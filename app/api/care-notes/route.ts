import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSession } from '@/lib/auth/session';
import { verifyProfileAccess } from '@/lib/permissions';
import { careNoteSchema } from '@/lib/validations';
import { getCareNotesCollection } from '@/lib/database/collections';
import { CareNote } from '@/types';
import { logAuditEvent } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get('profileId');

  if (!profileId) {
    return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
  }

  const access = await verifyProfileAccess(session.userId, profileId);
  if (!access.hasAccess) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
  }

  const col = await getCareNotesCollection();
  const notes = await col.find({ elderlyProfileId: profileId }).sort({ createdAt: -1 }).toArray();

  return NextResponse.json({
    notes,
    canLeaveNotes: access.isOwner || access.permissions.canLeaveNotes,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const validated = careNoteSchema.safeParse(body);

  if (!validated.success) {
    return NextResponse.json(
      { error: validated.error.issues[0]?.message ?? 'Invalid note data' },
      { status: 400 }
    );
  }

  const { elderlyProfileId, category, content } = validated.data;
  const access = await verifyProfileAccess(session.userId, elderlyProfileId);

  if (!access.hasAccess || (!access.isOwner && !access.permissions.canLeaveNotes)) {
    return NextResponse.json(
      { error: 'You do not have permission to post care notes for this profile.' },
      { status: 403 }
    );
  }

  const authorRole = access.isOwner ? 'owner' : (access.memberRecord?.role ?? 'caretaker');

  const noteId = `note_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const careNote: CareNote = {
    _id: noteId,
    elderlyProfileId,
    authorUserId: session.userId,
    authorName: session.name,
    authorRole,
    category,
    content,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const col = await getCareNotesCollection();
  await col.insertOne(careNote as any);

  await logAuditEvent({
    elderlyProfileId,
    actorUserId: session.userId,
    actorName: session.name,
    actorEmail: session.email,
    action: 'CARE_NOTE_CREATED',
    details: {
      category,
      noteId,
    },
  });

  return NextResponse.json({ success: true, note: careNote }, { status: 201 });
}
