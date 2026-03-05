import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Play } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";

const features = [
  "Projetos e documentos",
  "Cronograma atualizado",
  "Relatórios semanais",
  "Progresso da obra",
  "Fluxo de pagamentos",
  "Canal direto com engenheiro",
];

const placeholders = ["Cronograma", "Financeiro", "Relatórios"];

export function PortalShowcase() {
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <>
      <Card className="border-border overflow-hidden">
        <CardContent className="p-5 sm:p-6 space-y-5">
          <div>
            <h3 className="text-base sm:text-lg font-display font-bold text-foreground">
              Acompanhe tudo em tempo real
            </h3>
            <p className="text-sm text-muted-foreground font-body mt-1">
              Transparência total: documentos, etapas, pagamentos e próximos passos.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {features.map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm font-body text-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {placeholders.map((p) => (
              <button
                key={p}
                onClick={() => setVideoOpen(true)}
                className="group relative aspect-video rounded-lg bg-muted/60 border border-border flex items-center justify-center cursor-pointer hover:border-primary/40 hover:bg-muted transition-all"
              >
                <span className="text-[11px] text-muted-foreground font-body group-hover:opacity-0 transition-opacity">[{p}]</span>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="h-5 w-5 text-primary" />
                </div>
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setVideoOpen(true)}
            className="w-full gap-2 font-body"
          >
            <Play className="h-4 w-4" />
            Ver demonstração do portal
          </Button>

          <p className="text-xs text-muted-foreground font-body">
            Sistema web e mobile disponível durante toda a obra.
          </p>
        </CardContent>
      </Card>

      {/* Video Demo Modal */}
      <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Portal do Cliente</DialogTitle>
            <DialogDescription className="font-body">
              Veja como funciona o acompanhamento da sua obra em tempo real.
            </DialogDescription>
          </DialogHeader>
          <AspectRatio ratio={16 / 9} className="bg-muted rounded-lg overflow-hidden">
            {/* Replace with <iframe> when a real video URL is available */}
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-muted/80 border border-dashed border-border rounded-lg">
              <Play className="h-12 w-12 text-muted-foreground/50" />
              <span className="text-sm text-muted-foreground font-body">
                Vídeo demonstrativo em breve
              </span>
            </div>
          </AspectRatio>
        </DialogContent>
      </Dialog>
    </>
  );
}
