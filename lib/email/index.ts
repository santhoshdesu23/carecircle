import { BrevoClient, BrevoError, BrevoTimeoutError } from '@getbrevo/brevo';
import crypto from 'node:crypto';
import { getReminderDeliveriesCollection } from '@/lib/database/collections';
import { ReminderDelivery } from '@/types';
import {
  renderAccountVerificationEmail,
  renderPasswordResetEmail,
  renderInvitationCodeEmail,
} from './templates';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  elderlyProfileId: string;
  recipientUserId: string;
  referenceType: ReminderDelivery['referenceType'];
  referenceId: string;
  idempotencyKey: string;
  recipientName?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  status: 'sent' | 'skipped' | 'failed';
  error?: string;
}

let cachedBrevoClient: BrevoClient | null = null;
let cachedApiKey: string | undefined = undefined;

/**
 * Parses and returns the configured sender name and email from EMAIL_FROM.
 * Supports "Name <email@domain.com>" or "email@domain.com" formats.
 */
export function getEmailSender(): { name: string; email: string } {
  const envFrom = process.env.EMAIL_FROM || 'CareCircle <notifications@carecircle.app>';
  const match = envFrom.match(/^(?:([^<]+)<)?([^>]+)>?$/);
  if (match) {
    const name = match[1]?.trim() || 'CareCircle';
    const email = match[2]?.trim() || envFrom.trim();
    return { name, email };
  }
  return { name: 'CareCircle', email: envFrom.trim() };
}

/**
 * Initializes and returns the BrevoClient singleton.
 * Uses the server-side BREVO_API_KEY environment variable.
 */
export function getBrevoClient(): BrevoClient | null {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    cachedBrevoClient = null;
    cachedApiKey = undefined;
    return null;
  }
  if (cachedBrevoClient && cachedApiKey === apiKey) {
    return cachedBrevoClient;
  }
  cachedApiKey = apiKey;
  cachedBrevoClient = new BrevoClient({ apiKey });
  return cachedBrevoClient;
}

/**
 * Sends a transactional email through Brevo with idempotency protection,
 * database audit persistence, and transient retry handling.
 */
export async function sendTransactionalEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const deliveriesCol = await getReminderDeliveriesCollection();

  // 1. Idempotency Check: Prevent duplicate notifications
  const existingDelivery = await deliveriesCol.findOne({
    idempotencyKey: params.idempotencyKey,
  });

  if (existingDelivery?.status === 'sent') {
    return {
      success: true,
      messageId: existingDelivery.providerMessageId || existingDelivery._id,
      status: 'skipped',
      error: 'Duplicate delivery prevented by idempotency check.',
    };
  }

  // 2. Persist initial delivery audit record as 'pending'
  const deliveryRecord: ReminderDelivery = {
    _id: `del_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`,
    elderlyProfileId: params.elderlyProfileId,
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    recipientUserId: params.recipientUserId,
    recipientEmail: params.to,
    idempotencyKey: params.idempotencyKey,
    status: 'pending',
    attempts: 1,
    createdAt: new Date(),
  };

  try {
    await deliveriesCol.insertOne(deliveryRecord as any);
  } catch (_err) {
    // Expected on race conditions if duplicate insertion collides with unique index
  }

  // 3. Environment check: Validate BREVO_API_KEY is configured
  const client = getBrevoClient();
  if (!client) {
    const errorMsg =
      'BREVO_API_KEY is not configured in environment variables. Email logged to console in development.';
    const maskedTo = params.to.replace(/(?<=^.{2}).*?(?=@)/, '***');
    console.warn(`[CareCircle Email Simulated] To: ${maskedTo} | Subject: ${params.subject}`);

    await deliveriesCol.updateOne(
      { idempotencyKey: params.idempotencyKey },
      {
        $set: {
          status: 'skipped',
          error: errorMsg,
        },
      }
    );

    return {
      success: false,
      status: 'skipped',
      error: errorMsg,
    };
  }

  // 4. Construct Brevo payload
  const sender = getEmailSender();
  const brevoRequest = {
    sender: {
      name: sender.name,
      email: sender.email,
    },
    to: [
      {
        email: params.to,
        name: params.recipientName ?? 'CareCircle Member',
      },
    ],
    subject: params.subject,
    htmlContent: params.html,
    textContent: params.text,
    headers: {
      'X-Mailin-Custom': params.idempotencyKey,
      'X-CareCircle-ReferenceType': params.referenceType,
    },
  };

  // 5. Execute API request with retry logic for transient network or server errors
  const MAX_ATTEMPTS = 3;
  let attempt = 0;
  let lastError = '';

  // Retry loop for transient failures with backoff
  while (attempt < MAX_ATTEMPTS) {
    attempt++;
    try {
      const response = await client.transactionalEmails.sendTransacEmail(brevoRequest);
      const messageId = response.messageId ?? response.messageIds?.[0];

      if (!messageId) {
        throw new Error('Brevo response did not include an accepted messageId.');
      }

      // Mark as successfully accepted by Brevo provider
      await deliveriesCol.updateOne(
        { idempotencyKey: params.idempotencyKey },
        {
          $set: {
            status: 'sent',
            sentAt: new Date(),
            providerMessageId: messageId,
            attempts: attempt,
          },
        }
      );

      return {
        success: true,
        messageId,
        status: 'sent',
      };
    } catch (err: unknown) {
      const isTimeout =
        err instanceof BrevoTimeoutError || (err as any)?.name === 'BrevoTimeoutError';
      const statusCode = (err as BrevoError)?.statusCode || (err as any)?.status;
      const isRateLimited = statusCode === 429;
      const isServerError = typeof statusCode === 'number' && statusCode >= 500;
      const isRetryable = isTimeout || isRateLimited || isServerError;

      // Sanitize error message to prevent logging credentials or PHI
      let sanitizedMessage = 'Unknown error during Brevo email delivery';
      if (err instanceof Error) {
        sanitizedMessage = err.message;
      }
      const bodyMsg = (err as any)?.body?.message;
      if (typeof bodyMsg === 'string') {
        sanitizedMessage = `Brevo API error (${statusCode}): ${bodyMsg}`;
      }

      lastError = sanitizedMessage;

      // Structured error logging (safe: no passwords, no API keys, no health details)
      const recipientDomain = params.to.includes('@') ? params.to.split('@')[1] : 'unknown';
      console.warn(`[CareCircle Brevo Delivery Attempt ${attempt}/${MAX_ATTEMPTS} Failed]`, {
        referenceType: params.referenceType,
        recipientDomain,
        statusCode: statusCode || (isTimeout ? 'timeout' : 'network_error'),
        retryable: isRetryable,
      });

      if (isRetryable && attempt < MAX_ATTEMPTS) {
        const delayMs = 300 * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      break;
    }
  }

  // 6. Record failure when all attempts fail or a non-retryable error occurs
  await deliveriesCol.updateOne(
    { idempotencyKey: params.idempotencyKey },
    {
      $set: {
        status: 'failed',
        error: lastError,
        attempts: attempt,
      },
    }
  );

  return {
    success: false,
    status: 'failed',
    error: lastError,
  };
}

/**
 * Sends an account verification email via Brevo.
 */
export async function sendAccountVerificationEmail(params: {
  to: string;
  name: string;
  verificationUrl: string;
  userId?: string;
  expiresInMinutes?: number;
}): Promise<SendEmailResult> {
  const template = renderAccountVerificationEmail({
    name: params.name,
    verificationUrl: params.verificationUrl,
    expiresInMinutes: params.expiresInMinutes,
  });

  const idempotencyKey = `verify-${params.userId || params.to}-${Date.now()}`;

  return sendTransactionalEmail({
    to: params.to,
    recipientName: params.name,
    subject: template.subject,
    html: template.html,
    text: template.text,
    elderlyProfileId: 'system',
    recipientUserId: params.userId || 'unassigned',
    referenceType: 'verification',
    referenceId: params.userId || params.to,
    idempotencyKey,
  });
}

/**
 * Sends a password reset email via Brevo.
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
  userId?: string;
  expiresInMinutes?: number;
}): Promise<SendEmailResult> {
  const template = renderPasswordResetEmail({
    name: params.name,
    resetUrl: params.resetUrl,
    expiresInMinutes: params.expiresInMinutes,
  });

  const idempotencyKey = `pwdreset-${params.userId || params.to}-${Date.now()}`;

  return sendTransactionalEmail({
    to: params.to,
    recipientName: params.name,
    subject: template.subject,
    html: template.html,
    text: template.text,
    elderlyProfileId: 'system',
    recipientUserId: params.userId || 'unassigned',
    referenceType: 'password_reset',
    referenceId: params.userId || params.to,
    idempotencyKey,
  });
}

/**
 * Sends a care circle invitation passcode email via Brevo.
 */
export async function sendInvitationEmail(params: {
  to: string;
  recipientName?: string;
  inviterName: string;
  elderlyName: string;
  role: string;
  passcode: string;
  expiresInMinutes?: number;
  profileId: string;
  inviterUserId: string;
}): Promise<SendEmailResult> {
  const template = renderInvitationCodeEmail({
    elderlyName: params.elderlyName,
    inviterName: params.inviterName,
    role: params.role,
    passcode: params.passcode,
    expiresInMinutes: params.expiresInMinutes || 15,
  });

  const idempotencyKey = `invitation-${params.profileId}-${params.to}-${params.passcode}`;

  return sendTransactionalEmail({
    to: params.to,
    recipientName: params.recipientName || 'Invited Member',
    subject: template.subject,
    html: template.html,
    text: template.text,
    elderlyProfileId: params.profileId,
    recipientUserId: params.inviterUserId,
    referenceType: 'invitation',
    referenceId: params.profileId,
    idempotencyKey,
  });
}
