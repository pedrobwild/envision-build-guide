/**
 * OrcamentistaHome — home da orçamentista (papel ativo "orcamentista").
 *
 * MVP: redireciona usuários para o EstimatorDashboard existente
 * (`/admin/producao`) que já é a tela de produção. Vamos manter
 * uma versão dedicada como placeholder funcional aqui — futuro:
 * 4 zonas god-mode (header com SLA pessoal, filas de produção,
 * KPIs de eficiência, carga atual + bloqueios).
 */

import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Hammer, Inbox, Clock3, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PainelHeader } from "@/components/dashboard/PainelHeader";
import { FilaCard } from "@/components/dashboard/FilaCard";

const SECTION_DELAY = 0.05;
const anim = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

export default function OrcamentistaHome() {
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      <motion.div {...anim(0)}>
        <PainelHeader
          subtitle="Sua produção em foco. Filas, SLA e bloqueios em uma página."
          actions={
            <Button size="sm" className="gap-1.5 h-8" onClick={() => navigate("/admin/producao")}>
              <Hammer className="h-3.5 w-3.5" /> Pipeline completo
              <ArrowRight className="h-3 w-3" />
            </Button>
          }
        />
      </motion.div>

      <motion.div {...anim(SECTION_DELAY)} className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
        <Hammer className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
        <h2 className="text-sm font-semibold font-display text-foreground tracking-tight mb-1">
          Painel de produção em construção
        </h2>
        <p className="text-xs text-muted-foreground font-body max-w-md mx-auto">
          A versão "god mode" da home de orçamentista chega na próxima
          iteração. Por enquanto, use o pipeline completo para suas
          tarefas do dia.
        </p>
        <Button variant="outline" size="sm" className="mt-4 gap-1.5 h-8" onClick={() => navigate("/admin/producao")}>
          Abrir pipeline de orçamentos <ArrowRight className="h-3 w-3" />
        </Button>
      </motion.div>

      <motion.div {...anim(SECTION_DELAY * 2)}>
        <h2 className="text-sm font-semibold font-display text-foreground tracking-tight mb-3">
          Atalhos rápidos
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FilaCard
            icon={Inbox}
            label="Solicitações novas"
            count={0}
            description="Briefings recebidos aguardando triagem ou início de produção."
            priority="info"
            actionLabel="Ver solicitações"
            onAction={() => navigate("/admin/solicitacoes")}
          />
          <FilaCard
            icon={Clock3}
            label="SLA em risco"
            count={0}
            description="Orçamentos com prazo próximo do vencimento que precisam de prioridade."
            priority="warning"
            actionLabel="Ver no pipeline"
            onAction={() => navigate("/admin/producao?filter=sla_risk")}
          />
          <FilaCard
            icon={AlertTriangle}
            label="Aguardando informação"
            count={0}
            description="Orçamentos parados por falta de retorno do comercial ou cliente."
            priority="warning"
            actionLabel="Cobrar retorno"
            onAction={() => navigate("/admin/producao?status=waiting_info")}
          />
        </div>
      </motion.div>
    </div>
  );
}
