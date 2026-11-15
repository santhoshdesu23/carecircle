'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ElderlyProfile,
  DoseLog,
  Appointment,
  CareCircleMember,
  CareNote,
  AdherenceStats,
  MemberPermissions,
} from '@/types';
import { ElderlyDashboard } from '@/components/dashboard/ElderlyDashboard';
import { FamilyDashboard } from '@/components/dashboard/FamilyDashboard';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { getTodayDateString } from '@/lib/utils';
import { Heart, KeyRound, Plus, Sparkles, RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ElderlyProfile | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [userRole, setUserRole] = useState<string>('elderly');
  const [permissions, setPermissions] = useState<MemberPermissions>({
    canManageMedications: false,
    canRecordDoses: false,
    canManageAppointments: false,
    canViewTimeline: false,
    canInviteMembers: false,
    canLeaveNotes: false,
  });

  const [doses, setDoses] = useState<DoseLog[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [members, setMembers] = useState<CareCircleMember[]>([]);
  const [careNotes, setCareNotes] = useState<CareNote[]>([]);
  const [stats, setStats] = useState<AdherenceStats>({
    totalScheduled: 0,
    taken: 0,
    missed: 0,
    skipped: 0,
    pending: 0,
    adherencePercentage: 100,
    currentStreakDays: 0,
  });

  // Perspective Toggle for Demo / Testing (Elderly View vs Caretaker/Family View)
  const [viewPerspective, setViewPerspective] = useState<'elderly' | 'family'>('elderly');
  const [seeding, setSeeding] = useState(false);

  // New Profile / Join Circle Modals for users without profiles
  const [createProfileModal, setCreateProfileModal] = useState(false);
  const [joinPasscodeModal, setJoinPasscodeModal] = useState(false);
  const [passcodeVal, setPasscodeVal] = useState('');
  const [fullNameVal, setFullNameVal] = useState('');
  const [dobVal, setDobVal] = useState('1944-05-12');
  const [emergencyNameVal, setEmergencyNameVal] = useState('');
  const [emergencyPhoneVal, setEmergencyPhoneVal] = useState('');
  const [emergencyRelVal, setEmergencyRelVal] = useState('Daughter');

  const fetchData = useCallback(async () => {
    try {
      const authRes = await fetch('/api/auth/me');
      const authData = await authRes.json();
      if (!authRes.ok || !authData.authenticated) return;

      setUserRole(authData.user.role);
      const activeId = authData.user.activeProfileId;

      if (!activeId) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // Fetch profile
      const profRes = await fetch(`/api/profiles/${activeId}`);
      const profData = await profRes.json();
      if (profRes.ok) {
        setProfile(profData.profile);
        setIsOwner(profData.isOwner);
        setPermissions(profData.permissions);
        if (authData.user.role === 'elderly' || profData.isOwner) {
          setViewPerspective('elderly');
        } else {
          setViewPerspective('family');
        }
      }

      // Fetch doses
      const dosesRes = await fetch(`/api/doses?profileId=${activeId}&date=${getTodayDateString()}`);
      const dosesData = await dosesRes.json();
      if (dosesRes.ok) setDoses(dosesData.doses || []);

      // Fetch appointments
      const apptRes = await fetch(`/api/appointments?profileId=${activeId}`);
      const apptData = await apptRes.json();
      if (apptRes.ok) setAppointments(apptData.appointments || []);

      // Fetch members
      const memRes = await fetch(`/api/profiles/${activeId}/members`);
      const memData = await memRes.json();
      if (memRes.ok) setMembers(memData.members || []);

      // Fetch notes
      const notesRes = await fetch(`/api/care-notes?profileId=${activeId}`);
      const notesData = await notesRes.json();
      if (notesRes.ok) setCareNotes(notesData.notes || []);

      // Fetch adherence stats
      const adhRes = await fetch(`/api/doses/adherence?profileId=${activeId}&days=7`);
      const adhData = await adhRes.json();
      if (adhRes.ok) setStats(adhData.stats);
    } catch (e) {
      console.error('Failed to fetch dashboard data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (res.ok) {
        await fetchData();
      }
    } finally {
      setSeeding(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullNameVal,
          preferredName: fullNameVal.split(' ')[0],
          dateOfBirth: dobVal,
          emergencyContact: {
            name: emergencyNameVal || 'Emergency Contact',
            relationship: emergencyRelVal,
            phoneNumber: emergencyPhoneVal || '555-0199',
          },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCreateProfileModal(false);
        // Switch to new profile
        await fetch('/api/auth/profile-switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId: data.profile._id }),
        });
        window.location.reload();
      }
    } catch {
      alert('Failed to create profile.');
    }
  };

  const handleRedeemPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/invitations/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: passcodeVal.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setJoinPasscodeModal(false);
        window.location.reload();
      } else {
        alert(data.error || 'Failed to redeem code.');
      }
    } catch {
      alert('Network error.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-700 border-t-transparent" />
        <p className="text-sm font-semibold text-slate-600">Connecting to CareCircle...</p>
      </div>
    );
  }

  // If user has no connected elderly profile
  if (!profile) {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-100 text-teal-800 shadow-sm">
          <Heart className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900">Get Connected to CareCircle</h2>
        <p className="text-sm text-slate-600">
          You are not currently linked to an elderly healthcare profile. Enter an invitation
          passcode from your loved one or create a new profile.
        </p>

        <div className="flex flex-col justify-center gap-4 pt-2 sm:flex-row">
          <Button
            size="lg"
            variant="outline"
            onClick={() => setJoinPasscodeModal(true)}
            className="gap-2"
          >
            <KeyRound className="h-4 w-4 text-teal-700" />
            Enter 8-Digit Passcode
          </Button>

          <Button
            size="lg"
            onClick={() => setCreateProfileModal(true)}
            className="gap-2 bg-teal-700 text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            Create Elderly Profile
          </Button>
        </div>

        {/* Join Passcode Modal */}
        <Modal
          isOpen={joinPasscodeModal}
          onClose={() => setJoinPasscodeModal(false)}
          title="Join Care Circle"
          description="Enter the single-use 8-digit passcode provided by the profile owner."
          maxWidth="sm"
        >
          <form onSubmit={handleRedeemPasscode} className="space-y-4">
            <Input
              label="8-Digit Passcode"
              maxLength={8}
              value={passcodeVal}
              onChange={(e) => setPasscodeVal(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 84920481"
              required
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setJoinPasscodeModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-teal-700 hover:bg-teal-800">
                Join Circle
              </Button>
            </div>
          </form>
        </Modal>

        {/* Create Profile Modal */}
        <Modal
          isOpen={createProfileModal}
          onClose={() => setCreateProfileModal(false)}
          title="Create Elderly Healthcare Profile"
          description="Set up the profile owner details and emergency contact."
          maxWidth="md"
        >
          <form onSubmit={handleCreateProfile} className="space-y-4">
            <Input
              label="Elderly Individual's Full Name *"
              value={fullNameVal}
              onChange={(e) => setFullNameVal(e.target.value)}
              placeholder="e.g. Eleanor Vance"
              required
            />
            <Input
              label="Date of Birth"
              type="date"
              value={dobVal}
              onChange={(e) => setDobVal(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Emergency Contact Name *"
                value={emergencyNameVal}
                onChange={(e) => setEmergencyNameVal(e.target.value)}
                placeholder="e.g. Clara Vance"
                required
              />
              <Input
                label="Emergency Phone *"
                value={emergencyPhoneVal}
                onChange={(e) => setEmergencyPhoneVal(e.target.value)}
                placeholder="e.g. 555-0199"
                required
              />
            </div>
            <Input
              label="Emergency Contact Relationship"
              value={emergencyRelVal}
              onChange={(e) => setEmergencyRelVal(e.target.value)}
              placeholder="e.g. Daughter / Caretaker"
            />
            <div className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateProfileModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-teal-700 hover:bg-teal-800">
                Create Profile
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Bar Controls: View Switcher & Demo Data Generator */}
      <div className="flex flex-col items-start justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            View Dashboard As:
          </span>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-bold">
            <button
              onClick={() => setViewPerspective('elderly')}
              className={`rounded-lg px-3.5 py-1.5 transition-all ${
                viewPerspective === 'elderly'
                  ? 'border border-slate-200/60 bg-white text-teal-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Elderly View
            </button>
            <button
              onClick={() => setViewPerspective('family')}
              className={`rounded-lg px-3.5 py-1.5 transition-all ${
                viewPerspective === 'family'
                  ? 'border border-slate-200/60 bg-white text-teal-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Caretaker / Family View
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {doses.length === 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSeedData}
              isLoading={seeding}
              className="gap-1.5 border-teal-300 bg-teal-50 text-xs text-teal-800 hover:bg-teal-100"
            >
              <Sparkles className="h-3.5 w-3.5 text-teal-700" />
              Load Sample Demo Data
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={fetchData}
            title="Refresh Data"
            className="p-2 text-slate-500 hover:text-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Render selected dashboard view */}
      {viewPerspective === 'elderly' ? (
        <ElderlyDashboard
          profile={profile}
          doses={doses}
          appointments={appointments}
          members={members}
          onDoseUpdated={fetchData}
        />
      ) : (
        <FamilyDashboard
          profile={profile}
          doses={doses}
          appointments={appointments}
          members={members}
          careNotes={careNotes}
          stats={stats}
          permissions={permissions}
          isOwner={isOwner}
          currentUserRole={userRole}
          onRefresh={fetchData}
        />
      )}
    </div>
  );
}
