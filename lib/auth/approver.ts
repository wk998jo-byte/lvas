import { getOldestActiveAdminId } from "@/lib/db/queries";

/**
 * Resolves the admin who receives new authorization requests.
 * Prefers APPROVER_USER_ID; falls back to the oldest active admin profile.
 */
export async function getDefaultApproverId(): Promise<string | null> {
  const pinned = process.env.APPROVER_USER_ID?.trim();
  if (pinned) return pinned;

  try {
    return await getOldestActiveAdminId();
  } catch {
    return null;
  }
}
