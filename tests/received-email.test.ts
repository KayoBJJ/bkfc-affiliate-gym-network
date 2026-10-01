import assert from "node:assert/strict";
import test from "node:test";
import { buildApplicantReceivedEmail } from "../lib/application/received-email.ts";
import { getReceivedEmailAttachments } from "../lib/application/email-brand-assets.ts";
const sample = { contactPerson: '<img src=x onerror="alert(1)">', gymName: 'A & B Combat', cityCountry: 'Sofia, Bulgaria', submissionId: 'GYM-2026-001' };
test('receipt escapes applicant fields and has no action without a portal', () => {
 const html = buildApplicantReceivedEmail(sample);
 assert.ok(html.includes('&lt;img'));
 assert.ok(html.includes('A &amp; B Combat'));
 assert.ok(!html.includes('<img src=x'));
 assert.ok(!html.includes('Open application portal'));
 assert.ok(!html.includes('[support_email]'));
});
test('enabled portal remains linked, unsafe URLs are omitted', () => {
 const html = buildApplicantReceivedEmail({...sample,portalUrl:'https://example.com/portal?a=1&b=2',supportEmail:'support@example.com'});
 assert.ok(html.includes('href="https://example.com/portal?a=1&amp;b=2"'));
 assert.ok(html.includes('href="mailto:support@example.com"'));
 assert.ok(!buildApplicantReceivedEmail({...sample,portalUrl:'javascript:alert(1)'}).includes('Open application portal'));
});
test('every inline image has a nonempty Resend attachment', () => {
 const html=buildApplicantReceivedEmail(sample);
 const attachments=getReceivedEmailAttachments();
 const ids=[...html.matchAll(/src="cid:([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(ids,attachments.map(a=>a.contentId));
 assert.ok(attachments.every(a=>a.content.length>0));
 assert.ok(attachments.reduce((n,a)=>n+a.content.length,0)<100000);
});
