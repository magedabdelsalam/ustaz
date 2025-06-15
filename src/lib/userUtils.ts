/**
 * userUtils
 * ----------------
 * TODO: Add description and exports for userUtils.
 */

export function getUserInitials(email: string): string {
  return email.split('@')[0].substring(0, 2).toUpperCase()
}

export function isRecentlyActive(lastActive: Date): boolean {
  const twentyFourHoursAgo = new Date()
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)
  return lastActive > twentyFourHoursAgo
}
