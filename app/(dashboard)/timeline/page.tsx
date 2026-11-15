'use client';

import { useState, useEffect, useCallback } from 'react';
import { AuditLog, ElderlyProfile } from '@/types';
import { CareTimeline } from '@/components/timeline/CareTimeline';

export default function TimelinePage() {
  const [profile, setProfile] = useState<ElderlyProfile | null>(null);
  const [events, setEvents] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const authRes = await fetch('/api/auth/me');
      const authData = await authRes.json();
      if (!authRes.ok || !authData.authenticated) return;

      const activeId = authData.user.activeProfileId;
      if (!activeId) {
        setLoading(false);
        return;
      }

      const profRes = await fetch(`/api/profiles/${activeId}`);
      const profData = await profRes.json();
      if (profRes.ok) {
        setProfile(profData.profile);
      }

      const timeRes = await fetch(`/api/timeline?profileId=${activeId}&limit=50`);
      const timeData = await timeRes.json();
      if (timeRes.ok) {
        setEvents(timeData.events || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-700 border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-slate-500">No active healthcare profile found.</p>
      </div>
    );
  }

  return (
    <div>
      <CareTimeline events={events} elderlyName={profile.preferredName || profile.fullName} />
    </div>
  );
}
