import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const orphanUserIds = [
  "48d9bc05-be1a-4bf0-a5ca-517008ada6ae",
  "e5484db2-5338-43b4-b476-d6b2c7723700",
  "7f105a93-c653-403c-94cd-305b51d3e427",
];

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse({ error: "Konfigurasi server belum lengkap" }, 500);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const deleted: Array<{ id: string; email: string | null; created_at: string | null }> = [];
    const skipped: Array<{ id: string; reason: string }> = [];

    for (const userId of orphanUserIds) {
      const { data: profile, error: profileErr } = await adminClient
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (profileErr) {
        skipped.push({ id: userId, reason: `Gagal cek profil: ${profileErr.message}` });
        continue;
      }

      if (profile) {
        skipped.push({ id: userId, reason: "Profil sudah ada, tidak lagi orphan" });
        continue;
      }

      const { data: userData, error: getUserErr } = await adminClient.auth.admin.getUserById(userId);

      if (getUserErr || !userData?.user) {
        skipped.push({ id: userId, reason: getUserErr?.message ?? "Akun Auth tidak ditemukan" });
        continue;
      }

      const { error: deleteErr } = await adminClient.auth.admin.deleteUser(userId);

      if (deleteErr) {
        skipped.push({ id: userId, reason: `Gagal hapus Auth: ${deleteErr.message}` });
        continue;
      }

      deleted.push({
        id: userId,
        email: userData.user.email ?? null,
        created_at: userData.user.created_at ?? null,
      });
    }

    return jsonResponse({ deleted, skipped });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});