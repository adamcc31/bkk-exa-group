// ============================================
// Admin Users Service — CRUD Operations
// ============================================

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import type { AuthSession, User, ApiResponse } from "@/shared/types";

/** Service-role client for admin operations (bypasses RLS, has auth.admin access) */
function getServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

interface CreateUserInput {
    email: string;
    full_name: string;
    company_id: string;
    role_id: string;
    password: string;
}

interface UpdateUserInput {
    full_name?: string;
    company_id?: string;
    role_id?: string;
    is_active?: boolean;
}

export async function listUsers(
    session: AuthSession,
    query: { page?: number; pageSize?: number; company_id?: string; search?: string }
): Promise<ApiResponse<User[]>> {
    const supabase = await createSupabaseServerClient();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let qb = supabase
        .from("users")
        .select("*, role:roles(*), company:companies(*)", { count: "exact" })
        .order("full_name")
        .range(from, to);

    if (query.company_id) {
        qb = qb.eq("company_id", query.company_id);
    }

    // Search by full_name — case-insensitive partial match (uses pg_trgm GIN index)
    if (query.search && query.search.trim().length > 0) {
        qb = qb.ilike("full_name", `%${query.search.trim()}%`);
    }

    const { data, error, count } = await qb;

    if (error) {
        return { success: false, error: { code: "DB_ERROR", message: error.message } };
    }

    return {
        success: true,
        data: (data as unknown as User[]) ?? [],
        meta: {
            page,
            pageSize,
            total: count ?? 0,
            totalPages: Math.ceil((count ?? 0) / pageSize),
        },
    };
}

export async function createUser(
    session: AuthSession,
    input: CreateUserInput
): Promise<ApiResponse<User>> {
    const supabase = getServiceClient();

    // 0. Check if email already exists in users table
    const { data: existing } = await supabase
        .from("users")
        .select("id")
        .eq("email", input.email)
        .single();

    if (existing) {
        return {
            success: false,
            error: {
                code: "DUPLICATE_EMAIL",
                message: "Email sudah terdaftar. Gunakan email lain.",
            },
        };
    }

    // 1. Create auth user via Supabase Admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: { full_name: input.full_name },
    });

    if (authError || !authData.user) {
        return {
            success: false,
            error: {
                code: "AUTH_CREATE_FAILED",
                message: authError?.message ?? "Failed to create auth user",
            },
        };
    }

    // 2. Upsert profile into users table (since a database trigger might have already created a default row)
    const { data, error } = await supabase
        .from("users")
        .upsert({
            id: authData.user.id,
            email: input.email,
            full_name: input.full_name,
            company_id: input.company_id,
            role_id: input.role_id,
            created_by: session.user.id,
        })
        .select("*, role:roles(*), company:companies(*)")
        .single();

    if (error) {
        // Cleanup: delete the auth user if profile insert fails
        await supabase.auth.admin.deleteUser(authData.user.id);
        return { success: false, error: { code: "CREATE_FAILED", message: error.message } };
    }

    return { success: true, data: data as unknown as User };
}

export async function updateUser(
    id: string,
    input: UpdateUserInput
): Promise<ApiResponse<User>> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
        .from("users")
        .update(input)
        .eq("id", id)
        .select("*, role:roles(*), company:companies(*)")
        .single();

    if (error) {
        return { success: false, error: { code: "UPDATE_FAILED", message: error.message } };
    }

    return { success: true, data: data as unknown as User };
}

export async function deactivateUser(
    id: string
): Promise<ApiResponse<{ deactivated: boolean }>> {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
        .from("users")
        .update({ is_active: false })
        .eq("id", id);

    if (error) {
        return { success: false, error: { code: "DELETE_FAILED", message: error.message } };
    }

    return { success: true, data: { deactivated: true } };
}
