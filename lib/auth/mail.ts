import nodemailer from "nodemailer";

export function isPasswordResetEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim());
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  if (!host || !from) {
    throw new Error("Password reset email is not configured.");
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass: pass ?? "" } : undefined,
  });

  await transporter.sendMail({
    from,
    to,
    subject: "Reset your LVAS password",
    text: [
      "A password reset was requested for your LVAS account.",
      "",
      "Open this link to choose a new password. It expires in 30 minutes and can be used once:",
      resetUrl,
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
  });
}
