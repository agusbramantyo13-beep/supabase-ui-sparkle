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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user: caller },
    } = await callerClient.auth.getUser(authHeader.replace("Bearer ", ""));

    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (!profile || profile.role !== "developer") {
      return new Response(
        JSON.stringify({ error: "Forbidden: only developers can create users" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();
    const { email, password, name, role, store_id, store_role } = body ?? {};

    if (!email || !password || !name || !role) {
      return new Response(
        JSON.stringify({ error: "email, password, name, and role are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password minimal 6 karakter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (role !== "developer" && role !== "staff") {
      return new Response(
        JSON.stringify({ error: "role must be 'developer' or 'staff'" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (store_id && store_role && store_role !== "owner" && store_role !== "cashier") {
      return new Response(
        JSON.stringify({ error: "store_role must be 'owner' or 'cashier'" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create user via admin API - happens server-side, doesn't touch caller's session
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (createErr || !created?.user) {
      const msg = createErr?.message ?? "Gagal membuat pengguna";
      const friendly =
        /already registered|already exists|duplicate/i.test(msg)
          ? "Email sudah terdaftar"
          : msg;
      return new Response(JSON.stringify({ error: friendly }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = created.user.id;

    // Upsert profile with correct name and role (handle_new_user trigger may have already created a row)
    const { error: profileErr } = await adminClient
      .from("profiles")
      .upsert(
        { id: newUserId, email, name, role },
        { onConflict: "id" }
      );

    if (profileErr) {
      return new Response(
        JSON.stringify({
          success: true,
          user_id: newUserId,
          warning: `Pengguna dibuat tapi gagal menyimpan profil: ${profileErr.message}`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let warning: string | undefined;

    if (store_id) {
      const { error: memberErr } = await adminClient.from("store_members").insert({
        user_id: newUserId,
        store_id,
        role: store_role || "cashier",
      });
      if (memberErr) {
        warning = `Pengguna dibuat tapi gagal ditugaskan ke toko: ${memberErr.message}. Silakan assign manual.`;
      }
    }

    return new Response(
      JSON.stringify({ success: true, user_id: newUserId, warning }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
