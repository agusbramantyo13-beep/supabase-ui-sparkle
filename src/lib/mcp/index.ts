import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProductsTool from "./tools/list-products";
import listInventoryTool from "./tools/list-inventory";
import salesSummaryTool from "./tools/sales-summary";
import listMembersTool from "./tools/list-members";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "kenzho-apps-mcp",
  title: "KENZHO Apps MCP",
  version: "0.1.0",
  instructions:
    "Read-only tools for the KENZHO Apps POS: query products, inventory, loyalty members, and sales summaries scoped to the signed-in user's accessible stores.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProductsTool, listInventoryTool, salesSummaryTool, listMembersTool],
});
