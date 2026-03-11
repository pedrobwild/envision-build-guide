import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { textContent } = await req.json();

    if (!textContent || typeof textContent !== "string") {
      return new Response(
        JSON.stringify({ error: "textContent is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const systemPrompt = `Você é um parser especializado em orçamentos de reforma/construção civil brasileiros.
Analise o texto extraído de um PDF de orçamento e retorne um JSON estruturado.

REGRAS:
- Identifique seções principais (numeradas como 1, 2, 3... ou com títulos em MAIÚSCULAS) e seus itens
- Cada seção tem: title (nome), total (valor total da seção se disponível)
- Cada item tem: title, qty (quantidade), unit (unidade: VB, UN, m2, M, etc.), total (valor se disponível)
- Extraia também metadados: clientName, projectName, area (metragem), bairro, version, date
- Valores monetários devem ser números (ex: 17100.00, não "17.100,00")
- Se um item não tem valor individual, deixe total como null
- Mantenha a hierarquia: itens 1.1, 1.2 pertencem à seção 1
- Itens com sub-índices como 2.1.1, 2.1.2 também pertencem à seção pai (2)

Retorne APENAS JSON válido, sem markdown, neste formato:
{
  "meta": {
    "clientName": "string",
    "projectName": "string ou null",
    "area": "string ou null",
    "bairro": "string ou null",
    "version": "string ou null",
    "date": "string ou null",
    "grandTotal": number ou null
  },
  "sections": [
    {
      "title": "string",
      "total": number ou null,
      "items": [
        {
          "title": "string",
          "qty": number ou null,
          "unit": "string ou null",
          "total": number ou null
        }
      ]
    }
  ]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Extraia os dados estruturados deste orçamento:\n\n${textContent}` },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Extract JSON from response (handle possible markdown wrapping)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error parsing PDF:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to parse PDF" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
