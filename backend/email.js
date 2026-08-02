import nodemailer from 'nodemailer';

// In dev mode (no SMTP config) we just log the email to console.
function getTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    return null; // dev mode
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function send({ to, subject, html }) {
  const transport = getTransport();
  if (!transport) {
    // Dev mode: print to console
    console.log('\n──── EMAIL (dev mode) ────');
    console.log(`TO:      ${to}`);
    console.log(`SUBJECT: ${subject}`);
    console.log(html.replace(/<[^>]+>/g, ''));
    console.log('─────────────────────────\n');
    return;
  }
  await transport.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });
}

export async function sendInviteEmail({ to, inviteLink, inviterName }) {
  await send({
    to,
    subject: "You've been invited to join the Decision Intelligence Platform",
    html: `
      <p>Hi,</p>
      <p><strong>${inviterName}</strong> has invited you to join the Decision Intelligence Platform.</p>
      <p>Click the link below to create your account. This link expires in 72 hours.</p>
      <p><a href="${inviteLink}" style="background:#1E2761;color:#C9A227;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">Accept Invitation</a></p>
      <p>Or copy this URL:<br/><code>${inviteLink}</code></p>
      <p>If you didn't expect this invitation, you can ignore this email.</p>
    `,
  });
}

export async function sendPasswordResetEmail({ to, resetLink }) {
  await send({
    to,
    subject: 'Reset your password — Decision Intelligence Platform',
    html: `
      <p>Hi,</p>
      <p>We received a request to reset your password.</p>
      <p><a href="${resetLink}" style="background:#1E2761;color:#C9A227;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">Reset Password</a></p>
      <p>Or copy this URL:<br/><code>${resetLink}</code></p>
      <p>This link expires in 60 minutes. If you didn't request a reset, ignore this email.</p>
    `,
  });
}
