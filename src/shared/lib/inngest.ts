// ============================================
// Inngest Client — BKK Automatic V3
// ============================================

import { Inngest } from "inngest";

export const inngest = new Inngest({
    id: "bkk-automatic-v3",
    name: "BKK Automatic V3",
});

// ---- Event Types ----

export type AiParseRequestedEvent = {
    name: "ai/parse.requested";
    data: {
        job_id: string;
        file_path: string;
        company_id: string;
        initiated_by: string;
        original_filename: string;
    };
};

export type InngestEvents = {
    "ai/parse.requested": AiParseRequestedEvent;
};
