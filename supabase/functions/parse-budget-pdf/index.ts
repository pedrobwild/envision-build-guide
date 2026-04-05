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
1. Extraia ABSOLUTAMENTE TODAS as seções e TODOS os itens, sem exceção. Não pule nenhum item.
2. Cada seção deve conter: title, total (o subtotal da seção)
3. Cada item deve conter: title, description (quando existir), qty, unit, unitPrice, total

REGRAS DE PREÇO CRÍTICAS:
- MUITOS orçamentos colocam o SUBTOTAL DA SEÇÃO na coluna "Total venda" da PRIMEIRA LINHA de itens da seção, NÃO no cabeçalho da seção.
- Se apenas o primeiro item de uma seção tem um valor na coluna "Total venda" e os demais itens não têm, esse valor é o SUBTOTAL DA SEÇÃO, não o preço do item individual.
- Nesse caso: defina section.total = esse valor, e item.total = null para todos os itens da seção (incluindo o primeiro).
- Se cada item tiver seu próprio valor, então são preços individuais de itens.
- Procure o VALOR TOTAL GERAL (grandTotal) no final do documento — pode estar em uma linha separada, rodapé, ou campo "Valor (R$)".

VALIDAÇÃO OBRIGATÓRIA:
- A SOMA de TODOS os section.total DEVE ser EXATAMENTE IGUAL ao grandTotal.
- Se a soma dos section.total encontrados for MENOR que o grandTotal, significa que você PERDEU o subtotal de alguma seção.
- Nesse caso, EXAMINE A IMAGEM COM CUIDADO para encontrar os valores faltantes. Cada seção TEM um subtotal — pode estar parcialmente oculto, em fonte pequena, ou difícil de ler.
- NUNCA retorne um resultado onde a soma das seções não bata com o grandTotal sem justificativa.
- Se necessário, calcule: seção_faltante = grandTotal - soma_das_outras_seções.

METADADOS:
- Extraia: clientName, projectName, area, bairro, version, date, grandTotal
- Valores monetários brasileiros (ex: "20.188,80") devem ser convertidos para número (ex: 20188.80)
- Quantidades também como número (ex: "23,6800" → 23.68)
- Itens com códigos hierárquicos (ex: 002.01.01) pertencem à seção principal indicada pelo índice numérico (ex: "3 INFRAESTRUTURA E CIVIL")
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
  // Strip any HTML tags to prevent XSS from imported PDFs
  const text = String(value).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
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

function normalizeClientName(value: string | null): string | null {
  if (!value) return null;

  const withoutDocs = value
    .replace(/\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}/g, "")
    .replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}[-.]?\d{2}/g, "")
    .replace(/\b\d{11,14}\b/g, "")
    .replace(/\b(?:n[ºo°]\s*)?\d{5,}\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const cleaned = withoutDocs
    .replace(/^\s*(?:nome\s+do\s+)?cliente\s*[:\-–]?\s*/i, "")
    .replace(/^\s*(?:orçamento|orcamento|proposta)\s*(?:n[ºo°]\s*\d+)?\s*(?:para|de)?\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!cleaned) return null;

  return cleaned
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase("pt-BR") + part.slice(1))
    .join(" ");
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

  const grandTotal = parseBrazilianNumber(meta?.grandTotal);

  // Post-processing: validate section totals sum against grandTotal
  if (grandTotal && grandTotal > 0) {
    const sectionSum = sections.reduce((sum: number, s: any) => sum + (s.total || 0), 0);
    const diff = grandTotal - sectionSum;

    console.log(`[parse-budget-pdf] grandTotal=${grandTotal}, sectionSum=${sectionSum}, diff=${diff}`);

    // If there's a significant difference, find sections without totals and distribute
    if (Math.abs(diff) > 1) {
      const sectionsWithoutTotal = sections.filter((s: any) => !s.total || s.total === 0);
      
      if (sectionsWithoutTotal.length === 1) {
        // Only one section missing a total — assign the difference
        sectionsWithoutTotal[0].total = Math.round(diff * 100) / 100;
        console.log(`[parse-budget-pdf] Assigned missing total ${sectionsWithoutTotal[0].total} to section "${sectionsWithoutTotal[0].title}"`);
      } else if (sectionsWithoutTotal.length === 0) {
        // All sections have totals but sum doesn't match — log warning
        console.log(`[parse-budget-pdf] WARNING: All sections have totals but sum (${sectionSum}) != grandTotal (${grandTotal})`);
      } else {
        console.log(`[parse-budget-pdf] WARNING: ${sectionsWithoutTotal.length} sections missing totals, diff=${diff}`);
      }
    }
  }

  return {
    meta: {
      clientName: normalizeClientName(cleanText(meta?.clientName)),
      projectName: cleanText(meta?.projectName),
      area: cleanText(meta?.area),
      bairro: cleanText(meta?.bairro),
      version: cleanText(meta?.version),
      date: cleanText(meta?.date),
      grandTotal,
    },
    sections,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { textContent, pageImages } = body ?? {};

    // Input validation
    const hasText = typeof textContent === "string" && textContent.trim().length > 0;
    const hasImages = Array.isArray(pageImages) && pageImages.length > 0;

    if (!hasText && !hasImages) {
      return new Response(
        JSON.stringify({ error: "textContent ou pageImages é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate text content size (max 500KB)
    if (hasText && textContent.length > 500_000) {
      return new Response(
        JSON.stringify({ error: "Conteúdo de texto excede o limite de 500KB" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate image count (max 50 pages)
    if (hasImages && pageImages.length > 50) {
      return new Response(
        JSON.stringify({ error: "Máximo de 50 páginas de imagem permitidas" }),
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
          text: `Extraia os dados completos deste orçamento a partir das imagens. ATENÇÃO: o grandTotal está no final do documento. A soma de TODOS os section.total DEVE ser igual ao grandTotal. Se alguma seção não tem valor visível, examine a imagem com mais cuidado ou calcule a diferença.${hasText ? `\n\nTexto extraído (use como apoio):\n${textContent}` : ""}`,
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
        model: "google/gemini-2.5-flash",
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