import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const systemPrompt = `Você é um parser especializado em orçamentos de reforma/construção civil brasileiros.
Analise o conteúdo completo e retorne um JSON estruturado com máxima fidelidade ao documento.

REGRAS OBRIGATÓRIAS:
- Extraia TODAS as seções principais e TODOS os itens listados em cada seção
- Cada seção deve conter: title, total
- Cada item deve conter: title, description (quando existir), qty, unit, unitPrice, total
- Se item não tiver valor unitário/total explícito, mantenha unitPrice/total como null
- Extraia metadados: clientName, projectName, area, bairro, version, date, grandTotal
- Valores monetários devem ser retornados como número (ex: 17100.5)
- Quantidades também devem ser número (ex: 1, 2, 4.5)
- Itens com códigos (ex: 2.1.3) pertencem à seção principal do primeiro índice (2)
- Não invente dados: se não estiver no documento, retorne null

Retorne APENAS JSON válido, sem markdown, neste formato:
{
  "meta": {
    "clientName": "string ou null",
    "projectName": "string ou null",
    "area": "string ou null",
    "bairro": "string ou null",
    "version": "string ou null",
    "date": "string ou null",
    "grandTotal": "number ou null"
  },
  "sections": [
    {
      "title": "string",
      "total": "number ou null",
      "items": [
        {
          "title": "string",
          "description": "string ou null",
          "qty": "number ou null",
          "unit": "string ou null",
          "unitPrice": "number ou null",
          "total": "number ou null"
        }
      ]
    }
  ]
}`;

function parseBrazilianNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const raw = String(value).replace(/R\$/gi, "").replace(/\s/g, "").trim();
  if (!raw) return null;

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  const normalized = (hasComma && hasDot
    ? raw.replace(/\./g, "").replace(/,/g, ".")
    : hasComma
      ? raw.replace(/,/g, ".")
      : raw
  ).replace(/[^0-9.-]/g, "");

  if (!normalized || normalized === "-" || normalized === ".") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

function extractJsonContent(content: string): string {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();

  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return content.slice(firstBrace, lastBrace + 1);
  }

  return content.trim();
}

function normalizeParsedResult(raw: any) {
  const meta = raw?.meta ?? {};
  const rawSections = Array.isArray(raw?.sections) ? raw.sections : [];

  const sections = rawSections
    .map((section: any) => {
      const title = cleanText(section?.title) ?? "Geral";
      const items = (Array.isArray(section?.items) ? section.items : [])
        .map((item: any) => ({
          title: cleanText(item?.title) ?? "",
          description: cleanText(item?.description),
          qty: parseBrazilianNumber(item?.qty),
          unit: cleanText(item?.unit),
          unitPrice: parseBrazilianNumber(item?.unitPrice),
          total: parseBrazilianNumber(item?.total),
        }))
        .filter((item: any) => item.title.length > 0);

      return {
        title,
        total: parseBrazilianNumber(section?.total),
        items,
      };
    })
    .filter((section: any) => section.title.length > 0 && (section.items.length > 0 || section.total !== null));

  return {
    meta: {
      clientName: cleanText(meta?.clientName),
      projectName: cleanText(meta?.projectName),
      area: cleanText(meta?.area),
      bairro: cleanText(meta?.bairro),
      version: cleanText(meta?.version),
      date: cleanText(meta?.date),
      grandTotal: parseBrazilianNumber(meta?.grandTotal),
    },
    sections,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { textContent, pageImages } = await req.json();

    const hasText = typeof textContent === "string" && textContent.trim().length > 0;
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

    const messages: any[] = [{ role: "system", content: systemPrompt }];

    if (hasImages) {
      const contentParts: any[] = [
        {
          type: "text",
          text: `Extraia os dados completos deste orçamento a partir das imagens.${hasText ? " Use também o texto extraído como apoio para não perder valores." : ""}${
            hasText ? `\n\nTexto extraído:\n${textContent}` : ""
          }`,
        },
      ];

      for (const img of pageImages) {
        contentParts.push({
          type: "image_url",
          image_url: {
            url: String(img).startsWith("data:") ? img : `data:image/png;base64,${img}`,
          },
        });
      }

      messages.push({ role: "user", content: contentParts });
    } else {
      messages.push({
        role: "user",
        content: `Extraia os dados estruturados completos deste orçamento:\n\n${textContent}`,
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        temperature: 0,
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
    const content = aiResult?.choices?.[0]?.message?.content || "";
    const jsonStr = extractJsonContent(content);
    const parsed = JSON.parse(jsonStr);
    const normalized = normalizeParsedResult(parsed);

    return new Response(JSON.stringify(normalized), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error parsing PDF:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to parse PDF" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
