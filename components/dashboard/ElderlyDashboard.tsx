'use client';

import { useState } from 'react';
import { DoseLog, Appointment, CareCircleMember, ElderlyProfile } from '@/types';
import { useSeniorMode } from '@/components/layout/SeniorModeContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatTime, formatDate } from '@/lib/utils';
import { CheckCircle2, Clock, Volume2, Pill, Calendar, Users, ShieldCheck } from 'lucide-react';

interface ElderlyDashboardProps {
  profile: ElderlyProfile;
  doses: DoseLog[];
  appointments: Appointment[];
  members: CareCircleMember[];
  onDoseUpdated: () => void;
}

export function ElderlyDashboard({
  profile,
  doses,
  appointments,
  members,
  onDoseUpdated,
}: Readonly<ElderlyDashboardProps>) {
  const { seniorMode, speakText, isSpeaking } = useSeniorMode();
  const [selectedDoseForConfirmation, setSelectedDoseForConfirmation] = useState<DoseLog | null>(
    null
  );
  const [recordingDose, setRecordingDose] = useState(false);
  const [recordSuccessMessage, setRecordSuccessMessage] = useState<string | null>(null);

  const pendingDoses = doses.filter((d) => d.status === 'pending' || d.status === 'upcoming');
  const takenDoses = doses.filter((d) => d.status === 'taken');
  const nextDose = pendingDoses[0] || null;

  const totalToday = doses.length;
  const takenCount = takenDoses.length;
  const adherenceTodayPct = totalToday > 0 ? Math.round((takenCount / totalToday) * 100) : 100;

  const upcomingAppointment = appointments.find((a) => a.status === 'scheduled') || null;

  const handleConfirmTaken = async () => {
    if (!selectedDoseForConfirmation) return;
    setRecordingDose(true);
    try {
      const res = await fetch('/api/doses/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elderlyProfileId: profile._id,
          medicationId: selectedDoseForConfirmation.medicationId,
          scheduledDate: selectedDoseForConfirmation.scheduledDate,
          scheduledTime: selectedDoseForConfirmation.scheduledTime,
          status: 'taken',
        }),
      });

      if (res.ok) {
        setRecordSuccessMessage(
          `Great job! ${selectedDoseForConfirmation.medicationName} is marked as taken.`
        );
        setSelectedDoseForConfirmation(null);
        onDoseUpdated();
        setTimeout(() => setRecordSuccessMessage(null), 4000);
      }
    } catch {
      alert('Could not record dose. Please try again.');
    } finally {
      setRecordingDose(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Welcome Greeting Banner */}
      <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-gradient-to-r from-teal-800 to-teal-900 p-6 text-white shadow-card sm:p-8 md:flex-row md:items-center">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-teal-700/60 px-3 py-1 text-xs font-semibold text-teal-100">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>CareCircle Daily Health Companion</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">
            {getGreeting()}, {profile.preferredName || profile.fullName}!
          </h1>
          <p className="mt-1 max-w-xl text-sm text-teal-100 sm:text-base">
            {totalToday === 0
              ? 'No medications scheduled for today. Enjoy your day!'
              : `You have completed ${takenCount} of ${totalToday} doses today (${adherenceTodayPct}% adherence).`}
          </p>
        </div>

        {/* Adherence Ring / Badge */}
        <div className="flex min-w-[140px] items-center justify-between self-stretch rounded-2xl border border-white/20 bg-white/10 p-4 text-center backdrop-blur-md sm:flex-col sm:justify-center sm:self-auto sm:p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-200">
            Today&apos;s Care
          </span>
          <span className="my-0.5 text-3xl font-extrabold text-white sm:text-4xl">
            {adherenceTodayPct}%
          </span>
          <span className="text-xs font-medium text-teal-100">
            {takenCount} of {totalToday} taken
          </span>
        </div>
      </div>

      {recordSuccessMessage && (
        <div className="animate-in fade-in flex items-center gap-3 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 text-emerald-900 duration-200">
          <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-emerald-600" />
          <p className="text-base font-bold">{recordSuccessMessage}</p>
        </div>
      )}

      {/* PROMINENT NEXT MEDICATION CARD (Center of attention for Elderly Individual) */}
      {nextDose ? (
        <div className="relative overflow-hidden rounded-2xl border-2 border-teal-600/30 bg-teal-50/50 p-6 shadow-card sm:p-8">
          <div className="absolute right-0 top-0 rounded-bl-xl bg-teal-700 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-white">
            Up Next
          </div>

          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold uppercase tracking-wider text-teal-800">
                  Scheduled for {formatTime(nextDose.scheduledTime)}
                </span>
                <Badge variant={nextDose.status}>{nextDose.status}</Badge>
              </div>

              <h2 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 sm:text-3xl">
                <Pill className="h-8 w-8 text-teal-700" />
                {nextDose.medicationName}
                <span className="text-lg font-normal text-slate-600">({nextDose.dosage})</span>
              </h2>

              <p className="max-w-xl text-base font-medium text-slate-700">
                {nextDose.instructions || 'Take with a glass of water as prescribed.'}
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
              {/* Read Aloud Button for Accessibility */}
              <button
                onClick={() =>
                  speakText(
                    `Upcoming medication: ${nextDose.medicationName}, dosage ${nextDose.dosage}, scheduled for ${formatTime(
                      nextDose.scheduledTime
                    )}. Instructions: ${nextDose.instructions || 'Take as prescribed.'}`
                  )
                }
                title="Read medication instructions out loud"
                className="flex h-14 items-center justify-center gap-2 rounded-xl border border-teal-300 bg-white px-5 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-50"
              >
                <Volume2 className={`h-5 w-5 ${isSpeaking ? 'animate-pulse text-teal-600' : ''}`} />
                <span>{isSpeaking ? 'Stop Reading' : 'Listen'}</span>
              </button>

              {/* Prominent Action Button: "I've taken my medicine" */}
              <Button
                size={seniorMode ? 'xl' : 'lg'}
                className="h-14 rounded-xl bg-teal-700 px-8 text-lg font-extrabold text-white shadow-md hover:bg-teal-800 sm:h-16"
                onClick={() => setSelectedDoseForConfirmation(nextDose)}
              >
                <CheckCircle2 className="mr-2 h-6 w-6" />
                I&apos;ve taken my medicine
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 text-center sm:p-8">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h3 className="text-xl font-bold text-emerald-950">All caught up for today!</h3>
          <p className="mx-auto max-w-md text-sm text-emerald-800">
            You have no pending doses remaining right now. Your care circle has been notified of
            your completed doses.
          </p>
        </div>
      )}

      {/* Main Grid: Today's Full Schedule + Upcoming Doctor Appointment */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2 cols): Today's Medication Timeline */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Clock className="h-5 w-5 text-teal-700" />
              Today&apos;s Medication Schedule
            </h3>
            <span className="text-xs font-semibold text-slate-500">{formatDate(new Date())}</span>
          </div>

          {doses.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-slate-500">
                No medications configured for this profile yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {doses.map((dose) => {
                const isTaken = dose.status === 'taken';
                const isMissed = dose.status === 'missed';
                let statusCardClass = 'border-slate-200 bg-white shadow-sm hover:border-teal-500';
                let statusIconClass = 'bg-teal-100 text-teal-800';
                if (isTaken) {
                  statusCardClass = 'border-slate-200 bg-slate-50/80 opacity-90';
                  statusIconClass = 'bg-emerald-100 text-emerald-800';
                } else if (isMissed) {
                  statusCardClass = 'border-rose-200 bg-rose-50/60';
                  statusIconClass = 'bg-rose-100 text-rose-800';
                }

                return (
                  <div
                    key={dose._id}
                    className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-all sm:p-5 ${statusCardClass}`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold ${statusIconClass}`}
                      >
                        {formatTime(dose.scheduledTime).split(' ')[0]}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-slate-900">
                            {dose.medicationName}
                          </h4>
                          <span className="text-xs font-medium text-slate-500">
                            {dose.dosage} ({dose.form})
                          </span>
                          <Badge variant={dose.status}>{dose.status}</Badge>
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-600">
                          {dose.instructions || 'Take as prescribed.'}
                        </p>
                        {isTaken && dose.recordedByName && (
                          <p className="mt-1 text-[11px] text-emerald-800">
                            Recorded by {dose.recordedByName} at{' '}
                            {formatTime(
                              dose.recordedAt
                                ? new Date(dose.recordedAt).toTimeString().substring(0, 5)
                                : dose.scheduledTime
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    {!isTaken && (
                      <Button
                        size="sm"
                        variant={isMissed ? 'danger' : 'outline'}
                        onClick={() => setSelectedDoseForConfirmation(dose)}
                      >
                        Mark Taken
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Appointments & Care Circle */}
        <div className="space-y-6">
          {/* Upcoming Appointment Widget */}
          <Card>
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                <Calendar className="h-4 w-4 text-teal-700" />
                Next Doctor Appointment
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {upcomingAppointment ? (
                <div className="space-y-3">
                  <div>
                    <h4 className="text-base font-bold text-slate-900">
                      Dr. {upcomingAppointment.doctorName}
                    </h4>
                    <p className="text-xs font-semibold text-teal-700">
                      {upcomingAppointment.hospitalClinicName}
                    </p>
                  </div>
                  <div className="space-y-1 rounded-lg bg-slate-50 p-2.5 text-xs">
                    <p className="font-bold text-slate-800">
                      {formatDate(upcomingAppointment.appointmentDate)} at{' '}
                      {formatTime(upcomingAppointment.appointmentTime)}
                    </p>
                    <p className="text-slate-500">{upcomingAppointment.location}</p>
                  </div>
                  {upcomingAppointment.preparationChecklist.length > 0 && (
                    <div className="pt-1">
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Checklist (
                        {upcomingAppointment.preparationChecklist.filter((c) => c.completed).length}
                        /{upcomingAppointment.preparationChecklist.length} ready)
                      </p>
                      <ul className="space-y-1 text-xs text-slate-700">
                        {upcomingAppointment.preparationChecklist.slice(0, 2).map((item) => (
                          <li key={item.id} className="flex items-center gap-1.5">
                            <span
                              className={item.completed ? 'text-emerald-600' : 'text-slate-400'}
                            >
                              {item.completed ? '✓' : '•'}
                            </span>
                            <span className={item.completed ? 'text-slate-400 line-through' : ''}>
                              {item.text}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="py-3 text-center text-xs text-slate-500">
                  No upcoming doctor appointments scheduled.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Care Circle Members */}
          <Card>
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                <Users className="h-4 w-4 text-teal-700" />
                Connected Care Circle
              </CardTitle>
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
                    {member.role === 'owner' ? 'Elderly (You)' : member.role}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Explicit Confirmation Dialog (Requirement: "Never automatically mark medication as taken") */}
      <Modal
        isOpen={!!selectedDoseForConfirmation}
        onClose={() => setSelectedDoseForConfirmation(null)}
        title="Confirm Dose Administered"
        description="Please confirm that this medication dose has actually been taken."
      >
        {selectedDoseForConfirmation && (
          <div className="space-y-5">
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
              <h4 className="text-lg font-bold text-teal-950">
                {selectedDoseForConfirmation.medicationName} ({selectedDoseForConfirmation.dosage})
              </h4>
              <p className="mt-1 text-xs text-teal-800">
                Scheduled for {formatTime(selectedDoseForConfirmation.scheduledTime)} on{' '}
                {selectedDoseForConfirmation.scheduledDate}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-700">
                {selectedDoseForConfirmation.instructions}
              </p>
            </div>

            <p className="text-xs text-slate-500">
              Recording this dose updates the CareCircle adherence record and notifies your family
              and caretakers that this medication has been safely taken.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setSelectedDoseForConfirmation(null)}
                disabled={recordingDose}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmTaken}
                isLoading={recordingDose}
                className="bg-teal-700 hover:bg-teal-800"
              >
                Yes, I Have Taken This Dose
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
