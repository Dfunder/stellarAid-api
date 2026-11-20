export interface Mailer {
  send(message: { to: string; subject: string; text: string }): Promise<void>;
}

/** Deliver the reset token; creating a token without sending it is a no-op. */
export async function sendPasswordResetEmail(
  mailer: Mailer,
  to: string,
  resetUrlBase: string,
  token: string,
): Promise<void> {
  const link = `${resetUrlBase}?token=${encodeURIComponent(token)}`;
  await mailer.send({
    to,
    subject: 'Reset your StellarAid password',
    text: `Use this link to choose a new password: ${link}\nIt expires soon. If you did not ask for this, ignore this email.`,
  });
}
