// ============================================
// Permission Checking — Client-Safe Utility
// No server-only imports (next/headers, cookies)
// ============================================

import { ROLE_PERMISSIONS, type Permission } from "@/shared/lib/constants";
import type { UserRole } from "@/shared/types";

/**
 * Check if a role has a specific permission.
 * Safe to use in both client and server components.
 */
export function hasPermission(
    role: UserRole,
    permission: Permission
): boolean {
    const perms = ROLE_PERMISSIONS[role] ?? [];
    return perms.includes(permission);
}
