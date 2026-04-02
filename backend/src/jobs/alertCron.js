// src/jobs/alertCron.js
//
// Runs daily at 08:00 server time.
// For each milestone (365 / 180 / 90 / 30 days before patent expiry):
//   1. Queries user_watchlist for entries hitting that milestone today
//   2. Deduplicates so the same alert isn't sent twice in a day
//   3. Inserts a row in user_alerts
//   4. Sends an email via Nodemailer (SMTP credentials from env)
//
// Start: imported and called once from server.js
// ─────────────────────────────────────────────────────────────────────────────
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { getWatchlistEntriesExpiringIn } from '../models/watchlist.js';
import { createAlert, alertAlreadySentToday } from '../models/alert.js';

// ── Nodemailer transporter ────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST     || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',          // true = port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── Alert milestone config ────────────────────────────────────────────────────
const MILESTONES = [
  {
    days: 365,
    type: '365-day',
    subject: (drug) => `📅 1-Year Notice: ${drug.drug_name} patent expiry approaching`,
    body: (drug, expiryFmt) =>
      `Hi ${drug.user_name},\n\n` +
      `This is your 1-year advance notice: the patent for ${drug.drug_name} ` +
      `(${drug.generic_name}) is set to expire on ${expiryFmt}.\n\n` +
      `Now is a great time to start researching generic alternatives and discuss ` +
      `potential cost-saving switches with your doctor or pharmacist.\n\n` +
      `— Patent Cliff Tracker`,
    message: (drug, expiryFmt) =>
      `${drug.drug_name} patent expires in ~1 year (${expiryFmt}). ` +
      `Plan ahead — generic ${drug.generic_name} could significantly reduce costs.`,
  },
  {
    days: 180,
    type: '180-day',
    subject: (drug) => `📅 6-Month Notice: ${drug.drug_name} patent expiry approaching`,
    body: (drug, expiryFmt) =>
      `Hi ${drug.user_name},\n\n` +
      `${drug.drug_name} (${drug.generic_name}) is now 6 months from patent expiry on ${expiryFmt}.\n\n` +
      `Start researching generic ${drug.generic_name} options with your pharmacist ` +
      `and check your insurance formulary for upcoming coverage changes.\n\n` +
      `— Patent Cliff Tracker`,
    message: (drug, expiryFmt) =>
      `${drug.drug_name} patent expires in ~6 months (${expiryFmt}). ` +
      `Start researching generic ${drug.generic_name} options with your pharmacist.`,
  },
  {
    days: 90,
    type: '90-day',
    subject: (drug) => `⚠️ 90-Day Alert: ${drug.drug_name} patent expiring soon`,
    body: (drug, expiryFmt) =>
      `Hi ${drug.user_name},\n\n` +
      `${drug.drug_name} (${drug.generic_name}) patent expires in just 90 days on ${expiryFmt}.\n\n` +
      `Generics are expected to become available shortly after this date. ` +
      `Talk to your doctor now to ensure a smooth transition.\n\n` +
      `— Patent Cliff Tracker`,
    message: (drug, expiryFmt) =>
      `${drug.drug_name} patent expires in 90 days (${expiryFmt}). ` +
      `Speak with your doctor about switching to generic ${drug.generic_name}.`,
  },
  {
    days: 30,
    type: '30-day',
    subject: (drug) => `🚨 30-Day Alert: ${drug.drug_name} patent expiring VERY SOON`,
    body: (drug, expiryFmt) =>
      `Hi ${drug.user_name},\n\n` +
      `URGENT: The ${drug.drug_name} (${drug.generic_name}) patent expires in just 30 days on ${expiryFmt}.\n\n` +
      `Generic versions are expected to launch imminently. ` +
      `Contact your pharmacist today to discuss switching and potential savings.\n\n` +
      `— Patent Cliff Tracker`,
    message: (drug, expiryFmt) =>
      `${drug.drug_name} patent expires in ~30 days (${expiryFmt}). ` +
      `Generic ${drug.generic_name} will be available soon — ask your pharmacist today.`,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

async function sendAlertEmail({ to, subject, text }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[Cron] SMTP credentials not set — skipping email to', to);
    return;
  }
  await transporter.sendMail({
    from: `"Patent Cliff Tracker" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
  });
}

// ── Core job logic ────────────────────────────────────────────────────────────
export async function runAlertJob() {
  console.log('[Cron] Running daily alert job —', new Date().toISOString());

  for (const milestone of MILESTONES) {
    let entries;
    try {
      entries = await getWatchlistEntriesExpiringIn(milestone.days);
    } catch (err) {
      console.error(`[Cron] DB query failed for ${milestone.days}d milestone:`, err.message);
      continue;
    }

    for (const drug of entries) {
      try {
        // Skip if we already sent this exact alert today (idempotency guard)
        const alreadySent = await alertAlreadySentToday(
          drug.user_id,
          drug.drug_name,
          milestone.type,
        );
        if (alreadySent) {
          console.log(`[Cron] Skipping duplicate ${milestone.type} for ${drug.drug_name} → user ${drug.user_id}`);
          continue;
        }

        const expiryFmt = formatDate(drug.patent_expiry);
        const message   = milestone.message(drug, expiryFmt);

        // 1. Insert in-app alert
        await createAlert(drug.user_id, {
          drug_name:  drug.drug_name,
          alert_type: milestone.type,
          message,
        });

        // 2. Send email
        await sendAlertEmail({
          to:      drug.email,
          subject: milestone.subject(drug),
          text:    milestone.body(drug, expiryFmt),
        });

        console.log(`[Cron] ✅ ${milestone.type} alert sent for ${drug.drug_name} → ${drug.email}`);
      } catch (err) {
        console.error(`[Cron] Failed to process alert for ${drug.drug_name}:`, err.message);
      }
    }
  }

  console.log('[Cron] Daily alert job complete.');
}

// ── Schedule: every day at 08:00 ─────────────────────────────────────────────
export function startAlertCron() {
  cron.schedule('0 8 * * *', runAlertJob, { timezone: 'UTC' });
  console.log('[Cron] Alert job scheduled — runs daily at 08:00 UTC');
}