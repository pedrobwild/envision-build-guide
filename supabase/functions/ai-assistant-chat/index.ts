import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { toArrayBuffer } from "../_shared/bytes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o **Assistente BWild**, especialista no projeto **orcamento-bwild** — plataforma da BWild Engine para gestão de orçamentos de reformas residenciais de alto padrão em São Paulo.

# Idioma
Responda **SEMPRE em português brasileiro (pt-BR)**, mesmo que a pergunta venha em outro idioma. Use tom profissional, direto e cordial — como um colega sênior do time. Trate o usuário por "você".

# Domínio do produto
- **Orçamento Público** (link compartilhável com o cliente): hero, galeria 3D, composição de investimento, simulador de parcelas (até 12x sem juros), itens opcionais, ROI, solicitação de contrato via WhatsApp.
- **Editor de Orçamento V2**: seções, itens com BDI, mídias por item, templates, versionamento, importação de Excel/PDF, cronograma de reforma.
- **Pipeline Comercial** (/admin/comercial): kanban por status interno, filtros de prazo (due_at), revisão solicitada, temperatura do deal.
- **Dashboard Admin**: KPIs por internal_status, funil duplo, backlog aging, alertas operacionais, forecast.
- **Catálogo**: produtos e prestadores, fornecedores, histórico de preços, alertas de variação.
- **CRM de Clientes**: múltiplos imóveis (client_properties), visões salvas, ações em massa, inline edit com undo.
- **Workspace de Produção**: orçamentista gerencia backlog, briefing, plantas, mídias.

# Status internos (internal_status)
\`novo\`, \`em_analise\`, \`waiting_info\` (Aguardando), \`em_revisao\`, \`revision_requested\`, \`delivered_to_sales\` (Entregue), \`published\`, \`minuta_solicitada\`, \`contrato_fechado\`, \`perdido\`.

# Papéis (RBAC)
\`admin\` (visão global), \`comercial\` (carteira + leads sem dono), \`orcamentista\` (produção).

# Integrações
Digisac (WhatsApp), HubSpot (deals), Meta Ads (lead webhook), Elephan (reuniões), Lovable Cloud (Supabase).

# Stack técnico
React 18 + Vite + TypeScript + Tailwind + shadcn/ui + Supabase (RLS + Edge Functions Deno) + React Query + Framer Motion.

# Análise de arquivos
Quando o usuário enviar arquivos (PDFs, imagens, planilhas, documentos, áudios), você recebe:
- **Imagens**: como entrada visual nativa — analise diretamente (plantas, prints, fotos de obra, referências).
- **PDFs / Word / Excel / áudio transcrito**: como bloco de texto extraído anexado à mensagem, identificado por \`[Arquivo: nome.ext]\`.

Ao receber arquivos, faça nesta ordem:
1. **Resuma em 1-2 linhas** o que é o arquivo.
2. **Responda à pergunta do usuário** com base no conteúdo. Se não houver pergunta, ofereça insights úteis (valores totais, escopo, divergências, riscos).
3. **Sugira 3-5 próximas ações** específicas do contexto BWild (ex.: "criar orçamento com esses itens", "abrir cliente X no CRM", "comparar com template Y", "marcar como aguardando_info").
4. Use markdown (listas, tabelas, \`código\`) para clareza.

# Diretrizes gerais
1. **Foco no orcamento-bwild**: assuma o contexto deste projeto quando ambíguo.
2. **Markdown** para listas, código (\`\`\`tsx), tabelas e ênfase.
3. **Seja específico**: cite páginas reais (\`/admin/comercial\`), componentes (\`BudgetEditorV2\`), tabelas (\`budgets\`) quando relevante.
4. **Respostas curtas por padrão**; expanda apenas se pedirem detalhes.
5. **Não invente** rotas, tabelas ou features. Se não souber, diga.
6. **Copy para clientes**: tom premium, claro, sem jargão técnico.
7. **Privacidade**: nunca exponha custos internos, BDI ou margem em textos voltados ao cliente final.`;

type Attachment = {
  name: string;
  mimeType: string;
  // Either dataUrl (for images, sent as-is) or base64 (for files we need to extract)
  dataUrl?: string;
  base64?: string;
};

type IncomingMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: Attachment[];
};

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_TOTAL_BYTES = 40 * 1024 * 1024; // 40MB total per request
const MAX_EXTRACTED_CHARS = 60_000; // ~15k tokens cap per file

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function truncate(text: string, max = MAX_EXTRACTED_CHARS): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n\n[...truncado em ${max} caracteres de ${text.length}]`;
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  // unpdf works in Deno without native deps
  const { extractText, getDocumentProxy } = await import("https://esm.sh/unpdf@0.12.1");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return typeof text === "string" ? text : (text as string[]).join("\n\n");
}

async function extractXlsxText(bytes: Uint8Array): Promise<string> {
  const XLSX = await import("https://esm.sh/xlsx@0.18.5");
  const wb = XLSX.read(bytes, { type: "array" });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim()) parts.push(`### Planilha: ${name}\n${csv}`);
  }
  return parts.join("\n\n");
}

async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("https://esm.sh/mammoth@1.8.0");
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const result = await mammoth.extractRawText({ arrayBuffer: ab });
  return result.value || "";
}

async function transcribeAudio(
  bytes: Uint8Array,
  filename: string,
  mimeType: string,
  apiKey: string,
): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([bytes as BlobPart], { type: mimeType }), filename);
  form.append("model", "whisper-1");
  form.append("language", "pt");
  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`Whisper falhou: ${resp.status} ${t}`);
  }
  const json = await resp.json();
  return json.text || "";
}

async function processAttachment(
  att: Attachment,
  apiKey: string,
): Promise<{ kind: "image"; dataUrl: string } | { kind: "text"; text: string }> {
  const mime = att.mimeType.toLowerCase();

  // Images → multimodal vision input
  if (mime.startsWith("image/")) {
    const dataUrl = att.dataUrl ?? `data:${mime};base64,${att.base64}`;
    return { kind: "image", dataUrl };
  }

  if (!att.base64) {
    return { kind: "text", text: `[Arquivo: ${att.name}] (conteúdo ausente)` };
  }

  const bytes = base64ToBytes(att.base64);
  if (bytes.length > MAX_FILE_BYTES) {
    return {
      kind: "text",
      text: `[Arquivo: ${att.name}] (excede 20MB — não foi processado)`,
    };
  }

  try {
    let extracted = "";

    if (mime === "application/pdf" || att.name.toLowerCase().endsWith(".pdf")) {
      extracted = await extractPdfText(bytes);
    } else if (
      mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mime === "application/vnd.ms-excel" ||
      /\.(xlsx|xls|csv)$/i.test(att.name)
    ) {
      if (/\.csv$/i.test(att.name) || mime === "text/csv") {
        extracted = new TextDecoder().decode(bytes);
      } else {
        extracted = await extractXlsxText(bytes);
      }
    } else if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      /\.docx$/i.test(att.name)
    ) {
      extracted = await extractDocxText(bytes);
    } else if (mime.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|webm|mp4)$/i.test(att.name)) {
      extracted = await transcribeAudio(bytes, att.name, mime || "audio/mpeg", apiKey);
    } else if (mime.startsWith("text/") || /\.(txt|md|json|csv|log)$/i.test(att.name)) {
      extracted = new TextDecoder().decode(bytes);
    } else {
      return {
        kind: "text",
        text: `[Arquivo: ${att.name}] (tipo não suportado: ${mime})`,
      };
    }

    extracted = (extracted || "").trim();
    if (!extracted) {
      return { kind: "text", text: `[Arquivo: ${att.name}] (sem texto extraível)` };
    }

    return {
      kind: "text",
      text: `[Arquivo: ${att.name}]\n\`\`\`\n${truncate(extracted)}\n\`\`\``,
    };
  } catch (err) {
    console.error(`Erro ao processar ${att.name}:`, err);
    return {
      kind: "text",
      text: `[Arquivo: ${att.name}] (falha ao extrair: ${err instanceof Error ? err.message : "erro desconhecido"})`,
    };
  }
}

async function buildOpenAIMessages(messages: IncomingMessage[], apiKey: string) {
  const out: Array<{ role: string; content: unknown }> = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  for (const msg of messages) {
    if (!msg.attachments || msg.attachments.length === 0) {
      out.push({ role: msg.role, content: msg.content });
      continue;
    }

    // Validate total size
    const totalBytes = msg.attachments.reduce((acc, a) => {
      const b64len = (a.base64 ?? a.dataUrl?.split(",")[1] ?? "").length;
      return acc + Math.floor((b64len * 3) / 4);
    }, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      out.push({
        role: msg.role,
        content:
          msg.content +
          `\n\n[Anexos excedem 40MB combinados — ignorados. Reenvie em partes menores.]`,
      });
      continue;
    }

    const parts: Array<Record<string, unknown>> = [];
    if (msg.content?.trim()) {
      parts.push({ type: "text", text: msg.content });
    }

    for (const att of msg.attachments) {
      const processed = await processAttachment(att, apiKey);
      if (processed.kind === "image") {
        parts.push({ type: "image_url", image_url: { url: processed.dataUrl } });
      } else {
        parts.push({ type: "text", text: processed.text });
      }
    }

    if (parts.length === 0) {
      parts.push({ type: "text", text: "(mensagem vazia com anexos)" });
    }

    out.push({ role: msg.role, content: parts });
  }

  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { messages } = (await req.json()) as { messages: IncomingMessage[] };
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const hasAttachments = messages.some((m) => m.attachments && m.attachments.length > 0);
    const openaiMessages = await buildOpenAIMessages(messages, OPENAI_API_KEY);

    // Use a vision-capable model when attachments are present
    const model = hasAttachments ? "gpt-4o" : "gpt-4o-mini";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: openaiMessages,
        stream: true,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI error:", response.status, errText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "Chave OpenAI inválida ou expirada." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "Falha ao chamar OpenAI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    console.error("ai-assistant-chat error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
