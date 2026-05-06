// ============================================
// Home Page — Redirect to Dashboard or Login (Post-Supabase)
// ============================================

import { redirect } from "next/navigation";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function HomePage() {
    // Middleware already verified the token and set the headers
    const headerList = await headers();
    const userId = headerList.get("x-user-id");

    if (userId) {
        redirect("/transactions");
    } else {
        redirect("/login");
    }
}
