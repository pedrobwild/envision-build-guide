import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, TrendingDown, AlertTriangle, Clock, CalendarRange, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import ScoreBreakdown, { type ScoreFactor } from "./ScoreBreakdown";

interface LeadScore {
  title: string;
  date: string | null;
  durationMinutes: number;
  sentiment: string | null;
  score: number;
  scoreBreakdown?: ScoreFactor[];
  objectionCount: number;
  competitorMentions: number;
  summary: string | null;
}

function getScoreTier(score: number) {
  if (score >= 75) return { label: "Quente", color: "bg-emerald-500", textColor: "text-emerald-700", bgLight: "bg-emerald-500/10", icon: Flame };
  if (score >= 50) return { label: "Morno", color: "bg-amber-500", textColor: "text-amber-700", bgLight: "bg-amber-500/10", icon: Clock };
  return { label: "Frio", color: "bg-blue-400", textColor: "text-blue-700", bgLight: "bg-blue-400/10", icon: TrendingDown };
}

const sentimentLabel: Record<string, string> = {
  positive: "Positivo",
  negative: "Negativo",
  neutral: "Neutro",
};

export default function LeadRanking({ leads }: { leads: LeadScore[] }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!leads?.length) return null;

  const hot = leads.filter((l) => l.score >= 75).length;
  const warm = leads.filter((l) => l.score >= 50 && l.score < 75).length;
  const cold = leads.filter((l) => l.score < 50).length;

  return (
    <Card className="border-border/60 overflow-hidden">
      <CardHeader className="pb-3 bg-muted/30">
        <CardTitle className="text-base flex items-center gap-2">
          <Flame className="h-4.5 w-4.5 text-primary" />
          Ranking de Leads — Prontidão de Compra
          <div className="ml-auto flex items-center gap-2">
            {hot > 0 && (
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200">
                {hot} quente{hot > 1 ? "s" : ""}
              </Badge>
            )}
            {warm > 0 && (
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-200">
                {warm} morno{warm > 1 ? "s" : ""}
              </Badge>
            )}
            {cold > 0 && (
              <Badge variant="outline" className="text-[10px] bg-blue-400/10 text-blue-700 border-blue-200">
                {cold} frio{cold > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-2">
        {leads.map((lead, i) => {
          const tier = getScoreTier(lead.score);
          const TierIcon = tier.icon;
          const isExpanded = expandedIndex === i;

          return (
            <div key={i} className="rounded-lg border border-border/60 transition-colors hover:bg-muted/30 overflow-hidden">
              <div
                className="flex items-center gap-3 p-3 cursor-pointer"
                onClick={() => setExpandedIndex(isExpanded ? null : i)}
              >
                <div className="relative shrink-0 w-12 h-12 flex items-center justify-center">
                  <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.5" fill="none"
                      className={lead.score >= 75 ? "stroke-emerald-500" : lead.score >= 50 ? "stroke-amber-500" : "stroke-blue-400"}
                      strokeWidth="3" strokeDasharray={`${lead.score * 0.974} 100`} strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-xs font-bold tabular-nums text-foreground">{lead.score}</span>
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{lead.title}</p>
                    <Badge variant="outline" className={`shrink-0 text-[10px] ${tier.bgLight} ${tier.textColor} border-transparent`}>
                      <TierIcon className="h-2.5 w-2.5 mr-0.5" />
                      {tier.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    {lead.date && (
                      <span className="flex items-center gap-1">
                        <CalendarRange className="h-3 w-3" />
                        {new Date(lead.date).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                    <span>{lead.durationMinutes}min</span>
                    {lead.sentiment && typeof lead.sentiment === "string" ? (
                      <span>{sentimentLabel[lead.sentiment] || lead.sentiment}</span>
                    ) : (
                      <span className="text-muted-foreground/40 italic">N/A</span>
                    )}
                    {lead.objectionCount > 0 && (
                      <span className="flex items-center gap-0.5 text-amber-600">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {lead.objectionCount} objeç{lead.objectionCount > 1 ? "ões" : "ão"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="hidden sm:block w-24 shrink-0">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${tier.color}`} style={{ width: `${lead.score}%` }} />
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" aria-label={isExpanded ? "Recolher detalhes" : "Expandir detalhes"}>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-border/40 space-y-4 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                  {/* Score breakdown — NEW */}
                  <ScoreBreakdown breakdown={lead.scoreBreakdown || []} />

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-md bg-muted/50 p-2.5">
                      <span className="text-muted-foreground block mb-0.5">Duração</span>
                      <span className="font-semibold text-foreground">{lead.durationMinutes} min</span>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2.5">
                      <span className="text-muted-foreground block mb-0.5">Sentimento</span>
                      <span className="font-semibold text-foreground">
                        {lead.sentiment ? sentimentLabel[lead.sentiment] || lead.sentiment : "N/A"}
                      </span>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2.5">
                      <span className="text-muted-foreground block mb-0.5">Objeções</span>
                      <span className="font-semibold text-foreground">{lead.objectionCount}</span>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2.5">
                      <span className="text-muted-foreground block mb-0.5">Menções a concorrentes</span>
                      <span className="font-semibold text-foreground">{lead.competitorMentions}</span>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground block mb-1">Resumo da reunião</span>
                    {lead.summary ? (
                      <p>{lead.summary}</p>
                    ) : (
                      <p className="italic">Sem resumo disponível para esta reunião.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
