import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse({ error: "Konfigurasi server belum lengkap" }, 500);
    }

    const token = authHeader.replace("Bearer ", "");
    const callerClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user: caller },
      error: callerErr,
    } = await callerClient.auth.getUser(token);

    if (callerErr || !caller) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: profile, error: profileErr } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (profileErr || !profile || profile.role !== "developer") {
      return jsonResponse(
        { error: "Forbidden: only developers can delete users" },
        403
      );
    }

    const body = await req.json().catch(() => null);
    const userId = body?.user_id;

    if (!userId || typeof userId !== "string") {
      return jsonResponse({ error: "user_id wajib diisi" }, 400);
    }

    if (userId === caller.id) {
      return jsonResponse({ error: "Developer tidak bisa menghapus akun sendiri" }, 400);
    }

    const { error: membershipsErr } = await adminClient
      .from("store_members")
      .delete()
      .eq("user_id", userId);

    if (membershipsErr) {
      return jsonResponse(
        { error: `Gagal menghapus penugasan toko: ${membershipsErr.message}` },
        400
      );
    }

    const { error: profileDeleteErr } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileDeleteErr) {
      return jsonResponse(
        { error: `Gagal menghapus profil pengguna: ${profileDeleteErr.message}` },
        400
      );
    }

    const { error: authDeleteErr } = await adminClient.auth.admin.deleteUser(userId);

    if (authDeleteErr) {
      return jsonResponse(
        { error: `Profil terhapus, tapi gagal menghapus akun Auth: ${authDeleteErr.message}` },
        400
      );
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});