import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSession } from '@/lib/auth/session';
import {
  getMedicationsCollection,
  getAppointmentsCollection,
  getCareNotesCollection,
} from '@/lib/database/collections';
import { getTodayDateString } from '@/lib/utils';
import { syncDosesForDate } from '@/lib/doses';
import { verifyProfileAccess } from '@/lib/permissions';
import { Medication, Appointment, CareNote } from '@/types';

export async function POST(req: NextRequest) {
  // Disable public seed functionality in production
  if (process.env.NODE_ENV === 'production') {
    const adminSecret = process.env.ADMIN_SEED_SECRET;
    const providedSecret = req.headers.get('x-admin-seed-secret');

    const isValidSecret =
      adminSecret &&
      providedSecret &&
      Buffer.from(providedSecret).length === Buffer.from(adminSecret).length &&
      crypto.timingSafeEqual(Buffer.from(providedSecret), Buffer.from(adminSecret));

    if (!isValidSecret) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Seed functionality is disabled in production environments without explicit administrative authorization.',
        },
        { status: 403 }
      );
    }
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profileId = session.activeProfileId;
  if (!profileId) {
    return NextResponse.json({ error: 'No active profile found for this user.' }, { status: 400 });
  }

  // Verify access and permissions on profile
  const access = await verifyProfileAccess(session.userId, profileId);
  if (!access.hasAccess || (!access.isOwner && !access.permissions.canManageMedications)) {
    return NextResponse.json(
      { error: 'You do not have permission to modify records for this profile.' },
      { status: 403 }
    );
  }

  const todayStr = getTodayDateString();
  const medCol = await getMedicationsCollection();
  const apptCol = await getAppointmentsCollection();
  const notesCol = await getCareNotesCollection();

  // 1. Seed Medications
  const sampleMeds: Medication[] = [
    {
      _id: `med_${profileId}_lisinopril`,
      elderlyProfileId: profileId,
      name: 'Lisinopril',
      dosage: '10mg',
      form: 'tablet',
      instructions: 'Take 1 tablet every morning with a full glass of water after breakfast.',
      frequency: 'once_daily',
      scheduledTimes: ['08:30'],
      startDate: todayStr,
      endDate: null,
      status: 'active',
      reminderMinutesBefore: 15,
      notes: 'For blood pressure control.',
      prescribingDoctor: 'Dr. Sarah Jenkins',
      color: '#0D9488',
      createdByUserId: session.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: `med_${profileId}_metformin`,
      elderlyProfileId: profileId,
      name: 'Metformin',
      dosage: '500mg',
      form: 'tablet',
      instructions: 'Take with food to minimize gastrointestinal discomfort.',
      frequency: 'twice_daily',
      scheduledTimes: ['12:30', '19:30'],
      startDate: todayStr,
      endDate: null,
      status: 'active',
      reminderMinutesBefore: 15,
      notes: 'Blood sugar regulation.',
      prescribingDoctor: 'Dr. Marcus Chen',
      color: '#3B82F6',
      createdByUserId: session.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: `med_${profileId}_atorvastatin`,
      elderlyProfileId: profileId,
      name: 'Atorvastatin',
      dosage: '20mg',
      form: 'tablet',
      instructions: 'Take 1 tablet at night before bedtime.',
      frequency: 'once_daily',
      scheduledTimes: ['21:00'],
      startDate: todayStr,
      endDate: null,
      status: 'active',
      reminderMinutesBefore: 15,
      notes: 'Cholesterol management.',
      prescribingDoctor: 'Dr. Sarah Jenkins',
      color: '#8B5CF6',
      createdByUserId: session.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await Promise.all(
    sampleMeds.map((m) => medCol.updateOne({ _id: m._id }, { $set: m }, { upsert: true }))
  );

  // 2. Sync today's doses
  await syncDosesForDate(profileId, todayStr);

  // 3. Seed Appointments
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 5);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];

  const inTwoDays = new Date();
  inTwoDays.setDate(inTwoDays.getDate() + 2);
  const inTwoDaysStr = inTwoDays.toISOString().split('T')[0];

  const sampleAppts: Appointment[] = [
    {
      _id: `appt_${profileId}_cardio`,
      elderlyProfileId: profileId,
      doctorName: 'Sarah Jenkins',
      specialty: 'Cardiology',
      hospitalClinicName: 'St. Jude Heart & Vascular Center',
      appointmentDate: nextWeekStr,
      appointmentTime: '10:30',
      location: 'Suite 402, 1200 Healthcare Blvd',
      reason: 'Routine quarterly cardiovascular review & blood pressure check',
      notes: 'Bring current medication log and previous ECG report.',
      preparationChecklist: [
        { id: '1', text: 'Carry printed medication list from CareCircle', completed: true },
        { id: '2', text: 'Bring morning blood pressure logbook', completed: false },
        { id: '3', text: 'Confirm transportation pickup at 09:45 AM', completed: false },
      ],
      status: 'scheduled',
      remindersSent: { reminder24h: false, reminder2h: false },
      createdByUserId: session.userId,
      createdByName: session.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: `appt_${profileId}_eye`,
      elderlyProfileId: profileId,
      doctorName: 'Marcus Chen',
      specialty: 'Ophthalmology',
      hospitalClinicName: 'Metropolitan Eye Clinic',
      appointmentDate: inTwoDaysStr,
      appointmentTime: '14:00',
      location: 'Building B, 450 Vision Way',
      reason: 'Annual vision exam & glaucoma screening',
      notes: 'Eyes will be dilated; family member should accompany for driving.',
      preparationChecklist: [
        { id: '1', text: 'Bring sunglasses for post-dilation glare', completed: false },
        { id: '2', text: 'Have daughter Clara accompany for the drive home', completed: true },
      ],
      status: 'scheduled',
      remindersSent: { reminder24h: false, reminder2h: false },
      createdByUserId: session.userId,
      createdByName: session.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await Promise.all(
    sampleAppts.map((a) => apptCol.updateOne({ _id: a._id }, { $set: a }, { upsert: true }))
  );

  // 4. Seed Care Notes
  const sampleNotes: CareNote[] = [
    {
      _id: `note_${profileId}_1`,
      elderlyProfileId: profileId,
      authorUserId: session.userId,
      authorName: session.name,
      authorRole: 'owner',
      category: 'handover',
      content:
        'Morning blood pressure was 122/78 mmHg. Eleanor had a hearty breakfast and enjoyed a 20-minute walk in the garden.',
      createdAt: new Date(Date.now() - 3 * 3600 * 1000),
      updatedAt: new Date(Date.now() - 3 * 3600 * 1000),
    },
    {
      _id: `note_${profileId}_2`,
      elderlyProfileId: profileId,
      authorUserId: session.userId,
      authorName: 'Nurse Clara (Visiting Caretaker)',
      authorRole: 'caretaker',
      category: 'medical_observation',
      content:
        'Refilled the weekly pill organizer. Noticed slight ankle swelling; recommended keeping legs elevated during evening reading.',
      createdAt: new Date(Date.now() - 24 * 3600 * 1000),
      updatedAt: new Date(Date.now() - 24 * 3600 * 1000),
    },
  ];

  await Promise.all(
    sampleNotes.map((n) => notesCol.updateOne({ _id: n._id }, { $set: n }, { upsert: true }))
  );

  return NextResponse.json({
    success: true,
    message: 'Sample healthcare schedule, appointments, and care notes loaded successfully!',
  });
}
