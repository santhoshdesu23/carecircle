import crypto from 'node:crypto';
import { getAuditLogsCollection } from '@/lib/database/collections';
import { AuditLog } from '@/types';

export interface CreateAuditLogParams {
  elderlyProfileId?: string;
  actorUserId: string;
  actorName: string;
  actorEmail: string;
  action: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAuditEvent(params: CreateAuditLogParams): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  try {
    const col = await getAuditLogsCollection();
    const entry: AuditLog = {
      _id: `audit_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`,
      elderlyProfileId: params.elderlyProfileId,
      actorUserId: params.actorUserId,
      actorName: params.actorName,
      actorEmail: params.actorEmail,
      action: params.action,
      details: params.details,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      createdAt: new Date(),
    };
    // Append-only: insertOne is the only permitted database operation for audit logs
    await col.insertOne(entry as any);
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}
