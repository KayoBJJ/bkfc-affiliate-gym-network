// Run from the repository root with Node 22+ and the existing RESEND_API_KEY.
// Preview by default. Use --send only for the explicitly authorized test inbox.
import { Resend } from 'resend';
import { buildApplicantReceivedEmail } from '../lib/application/received-email.ts';
import { getReceivedEmailAttachments } from '../lib/application/email-brand-assets.ts';
const message = {
  from: 'BKFC Gym Network <notifications@bkfcgym.com>',
  to: ['Kayo@bkfc.com'],
  replyTo: 'bkfcgym@bkfc.com',
  subject: '[DESIGN TEST] BKFC Gym Network — Application received',
  html: buildApplicantReceivedEmail({
    contactPerson: 'Kayo',
    gymName: 'Example Combat Academy — Design Test',
    cityCountry: 'Sofia, Bulgaria',
    submissionId: 'GYM-DESIGN-TEST-20261001',
  }),
  attachments: getReceivedEmailAttachments(),
};
if (!process.argv.includes('--send')) {
  console.log(JSON.stringify({ from: message.from, to: message.to, replyTo: message.replyTo, subject: message.subject, attachments: message.attachments.map(a => ({ filename: a.filename, bytes: a.content.length })), status: 'Prepared only; no email sent' }, null, 2));
} else {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is required; use the existing authorized backend credential.');
  const result = await new Resend(process.env.RESEND_API_KEY).emails.send(message, { idempotencyKey: 'gym-design-test-20261001-kayo-v1' });
  if (result.error) {
    console.error(JSON.stringify({ status: 'not accepted', error: result.error.name, message: result.error.message }));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ status: 'accepted by Resend; inbox delivery still needs confirmation', id: result.data.id }));
  }
}
