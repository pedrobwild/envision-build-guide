import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Quote, FileText } from "lucide-react";

export interface EvidenceItem {
  meetingTitle?: string;
  quote?: string;
}

interface Props {
  /** Título exibido no header do modal (ex: a objeção/pergunta em si) */
  title: string;
  evidence: EvidenceItem[];
  /** Total de reuniões analisadas, para mostrar X de Y */
  totalMeetings: number;
}

/** Botão "Ver trechos" que abre modal com citações literais das reuniões. */
export default function EvidenceDialog({ title, evidence, totalMeetings }: Props) {
  if (!evidence?.length) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px] gap-1.5 px-2.5 text-muted-foreground hover:text-foreground"
        >
          <Quote className="h-3 w-3" />
          Ver {evidence.length} trecho{evidence.length > 1 ? "s" : ""}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base leading-snug">{title}</DialogTitle>
          <DialogDescription>
            Citações literais extraídas de {evidence.length} de {totalMeetings} reuniões analisadas.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto pr-1 -mr-1 space-y-3 mt-2">
          {evidence.map((e, i) => (
            <div
              key={i}
              className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2"
            >
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <FileText className="h-3 w-3" />
                <span className="font-medium truncate">
                  {e.meetingTitle || "Reunião sem título"}
                </span>
              </div>
              <blockquote className="text-sm text-foreground leading-relaxed border-l-2 border-primary/40 pl-3 italic">
                "{e.quote || ""}"
              </blockquote>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
