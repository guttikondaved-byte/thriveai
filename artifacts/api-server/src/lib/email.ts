import { Resend } from "resend";
import { logger } from "./logger";

const resendApiKey = process.env.RESEND_API_KEY;
const resendClient = resendApiKey ? new Resend(resendApiKey) : null;

// Resend's shared testing sender — works with no domain setup, but can only
// send to the account owner's own verified email. Set RESEND_FROM_EMAIL once
// a real sending domain is verified in Resend to email real users.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "ThriveAI <onboarding@resend.dev>";

const RISK_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

interface InjuryAlertEmailInput {
  to: string;
  recipientName: string;
  athleteName: string;
  /** True when the recipient IS the athlete, for wording ("You're" vs "Their"). */
  isAthlete: boolean;
  bodyPart: string;
  riskLevel: string;
  message: string;
  recommendation: string;
}

/**
 * Emails a new injury-risk alert. Fire-and-forget by convention (callers
 * shouldn't await-and-fail on this) — logs and swallows errors so a flaky
 * email provider never breaks the activity-sync flow that triggers alerts.
 * No-ops silently if RESEND_API_KEY isn't configured.
 */
export async function sendInjuryAlertEmail(input: InjuryAlertEmailInput): Promise<void> {
  if (!resendClient) return;

  const subject = input.isAthlete
    ? `New injury alert: ${input.bodyPart}`
    : `Injury alert for ${input.athleteName}: ${input.bodyPart}`;

  const intro = input.isAthlete
    ? `We've flagged a new ${RISK_LABEL[input.riskLevel] ?? input.riskLevel}-risk alert for your <strong>${input.bodyPart}</strong>.`
    : `A new ${RISK_LABEL[input.riskLevel] ?? input.riskLevel}-risk alert was flagged for <strong>${input.athleteName}</strong>'s <strong>${input.bodyPart}</strong>.`;

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
      <p>Hi ${input.recipientName},</p>
      <p>${intro}</p>
      <p style="background: #fef3c7; border-radius: 8px; padding: 12px 16px; color: #78350f;">${input.message}</p>
      <p><strong>Recommendation:</strong> ${input.recommendation}</p>
      <p style="color: #6b7280; font-size: 13px;">Sign in to ThriveAI to see full details and acknowledge this alert.</p>
    </div>
  `.trim();

  try {
    await resendClient.emails.send({
      from: FROM_EMAIL,
      to: input.to,
      subject,
      html,
    });
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err), to: input.to },
      "Failed to send injury alert email",
    );
  }
}
