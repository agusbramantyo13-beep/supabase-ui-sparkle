import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "sales_summary",
  title: "Sales summary",
  description:
    "Return total sales and transaction count for the signed-in user's stores between two ISO dates (inclusive).",
  inputSchema: {
    from: z.string().describe("Start date, ISO 8601 (e.g. 2026-01-01)."),
    to: z.string().describe("End date, ISO 8601 (e.g. 2026-01-31)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("sales")
      .select("id, total, created_at, store_id")
      .gte("created_at", from)
      .lte("created_at", to);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const totalRevenue = (data ?? []).reduce((s, r: any) => s + Number(r.total ?? 0), 0);
    const summary = { transactions: data?.length ?? 0, totalRevenue, from, to };
    return {
      content: [{ type: "text", text: JSON.stringify(summary) }],
      structuredContent: summary,
    };
  },
});
