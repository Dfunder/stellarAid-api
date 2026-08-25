/**
 * Canonical list of sensitive actions that must be written to the audit trail.
 * Using an enum keeps action names consistent across the codebase and makes the
 * set of audited operations easy to review. See `docs/audit-logging.md`.
 */
export enum AuditAction {
  // Auth
  USER_LOGIN = 'user.login',
  USER_LOGIN_FAILED = 'user.login_failed',
  USER_LOGOUT = 'user.logout',
  PASSWORD_CHANGED = 'user.password_changed',

  // Wallet
  WALLET_LINKED = 'wallet.linked',
  WALLET_VERIFIED = 'wallet.verified',

  // Payments
  ESCROW_INITIATED = 'payment.escrow_initiated',
  PAYMENT_CONFIRMED = 'payment.confirmed',
  PAYMENT_RELEASED = 'payment.released',
  PAYMENT_REFUNDED = 'payment.refunded',

  // Admin
  USER_STATUS_UPDATED = 'admin.user_status_updated',
  DISPUTE_RESOLVED = 'admin.dispute_resolved',
  ARTIST_VERIFIED = 'admin.artist_verified',
}
