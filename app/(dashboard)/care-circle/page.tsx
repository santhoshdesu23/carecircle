'use client';

import { useState, useEffect, useCallback } from 'react';
import { CareCircleMember, ElderlyProfile } from '@/types';
import { CareCircleManager } from '@/components/care-circle/CareCircleManager';

export default function CareCirclePage() {
  const [profile, setProfile] = useState<ElderlyProfile | null>(null);
  const [members, setMembers] = useState<CareCircleMember[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [canInvite, setCanInvite] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const authRes = await fetch('/api/auth/me');
      const authData = await authRes.json();
      if (!authRes.ok || !authData.authenticated) return;

      setCurrentUserId(authData.user.id);
      const activeId = authData.user.activeProfileId;
      if (!activeId) {
        setLoading(false);
        return;
      }

      const profRes = await fetch(`/api/profiles/${activeId}`);
      const profData = await profRes.json();
      if (profRes.ok) {
        setProfile(profData.profile);
        setIsOwner(profData.isOwner);
        setCanInvite(profData.isOwner || profData.permissions.canInviteMembers);
      }

      const memRes = await fetch(`/api/profiles/${activeId}/members`);
      const memData = await memRes.json();
      if (memRes.ok) {
        setMembers(memData.members || []);
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
      <CareCircleManager
        profileId={profile._id}
        elderlyName={profile.preferredName || profile.fullName}
        members={members}
        isOwner={isOwner}
        canInvite={canInvite}
        currentUserId={currentUserId}
        onRefresh={loadData}
      />
    </div>
  );
}
