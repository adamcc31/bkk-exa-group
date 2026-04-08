// ============================================
// Inngest API Route Handler — BKK Automatic V3
// Serves as the webhook endpoint for Inngest
// ============================================

import { serve } from "inngest/next";
import { inngest } from "@/shared/lib/inngest";
import { parseDocument } from "@/features/ai-parser/services/orchestrator";

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [parseDocument],
});
