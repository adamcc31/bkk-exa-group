// ============================================
// Home Page — Redirect to Dashboard or Login
// ============================================

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/transactions");
  } else {
    redirect("/login");
  }
}
