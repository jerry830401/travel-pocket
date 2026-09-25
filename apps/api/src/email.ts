/** Emails identify users and are compared case-insensitively, as Google does. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
