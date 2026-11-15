import {
  getDoseLogsCollection,
  getMedicationsCollection,
  getElderlyProfilesCollection,
} from '@/lib/database/collections';
import { DoseLog, DoseStatus, AdherenceStats, CircleMemberRole } from '@/types';
import { logAuditEvent } from '@/lib/audit';
import { parseDateTimeInTimezone } from '@/lib/utils';

export async function syncDosesForDate(
  elderlyProfileId: string,
  dateStr: string // YYYY-MM-DD
): Promise<DoseLog[]> {
  const medicationsCol = await getMedicationsCollection();
  const doseLogsCol = await getDoseLogsCollection();
  const profilesCol = await getElderlyProfilesCollection();

  const profile = await profilesCol.findOne({ _id: elderlyProfileId });
  const timezone = profile?.timezone ?? 'UTC';

  // Find all active medications for this profile
  const medications = await medicationsCol
    .find({
      elderlyProfileId,
      status: 'active',
      startDate: { $lte: dateStr },
      $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: dateStr } }],
    })
    .toArray();

  const now = new Date();

  await Promise.all(
    medications.flatMap((med) =>
      med.scheduledTimes.map(async (timeStr) => {
        const scheduledDateTime = parseDateTimeInTimezone(dateStr, timeStr, timezone);
        const existing = await doseLogsCol.findOne({
          medicationId: med._id,
          scheduledDate: dateStr,
          scheduledTime: timeStr,
        });

        if (!existing) {
          // Calculate initial status
          let initialStatus: DoseStatus = 'upcoming';
          const graceEnd = new Date(scheduledDateTime.getTime() + 60 * 60 * 1000); // 60 min default grace
          if (now > graceEnd) {
            initialStatus = 'missed';
          } else if (now >= scheduledDateTime) {
            initialStatus = 'pending';
          }

          const newDose: DoseLog = {
            _id: `dose_${med._id}_${dateStr}_${timeStr.replace(':', '')}`,
            elderlyProfileId,
            medicationId: med._id,
            medicationName: med.name,
            dosage: med.dosage,
            form: med.form,
            instructions: med.instructions,
            scheduledDate: dateStr,
            scheduledTime: timeStr,
            scheduledDateTime,
            status: initialStatus,
            gracePeriodMinutes: 60,
            missedAlertSent: initialStatus === 'missed',
            upcomingReminderSent: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          try {
            await doseLogsCol.insertOne(newDose as any);
          } catch (_err) {
            // Expected: Ignore duplicate key collision if concurrent sync occurs
          }
        }
      })
    )
  );

  // Fetch updated doses for this day
  return doseLogsCol
    .find({
      elderlyProfileId,
      scheduledDate: dateStr,
    })
    .sort({ scheduledTime: 1 })
    .toArray();
}

export interface RecordDoseParams {
  elderlyProfileId: string;
  medicationId: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'taken' | 'skipped';
  recordedByUserId: string;
  recordedByName: string;
  recordedRole: CircleMemberRole;
  notes?: string;
}

export async function recordDoseEvent(params: RecordDoseParams): Promise<DoseLog> {
  const doseLogsCol = await getDoseLogsCollection();
  const medCol = await getMedicationsCollection();
  const profilesCol = await getElderlyProfilesCollection();

  // Validate that medication exists and strictly belongs to this elderlyProfileId
  const med = await medCol.findOne({ _id: params.medicationId });
  if (!med || med.elderlyProfileId !== params.elderlyProfileId) {
    throw new Error('Medication not found or does not belong to the specified elderly profile.');
  }

  const profile = await profilesCol.findOne({ _id: params.elderlyProfileId });
  const timezone = profile?.timezone ?? 'UTC';
  const scheduledDateTime = parseDateTimeInTimezone(
    params.scheduledDate,
    params.scheduledTime,
    timezone
  );

  const now = new Date();
  const doseId = `dose_${params.medicationId}_${params.scheduledDate}_${params.scheduledTime.replace(':', '')}`;

  // Atomic findOneAndUpdate with upsert ensures concurrent caretakers cannot create duplicates
  const result = await doseLogsCol.findOneAndUpdate(
    {
      medicationId: params.medicationId,
      scheduledDate: params.scheduledDate,
      scheduledTime: params.scheduledTime,
    },
    {
      $set: {
        status: params.status,
        recordedAt: now,
        recordedByUserId: params.recordedByUserId,
        recordedByName: params.recordedByName,
        recordedRole: params.recordedRole,
        notes: params.notes,
        updatedAt: now,
      },
      $setOnInsert: {
        _id: doseId,
        elderlyProfileId: params.elderlyProfileId,
        medicationName: med.name,
        dosage: med.dosage,
        form: med.form,
        instructions: med.instructions,
        scheduledDateTime,
        gracePeriodMinutes: 60,
        missedAlertSent: false,
        upcomingReminderSent: false,
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  const dose = (result || (await doseLogsCol.findOne({ _id: doseId }))) as DoseLog;

  await logAuditEvent({
    elderlyProfileId: params.elderlyProfileId,
    actorUserId: params.recordedByUserId,
    actorName: params.recordedByName,
    actorEmail: '',
    action: params.status === 'taken' ? 'DOSE_RECORDED_TAKEN' : 'DOSE_RECORDED_SKIPPED',
    details: {
      medicationId: params.medicationId,
      medicationName: dose.medicationName,
      scheduledDate: params.scheduledDate,
      scheduledTime: params.scheduledTime,
      status: params.status,
      recordedRole: params.recordedRole,
    },
  });

  return dose;
}

export async function cancelPendingDosesForMedication(
  medicationId: string,
  elderlyProfileId: string
): Promise<number> {
  const doseLogsCol = await getDoseLogsCollection();
  const result = await doseLogsCol.deleteMany({
    medicationId,
    elderlyProfileId,
    status: { $in: ['upcoming', 'pending'] },
  });
  return result.deletedCount;
}

export async function calculateAdherenceStats(
  elderlyProfileId: string,
  days: number = 7
): Promise<AdherenceStats> {
  const doseLogsCol = await getDoseLogsCollection();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  const doses = await doseLogsCol
    .find({
      elderlyProfileId,
      scheduledDate: { $gte: startStr, $lte: endStr },
    })
    .toArray();

  const total = doses.length;
  const taken = doses.filter((d) => d.status === 'taken').length;
  const missed = doses.filter((d) => d.status === 'missed').length;
  const skipped = doses.filter((d) => d.status === 'skipped').length;
  const pending = doses.filter((d) => d.status === 'pending' || d.status === 'upcoming').length;

  const validEvaluated = taken + missed + skipped;
  const adherencePercentage = validEvaluated > 0 ? Math.round((taken / validEvaluated) * 100) : 100;

  // Calculate streak: consecutive days looking backwards from today
  let currentStreakDays = 0;
  for (let i = 0; i < 30; i++) {
    const checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - i);
    const dayStr = checkDate.toISOString().split('T')[0];
    const dayDoses = doses.filter((d) => d.scheduledDate === dayStr);
    if (dayDoses.length === 0) continue;
    const allTaken = dayDoses.every((d) => d.status === 'taken');
    if (allTaken) {
      currentStreakDays++;
    } else {
      break;
    }
  }

  return {
    totalScheduled: total,
    taken,
    missed,
    skipped,
    pending,
    adherencePercentage,
    currentStreakDays,
  };
}
