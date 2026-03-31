import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const token = authHeader.replace("Bearer ", "");

    // Verify caller with anon client
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: userError } = await anonClient.auth.getUser(token);

    if (userError || !caller) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...payload } = await req.json();

    // ── LIST USERS ──
    if (action === "list_users") {
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, full_name, is_active, created_at");

      const { data: allRoles } = await adminClient
        .from("user_roles")
        .select("user_id, role");

      // Get emails from auth.users
      const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });

      const enriched = (profiles || []).map((p: any) => {
        const authUser = (authUsers || []).find((u: any) => u.id === p.id);
        const roles = (allRoles || [])
          .filter((r: any) => r.user_id === p.id)
          .map((r: any) => r.role);
        return {
          ...p,
          email: authUser?.email ?? "—",
          roles,
        };
      });

      return new Response(JSON.stringify({ users: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── INVITE USER ──
    if (action === "invite_user") {
      const { email, full_name, role } = payload;

      if (!email || !role) {
        return new Response(JSON.stringify({ error: "email and role are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create user with a temp password (they'll reset)
      const tempPassword = crypto.randomUUID() + "Aa1!";
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: full_name || "" },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create profile
      await adminClient.from("profiles").upsert({
        id: newUser.user.id,
        full_name: full_name || "",
      });

      // Assign role
      await adminClient.from("user_roles").insert({
        user_id: newUser.user.id,
        role,
      });

      // Send password reset so user can set their own password
      await adminClient.auth.admin.generateLink({
        type: "recovery",
        email,
      });

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── UPDATE ROLES ──
    if (action === "update_roles") {
      const { user_id, roles } = payload;

      if (!user_id || !Array.isArray(roles)) {
        return new Response(JSON.stringify({ error: "user_id and roles[] required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Don't allow removing own admin role
      if (user_id === caller.id && !roles.includes("admin")) {
        return new Response(JSON.stringify({ error: "Cannot remove your own admin role" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete existing roles and re-insert
      await adminClient.from("user_roles").delete().eq("user_id", user_id);

      if (roles.length > 0) {
        await adminClient.from("user_roles").insert(
          roles.map((r: string) => ({ user_id, role: r }))
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── TOGGLE ACTIVE ──
    if (action === "toggle_active") {
      const { user_id, is_active } = payload;

      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Don't allow deactivating yourself
      if (user_id === caller.id && !is_active) {
        return new Response(JSON.stringify({ error: "Cannot deactivate yourself" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from("profiles").update({ is_active }).eq("id", user_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SET PASSWORD ──
    if (action === "set_password") {
      const { user_id, password } = payload;

      if (!user_id || !password) {
        return new Response(JSON.stringify({ error: "user_id and password required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await adminClient.auth.admin.updateUserById(user_id, {
        password,
      });

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── BULK SET PASSWORD ──
    if (action === "bulk_set_password") {
      const { password } = payload;

      if (!password) {
        return new Response(JSON.stringify({ error: "password required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      const results: { user_id: string; email: string; success: boolean; error?: string }[] = [];

      for (const user of (authUsers || [])) {
        const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, { password });
        results.push({
          user_id: user.id,
          email: user.email ?? "—",
          success: !updateError,
          error: updateError?.message,
        });
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
