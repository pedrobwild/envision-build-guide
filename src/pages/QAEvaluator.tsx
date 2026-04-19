import { useState, useRef } from "react";

const QA_CRITERIA = [
  {
    id: "floor_plan",
    label: "Planta baixa interativa",
    description: "FloorPlanViewer renderiza, filtros de cômodo funcionam (wc, quarto, cozinha, terraço)",
    prompt: 1,
  },
  {
    id: "search",
    label: "Busca de itens",
    description: "Campo de busca filtra seções e itens em tempo real",
    prompt: 1,
  },
  {
    id: "totals",
    label: "Totais corretos",
    description: "BudgetSummary exibe subtotais e Total Final sem alteração",
    prompt: 1,
  },
  {
    id: "simulator",
    label: "Simulador de parcelas",
    description: "InstallmentSimulator calcula 6x / 10x / 12x corretamente",
    prompt: 1,
  },
  {
    id: "approval",
    label: "Fluxo de aprovação (Supabase)",
    description: "ApprovalCTA abre formulário, salva nome e atualiza estado",
    prompt: 1,
  },
  {
    id: "pdf_hide",
    label: "Export PDF sem novas seções",
    description: "Novas seções têm data-pdf-hide; PDF exporta apenas o orçamento",
    prompt: 1,
  },
  {
    id: "investment_impact",
    label: "Seção: Impacto no investimento",
    description: "InvestmentImpact renderiza com tabs, 4 cards de métricas e slider de ocupação",
    prompt: 1,
  },
  {
    id: "what_included",
    label: "Seção: O que está incluso",
    description: "WhatIsIncluded renderiza 8 cards com ícone, título e descrição",
    prompt: 1,
  },
  {
    id: "journey",
    label: "Seção: Jornada do cliente",
    description: "ClientJourney renderiza 8 etapas expansíveis com Accordion",
    prompt: 1,
  },
  {
    id: "arquitetonico",
    label: "Explicador: Projeto Arquitetônico",
    description: "ArquitetonicoExpander aparece acima da seção PROJETOS com checklist e Saiba mais",
    prompt: 2,
  },
  {
    id: "engenharia",
    label: "Explicador: Engenharia e Gestão",
    description: "EngenhariaExpander renderiza bullets e chips de 'o que você evita'",
    prompt: 2,
  },
  {
    id: "portal",
    label: "Showcase: Portal Bwild",
    description: "PortalShowcase renderiza feature list e placeholders de screenshots",
    prompt: 2,
  },
  {
    id: "summary_checklist",
    label: "Checklist no resumo",
    description: "BudgetSummary tem checklist acima das seções e badge 'Sem custos ocultos'",
    prompt: 3,
  },
  {
    id: "condicoes",
    label: "Seção: Condições do Projeto",
    description: "ProjectConditions renderiza prazo estimado, orçamento fechado e checklist",
    prompt: 3,
  },
  {
    id: "next_steps",
    label: "Seção: Próximos passos",
    description: "NextSteps renderiza 5 etapas numeradas com linha conectora",
    prompt: 3,
  },
  {
    id: "cta_copy",
    label: "CTA melhorado",
    description: "ApprovalCTA exibe 'Iniciar meu projeto' e botão secundário WhatsApp",
    prompt: 3,
  },
  {
    id: "hero_chips",
    label: "Hero chips e subtitle",
    description: "BudgetHeader tem 3 value badges e subtitle de posicionamento",
    prompt: 4,
  },
  {
    id: "sticky_toc",
    label: "Sumário lateral (desktop)",
    description: "StickyTableOfContents renderiza, scrollspy funciona, oculto em mobile",
    prompt: 4,
  },
  {
    id: "mobile_bar",
    label: "Barra mobile sticky",
    description: "Bottom bar exibe total, parcela estimada e CTA 'Iniciar meu projeto'",
    prompt: 4,
  },
  {
    id: "responsive",
    label: "Responsividade geral",
    description: "Página sem overflow em mobile (375px) e desktop (1280px)",
    prompt: 4,
  },
  {
    id: "dark_mode",
    label: "Dark mode",
    description: "Todos os novos componentes respeitam o tema dark do sistema",
    prompt: 4,
  },
  {
    id: "demo_route",
    label: "Rota /demo funciona",
    description: "Budget de demonstração carrega sem erros com os novos componentes",
    prompt: 4,
  },
];

const STATUS_OPTIONS = [
  { value: "pass", label: "✅ OK", color: "#16a34a" },
  { value: "fail", label: "❌ Falhou", color: "#dc2626" },
  { value: "partial", label: "⚠️ Parcial", color: "#d97706" },
  { value: "skip", label: "⏭️ Não testado", color: "#6b7280" },
];

export default function BWildQAEvaluator() {
  const [statuses, setStatuses] = useState({});
  const [notes, setNotes] = useState({});
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiReport, setAiReport] = useState("");
  const [activePrompt, setActivePrompt] = useState(1);
  const [activeTab, setActiveTab] = useState("manual");
  const reportRef = useRef(null);

  const setStatus = (id, value) => setStatuses((s) => ({ ...s, [id]: value }));
  const setNote = (id, value) => setNotes((n) => ({ ...n, [id]: value }));

  const filteredCriteria = QA_CRITERIA.filter((c) => c.prompt === activePrompt);

  const stats = {
    pass: Object.values(statuses).filter((v) => v === "pass").length,
    fail: Object.values(statuses).filter((v) => v === "fail").length,
    partial: Object.values(statuses).filter((v) => v === "partial").length,
    total: QA_CRITERIA.length,
  };

  const score = Math.round(
    ((stats.pass + stats.partial * 0.5) / stats.total) * 100
  );

  const runAIEvaluation = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setAiReport("");

    const criteria = QA_CRITERIA.map(
      (c) => `- [Prompt ${c.prompt}] ${c.label}: ${c.description}`
    ).join("\n");

    const prompt = `Você é um engenheiro sênior de QA revisando uma implementação React+Tailwind para a página de orçamento da Bwild.

O usuário colou o código (ou descrição da página) abaixo. Avalie cada critério listado e retorne um relatório estruturado em Markdown com:

1. **Resumo executivo** (2-3 linhas)
2. **Status por critério** — para cada item: ✅ OK / ❌ Falhou / ⚠️ Parcial, com explicação de 1 linha
3. **Problemas críticos** (se houver) — o que pode quebrar a funcionalidade existente
4. **Recomendações** — o que ajustar antes de seguir para o próximo prompt

CRITÉRIOS:
${criteria}

CÓDIGO / DESCRIÇÃO:
${code.slice(0, 8000)}`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      const text = data.content?.map((b) => b.text || "").join("") || "Erro na API.";
      setAiReport(text);
    } catch (e) {
      setAiReport("Erro ao conectar com a API. Verifique sua conexão.");
    }
    setLoading(false);
  };

  // SECURITY: escape HTML before applying markdown regex.
  // The text comes from an external LLM API and must NOT be trusted.
  const escapeHtml = (raw: string) =>
    raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const renderMarkdown = (text: string) => {
    return escapeHtml(text)
      .replace(/^### (.+)$/gm, '<h3 style="font-weight:700;font-size:14px;margin:16px 0 6px;color:#1e3a5f">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 style="font-weight:700;font-size:16px;margin:20px 0 8px;color:#1e3a5f">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 style="font-weight:800;font-size:18px;margin:20px 0 8px;color:#1e3a5f">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<li style="margin:4px 0;padding-left:8px">$1</li>')
      .replace(/✅/g, '<span style="color:#16a34a">✅</span>')
      .replace(/❌/g, '<span style="color:#dc2626">❌</span>')
      .replace(/⚠️/g, '<span style="color:#d97706">⚠️</span>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", background: "#f0f4f8", minHeight: "100vh", padding: "24px" }}>
      {/* Header */}
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ background: "#1e3a5f", borderRadius: 12, padding: "20px 28px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "#7dd3fc", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Bwild · Lovable QA</div>
            <div style={{ color: "#fff", fontSize: 22, fontWeight: 800 }}>Avaliador de Implementação</div>
            <div style={{ color: "#93c5fd", fontSize: 13, marginTop: 2 }}>Valide cada prompt antes de avançar para o próximo</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, fontWeight: 900, color: score >= 80 ? "#4ade80" : score >= 50 ? "#fbbf24" : "#f87171" }}>{score}%</div>
            <div style={{ color: "#93c5fd", fontSize: 11 }}>Score geral</div>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Aprovados", value: stats.pass, color: "#16a34a", bg: "#f0fdf4" },
            { label: "Parciais", value: stats.partial, color: "#d97706", bg: "#fffbeb" },
            { label: "Falhas", value: stats.fail, color: "#dc2626", bg: "#fef2f2" },
            { label: "Total", value: stats.total, color: "#1e3a5f", bg: "#eff6ff" },
          ].map((s) => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: "14px 18px", border: `1px solid ${s.color}22` }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {["manual", "ai"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                padding: "8px 20px", borderRadius: 8, fontWeight: 700, fontSize: 13,
                background: activeTab === t ? "#1e3a5f" : "#fff",
                color: activeTab === t ? "#fff" : "#6b7280",
                border: `1px solid ${activeTab === t ? "#1e3a5f" : "#e5e7eb"}`,
                cursor: "pointer",
              }}
            >
              {t === "manual" ? "✓ Checklist Manual" : "🤖 Avaliação com IA"}
            </button>
          ))}
        </div>

        {/* Manual Tab */}
        {activeTab === "manual" && (
          <>
            {/* Prompt selector */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {[1, 2, 3, 4].map((p) => {
                const pCriteria = QA_CRITERIA.filter((c) => c.prompt === p);
                const pPass = pCriteria.filter((c) => statuses[c.id] === "pass").length;
                const allDone = pCriteria.every((c) => statuses[c.id]);
                return (
                  <button
                    key={p}
                    onClick={() => setActivePrompt(p)}
                    style={{
                      flex: 1, padding: "12px 8px", borderRadius: 10, border: `2px solid ${activePrompt === p ? "#1e3a5f" : "#e5e7eb"}`,
                      background: activePrompt === p ? "#1e3a5f" : "#fff",
                      cursor: "pointer", textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 800, color: activePrompt === p ? "#fff" : "#1e3a5f" }}>Prompt {p}</div>
                    <div style={{ fontSize: 11, color: activePrompt === p ? "#93c5fd" : "#9ca3af", marginTop: 2 }}>
                      {pPass}/{pCriteria.length} {allDone ? "✅" : ""}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Criteria cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredCriteria.map((c) => {
                const status = statuses[c.id] || "skip";
                const statusObj = STATUS_OPTIONS.find((s) => s.value === status);
                return (
                  <div key={c.id} style={{
                    background: "#fff", borderRadius: 10, padding: "16px 20px",
                    border: `1.5px solid ${status === "pass" ? "#bbf7d0" : status === "fail" ? "#fecaca" : status === "partial" ? "#fde68a" : "#e5e7eb"}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#1e3a5f", marginBottom: 3 }}>{c.label}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{c.description}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {STATUS_OPTIONS.map((s) => (
                          <button
                            key={s.value}
                            onClick={() => setStatus(c.id, s.value)}
                            style={{
                              padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
                              background: status === s.value ? s.color : "#f3f4f6",
                              color: status === s.value ? "#fff" : "#9ca3af",
                              border: `1px solid ${status === s.value ? s.color : "#e5e7eb"}`,
                            }}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {status === "fail" || status === "partial" ? (
                      <input
                        type="text"
                        placeholder="Descreva o problema..."
                        value={notes[c.id] || ""}
                        onChange={(e) => setNote(c.id, e.target.value)}
                        style={{
                          marginTop: 10, width: "100%", padding: "7px 12px", borderRadius: 6,
                          border: "1px solid #e5e7eb", fontSize: 12, color: "#374151",
                          boxSizing: "border-box", outline: "none",
                        }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* Failures summary */}
            {stats.fail > 0 && (
              <div style={{ marginTop: 20, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "16px 20px" }}>
                <div style={{ fontWeight: 800, color: "#dc2626", marginBottom: 8 }}>❌ Itens com falha — corrija antes de avançar</div>
                {QA_CRITERIA.filter((c) => statuses[c.id] === "fail").map((c) => (
                  <div key={c.id} style={{ fontSize: 12, color: "#7f1d1d", marginBottom: 4 }}>
                    • <strong>{c.label}</strong>{notes[c.id] ? `: ${notes[c.id]}` : ""}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* AI Tab */}
        {activeTab === "ai" && (
          <div>
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "14px 18px", marginBottom: 16, fontSize: 13, color: "#1e40af" }}>
              <strong>Como usar:</strong> Cole o código do arquivo modificado (ex: PublicBudget.tsx, BudgetSummary.tsx) ou descreva em texto o que foi implementado. A IA avalia contra todos os 22 critérios.
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Cole aqui o código gerado pelo Lovable (PublicBudget.tsx, novos componentes, etc.) ou descreva o que foi implementado..."
              style={{
                width: "100%", height: 200, padding: "14px", borderRadius: 10,
                border: "1.5px solid #e5e7eb", fontSize: 12, fontFamily: "monospace",
                resize: "vertical", boxSizing: "border-box", outline: "none", color: "#374151",
              }}
            />
            <button
              onClick={runAIEvaluation}
              disabled={loading || !code.trim()}
              style={{
                marginTop: 12, width: "100%", padding: "14px", borderRadius: 10,
                background: loading || !code.trim() ? "#9ca3af" : "#1e3a5f",
                color: "#fff", fontWeight: 800, fontSize: 14, cursor: loading || !code.trim() ? "not-allowed" : "pointer",
                border: "none",
              }}
            >
              {loading ? "⏳ Analisando código..." : "🤖 Avaliar implementação com IA"}
            </button>

            {aiReport && (
              <div
                ref={reportRef}
                style={{
                  marginTop: 20, background: "#fff", border: "1px solid #e5e7eb",
                  borderRadius: 10, padding: "20px 24px", fontSize: 13, lineHeight: 1.7, color: "#374151",
                }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(aiReport) }}
              />
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: "#9ca3af" }}>
          Bwild QA Evaluator · Execute um prompt no Lovable, avalie aqui, depois avance
        </div>
      </div>
    </div>
  );
}
