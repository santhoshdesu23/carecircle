'use client';

import { useState } from 'react';
import { Medication, MedicationForm, MedicationFrequency } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatTime, getTodayDateString } from '@/lib/utils';
import { Pill, Plus, Pause, Play, Trash2, Edit2, Clock } from 'lucide-react';

interface MedicationManagerProps {
  profileId: string;
  medications: Medication[];
  canManage: boolean;
  onRefresh: () => void;
}

export function MedicationManager({
  profileId,
  medications,
  canManage,
  onRefresh,
}: Readonly<MedicationManagerProps>) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [form, setForm] = useState<MedicationForm>('tablet');
  const [instructions, setInstructions] = useState('');
  const [frequency, setFrequency] = useState<MedicationFrequency>('once_daily');
  const [scheduledTimesStr, setScheduledTimesStr] = useState('08:00');
  const [startDate, setStartDate] = useState(getTodayDateString());
  const [endDate, setEndDate] = useState('');
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(15);
  const [prescribingDoctor, setPrescribingDoctor] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingMed(null);
    setName('');
    setDosage('');
    setForm('tablet');
    setInstructions('');
    setFrequency('once_daily');
    setScheduledTimesStr('08:00');
    setStartDate(getTodayDateString());
    setEndDate('');
    setReminderMinutesBefore(15);
    setPrescribingDoctor('');
    setNotes('');
    setErrorMessage(null);
    setModalOpen(true);
  };

  const openEditModal = (med: Medication) => {
    setEditingMed(med);
    setName(med.name);
    setDosage(med.dosage);
    setForm(med.form);
    setInstructions(med.instructions);
    setFrequency(med.frequency);
    setScheduledTimesStr(med.scheduledTimes.join(', '));
    setStartDate(med.startDate);
    setEndDate(med.endDate || '');
    setReminderMinutesBefore(med.reminderMinutesBefore);
    setPrescribingDoctor(med.prescribingDoctor || '');
    setNotes(med.notes || '');
    setErrorMessage(null);
    setModalOpen(true);
  };

  const handleFrequencyChange = (f: MedicationFrequency) => {
    setFrequency(f);
    if (f === 'once_daily') setScheduledTimesStr('08:00');
    else if (f === 'twice_daily') setScheduledTimesStr('08:00, 20:00');
    else if (f === 'three_times_daily') setScheduledTimesStr('08:00, 13:00, 19:00');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const times = scheduledTimesStr
      .split(',')
      .map((t) => t.trim())
      .filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t));

    if (times.length === 0) {
      setErrorMessage('Please provide valid times in HH:mm 24-hour format (e.g. 08:00, 20:00).');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        elderlyProfileId: profileId,
        name,
        dosage,
        form,
        instructions,
        frequency,
        scheduledTimes: times,
        startDate,
        endDate: endDate || null,
        reminderMinutesBefore: Number(reminderMinutesBefore),
        prescribingDoctor,
        notes,
      };

      const url = editingMed ? `/api/medications/${editingMed._id}` : '/api/medications';
      const method = editingMed ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to save medication.');
        return;
      }

      setModalOpen(false);
      onRefresh();
    } catch {
      setErrorMessage('A network error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (med: Medication) => {
    const nextStatus = med.status === 'active' ? 'paused' : 'active';
    try {
      await fetch(`/api/medications/${med._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      onRefresh();
    } catch {
      alert('Failed to update status.');
    }
  };

  const handleDelete = async (medId: string) => {
    if (!confirm('Are you sure you want to remove this medication from the profile?')) return;
    try {
      await fetch(`/api/medications/${medId}`, { method: 'DELETE' });
      onRefresh();
    } catch {
      alert('Failed to delete medication.');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-slate-900 sm:text-3xl">
            <Pill className="h-7 w-7 text-teal-700" />
            Medication Management
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Configure prescription schedules, dose times, instructions, and reminder intervals.
          </p>
        </div>

        {canManage && (
          <Button onClick={openAddModal} className="gap-2 bg-teal-700 hover:bg-teal-800">
            <Plus className="h-4 w-4" />
            Add Medication
          </Button>
        )}
      </div>

      {/* Medication Cards Grid */}
      {medications.length === 0 ? (
        <Card className="py-12 text-center">
          <Pill className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <h3 className="text-lg font-bold text-slate-800">No medications added yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Add the daily medications, dosages, and times for this profile to begin tracking
            adherence.
          </p>
          {canManage && (
            <Button onClick={openAddModal} className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Add First Medication
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {medications.map((med) => {
            const isPaused = med.status === 'paused';
            return (
              <Card
                key={med._id}
                className={`relative flex flex-col justify-between transition-all ${
                  isPaused
                    ? 'border-slate-300 bg-slate-50/80 opacity-75'
                    : 'bg-white hover:border-teal-400'
                }`}
              >
                <div>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{med.name}</h3>
                      <span className="text-xs font-semibold text-slate-500">
                        {med.dosage} • {med.form}
                      </span>
                    </div>
                    <Badge variant={isPaused ? 'warning' : 'success'}>{med.status}</Badge>
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs text-slate-700">{med.instructions}</p>

                  <div className="mt-4 space-y-1.5 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Clock className="h-3.5 w-3.5 text-teal-700" />
                      <span>Times: {med.scheduledTimes.map((t) => formatTime(t)).join(', ')}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Frequency:</span>{' '}
                      <span className="capitalize">{med.frequency.replaceAll('_', ' ')}</span>
                    </div>
                    {med.prescribingDoctor && (
                      <div>
                        <span className="text-slate-500">Doctor:</span> {med.prescribingDoctor}
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500">Reminders:</span> {med.reminderMinutesBefore}
                      m before
                    </div>
                  </div>
                </div>

                {canManage && (
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleStatus(med)}
                      className="gap-1.5 text-xs"
                    >
                      {isPaused ? (
                        <Play className="h-3.5 w-3.5 text-teal-700" />
                      ) : (
                        <Pause className="h-3.5 w-3.5 text-amber-600" />
                      )}
                      {isPaused ? 'Resume' : 'Pause'}
                    </Button>

                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditModal(med)}
                        className="p-2 text-slate-600 hover:text-teal-700"
                        title="Edit Medication"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(med._id)}
                        className="p-2 text-slate-400 hover:text-rose-600"
                        title="Delete Medication"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Medication Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingMed ? 'Edit Medication' : 'Add New Medication'}
        description="Enter prescription details, timing, and caregiver instructions."
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
              label="Medication Name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lisinopril, Metformin"
              required
            />
            <Input
              label="Dosage *"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder="e.g. 10mg, 1 tablet, 5ml"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="medication-form-select" className="text-xs font-bold text-slate-800">
                Form *
              </label>
              <select
                id="medication-form-select"
                value={form}
                onChange={(e) => setForm(e.target.value as MedicationForm)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="tablet">Tablet</option>
                <option value="capsule">Capsule</option>
                <option value="liquid">Liquid</option>
                <option value="injection">Injection</option>
                <option value="inhaler">Inhaler</option>
                <option value="drops">Drops</option>
                <option value="topical">Topical</option>
                <option value="patch">Patch</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="medication-frequency-select"
                className="text-xs font-bold text-slate-800"
              >
                Frequency *
              </label>
              <select
                id="medication-frequency-select"
                value={frequency}
                onChange={(e) => handleFrequencyChange(e.target.value as MedicationFrequency)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="once_daily">Once Daily</option>
                <option value="twice_daily">Twice Daily</option>
                <option value="three_times_daily">Three Times Daily</option>
                <option value="four_times_daily">Four Times Daily</option>
                <option value="custom">Custom Times</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="medication-scheduled-times"
              className="text-xs font-bold text-slate-800"
            >
              Scheduled Times (24h format, comma-separated) *
            </label>
            <Input
              id="medication-scheduled-times"
              value={scheduledTimesStr}
              onChange={(e) => setScheduledTimesStr(e.target.value)}
              placeholder="08:00, 20:00"
              helperText="Examples: 08:00 (for 8 AM), 12:30 (for 12:30 PM), 20:00 (for 8 PM)"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="medication-instructions" className="text-xs font-bold text-slate-800">
              Patient Instructions *
            </label>
            <textarea
              id="medication-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Take 1 tablet with full glass of water after breakfast."
              className="w-full rounded-lg border border-slate-300 p-3 text-xs focus:outline-none focus:ring-2 focus:ring-teal-600"
              rows={2}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Start Date *"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Input
              label="End Date (Optional)"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <Input
              label="Reminder Notice (Minutes)"
              type="number"
              min={0}
              max={120}
              value={reminderMinutesBefore}
              onChange={(e) => setReminderMinutesBefore(Number(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Prescribing Doctor (Optional)"
              value={prescribingDoctor}
              onChange={(e) => setPrescribingDoctor(e.target.value)}
              placeholder="Dr. Sarah Jenkins"
            />
            <Input
              label="Additional Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. For cholesterol control"
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
              {editingMed ? 'Update Medication' : 'Save Medication'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
