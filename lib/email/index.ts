import { Resend } from 'resend';
import crypto from 'node:crypto';
import { getReminderDeliveriesCollection } from '@/lib/database/collections';
import { ReminderDelivery } from '@/types';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const defaultSender = process.env.EMAIL_FROM || 'CareCircle <notifications@carecircle.app>';

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
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  status: 'sent' | 'skipped' | 'failed';
  error?: string;
}

export async function sendTransactionalEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const deliveriesCol = await getReminderDeliveriesCollection();

  // Check idempotency key to prevent any duplicate sending
  const existingDelivery = await deliveriesCol.findOne({
    idempotencyKey: params.idempotencyKey,
  });

  if (existingDelivery?.status === 'sent') {
    return {
      success: true,
      messageId: existingDelivery._id,
      status: 'skipped',
      error: 'Duplicate delivery prevented by idempotency check.',
    };
  }

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
    // Expected: Already logged or in-flight duplicate insertion
  }

  // If no Resend API key is configured, do not pretend it was delivered
  if (!resend) {
    const errorMsg =
      'RESEND_API_KEY is not configured in environment variables. Email logged to console in development.';
    console.warn(`[CareCircle Email Simulated] To: ${params.to} | Subject: ${params.subject}`);
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

  try {
    const response = await resend.emails.send({
      from: defaultSender,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    if (response.error) {
      await deliveriesCol.updateOne(
        { idempotencyKey: params.idempotencyKey },
        {
          $set: {
            status: 'failed',
            error: response.error.message,
          },
        }
      );
      return {
        success: false,
        status: 'failed',
        error: response.error.message,
      };
    }

    await deliveriesCol.updateOne(
      { idempotencyKey: params.idempotencyKey },
      {
        $set: {
          status: 'sent',
          sentAt: new Date(),
        },
      }
    );

    return {
      success: true,
      messageId: response.data?.id,
      status: 'sent',
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error during email delivery';
    await deliveriesCol.updateOne(
      { idempotencyKey: params.idempotencyKey },
      {
        $set: {
          status: 'failed',
          error: errorMessage,
        },
      }
    );
    return {
      success: false,
      status: 'failed',
      error: errorMessage,
    };
  }
}
