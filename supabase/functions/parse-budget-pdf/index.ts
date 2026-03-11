import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const systemPrompt = `Você é um parser especializado em orçamentos de reforma/construção civil brasileiros.
Analise o conteúdo do orçamento e retorne um JSON estruturado.

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { textContent, pageImages } = await req.json();

    const hasText = textContent && typeof textContent === "string" && textContent.trim().length > 0;
    const hasImages = Array.isArray(pageImages) && pageImages.length > 0;

    if (!hasText && !hasImages) {
      return new Response(
        JSON.stringify({ error: "textContent ou pageImages é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Build messages based on input type
    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    if (hasImages) {
      // Vision mode: send page images for OCR
      const contentParts: any[] = [
        { type: "text", text: "Extraia os dados estruturados deste orçamento a partir das imagens das páginas do PDF. Leia todo o texto visível nas imagens, incluindo tabelas, valores e cabeçalhos." },
      ];

      for (const img of pageImages) {
        contentParts.push({
          type: "image_url",
          image_url: {
            url: img.startsWith("data:") ? img : `data:image/png;base64,${img}`,
          },
        });
      }

      messages.push({ role: "user", content: contentParts });
    } else {
      // Text mode
      messages.push({
        role: "user",
        content: `Extraia os dados estruturados deste orçamento:\n\n${textContent}`,
      });
    }

    // Use gemini-2.5-flash for both text and vision (supports multimodal)
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao seu workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
