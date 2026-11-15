export interface EmailTemplateResult {
  subject: string;
  html: string;
  text: string;
}

const baseStyles = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #0F172A;
  background-color: #FAF9F6;
  margin: 0;
  padding: 30px 15px;
`;

const containerStyles = `
  max-width: 580px;
  margin: 0 auto;
  background-color: #FFFFFF;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid #E2E8F0;
`;

const headerStyles = `
  background-color: #0D9488;
  color: #FFFFFF;
  padding: 24px;
  text-align: center;
`;

const footerStyles = `
  padding: 20px;
  text-align: center;
  font-size: 12px;
  color: #64748B;
  background-color: #F8FAFC;
  border-top: 1px solid #E2E8F0;
`;

export function renderUpcomingDoseEmail(params: {
  elderlyName: string;
  medicationName: string;
  dosage: string;
  form: string;
  scheduledTime: string;
  instructions: string;
}): EmailTemplateResult {
  const subject = `Medication Reminder: ${params.medicationName} at ${params.scheduledTime} for ${params.elderlyName}`;
  const html = `
    <div style="${baseStyles}">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          <h1 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">CareCircle</h1>
          <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Care, Connected. Every Day.</p>
        </div>
        <div style="padding: 28px;">
          <div style="display: inline-block; padding: 4px 12px; background-color: #FEF3C7; color: #B45309; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 16px;">
            Upcoming Dose Reminder
          </div>
          <h2 style="margin: 0 0 12px; font-size: 20px; color: #0F172A;">Hello from CareCircle</h2>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.5; color: #334155;">
            This is a friendly reminder that a scheduled medication dose is coming up for <strong>${params.elderlyName}</strong>.
          </p>
          <div style="background-color: #F0FDFA; border: 1px solid #CCFBF1; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #0F766E; font-weight: 600; width: 120px;">Medication:</td>
                <td style="padding: 6px 0; color: #0F172A; font-weight: 700; font-size: 16px;">${params.medicationName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #0F766E; font-weight: 600;">Dosage:</td>
                <td style="padding: 6px 0; color: #0F172A;">${params.dosage} (${params.form})</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #0F766E; font-weight: 600;">Scheduled Time:</td>
                <td style="padding: 6px 0; color: #0F172A; font-weight: 600;">${params.scheduledTime}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #0F766E; font-weight: 600;">Instructions:</td>
                <td style="padding: 6px 0; color: #334155;">${params.instructions || 'Follow doctor directions'}</td>
              </tr>
            </table>
          </div>
          <p style="margin: 0; font-size: 13px; color: #64748B; line-height: 1.5;">
            After taking the medication, please record it in the CareCircle dashboard so your care circle stays informed.
          </p>
        </div>
        <div style="${footerStyles}">
          <p style="margin: 0 0 6px;">CareCircle is a supportive management tool and never provides medical diagnoses or alters dosages.</p>
          <p style="margin: 0;">&copy; ${new Date().getFullYear()} CareCircle. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;
  const text = `CareCircle - Upcoming Medication Reminder\n\nMedication: ${params.medicationName}\nDosage: ${params.dosage} (${params.form})\nScheduled Time: ${params.scheduledTime}\nRecipient: ${params.elderlyName}\nInstructions: ${params.instructions}\n\nPlease mark as taken in the CareCircle app once administered.`;
  return { subject, html, text };
}

export function renderMissedDoseEmail(params: {
  elderlyName: string;
  medicationName: string;
  dosage: string;
  scheduledTime: string;
  scheduledDate: string;
}): EmailTemplateResult {
  const subject = `Urgent Alert: Missed Medication Dose for ${params.elderlyName} (${params.medicationName})`;
  const html = `
    <div style="${baseStyles}">
      <div style="${containerStyles}">
        <div style="background-color: #E11D48; color: #FFFFFF; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 700;">CareCircle Alert</h1>
          <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Unconfirmed Medication Dose</p>
        </div>
        <div style="padding: 28px;">
          <div style="display: inline-block; padding: 4px 12px; background-color: #FFE4E6; color: #BE123C; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 16px;">
            Grace Period Expired
          </div>
          <h2 style="margin: 0 0 12px; font-size: 20px; color: #0F172A;">Attention Care Circle</h2>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.5; color: #334155;">
            The scheduled dose of <strong>${params.medicationName}</strong> for <strong>${params.elderlyName}</strong> scheduled at <strong>${params.scheduledTime}</strong> on ${params.scheduledDate} has not been recorded as taken and the grace period has passed.
          </p>
          <div style="background-color: #FFF1F2; border: 1px solid #FECDD3; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px; font-size: 14px; font-weight: 700; color: #9F1239;">Important Safety Notice:</p>
            <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #881337;">
              Do not assume the individual should take a double or extra dose. Check in gently with ${params.elderlyName}, or consult their prescribing physician or pharmacist if uncertain.
            </p>
          </div>
          <p style="margin: 0; font-size: 13px; color: #64748B;">
            If the medicine has already been taken, an authorized family member or caretaker can record it now in CareCircle.
          </p>
        </div>
        <div style="${footerStyles}">
          <p style="margin: 0;">&copy; ${new Date().getFullYear()} CareCircle. Always consult qualified healthcare professionals for medical advice.</p>
        </div>
      </div>
    </div>
  `;
  const text = `Urgent Alert: Missed Medication Dose for ${params.elderlyName}\n\nMedication: ${params.medicationName}\nScheduled Time: ${params.scheduledTime} (${params.scheduledDate})\n\nSafety notice: Do not double the next dose. Check in with ${params.elderlyName} and log the dose in CareCircle if taken.`;
  return { subject, html, text };
}

export function renderAppointmentReminderEmail(params: {
  elderlyName: string;
  doctorName: string;
  clinicName: string;
  appointmentDate: string;
  appointmentTime: string;
  location: string;
  leadHours: number;
  checklistItems: string[];
}): EmailTemplateResult {
  const subject = `Upcoming Doctor Appointment in ${params.leadHours}h for ${params.elderlyName} with Dr. ${params.doctorName}`;
  const checklistHtml = params.checklistItems.length
    ? `<ul style="margin: 8px 0 0; padding-left: 20px; font-size: 13px; color: #334155;">
        ${params.checklistItems.map((item) => `<li style="margin-bottom: 4px;">${item}</li>`).join('')}
       </ul>`
    : '<p style="margin: 6px 0 0; font-size: 13px; color: #64748B;">No preparation items specified.</p>';

  const html = `
    <div style="${baseStyles}">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          <h1 style="margin: 0; font-size: 22px; font-weight: 700;">CareCircle</h1>
          <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Appointment Notification</p>
        </div>
        <div style="padding: 28px;">
          <h2 style="margin: 0 0 12px; font-size: 20px; color: #0F172A;">Upcoming Medical Appointment</h2>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.5; color: #334155;">
            An appointment for <strong>${params.elderlyName}</strong> is scheduled in approximately <strong>${params.leadHours} hours</strong>.
          </p>
          <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #64748B; width: 100px;">Doctor:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #0F172A;">Dr. ${params.doctorName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748B;">Facility:</td>
                <td style="padding: 6px 0; color: #0F172A;">${params.clinicName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748B;">When:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #0F172A;">${params.appointmentDate} at ${params.appointmentTime}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748B;">Location:</td>
                <td style="padding: 6px 0; color: #0F172A;">${params.location}</td>
              </tr>
            </table>
          </div>
          <div style="background-color: #F0FDFA; border-left: 4px solid #0D9488; padding: 14px 18px; border-radius: 6px;">
            <p style="margin: 0; font-size: 13px; font-weight: 600; color: #0F766E;">Preparation Checklist:</p>
            ${checklistHtml}
          </div>
        </div>
        <div style="${footerStyles}">
          <p style="margin: 0;">&copy; ${new Date().getFullYear()} CareCircle. Safe travels to your appointment.</p>
        </div>
      </div>
    </div>
  `;
  const text = `Upcoming Doctor Appointment for ${params.elderlyName}\n\nDoctor: Dr. ${params.doctorName}\nFacility: ${params.clinicName}\nWhen: ${params.appointmentDate} at ${params.appointmentTime}\nLocation: ${params.location}\nChecklist: ${params.checklistItems.join(', ')}`;
  return { subject, html, text };
}

export function renderInvitationCodeEmail(params: {
  elderlyName: string;
  inviterName: string;
  role: string;
  passcode: string;
  expiresInMinutes: number;
}): EmailTemplateResult {
  const subject = `Invitation to join ${params.elderlyName}'s Care Circle on CareCircle`;
  const html = `
    <div style="${baseStyles}">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          <h1 style="margin: 0; font-size: 22px; font-weight: 700;">CareCircle</h1>
          <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Secure Passcode Access</p>
        </div>
        <div style="padding: 28px;">
          <h2 style="margin: 0 0 12px; font-size: 20px; color: #0F172A;">You've Been Invited</h2>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.5; color: #334155;">
            <strong>${params.inviterName}</strong> has invited you to join the Care Circle for <strong>${params.elderlyName}</strong> as a <strong>${params.role}</strong>.
          </p>
          <div style="text-align: center; background-color: #F8FAFC; border: 2px dashed #0D9488; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #64748B;">Your 8-Digit Single-Use Passcode</p>
            <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0D9488; font-family: monospace;">
              ${params.passcode}
            </div>
            <p style="margin: 12px 0 0; font-size: 13px; color: #E11D48; font-weight: 500;">
              This code expires in ${params.expiresInMinutes} minutes.
            </p>
          </div>
          <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #0F172A;">How to connect:</p>
          <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.6;">
            <li>Sign in or create your CareCircle account.</li>
            <li>Go to the <strong>Join Care Circle</strong> page.</li>
            <li>Enter this 8-digit passcode to immediately gain authorized access.</li>
          </ol>
        </div>
        <div style="${footerStyles}">
          <p style="margin: 0;">&copy; ${new Date().getFullYear()} CareCircle. Never share this code with unauthorized individuals.</p>
        </div>
      </div>
    </div>
  `;
  const text = `You've been invited to join ${params.elderlyName}'s Care Circle by ${params.inviterName}.\n\nPasscode: ${params.passcode}\n(Expires in ${params.expiresInMinutes} minutes)\n\nEnter this code in CareCircle to join.`;
  return { subject, html, text };
}
