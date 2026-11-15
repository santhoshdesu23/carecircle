import { describe, it, expect, vi } from 'vitest';
import { verifyProfileAccess, OWNER_PERMISSIONS, NO_PERMISSIONS } from '@/lib/permissions';
import * as collections from '@/lib/database/collections';

describe('Profile-Level Authorization & Access Control', () => {
  it('should deny access when elderly profile does not exist', async () => {
    vi.spyOn(collections, 'getElderlyProfilesCollection').mockResolvedValueOnce({
      findOne: vi.fn().mockResolvedValue(null),
    } as any);

    const result = await verifyProfileAccess('usr_123', 'prof_nonexistent');
    expect(result.hasAccess).toBe(false);
    expect(result.isOwner).toBe(false);
    expect(result.permissions).toEqual(NO_PERMISSIONS);
    expect(result.reason).toContain('not found');
  });

  it('should grant full owner access when authenticated user owns the profile', async () => {
    const mockProfile = {
      _id: 'prof_123',
      ownerUserId: 'usr_owner_123',
      fullName: 'Eleanor Vance',
    };

    vi.spyOn(collections, 'getElderlyProfilesCollection').mockResolvedValueOnce({
      findOne: vi.fn().mockResolvedValue(mockProfile),
    } as any);

    const result = await verifyProfileAccess('usr_owner_123', 'prof_123');
    expect(result.hasAccess).toBe(true);
    expect(result.isOwner).toBe(true);
    expect(result.permissions).toEqual(OWNER_PERMISSIONS);
  });

  it('should grant restricted permissions to active care circle member', async () => {
    const mockProfile = {
      _id: 'prof_123',
      ownerUserId: 'usr_owner_123',
      fullName: 'Eleanor Vance',
    };

    const mockMember = {
      _id: 'mem_456',
      elderlyProfileId: 'prof_123',
      userId: 'usr_member_456',
      status: 'active',
      role: 'caretaker' as const,
      permissions: {
        canManageMedications: true,
        canRecordDoses: true,
        canManageAppointments: false,
        canViewTimeline: true,
        canInviteMembers: false,
        canLeaveNotes: true,
      },
    };

    vi.spyOn(collections, 'getElderlyProfilesCollection').mockResolvedValueOnce({
      findOne: vi.fn().mockResolvedValue(mockProfile),
    } as any);

    vi.spyOn(collections, 'getCareCircleMembersCollection').mockResolvedValueOnce({
      findOne: vi.fn().mockResolvedValue(mockMember),
    } as any);

    const result = await verifyProfileAccess('usr_member_456', 'prof_123');
    expect(result.hasAccess).toBe(true);
    expect(result.isOwner).toBe(false);
    expect(result.permissions.canManageMedications).toBe(true);
    expect(result.permissions.canManageAppointments).toBe(false);
  });

  it('should deny access when user is not a member or access has been revoked', async () => {
    const mockProfile = {
      _id: 'prof_123',
      ownerUserId: 'usr_owner_123',
      fullName: 'Eleanor Vance',
    };

    vi.spyOn(collections, 'getElderlyProfilesCollection').mockResolvedValueOnce({
      findOne: vi.fn().mockResolvedValue(mockProfile),
    } as any);

    vi.spyOn(collections, 'getCareCircleMembersCollection').mockResolvedValueOnce({
      findOne: vi.fn().mockResolvedValue(null), // No active member found
    } as any);

    const result = await verifyProfileAccess('usr_stranger_999', 'prof_123');
    expect(result.hasAccess).toBe(false);
    expect(result.isOwner).toBe(false);
    expect(result.permissions).toEqual(NO_PERMISSIONS);
  });
});
