'use client';

import { AuditLog } from '@/types';
import { Card } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Pill,
  UserPlus,
  FileText,
  Activity,
} from 'lucide-react';

interface CareTimelineProps {
  events: AuditLog[];
  elderlyName: string;
}

export function CareTimeline({ events, elderlyName }: Readonly<CareTimelineProps>) {
  const getEventIcon = (action: string) => {
    switch (action) {
      case 'DOSE_RECORDED_TAKEN':
        return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      case 'DOSE_RECORDED_SKIPPED':
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'MEDICATION_CREATED':
      case 'MEDICATION_UPDATED':
      case 'MEDICATION_STATUS_CHANGED':
        return <Pill className="h-4 w-4 text-teal-700" />;
      case 'APPOINTMENT_CREATED':
      case 'APPOINTMENT_UPDATED':
      case 'APPOINTMENT_STATUS_CHANGED':
        return <Calendar className="h-4 w-4 text-blue-600" />;
      case 'MEMBER_JOINED_VIA_PASSCODE':
      case 'INVITATION_GENERATED':
      case 'MEMBER_REVOKED':
        return <UserPlus className="h-4 w-4 text-purple-600" />;
      case 'CARE_NOTE_CREATED':
        return <FileText className="h-4 w-4 text-slate-700" />;
      default:
        return <Activity className="h-4 w-4 text-slate-500" />;
    }
  };

  const formatEventTitle = (event: AuditLog) => {
    switch (event.action) {
      case 'DOSE_RECORDED_TAKEN':
        return `Medication dose recorded as taken`;
      case 'DOSE_RECORDED_SKIPPED':
        return `Medication dose marked as skipped`;
      case 'MEDICATION_CREATED':
        return `New medication added: ${event.details?.name ?? ''}`;
      case 'MEDICATION_UPDATED':
        return `Medication updated: ${event.details?.name ?? ''}`;
      case 'MEDICATION_STATUS_CHANGED':
        return `Medication status changed to ${event.details?.newStatus ?? ''}`;
      case 'APPOINTMENT_CREATED':
        return `Doctor appointment scheduled with Dr. ${event.details?.doctorName ?? ''}`;
      case 'APPOINTMENT_UPDATED':
        return `Appointment updated with Dr. ${event.details?.doctorName ?? ''}`;
      case 'APPOINTMENT_STATUS_CHANGED':
        return `Appointment marked as ${event.details?.newStatus ?? ''}`;
      case 'MEMBER_JOINED_VIA_PASSCODE':
        return `New member joined Care Circle (${event.details?.role ?? ''})`;
      case 'INVITATION_GENERATED':
        return `Passcode generated for new ${event.details?.role ?? 'member'}`;
      case 'MEMBER_REVOKED':
        return `Care Circle access revoked for ${event.details?.revokedUserName ?? 'member'}`;
      case 'CARE_NOTE_CREATED':
        return `Care note posted (${event.details?.category ?? 'general'})`;
      case 'SENIOR_MODE_TOGGLED':
        return `Senior Mode ${event.details?.seniorModeEnabled ? 'enabled' : 'disabled'}`;
      default:
        return event.action.replace(/_/g, ' ');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-slate-900 sm:text-3xl">
          <Clock className="h-7 w-7 text-teal-700" />
          Shared Healthcare Timeline
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Chronological record of medication doses, clinic appointments, handovers, and circle
          activities for {elderlyName}.
        </p>
      </div>

      {events.length === 0 ? (
        <Card className="py-12 text-center">
          <Clock className="mx-auto mb-2 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">No recorded activities yet.</p>
        </Card>
      ) : (
        <div className="relative my-6 space-y-6 border-l-2 border-slate-200 pl-6 sm:pl-8">
          {events.map((event) => {
            const date = new Date(event.createdAt);
            return (
              <div key={event._id} className="group relative">
                {/* Node icon marker */}
                <div className="absolute -left-[31px] top-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-teal-600 bg-white shadow-sm transition-transform group-hover:scale-110 sm:-left-[39px]">
                  {getEventIcon(event.action)}
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-card transition-colors hover:border-teal-400">
                  <div className="mb-1 flex flex-col justify-between gap-1 text-xs sm:flex-row sm:items-center">
                    <span className="text-sm font-bold text-slate-900">
                      {formatEventTitle(event)}
                    </span>
                    <span className="text-slate-400">
                      {formatDate(date)} at{' '}
                      {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">
                    Logged by{' '}
                    <span className="font-semibold text-slate-800">{event.actorName}</span>
                  </p>

                  {/* Optional details pills */}
                  {event.details && Object.keys(event.details).length > 0 && (
                    <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-2 font-mono text-[11px] text-slate-500">
                      {Object.entries(event.details).map(([k, v]) => (
                        <span key={k} className="mr-3 inline-block">
                          <strong className="text-slate-700">{k}:</strong> {String(v)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
