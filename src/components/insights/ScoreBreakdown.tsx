import { TrendingUp, TrendingDown, MinusCircle } from "lucide-react";

export type ScoreFactorCategory =
  | "sentiment"
  | "duration"
  | "reasons"
  | "competitors"
  | "answers";

export interface ScoreFactor {
  label: string;
  delta: number;
  category: ScoreFactorCategory;
}

const categoryLabel: Record<ScoreFactorCategory, string> = {
  sentiment: "Sentimento",
  duration: "Duração",
  reasons: "Razões",
  competitors: "Concorrência",
  answers: "Respostas",
};

const categoryColor: Record<ScoreFactorCategory, string> = {
  sentiment: "bg-violet-500/10 text-violet-700 border-violet-200",
  duration: "bg-blue-500/10 text-blue-700 border-blue-200",
  reasons: "bg-amber-500/10 text-amber-700 border-amber-200",
  competitors: "bg-rose-500/10 text-rose-700 border-rose-200",
  answers: "bg-teal-500/10 text-teal-700 border-teal-200",
};

interface Props {
  baseScore?: number;
  breakdown: ScoreFactor[];
}

/** Renderiza os fatores que compuseram o lead score, ordenados por |delta|. */
export default function ScoreBreakdown({ baseScore = 50, breakdown }: Props) {
  if (!breakdown?.length) {
    return (
      <p className="text-xs italic text-muted-foreground">
        Detalhamento do score indisponível para esta reunião (cache antigo — clique em "Forçar atualização" para recalcular).
      </p>
    );
  }

  const sorted = [...breakdown].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-1">
        <span>Por que esse score?</span>
        <span className="normal-case tracking-normal">
          base <span className="font-semibold text-foreground tabular-nums">{baseScore}</span>
        </span>
      </div>
      <ul className="space-y-1.5">
        {sorted.map((f, i) => {
          const Icon = f.delta > 0 ? TrendingUp : f.delta < 0 ? TrendingDown : MinusCircle;
          const sign = f.delta > 0 ? "+" : "";
          const tone =
            f.delta > 0
              ? "text-emerald-700"
              : f.delta < 0
                ? "text-red-700"
                : "text-muted-foreground";
          return (
            <li
              key={i}
              className="flex items-center gap-2.5 rounded-md border border-border/50 bg-background/50 px-2.5 py-1.5"
            >
              <Icon className={`h-3.5 w-3.5 shrink-0 ${tone}`} />
              <span
                className={`shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${categoryColor[f.category]}`}
              >
                {categoryLabel[f.category]}
              </span>
              <span className="text-xs text-foreground flex-1 min-w-0 truncate">{f.label}</span>
              <span className={`shrink-0 text-xs font-bold tabular-nums ${tone}`}>
                {sign}
                {f.delta}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
