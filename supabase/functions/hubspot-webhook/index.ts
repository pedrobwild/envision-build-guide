import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hubspot-signature-v3, x-hubspot-signature-version, x-hubspot-request-timestamp",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HUBSPOT_ACCESS_TOKEN = Deno.env.get("HUBSPOT_ACCESS_TOKEN");
    if (!HUBSPOT_ACCESS_TOKEN) {
      throw new Error("HUBSPOT_ACCESS_TOKEN is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    console.log("HubSpot webhook received:", JSON.stringify(body));

    // HubSpot sends an array of events
    const events = Array.isArray(body) ? body : [body];

    for (const event of events) {
      // Filter: only deal stage changes (propertyName === "dealstage")
      if (
        event.subscriptionType !== "deal.propertyChange" ||
        event.propertyName !== "dealstage"
      ) {
        console.log("Skipping non-dealstage event:", event.subscriptionType, event.propertyName);
        continue;
      }

      const dealId = event.objectId;
      const newStage = event.propertyValue;

      console.log(`Deal ${dealId} moved to stage: ${newStage}`);

      // Fetch deal details from HubSpot API
      const dealResponse = await fetch(
        `https://api.hubapi.com/crm/v3/objects/deals/${dealId}?properties=dealname,amount,closedate,hubspot_owner_id,pipeline,dealstage&associations=contacts`,
        {
          headers: {
            Authorization: `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!dealResponse.ok) {
        const errText = await dealResponse.text();
        console.error(`Failed to fetch deal ${dealId}: ${dealResponse.status} - ${errText}`);
        continue;
      }

      const dealData = await dealResponse.json();
      const dealProps = dealData.properties || {};

      // Fetch contact details if associated
      let contactName = "";
      let contactEmail = "";
      const contactAssociations =
        dealData.associations?.contacts?.results || [];

      if (contactAssociations.length > 0) {
        const contactId = contactAssociations[0].id;
        const contactResponse = await fetch(
          `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,email,phone`,
          {
            headers: {
              Authorization: `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
          }
        );
        if (contactResponse.ok) {
          const contactData = await contactResponse.json();
          const cp = contactData.properties || {};
          contactName = [cp.firstname, cp.lastname].filter(Boolean).join(" ");
          contactEmail = cp.email || "";
        } else {
          await contactResponse.text(); // consume body
        }
      }

      // Check if a budget already exists for this HubSpot deal
      const hubspotDealUrl = `https://app.hubspot.com/contacts/${dealId}`;
      const { data: existingBudgets } = await supabase
        .from("budgets")
        .select("id")
        .eq("hubspot_deal_url", hubspotDealUrl)
        .limit(1);

      if (existingBudgets && existingBudgets.length > 0) {
        console.log(`Budget already exists for deal ${dealId}, skipping.`);
        continue;
      }

      // Round-robin: fetch all orcamentistas and find the next one
      const { data: orcamentistas } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "orcamentista");

      let estimatorOwnerId: string | null = null;

      if (orcamentistas && orcamentistas.length > 0) {
        // Get the last assigned estimator (maybeSingle: pode não haver budget anterior)
        const { data: lastBudget, error: lastBudgetErr } = await supabase
          .from("budgets")
          .select("estimator_owner_id")
          .not("estimator_owner_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastBudgetErr) {
          console.error("hubspot-webhook: erro ao buscar último estimador:", lastBudgetErr);
        }

        const orcamentistaIds = orcamentistas.map((o) => o.user_id);
        const lastIdx = lastBudget?.estimator_owner_id
          ? orcamentistaIds.indexOf(lastBudget.estimator_owner_id)
          : -1;
        const nextIdx = (lastIdx + 1) % orcamentistaIds.length;
        estimatorOwnerId = orcamentistaIds[nextIdx];
      }

      // Create the budget request
      const { error: insertError } = await supabase.from("budgets").insert({
        client_name: contactName || dealProps.dealname || "Cliente HubSpot",
        project_name: dealProps.dealname || "Projeto via HubSpot",
        lead_email: contactEmail || null,
        lead_name: contactName || null,
        hubspot_deal_url: hubspotDealUrl,
        status: "draft",
        internal_status: "novo",
        priority: "normal",
        estimator_owner_id: estimatorOwnerId,
        demand_context: `Solicitação automática via HubSpot. Deal ID: ${dealId}`,
      });

      if (insertError) {
        console.error("Error creating budget:", insertError);
        continue;
      }

      console.log(`Budget created for deal ${dealId} → estimator: ${estimatorOwnerId}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
