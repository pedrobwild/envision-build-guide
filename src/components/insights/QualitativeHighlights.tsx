import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Brain, ShieldAlert, MessageCircleQuestion, Eye, Target,
  UserCheck, AlertTriangle, ArrowRight, CheckCircle2, HelpCircle,
} from "lucide-react";

function safeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

const freqColor: Record<string, string> = {
  alta: "bg-red-500/10 text-red-700 border-red-200",
  média: "bg-amber-500/10 text-amber-700 border-amber-200",
  baixa: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
};

interface PersonalityProfileItem {
  type?: unknown;
  frequency?: unknown;
  description?: unknown;
  approachStrategy?: unknown;
}
interface ObjectionItem { objection?: unknown; rebuttal?: unknown; }
interface QuestionItem { question?: unknown; idealAnswer?: unknown; }
interface BuyingSignalItem { signal?: unknown; action?: unknown; }

interface QualitativeHighlightsData {
  personalityProfiles?: PersonalityProfileItem[];
  objections?: ObjectionItem[];
  topQuestions?: QuestionItem[];
  buyingSignals?: BuyingSignalItem[];
  buyerPersona?: unknown;
}

export default function QualitativeHighlights({ data }: { data: QualitativeHighlightsData | null | undefined }) {
  if (!data) return null;

  const hasProfiles = Array.isArray(data.personalityProfiles) && data.personalityProfiles.length > 0;
  const hasObjections = Array.isArray(data.objections) && data.objections.length > 0;
  const hasQuestions = Array.isArray(data.topQuestions) && data.topQuestions.length > 0;
  const hasBuyingSignals = Array.isArray(data.buyingSignals) && data.buyingSignals.length > 0;
  const hasBuyerPersona = !!data.buyerPersona;

  if (!hasProfiles && !hasObjections && !hasQuestions && !hasBuyingSignals && !hasBuyerPersona) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pt-2">
        <div className="h-px flex-1 bg-border/60" />
        <Badge variant="outline" className="text-xs font-medium text-primary border-primary/20 px-3 py-1">
          <Brain className="h-3 w-3 mr-1.5" />
          Inteligência Qualitativa
        </Badge>
        <div className="h-px flex-1 bg-border/60" />
      </div>

      {/* Personality Profiles - top-level highlight */}
      {hasProfiles && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {data.personalityProfiles!.slice(0, 3).map((p, i: number) => (
            <Card key={i} className="border-border/60 overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-primary/5 border-b border-border/40 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-foreground">{safeText(p.type)}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${freqColor[safeText(p.frequency)] || ""}`}>
                    {safeText(p.frequency)}
                  </Badge>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{safeText(p.description)}</p>
                  <div className="rounded-md bg-emerald-500/5 p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-medium mb-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Abordagem
                    </p>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed line-clamp-2">
                      {safeText(p.approachStrategy)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Two-column: Top Objections + Top Questions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Objections */}
        {hasObjections && (
          <Card className="border-border/60 overflow-hidden">
            <div className="bg-muted/30 border-b border-border/40 px-4 py-3 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Top Objeções</p>
              <Badge variant="outline" className="ml-auto text-[10px]">{data.objections.length}</Badge>
            </div>
            <CardContent className="p-4 space-y-2.5">
              {data.objections!.slice(0, 4).map((o, i: number) => (
                <div key={i} className="flex items-start gap-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground leading-snug">{safeText(o.objection)}</p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 leading-relaxed line-clamp-2">
                      → {safeText(o.rebuttal)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Top Questions */}
        {hasQuestions && (
          <Card className="border-border/60 overflow-hidden">
            <div className="bg-muted/30 border-b border-border/40 px-4 py-3 flex items-center gap-2">
              <MessageCircleQuestion className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Perguntas Frequentes</p>
              <Badge variant="outline" className="ml-auto text-[10px]">{data.topQuestions.length}</Badge>
            </div>
            <CardContent className="p-4 space-y-2.5">
              {data.topQuestions!.slice(0, 4).map((q, i: number) => (
                <div key={i} className="flex items-start gap-2.5">
                  <HelpCircle className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground leading-snug">"{safeText(q.question)}"</p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                      {safeText(q.idealAnswer)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Buying Signals - compact */}
      {hasBuyingSignals && (
        <Card className="border-border/60 overflow-hidden">
          <div className="bg-muted/30 border-b border-border/40 px-4 py-3 flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Sinais de Compra Identificados</p>
            <Badge variant="outline" className="ml-auto text-[10px]">{data.buyingSignals.length}</Badge>
          </div>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {data.buyingSignals!.slice(0, 6).map((s, i: number) => (
                <div key={i} className="flex items-start gap-2 rounded-md border border-border/40 p-2.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">{safeText(s.signal)}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">→ {safeText(s.action)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
