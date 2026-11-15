'use client';

import { useState } from 'react';
import { Appointment, AppointmentChecklistItem } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatTime, formatDate, getTodayDateString } from '@/lib/utils';
import {
  Calendar,
  Plus,
  CheckCircle2,
  XCircle,
  MapPin,
  Clock,
  ClipboardList,
  Trash2,
  CheckSquare,
  Square,
} from 'lucide-react';

interface AppointmentManagerProps {
  profileId: string;
  appointments: Appointment[];
  canManage: boolean;
  onRefresh: () => void;
}

export function AppointmentManager({
  profileId,
  appointments,
  canManage,
  onRefresh,
}: Readonly<AppointmentManagerProps>) {
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [doctorName, setDoctorName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [hospitalClinicName, setHospitalClinicName] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(getTodayDateString());
  const [appointmentTime, setAppointmentTime] = useState('10:00');
  const [location, setLocation] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [checklistText, setChecklistText] = useState(
    'Carry printed medication list\nBring previous test reports\nPrepare questions for doctor'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const openAddModal = () => {
    setDoctorName('');
    setSpecialty('');
    setHospitalClinicName('');
    setAppointmentDate(getTodayDateString());
    setAppointmentTime('10:00');
    setLocation('');
    setReason('');
    setNotes('');
    setChecklistText(
      'Carry printed medication list\nBring previous test reports\nPrepare questions for doctor'
    );
    setErrorMessage(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    const checklistItems: AppointmentChecklistItem[] = checklistText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text, i) => ({
        id: `check_${Date.now()}_${i}`,
        text,
        completed: false,
      }));

    try {
      const payload = {
        elderlyProfileId: profileId,
        doctorName,
        specialty,
        hospitalClinicName,
        appointmentDate,
        appointmentTime,
        location,
        reason,
        notes,
        preparationChecklist: checklistItems,
      };

      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to save appointment.');
        return;
      }

      setModalOpen(false);
      onRefresh();
    } catch {
      setErrorMessage('Network error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleChecklistItem = async (appt: Appointment, itemId: string) => {
    const updatedChecklist = appt.preparationChecklist.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );

    try {
      await fetch(`/api/appointments/${appt._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preparationChecklist: updatedChecklist }),
      });
      onRefresh();
    } catch {
      alert('Failed to update checklist item.');
    }
  };

  const handleUpdateStatus = async (apptId: string, status: 'completed' | 'cancelled') => {
    try {
      await fetch(`/api/appointments/${apptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      onRefresh();
    } catch {
      alert('Failed to update status.');
    }
  };

  const handleDelete = async (apptId: string) => {
    if (!confirm('Are you sure you want to delete this appointment?')) return;
    try {
      await fetch(`/api/appointments/${apptId}`, { method: 'DELETE' });
      onRefresh();
    } catch {
      alert('Failed to delete appointment.');
    }
  };

  const upcomingAppts = appointments.filter((a) => a.status === 'scheduled');
  const pastAppts = appointments.filter((a) => a.status !== 'scheduled');

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-slate-900 sm:text-3xl">
            <Calendar className="h-7 w-7 text-teal-700" />
            Medical Appointments
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Schedule clinic visits, track preparation checklists, and automatically dispatch 24h and
            2h email reminders.
          </p>
        </div>

        {canManage && (
          <Button onClick={openAddModal} className="gap-2 bg-teal-700 hover:bg-teal-800">
            <Plus className="h-4 w-4" />
            Schedule Appointment
          </Button>
        )}
      </div>

      {/* Upcoming Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">
          Upcoming Appointments ({upcomingAppts.length})
        </h2>

        {upcomingAppts.length === 0 ? (
          <Card className="py-10 text-center">
            <Calendar className="mx-auto mb-2 h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">
              No upcoming appointments scheduled.
            </p>
            {canManage && (
              <Button size="sm" onClick={openAddModal} className="mt-3 gap-1.5">
                <Plus className="h-4 w-4" />
                Schedule Now
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {upcomingAppts.map((appt) => (
              <Card
                key={appt._id}
                className="relative flex flex-col justify-between hover:border-teal-400"
              >
                <div>
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Dr. {appt.doctorName}</h3>
                      <p className="text-xs font-semibold text-teal-800">
                        {appt.hospitalClinicName}
                      </p>
                      {appt.specialty && <p className="text-xs text-slate-500">{appt.specialty}</p>}
                    </div>
                    <Badge variant="upcoming">Scheduled</Badge>
                  </div>

                  <div className="my-3 space-y-1.5 rounded-xl border border-teal-100 bg-teal-50/60 p-3 text-xs">
                    <div className="flex items-center gap-2 font-bold text-teal-950">
                      <Clock className="h-4 w-4 text-teal-700" />
                      <span>
                        {formatDate(appt.appointmentDate)} at {formatTime(appt.appointmentTime)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      <span>{appt.location}</span>
                    </div>
                    {appt.reason && (
                      <p className="pt-1 font-medium text-slate-700">Reason: {appt.reason}</p>
                    )}
                  </div>

                  {/* Preparation Checklist */}
                  {appt.preparationChecklist.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <ClipboardList className="h-3.5 w-3.5 text-teal-700" />
                        Appointment Preparation Checklist:
                      </p>
                      <div className="space-y-1 pl-1">
                        {appt.preparationChecklist.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => canManage && handleToggleChecklistItem(appt, item.id)}
                            className="flex w-full items-center gap-2 py-0.5 text-left text-xs transition-colors hover:text-teal-800"
                          >
                            {item.completed ? (
                              <CheckSquare className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                            ) : (
                              <Square className="h-4 w-4 flex-shrink-0 text-slate-400" />
                            )}
                            <span
                              className={
                                item.completed
                                  ? 'text-slate-400 line-through'
                                  : 'font-medium text-slate-800'
                              }
                            >
                              {item.text}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {canManage && (
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleUpdateStatus(appt._id, 'completed')}
                        className="text-xs"
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        Complete
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(appt._id, 'cancelled')}
                        className="text-xs text-rose-700 hover:bg-rose-50"
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" />
                        Cancel
                      </Button>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(appt._id)}
                      className="p-2 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Past / Completed Section */}
      {pastAppts.length > 0 && (
        <div className="space-y-3 border-t border-slate-200 pt-6">
          <h2 className="text-base font-bold text-slate-600">
            Past & Completed Appointments ({pastAppts.length})
          </h2>
          <div className="space-y-2">
            {pastAppts.map((appt) => (
              <div
                key={appt._id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600"
              >
                <div>
                  <span className="text-sm font-bold text-slate-800">Dr. {appt.doctorName}</span> •{' '}
                  <span>{appt.hospitalClinicName}</span> •{' '}
                  <span>{formatDate(appt.appointmentDate)}</span>
                </div>
                <Badge variant={appt.status === 'completed' ? 'success' : 'skipped'}>
                  {appt.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Appointment Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Schedule Doctor Appointment"
        description="Set clinic visit date, time, location, and preparation checklist."
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Doctor Name *"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              placeholder="e.g. Sarah Jenkins"
              required
            />
            <Input
              label="Specialty (Optional)"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="e.g. Cardiology, Ophthalmology"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Hospital / Clinic Name *"
              value={hospitalClinicName}
              onChange={(e) => setHospitalClinicName(e.target.value)}
              placeholder="e.g. St. Jude Medical Pavilion"
              required
            />
            <Input
              label="Clinic Location / Address *"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Suite 402, 1200 Healthcare Blvd"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Appointment Date *"
              type="date"
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
              required
            />
            <Input
              label="Appointment Time (24h) *"
              type="time"
              value={appointmentTime}
              onChange={(e) => setAppointmentTime(e.target.value)}
              required
            />
          </div>

          <Input
            label="Reason for Visit (Optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. 6-month blood pressure review"
          />

          <div className="space-y-1.5">
            <label htmlFor="appointment-checklist" className="text-xs font-bold text-slate-800">
              Preparation Checklist (One item per line)
            </label>
            <textarea
              id="appointment-checklist"
              value={checklistText}
              onChange={(e) => setChecklistText(e.target.value)}
              placeholder="Bring previous prescriptions&#10;Carry recent blood test results&#10;Confirm transportation"
              className="w-full rounded-lg border border-slate-300 p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-teal-600"
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting} className="bg-teal-700 hover:bg-teal-800">
              Schedule Appointment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
