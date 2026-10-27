import { requireAccess, AccessDenied } from "@/lib/permissions/server";

/** Fields a user may change on their own profile. Role, permissions, employee no. and password are never accepted here. */
const PROFILE_FIELDS = ["fullName", "email", "phone", "profilePicture"] as const;

export async function updateOwnProfile(targetUserId: string, profile: unknown): Promise<{ success: boolean; message?: string; error?: string; status: number }> {
  try {
    const access = await requireAccess();
    if (!targetUserId) return { success: false, error: "Missing user id", status: 400 };
    if (targetUserId !== access.userId && !access.isAdmin) {
      return { success: false, error: "You can only change your own profile", status: 403 };
    }
    const input = (profile && typeof profile === "object" ? profile : {}) as Record<string, unknown>;
    const updates: Record<string, string | null> = {};
    for (const field of PROFILE_FIELDS) {
      if (!(field in input)) continue;
      const value = input[field];
      if (value !== null && typeof value !== "string") continue;
      updates[field] = value === null ? null : value.slice(0, field === "profilePicture" ? 2000 : 200);
    }
    if (!Object.keys(updates).length) return { success: false, error: "Nothing to update", status: 400 };
    const { getAdminDb } = await import("@/lib/firebase/admin");
    const db = await getAdminDb();
    await db.collection("Users").doc(targetUserId).update(updates);
    return { success: true, message: "Profile updated successfully.", status: 200 };
  } catch (error) {
    if (error instanceof AccessDenied) return { success: false, error: error.message, status: error.status };
    return { success: false, error: "Failed to update profile.", status: 500 };
  }
}
