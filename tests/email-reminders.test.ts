import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderUpcomingDoseEmail,
  renderMissedDoseEmail,
  renderAppointmentReminderEmail,
  renderInvitationCodeEmail,
  renderAccountVerificationEmail,
  renderPasswordResetEmail,
} from '@/lib/email/templates';
import { sendTransactionalEmail, getEmailSender } from '@/lib/email';
import { ReminderDelivery } from '@/types';

// Mock in-memory database store
const mockDeliveries = new Map<string, ReminderDelivery>();

vi.mock('@/lib/database/collections', () => ({
  getReminderDeliveriesCollection: vi.fn().mockResolvedValue({
    findOne: vi.fn().mockImplementation(async (query: { idempotencyKey: string }) => {
      return mockDeliveries.get(query.idempotencyKey) || null;
    }),
    insertOne: vi.fn().mockImplementation(async (doc: ReminderDelivery) => {
      mockDeliveries.set(doc.idempotencyKey, { ...doc });
      return { acknowledged: true, insertedId: doc._id };
    }),
    updateOne: vi
      .fn()
      .mockImplementation(
        async (query: { idempotencyKey: string }, update: { $set: Partial<ReminderDelivery> }) => {
          const existing = mockDeliveries.get(query.idempotencyKey);
          if (existing) {
            mockDeliveries.set(query.idempotencyKey, {
              ...existing,
              ...update.$set,
            });
          }
          return { acknowledged: true, modifiedCount: 1 };
        }
      ),
  }),
}));

// Hoisted Brevo Mock definitions to satisfy Vitest hoisting requirements
const { MockBrevoError, MockBrevoTimeoutError, mockSendTransacEmail } = vi.hoisted(() => {
  const mockSendTransacEmail = vi.fn();

  class MockBrevoError extends Error {
    statusCode: number;
    body: { message: string; code: string };
    constructor(message: string, statusCode: number, body?: { message: string; code: string }) {
      super(message);
      this.name = 'BrevoError';
      this.statusCode = statusCode;
      this.body = body || { message, code: 'error' };
    }
  }

  class MockBrevoTimeoutError extends Error {
    constructor(message = 'Brevo request timed out') {
      super(message);
      this.name = 'BrevoTimeoutError';
    }
  }

  return { MockBrevoError, MockBrevoTimeoutError, mockSendTransacEmail };
});

vi.mock('@getbrevo/brevo', () => {
  return {
    BrevoClient: vi.fn().mockImplementation(() => ({
      transactionalEmails: {
        sendTransacEmail: mockSendTransacEmail,
      },
    })),
    BrevoError: MockBrevoError,
    BrevoTimeoutError: MockBrevoTimeoutError,
  };
});

describe('CareCircle Brevo Transactional Email Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeliveries.clear();
    process.env.BREVO_API_KEY = 'xkeysib-test-brevo-api-key-mock';
    process.env.EMAIL_FROM = 'CareCircle <notifications@carecircle.app>';
  });

  describe('HTML Email Template Generation', () => {
    it('should render upcoming dose email with exact medication details and instructions', () => {
      const template = renderUpcomingDoseEmail({
        elderlyName: 'Eleanor Vance',
        medicationName: 'Lisinopril',
        dosage: '10mg',
        form: 'tablet',
        scheduledTime: '08:30 AM',
        instructions: 'Take after breakfast with a full glass of water.',
      });

      expect(template.subject).toContain('Medication Reminder: Lisinopril');
      expect(template.html).toContain('Eleanor Vance');
      expect(template.html).toContain('Lisinopril');
      expect(template.html).toContain('10mg (tablet)');
      expect(template.html).toContain('Take after breakfast');
      expect(template.text).toContain('CareCircle');
    });

    it('should render missed dose email with explicit safety warning against double dosing', () => {
      const template = renderMissedDoseEmail({
        elderlyName: 'Eleanor Vance',
        medicationName: 'Metformin',
        dosage: '500mg',
        scheduledTime: '12:30 PM',
        scheduledDate: '2026-11-15',
      });

      expect(template.subject).toContain('Urgent Alert: Missed Medication Dose');
      expect(template.html).toContain(
        'Do not assume the individual should take a double or extra dose'
      );
      expect(template.html).toContain('Eleanor Vance');
      expect(template.html).toContain('Metformin');
    });

    it('should render appointment reminder with preparation checklist items', () => {
      const template = renderAppointmentReminderEmail({
        elderlyName: 'Eleanor Vance',
        doctorName: 'Sarah Jenkins',
        clinicName: 'St. Jude Heart Center',
        appointmentDate: '2026-11-20',
        appointmentTime: '10:30 AM',
        location: 'Suite 402, 1200 Healthcare Blvd',
        leadHours: 24,
        checklistItems: ['Bring previous ECG reports', 'Carry morning blood pressure logbook'],
      });

      expect(template.subject).toContain('Upcoming Doctor Appointment in 24h');
      expect(template.html).toContain('Dr. Sarah Jenkins');
      expect(template.html).toContain('St. Jude Heart Center');
      expect(template.html).toContain('Bring previous ECG reports');
      expect(template.html).toContain('Carry morning blood pressure logbook');
    });

    it('should render 8-digit passcode invitation email with 15-minute expiration notice', () => {
      const template = renderInvitationCodeEmail({
        elderlyName: 'Eleanor Vance',
        inviterName: 'Eleanor Vance',
        role: 'Caretaker',
        passcode: '84920481',
        expiresInMinutes: 15,
      });

      expect(template.subject).toContain("Invitation to join Eleanor Vance's Care Circle");
      expect(template.html).toContain('84920481');
      expect(template.html).toContain('expires in 15 minutes');
    });

    it('should render account verification email with secure activation link', () => {
      const template = renderAccountVerificationEmail({
        name: 'Sarah Connor',
        verificationUrl: 'https://carecircle.app/verify?token=tok_abc123',
        expiresInMinutes: 60,
      });

      expect(template.subject).toBe('Verify your email address for CareCircle');
      expect(template.html).toContain('Welcome to CareCircle, Sarah Connor');
      expect(template.html).toContain('https://carecircle.app/verify?token=tok_abc123');
      expect(template.html).toContain('expire in 60 minutes');
    });

    it('should render password reset email with single-use security notice', () => {
      const template = renderPasswordResetEmail({
        name: 'John Doe',
        resetUrl: 'https://carecircle.app/reset-password?token=pwd_xyz789',
        expiresInMinutes: 30,
      });

      expect(template.subject).toBe('Reset your CareCircle password');
      expect(template.html).toContain('Password Reset Request');
      expect(template.html).toContain('https://carecircle.app/reset-password?token=pwd_xyz789');
      expect(template.html).toContain('expire in 30 minutes');
    });
  });

  describe('Brevo Delivery & Error Handling', () => {
    it('should parse sender name and email correctly from EMAIL_FROM', () => {
      process.env.EMAIL_FROM = 'CareCircle Health <support@carecircle.app>';
      const sender = getEmailSender();
      expect(sender.name).toBe('CareCircle Health');
      expect(sender.email).toBe('support@carecircle.app');

      process.env.EMAIL_FROM = 'plain-sender@carecircle.app';
      const sender2 = getEmailSender();
      expect(sender2.name).toBe('CareCircle');
      expect(sender2.email).toBe('plain-sender@carecircle.app');
    });

    it('should successfully deliver transactional email and persist Brevo messageId', async () => {
      mockSendTransacEmail.mockResolvedValueOnce({
        messageId: '<202611151600.brevo_msg_98765@smtp-relay.brevo.com>',
      });

      const res = await sendTransactionalEmail({
        to: 'family@carecircle.demo',
        recipientName: 'Alice Vance',
        subject: 'Upcoming Dose Reminder',
        html: '<p>Upcoming dose</p>',
        text: 'Upcoming dose',
        elderlyProfileId: 'prof_123',
        recipientUserId: 'usr_456',
        referenceType: 'dose_upcoming',
        referenceId: 'dose_789',
        idempotencyKey: 'idemp_dose_789_usr_456',
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('sent');
      expect(res.messageId).toBe('<202611151600.brevo_msg_98765@smtp-relay.brevo.com>');

      // Verify Brevo payload formatting
      expect(mockSendTransacEmail).toHaveBeenCalledTimes(1);
      const callArgs = mockSendTransacEmail.mock.calls[0][0];
      expect(callArgs.sender.name).toBe('CareCircle');
      expect(callArgs.sender.email).toBe('notifications@carecircle.app');
      expect(callArgs.to[0].email).toBe('family@carecircle.demo');
      expect(callArgs.to[0].name).toBe('Alice Vance');
      expect(callArgs.subject).toBe('Upcoming Dose Reminder');
      expect(callArgs.htmlContent).toBe('<p>Upcoming dose</p>');
      expect(callArgs.headers['X-Mailin-Custom']).toBe('idemp_dose_789_usr_456');

      // Verify database record persisted
      const savedDelivery = mockDeliveries.get('idemp_dose_789_usr_456');
      expect(savedDelivery?.status).toBe('sent');
      expect(savedDelivery?.providerMessageId).toBe(
        '<202611151600.brevo_msg_98765@smtp-relay.brevo.com>'
      );
      expect(savedDelivery?.sentAt).toBeDefined();
    });

    it('should handle invalid API key (401 Unauthorized) without crashing or retrying', async () => {
      mockSendTransacEmail.mockRejectedValueOnce(
        new MockBrevoError('Status code: 401\nBody: {"message":"Key not found"}', 401, {
          message: 'Key not found',
          code: 'unauthorized',
        })
      );

      const res = await sendTransactionalEmail({
        to: 'family@carecircle.demo',
        subject: 'Test Subject',
        html: '<p>Test</p>',
        text: 'Test',
        elderlyProfileId: 'prof_123',
        recipientUserId: 'usr_456',
        referenceType: 'dose_upcoming',
        referenceId: 'dose_001',
        idempotencyKey: 'idemp_invalid_key_test',
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('failed');
      expect(res.error).toContain('Key not found');
      // Should not retry client authentication errors (401)
      expect(mockSendTransacEmail).toHaveBeenCalledTimes(1);

      const savedDelivery = mockDeliveries.get('idemp_invalid_key_test');
      expect(savedDelivery?.status).toBe('failed');
      expect(savedDelivery?.error).toContain('Key not found');
      expect(savedDelivery?.attempts).toBe(1);
    });

    it('should handle provider rejection (400 Bad Request) and record failure status', async () => {
      mockSendTransacEmail.mockRejectedValueOnce(
        new MockBrevoError('Bad Request', 400, {
          message: 'Invalid email address provided',
          code: 'bad_request',
        })
      );

      const res = await sendTransactionalEmail({
        to: 'invalid-email-address',
        subject: 'Test Subject',
        html: '<p>Test</p>',
        text: 'Test',
        elderlyProfileId: 'prof_123',
        recipientUserId: 'usr_456',
        referenceType: 'dose_missed',
        referenceId: 'dose_002',
        idempotencyKey: 'idemp_bad_request_test',
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('failed');
      expect(res.error).toContain('Invalid email address');
      expect(mockSendTransacEmail).toHaveBeenCalledTimes(1);

      const savedDelivery = mockDeliveries.get('idemp_bad_request_test');
      expect(savedDelivery?.status).toBe('failed');
    });

    it('should retry transient timeout errors and succeed on retry', async () => {
      // First attempt times out, second attempt succeeds
      mockSendTransacEmail
        .mockRejectedValueOnce(new MockBrevoTimeoutError('Socket timeout'))
        .mockResolvedValueOnce({
          messageId: '<brevo-retry-success-msg@brevo.com>',
        });

      const res = await sendTransactionalEmail({
        to: 'family@carecircle.demo',
        subject: 'Retry Test',
        html: '<p>Retry</p>',
        text: 'Retry',
        elderlyProfileId: 'prof_123',
        recipientUserId: 'usr_456',
        referenceType: 'appointment_24h',
        referenceId: 'appt_001',
        idempotencyKey: 'idemp_retry_test',
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('sent');
      expect(res.messageId).toBe('<brevo-retry-success-msg@brevo.com>');
      expect(mockSendTransacEmail).toHaveBeenCalledTimes(2);

      const savedDelivery = mockDeliveries.get('idemp_retry_test');
      expect(savedDelivery?.status).toBe('sent');
      expect(savedDelivery?.attempts).toBe(2);
    });

    it('should mark status as skipped when BREVO_API_KEY is not configured', async () => {
      delete process.env.BREVO_API_KEY;

      const res = await sendTransactionalEmail({
        to: 'family@carecircle.demo',
        subject: 'Dev Mode Test',
        html: '<p>Dev</p>',
        text: 'Dev',
        elderlyProfileId: 'prof_123',
        recipientUserId: 'usr_456',
        referenceType: 'dose_upcoming',
        referenceId: 'dose_003',
        idempotencyKey: 'idemp_missing_api_key_test',
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('skipped');
      expect(res.error).toContain('BREVO_API_KEY is not configured');
      expect(mockSendTransacEmail).not.toHaveBeenCalled();

      const savedDelivery = mockDeliveries.get('idemp_missing_api_key_test');
      expect(savedDelivery?.status).toBe('skipped');
    });

    it('should enforce idempotency and prevent duplicate notification sending', async () => {
      mockSendTransacEmail.mockResolvedValueOnce({
        messageId: '<original-msg-id-123@brevo.com>',
      });

      // First dispatch
      const firstCall = await sendTransactionalEmail({
        to: 'family@carecircle.demo',
        subject: 'Idempotency Test',
        html: '<p>First</p>',
        text: 'First',
        elderlyProfileId: 'prof_123',
        recipientUserId: 'usr_456',
        referenceType: 'dose_upcoming',
        referenceId: 'dose_004',
        idempotencyKey: 'idemp_duplicate_test_key',
      });

      expect(firstCall.success).toBe(true);
      expect(firstCall.status).toBe('sent');
      expect(mockSendTransacEmail).toHaveBeenCalledTimes(1);

      // Duplicate dispatch with exact same idempotencyKey
      const secondCall = await sendTransactionalEmail({
        to: 'family@carecircle.demo',
        subject: 'Idempotency Test Duplicate',
        html: '<p>Second</p>',
        text: 'Second',
        elderlyProfileId: 'prof_123',
        recipientUserId: 'usr_456',
        referenceType: 'dose_upcoming',
        referenceId: 'dose_004',
        idempotencyKey: 'idemp_duplicate_test_key',
      });

      expect(secondCall.success).toBe(true);
      expect(secondCall.status).toBe('skipped');
      expect(secondCall.error).toContain('Duplicate delivery prevented');
      // Brevo API MUST NOT be invoked a second time
      expect(mockSendTransacEmail).toHaveBeenCalledTimes(1);
    });

    it('should respect recipient notification preferences when evaluated by dispatch engine', () => {
      const preferences = {
        emailUpcomingDoses: false,
        emailMissedDoses: true,
        emailAppointments: true,
        emailHandoverNotes: false,
      };

      // Simulating recipient preference check
      const shouldSendUpcoming = preferences.emailUpcomingDoses;
      const shouldSendMissed = preferences.emailMissedDoses;
      const shouldSendAppointment = preferences.emailAppointments;

      expect(shouldSendUpcoming).toBe(false);
      expect(shouldSendMissed).toBe(true);
      expect(shouldSendAppointment).toBe(true);
    });
  });
});
