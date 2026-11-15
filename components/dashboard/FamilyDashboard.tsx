'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  DoseLog,
  Appointment,
  CareCircleMember,
  ElderlyProfile,
  CareNote,
  MemberPermissions,
  AdherenceStats,
} from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatTime, formatDate } from '@/lib/utils';
import {
  Pill,
  Calendar,
  AlertTriangle,
  PlusCircle,
  FileText,
  UserCheck,
  MessageSquare,
} from 'lucide-react';

interface FamilyDashboardProps {
  profile: ElderlyProfile;
  doses: DoseLog[];
  appointments: Appointment[];
  members: CareCircleMember[];
  careNotes: CareNote[];
  stats: AdherenceStats;
  permissions: MemberPermissions;
  isOwner: boolean;
  currentUserRole: string;
  onRefresh: () => void;
}

export function FamilyDashboard({
  profile,
  doses,
  appointments,
  members,
  careNotes,
  stats,
  permissions,
  isOwner,
  currentUserRole,
  onRefresh,
}: Readonly<FamilyDashboardProps>) {
  const [selectedDoseToLog, setSelectedDoseToLog] = useState<DoseLog | null>(null);
  const [doseStatusChoice, setDoseStatusChoice] = useState<'taken' | 'skipped'>('taken');
  const [doseNote, setDoseNote] = useState('');
  const [submittingDose, setSubmittingDose] = useState(false);

  const [handoverNoteModal, setHandoverNoteModal] = useState(false);
  const [noteCategory, setNoteCategory] = useState<
    'handover' | 'general' | 'medical_observation' | 'urgent'
  >('handover');
  const [noteContent, setNoteContent] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  const missedDoses = doses.filter((d) => d.status === 'missed');
  const upcomingAppointments = appointments.filter((a) => a.status === 'scheduled');

  const canManageMeds = isOwner || permissions.canManageMedications;
  const canRecordDoses = isOwner || permissions.canRecordDoses;
  const canManageAppts = isOwner || permissions.canManageAppointments;
  const canLeaveNotes = isOwner || permissions.canLeaveNotes;

  const handleRecordDose = async () => {
    if (!selectedDoseToLog) return;
    setSubmittingDose(true);
    try {
      const res = await fetch('/api/doses/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elderlyProfileId: profile._id,
          medicationId: selectedDoseToLog.medicationId,
          scheduledDate: selectedDoseToLog.scheduledDate,
          scheduledTime: selectedDoseToLog.scheduledTime,
          status: doseStatusChoice,
          notes: doseNote,
        }),
      });

      if (res.ok) {
        setSelectedDoseToLog(null);
        setDoseNote('');
        onRefresh();
      }
    } catch {
      alert('Failed to record dose.');
    } finally {
      setSubmittingDose(false);
    }
  };

  const handleCreateCareNote = async () => {
    if (!noteContent.trim()) return;
    setSubmittingNote(true);
    try {
      const res = await fetch('/api/care-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elderlyProfileId: profile._id,
          category: noteCategory,
          content: noteContent,
        }),
      });

      if (res.ok) {
        setHandoverNoteModal(false);
        setNoteContent('');
        onRefresh();
      }
    } catch {
      alert('Failed to post care note.');
    } finally {
      setSubmittingNote(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Overview Banner */}
      <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card sm:p-8 md:flex-row md:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-teal-700">
              Care Circle Dashboard
            </span>
            <span className="text-xs font-medium capitalize text-slate-500">
              Role: {currentUserRole}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            {profile.fullName}&apos;s Health Overview
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Emergency Contact: {profile.emergencyContact.name} (
            {profile.emergencyContact.relationship}) -{' '}
            <span className="font-semibold text-slate-900">
              {profile.emergencyContact.phoneNumber || 'Not provided'}
            </span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2.5">
          {canLeaveNotes && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHandoverNoteModal(true)}
              className="gap-1.5"
            >
              <FileText className="h-4 w-4 text-teal-700" />
              Leave Handover Note
            </Button>
          )}

          {canManageMeds && (
            <Link href="/medications">
              <Button size="sm" className="gap-1.5 bg-teal-700 hover:bg-teal-800">
                <PlusCircle className="h-4 w-4" />
                Manage Meds
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Missed Medication Alert Banner (Requirement: Missed medication alerts) */}
      {missedDoses.length > 0 && (
        <div className="animate-in fade-in flex flex-col items-start justify-between gap-4 rounded-2xl border-2 border-rose-300 bg-rose-50/80 p-5 shadow-sm sm:flex-row sm:items-center sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 rounded-xl bg-rose-600 p-2.5 text-white">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-rose-950 sm:text-lg">
                Attention: {missedDoses.length} Medication Dose{missedDoses.length > 1 ? 's' : ''}{' '}
                Missed
              </h3>
              <p className="mt-0.5 text-xs text-rose-800 sm:text-sm">
                The grace period expired without confirmation for{' '}
                <strong>{missedDoses.map((m) => m.medicationName).join(', ')}</strong>. Please check
                in with {profile.preferredName || profile.fullName}. Do not administer a double dose
                without physician guidance.
              </p>
            </div>
          </div>
          {canRecordDoses && (
            <Button
              size="sm"
              variant="danger"
              className="whitespace-nowrap"
              onClick={() => setSelectedDoseToLog(missedDoses[0])}
            >
              Resolve Dose Log
            </Button>
          )}
        </div>
      )}

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            7-Day Adherence
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-teal-700">
              {stats.adherencePercentage}%
            </span>
            <span className="text-xs text-slate-500">recorded</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-teal-600 transition-all"
              style={{ width: `${stats.adherencePercentage}%` }}
            />
          </div>
        </Card>

        <Card className="p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Today&apos;s Status
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {doses.filter((d) => d.status === 'taken').length}/{doses.length}
            </span>
            <span className="text-xs text-slate-500">doses taken</span>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {doses.filter((d) => d.status === 'pending' || d.status === 'upcoming').length} pending
          </p>
        </Card>

        <Card className="p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Adherence Streak
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-600">
              {stats.currentStreakDays}
            </span>
            <span className="text-xs text-slate-500">days streak</span>
          </div>
          <p className="mt-3 text-xs text-slate-500">Consecutive completed days</p>
        </Card>

        <Card className="p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Care Circle Team
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{members.length}</span>
            <span className="text-xs text-slate-500">active members</span>
          </div>
          <p className="mt-3 text-xs text-slate-500">Caretakers & family members</p>
        </Card>
      </div>

      {/* Main Grid: Doses + Handover Notes + Upcoming Appointments */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2 Cols): Today's Schedule with On-Behalf Logging */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <Pill className="h-5 w-5 text-teal-700" />
                  Today&apos;s Medication Regimen
                </CardTitle>
                <p className="mt-0.5 text-xs text-slate-500">
                  Real-time status of scheduled medications for {formatDate(new Date())}
                </p>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {doses.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  No medications scheduled for today.
                </p>
              ) : (
                <div className="space-y-3">
                  {doses.map((dose) => (
                    <div
                      key={dose._id}
                      className="flex flex-col items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 text-xs font-bold text-teal-800">
                          {formatTime(dose.scheduledTime).split(' ')[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{dose.medicationName}</span>
                            <span className="text-xs text-slate-500">{dose.dosage}</span>
                            <Badge variant={dose.status}>{dose.status}</Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-600">{dose.instructions}</p>
                          {dose.recordedByName && (
                            <p className="mt-1 text-[11px] text-teal-700">
                              Recorded by {dose.recordedByName} ({dose.recordedRole})
                            </p>
                          )}
                        </div>
                      </div>

                      {canRecordDoses && dose.status !== 'taken' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedDoseToLog(dose)}
                          className="self-end text-xs sm:self-center"
                        >
                          Record Dose
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Caregiver Handover Notes Feed (Innovative Feature B) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <MessageSquare className="h-5 w-5 text-teal-700" />
                  Caregiver Handover Notes
                </CardTitle>
                <p className="mt-0.5 text-xs text-slate-500">
                  Observations, vital updates, and handovers between caretakers & family
                </p>
              </div>
              {canLeaveNotes && (
                <Button size="sm" variant="outline" onClick={() => setHandoverNoteModal(true)}>
                  + Add Note
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-4">
              {careNotes.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No care notes posted yet.</p>
              ) : (
                <div className="space-y-3">
                  {careNotes.slice(0, 5).map((note) => (
                    <div
                      key={note._id}
                      className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{note.authorName}</span>
                          <span className="rounded bg-teal-100 px-2 py-0.5 text-[10px] font-bold uppercase text-teal-800">
                            {note.category}
                          </span>
                        </div>
                        <span className="text-slate-400">
                          {new Date(note.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-700">{note.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Appointments & Care Circle */}
        <div className="space-y-6">
          {/* Upcoming Appointments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Calendar className="h-4 w-4 text-teal-700" />
                Upcoming Appointments
              </CardTitle>
              {canManageAppts && (
                <Link href="/appointments">
                  <Button size="sm" variant="ghost" className="text-xs">
                    View All
                  </Button>
                </Link>
              )}
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {upcomingAppointments.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-500">
                  No upcoming appointments scheduled.
                </p>
              ) : (
                upcomingAppointments.slice(0, 3).map((appt) => (
                  <div
                    key={appt._id}
                    className="space-y-1 rounded-lg border border-slate-200/80 bg-slate-50/50 p-3"
                  >
                    <p className="text-xs font-bold text-slate-900">Dr. {appt.doctorName}</p>
                    <p className="text-[11px] font-semibold text-teal-700">
                      {appt.hospitalClinicName}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      {formatDate(appt.appointmentDate)} at {formatTime(appt.appointmentTime)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Connected Care Circle */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <UserCheck className="h-4 w-4 text-teal-700" />
                Care Circle Members
              </CardTitle>
              <Link href="/care-circle">
                <Button size="sm" variant="ghost" className="text-xs">
                  Manage
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {members.map((member) => (
                <div key={member._id} className="flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-800">{member.userName}</p>
                    <p className="capitalize text-slate-500">
                      {member.relationshipToElderly || member.role}
                    </p>
                  </div>
                  <Badge variant={member.role === 'owner' ? 'default' : 'info'}>
                    {member.role}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Record Dose Modal (Caretaker/Family on-behalf logging) */}
      <Modal
        isOpen={!!selectedDoseToLog}
        onClose={() => setSelectedDoseToLog(null)}
        title="Record Dose on Behalf of Elder"
        description="Explicitly record dose administration status for the healthcare log."
      >
        {selectedDoseToLog && (
          <div className="space-y-4">
            <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
              <p className="text-sm font-bold text-slate-900">{selectedDoseToLog.medicationName}</p>
              <p className="text-slate-600">
                Scheduled: {formatTime(selectedDoseToLog.scheduledTime)} on{' '}
                {selectedDoseToLog.scheduledDate}
              </p>
              <p className="font-medium text-slate-600">{selectedDoseToLog.instructions}</p>
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-bold text-slate-700">Dose Status</span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDoseStatusChoice('taken')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
                    doseStatusChoice === 'taken'
                      ? 'border-emerald-400 bg-emerald-100 text-emerald-900'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  Administered / Taken
                </button>
                <button
                  type="button"
                  onClick={() => setDoseStatusChoice('skipped')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
                    doseStatusChoice === 'skipped'
                      ? 'border-amber-400 bg-amber-100 text-amber-900'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  Skipped (e.g. Doctor Advice)
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="dose-note-textarea" className="text-xs font-bold text-slate-700">
                Notes (Optional)
              </label>
              <textarea
                id="dose-note-textarea"
                value={doseNote}
                onChange={(e) => setDoseNote(e.target.value)}
                placeholder="e.g. Taken with oatmeal; patient reported mild drowsiness."
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-600"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedDoseToLog(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleRecordDose} isLoading={submittingDose}>
                Save Dose Record
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Handover Note Modal */}
      <Modal
        isOpen={handoverNoteModal}
        onClose={() => setHandoverNoteModal(false)}
        title="Leave Caregiver Handover Note"
        description="Share observations or shift handover details with the rest of the Care Circle."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="note-category-select" className="text-xs font-bold text-slate-700">
              Note Category
            </label>
            <select
              id="note-category-select"
              value={noteCategory}
              onChange={(e) => setNoteCategory(e.target.value as any)}
              className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs font-medium"
            >
              <option value="handover">Shift / Daily Handover</option>
              <option value="medical_observation">Medical Observation</option>
              <option value="urgent">Urgent / Important Alert</option>
              <option value="general">General Note</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="note-content-textarea" className="text-xs font-bold text-slate-700">
              Content
            </label>
            <textarea
              id="note-content-textarea"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="e.g. Morning vitals: BP 124/80, pulse 72. Eleanor ate a full breakfast and was in good spirits."
              className="w-full rounded-lg border border-slate-300 p-3 text-xs focus:outline-none focus:ring-2 focus:ring-teal-600"
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setHandoverNoteModal(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateCareNote} isLoading={submittingNote}>
              Post Note
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
