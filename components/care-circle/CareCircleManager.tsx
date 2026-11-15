'use client';

import { useState, useEffect } from 'react';
import { CareCircleMember, MemberPermissions, CircleMemberRole } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatDate } from '@/lib/utils';
import { Users, KeyRound, ShieldCheck, UserPlus, Trash2, Copy, Check, Clock } from 'lucide-react';

interface CareCircleManagerProps {
  profileId: string;
  elderlyName: string;
  members: CareCircleMember[];
  isOwner: boolean;
  canInvite: boolean;
  currentUserId: string;
  onRefresh: () => void;
}

export function CareCircleManager({
  profileId,
  elderlyName,
  members,
  isOwner,
  canInvite,
  currentUserId,
  onRefresh,
}: Readonly<CareCircleManagerProps>) {
  // Invite Passcode State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [role, setRole] = useState<CircleMemberRole>('family');
  const [relationship, setRelationship] = useState('');
  const [permissions, setPermissions] = useState<MemberPermissions>({
    canManageMedications: false,
    canRecordDoses: true,
    canManageAppointments: false,
    canViewTimeline: true,
    canInviteMembers: false,
    canLeaveNotes: true,
  });
  const [generatingCode, setGeneratingCode] = useState(false);
  const [generatedPasscode, setGeneratedPasscode] = useState<string | null>(null);
  const [passcodeExpiresAt, setPasscodeExpiresAt] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);

  // Join Passcode State
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  // Time remaining countdown for generated passcode
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  useEffect(() => {
    if (!passcodeExpiresAt) return;
    const interval = setInterval(() => {
      const diff = Math.max(
        0,
        Math.floor((new Date(passcodeExpiresAt).getTime() - Date.now()) / 1000)
      );
      setSecondsRemaining(diff);
      if (diff === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [passcodeExpiresAt]);

  const handleRoleChange = (newRole: CircleMemberRole) => {
    setRole(newRole);
    if (newRole === 'caretaker') {
      setPermissions({
        canManageMedications: true,
        canRecordDoses: true,
        canManageAppointments: true,
        canViewTimeline: true,
        canInviteMembers: false,
        canLeaveNotes: true,
      });
      setRelationship('Visiting Caretaker');
    } else {
      setPermissions({
        canManageMedications: false,
        canRecordDoses: true,
        canManageAppointments: false,
        canViewTimeline: true,
        canInviteMembers: false,
        canLeaveNotes: true,
      });
      setRelationship('Family Member');
    }
  };

  const handleGeneratePasscode = async () => {
    setGeneratingCode(true);
    try {
      const res = await fetch('/api/invitations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elderlyProfileId: profileId,
          role,
          relationship,
          permissions,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setGeneratedPasscode(data.passcode);
        setPasscodeExpiresAt(new Date(data.expiresAt));
      } else {
        alert(data.error || 'Failed to generate invitation code.');
      }
    } catch {
      alert('Network error while generating code.');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCopyPasscode = () => {
    if (!generatedPasscode) return;
    navigator.clipboard.writeText(generatedPasscode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    setJoinSuccess(null);
    setRedeeming(true);

    try {
      const res = await fetch('/api/invitations/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || 'Failed to redeem invitation code.');
        return;
      }

      setJoinSuccess(data.message || 'Successfully joined Care Circle!');
      setTimeout(() => {
        setJoinModalOpen(false);
        setJoinCode('');
        window.location.reload();
      }, 1500);
    } catch {
      setJoinError('Network error occurred.');
    } finally {
      setRedeeming(false);
    }
  };

  const handleRevokeMember = async (memberId: string, memberName: string) => {
    if (
      !confirm(
        `Are you sure you want to revoke ${memberName}'s access to this Care Circle? They will lose access immediately.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/profiles/${profileId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });

      if (res.ok) {
        onRefresh();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to revoke member.');
      }
    } catch {
      alert('Network error while revoking member.');
    }
  };

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-slate-900 sm:text-3xl">
            <Users className="h-7 w-7 text-teal-700" />
            Care Circle Collaboration
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Connected family members and authorized caretakers supporting {elderlyName}.
          </p>
        </div>

        <div className="flex gap-2.5">
          <Button
            variant="outline"
            onClick={() => setJoinModalOpen(true)}
            className="gap-2 text-xs"
          >
            <KeyRound className="h-4 w-4 text-teal-700" />
            Enter Passcode
          </Button>

          {canInvite && (
            <Button
              onClick={() => {
                setGeneratedPasscode(null);
                setInviteModalOpen(true);
              }}
              className="gap-2 bg-teal-700 text-xs hover:bg-teal-800"
            >
              <UserPlus className="h-4 w-4" />
              Invite Member
            </Button>
          )}
        </div>
      </div>

      {/* Security Info Card */}
      <div className="flex items-start gap-4 rounded-2xl border border-teal-200 bg-teal-50/60 p-5">
        <ShieldCheck className="mt-0.5 h-6 w-6 flex-shrink-0 text-teal-700" />
        <div className="space-y-1 text-xs text-slate-700">
          <p className="text-sm font-bold text-teal-950">Secure Passcode-Based Authorization</p>
          <p>
            CareCircle protects health privacy using single-use 8-digit invitation passcodes that
            expire in 15 minutes. Passcodes are hashed with cryptographic salts before storage,
            preventing unauthorized access. The elderly profile owner maintains full sovereignty and
            can revoke member access at any time.
          </p>
        </div>
      </div>

      {/* Members Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => {
          const isCurrent = member.userId === currentUserId;
          const isMemberOwner = member.role === 'owner';
          return (
            <Card
              key={member._id}
              className="relative flex flex-col justify-between hover:border-teal-400"
            >
              <div>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-1.5 text-base font-bold text-slate-900">
                      {member.userName}
                      {isCurrent && (
                        <span className="text-xs font-normal text-teal-700">(You)</span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500">{member.userEmail}</p>
                  </div>
                  <Badge variant={isMemberOwner ? 'default' : 'info'}>{member.role}</Badge>
                </div>

                <div className="my-3 space-y-1.5 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Relationship:</span>
                    <span className="font-semibold text-slate-800">
                      {member.relationshipToElderly ||
                        (isMemberOwner ? 'Elderly Individual' : member.role)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Joined:</span>
                    <span className="text-slate-700">{formatDate(member.joinedAt)}</span>
                  </div>
                </div>

                {/* Granular Permissions Badges */}
                <div className="space-y-1 pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Permissions:
                  </p>
                  <div className="flex flex-wrap gap-1 text-[11px]">
                    {member.permissions.canManageMedications && (
                      <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800">
                        Manage Meds
                      </span>
                    )}
                    {member.permissions.canRecordDoses && (
                      <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800">
                        Record Doses
                      </span>
                    )}
                    {member.permissions.canManageAppointments && (
                      <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800">
                        Manage Appointments
                      </span>
                    )}
                    {member.permissions.canViewTimeline && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                        View Timeline
                      </span>
                    )}
                    {member.permissions.canLeaveNotes && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                        Leave Notes
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Revoke button (for owner only, cannot revoke owner) */}
              {isOwner && !isMemberOwner && (
                <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRevokeMember(member._id, member.userName)}
                    className="gap-1.5 text-xs text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Revoke Access
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Invite Member Passcode Generator Modal */}
      <Modal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title="Generate Secure Invitation Passcode"
        description="Create an 8-digit single-use access code with 15-minute expiration."
        maxWidth="md"
      >
        {!generatedPasscode ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <span className="block text-xs font-bold text-slate-800">Member Role *</span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleRoleChange('family')}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    role === 'family'
                      ? 'border-teal-600 bg-teal-50 font-bold text-teal-950 ring-2 ring-teal-600/20'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <p className="text-sm">Family Member</p>
                  <p className="mt-0.5 text-[11px] font-normal text-slate-500">
                    View schedules, record doses, receive alerts
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleChange('caretaker')}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    role === 'caretaker'
                      ? 'border-teal-600 bg-teal-50 font-bold text-teal-950 ring-2 ring-teal-600/20'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <p className="text-sm">Caretaker / Nurse</p>
                  <p className="mt-0.5 text-[11px] font-normal text-slate-500">
                    Manage meds, appointments, handover notes
                  </p>
                </button>
              </div>
            </div>

            <Input
              label="Relationship to Elder (Optional)"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              placeholder="e.g. Daughter, Visiting Nurse, Son"
            />

            {/* Granular Permissions Toggles */}
            <div className="space-y-2 border-t border-slate-100 pt-1">
              <p className="text-xs font-bold text-slate-800">Granular Access Permissions</p>
              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <label
                  htmlFor="perm-can-manage-meds"
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2"
                >
                  <input
                    id="perm-can-manage-meds"
                    type="checkbox"
                    checked={permissions.canManageMedications}
                    onChange={(e) =>
                      setPermissions({ ...permissions, canManageMedications: e.target.checked })
                    }
                    className="h-4 w-4 rounded text-teal-700"
                  />
                  <span>Can edit medications</span>
                </label>

                <label
                  htmlFor="perm-can-record-doses"
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2"
                >
                  <input
                    id="perm-can-record-doses"
                    type="checkbox"
                    checked={permissions.canRecordDoses}
                    onChange={(e) =>
                      setPermissions({ ...permissions, canRecordDoses: e.target.checked })
                    }
                    className="h-4 w-4 rounded text-teal-700"
                  />
                  <span>Can record doses</span>
                </label>

                <label
                  htmlFor="perm-can-manage-appts"
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2"
                >
                  <input
                    id="perm-can-manage-appts"
                    type="checkbox"
                    checked={permissions.canManageAppointments}
                    onChange={(e) =>
                      setPermissions({ ...permissions, canManageAppointments: e.target.checked })
                    }
                    className="h-4 w-4 rounded text-teal-700"
                  />
                  <span>Can manage appointments</span>
                </label>

                <label
                  htmlFor="perm-can-leave-notes"
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2"
                >
                  <input
                    id="perm-can-leave-notes"
                    type="checkbox"
                    checked={permissions.canLeaveNotes}
                    onChange={(e) =>
                      setPermissions({ ...permissions, canLeaveNotes: e.target.checked })
                    }
                    className="h-4 w-4 rounded text-teal-700"
                  />
                  <span>Can post care notes</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-3">
              <Button variant="outline" onClick={() => setInviteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleGeneratePasscode}
                isLoading={generatingCode}
                className="bg-teal-700 hover:bg-teal-800"
              >
                Generate 8-Digit Passcode
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 py-2 text-center">
            <div className="space-y-2 rounded-2xl border border-teal-200 bg-teal-50 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-teal-800">
                Single-Use Passcode
              </p>
              <div className="font-mono text-4xl font-black tracking-widest text-teal-800 selection:bg-teal-200">
                {generatedPasscode}
              </div>
              <p className="flex items-center justify-center gap-1.5 pt-1 text-xs font-semibold text-rose-600">
                <Clock className="h-3.5 w-3.5" />
                Expires in {formatCountdown(secondsRemaining)}
              </p>
            </div>

            <p className="mx-auto max-w-sm text-xs text-slate-600">
              Share this passcode with the invited individual. They should log in to their
              CareCircle account and click <strong>&quot;Enter Passcode&quot;</strong>.
            </p>

            <div className="flex justify-center gap-3">
              <Button onClick={handleCopyPasscode} variant="outline" className="gap-2 text-xs">
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? 'Passcode Copied!' : 'Copy Passcode'}
              </Button>
              <Button
                onClick={() => {
                  setGeneratedPasscode(null);
                  setInviteModalOpen(false);
                  onRefresh();
                }}
                className="bg-teal-700 text-xs hover:bg-teal-800"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Enter Passcode Modal (To join an elder's circle) */}
      <Modal
        isOpen={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        title="Join a Care Circle"
        description="Enter the 8-digit numeric invitation passcode provided by the elderly profile owner."
        maxWidth="sm"
      >
        <form onSubmit={handleRedeemCode} className="space-y-4">
          {joinError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              {joinError}
            </div>
          )}

          {joinSuccess && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
              {joinSuccess}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="join-passcode-input" className="text-xs font-bold text-slate-800">
              8-Digit Passcode
            </label>
            <input
              id="join-passcode-input"
              type="text"
              maxLength={8}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 84920481"
              className="h-14 w-full rounded-xl border border-slate-300 text-center font-mono text-2xl font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-teal-600"
              autoFocus
              required
            />
          </div>

          <p className="text-xs text-slate-500">
            Passcodes are single-use and expire within 15 minutes of generation. Failed attempts are
            rate-limited to protect healthcare data.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setJoinModalOpen(false)}
              disabled={redeeming}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={redeeming}
              className="bg-teal-700 hover:bg-teal-800"
            >
              Join Care Circle
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
