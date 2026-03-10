import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Play, Smartphone, BarChart3, FileText, MessageSquare, Calendar, CreditCard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const features = [
  { icon: FileText, text: "Projetos e documentos" },
  { icon: Calendar, text: "Cronograma atualizado" },
  { icon: BarChart3, text: "Relatórios semanais" },
  { icon: Smartphone, text: "Progresso da obra" },
  { icon: CreditCard, text: "Fluxo de pagamentos" },
  { icon: MessageSquare, text: "Canal direto com engenheiro" },
];

export function PortalShowcase() {
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <>
      <Card className="border-border overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-display font-bold text-foreground">
                Acompanhe tudo em tempo real
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground font-body mt-0.5">
                Transparência total: documentos, etapas, pagamentos e próximos passos.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {features.map((f, i) => (
              <motion.div
                key={f.text}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-transparent hover:border-primary/10 transition-colors"
              >
                <f.icon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <span className="text-xs font-body text-foreground">{f.text}</span>
              </motion.div>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setVideoOpen(true)}
            className="w-full gap-2 font-body text-xs sm:text-sm border-primary/20 hover:bg-primary/5 hover:text-primary"
          >
            <Play className="h-3.5 w-3.5" />
            Ver demonstração do portal
          </Button>

          <p className="text-[10px] text-muted-foreground font-body text-center">
            Sistema web e mobile disponível durante toda a obra.
          </p>
        </CardContent>
      </Card>

      <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
        <DialogContent className="sm:max-w-2xl max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="font-display">Portal do Cliente</DialogTitle>
            <DialogDescription className="font-body">
              Veja como funciona o acompanhamento da sua obra em tempo real.
            </DialogDescription>
          </DialogHeader>
          <AspectRatio ratio={16 / 9} className="bg-muted rounded-lg overflow-hidden">
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-muted/80 border border-dashed border-border rounded-lg">
              <Play className="h-10 w-10 text-muted-foreground/50" />
              <span className="text-xs text-muted-foreground font-body">
                Vídeo demonstrativo em breve
              </span>
            </div>
          </AspectRatio>
        </DialogContent>
      </Dialog>
    </>
  );
}
