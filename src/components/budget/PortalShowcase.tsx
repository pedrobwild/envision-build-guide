import { Card, CardContent } from "@/components/ui/card";
import { Smartphone, BarChart3, FileText, MessageSquare, Calendar, CreditCard } from "lucide-react";
import { motion } from "framer-motion";
import portalDemoGif from "@/assets/portal-demo.gif";

const features = [
  { icon: FileText, text: "Projetos e documentos" },
  { icon: Calendar, text: "Cronograma em tempo real" },
  { icon: BarChart3, text: "Relatórios semanais" },
  { icon: Smartphone, text: "Fotos do progresso" },
  { icon: CreditCard, text: "Controle financeiro" },
  { icon: MessageSquare, text: "Chat com engenheiro" },
];

export function PortalShowcase() {
  return (
    <Card className="border-border overflow-hidden">
      <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-display font-bold text-foreground">
              Portal Bwild
            </h3>
            <p className="text-xs text-muted-foreground font-body mt-0.5">
              Acompanhe sua obra de qualquer lugar, a qualquer momento.
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

        <div className="rounded-lg overflow-hidden border border-border">
          <img
            src={portalDemoGif}
            alt="Portal Bwild — acompanhamento de obra em tempo real"
            className="w-full h-auto"
            loading="lazy"
          />
        </div>

        <p className="text-xs text-muted-foreground font-body text-center">
          Acesso web e mobile durante toda a obra.
        </p>
      </CardContent>
    </Card>
  );
}
