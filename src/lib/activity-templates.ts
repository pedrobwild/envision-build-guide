import type { LucideIcon } from "lucide-react";
import {
  FileText,
  Calendar,
  FolderOpen,
  Phone,
  Mail,
  RefreshCw,
  CheckSquare,
  Send,
  HandCoins,
  ClipboardList,
} from "lucide-react";
import type { ActivityInitialValues } from "@/components/admin/NewBudgetActivityDialog";

export interface ActivityTemplate {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: "Comercial" | "Operacional" | "Pós-venda";
  values: ActivityInitialValues;
}

/**
 * Templates de ações pré-configuradas usados na criação rápida de tarefas
 * dentro do painel "Ações & Tarefas". Cada template define tipo, título,
 * descrição e prazo padrão (offset em horas + hora do dia).
 */
export const ACTIVITY_TEMPLATES: ActivityTemplate[] = [
  {
    id: "send-revised-budget",
    label: "Enviar orçamento revisado",
    description: "Confirmar revisão e despachar nova versão ao cliente.",
    icon: Send,
    group: "Comercial",
    values: {
      type: "email",
      title: "Enviar orçamento revisado ao cliente",
      description:
        "Revisar últimos ajustes solicitados, validar valores finais e enviar a nova versão por e-mail/WhatsApp.",
      scheduledOffsetHours: 24,
      scheduledHour: 10,
    },
  },
  {
    id: "schedule-meeting",
    label: "Agendar reunião",
    description: "Marcar próxima conversa de alinhamento ou apresentação.",
    icon: Calendar,
    group: "Comercial",
    values: {
      type: "meeting",
      title: "Agendar reunião com o cliente",
      description:
        "Propor 2 horários alternativos. Enviar convite com link da videochamada e pauta resumida.",
      scheduledOffsetHours: 24,
      scheduledHour: 9,
    },
  },
  {
    id: "request-documents",
    label: "Solicitar documentos",
    description: "Pedir contrato, RG, comprovantes ou plantas atualizadas.",
    icon: FolderOpen,
    group: "Operacional",
    values: {
      type: "task",
      title: "Solicitar documentos pendentes",
      description:
        "Listar documentos necessários (RG, CPF, comprovante de endereço, plantas) e enviar ao cliente com prazo.",
      scheduledOffsetHours: 48,
      scheduledHour: 11,
    },
  },
  {
    id: "followup-call",
    label: "Follow-up por ligação",
    description: "Tirar pendências por telefone após envio do orçamento.",
    icon: Phone,
    group: "Comercial",
    values: {
      type: "call",
      title: "Ligar para follow-up do orçamento",
      description:
        "Confirmar recebimento do orçamento, esclarecer dúvidas e identificar próximos passos.",
      scheduledOffsetHours: 48,
      scheduledHour: 14,
    },
  },
  {
    id: "send-contract",
    label: "Enviar minuta de contrato",
    description: "Despachar contrato preliminar para análise jurídica.",
    icon: FileText,
    group: "Comercial",
    values: {
      type: "email",
      title: "Enviar minuta de contrato",
      description:
        "Gerar minuta com base no escopo aprovado, anexar e solicitar revisão antes da assinatura.",
      scheduledOffsetHours: 24,
      scheduledHour: 10,
    },
  },
  {
    id: "site-visit",
    label: "Agendar visita técnica",
    description: "Combinar visita ao imóvel para medição e checklist.",
    icon: ClipboardList,
    group: "Operacional",
    values: {
      type: "visit",
      title: "Agendar visita técnica ao imóvel",
      description:
        "Confirmar acesso ao imóvel, definir equipe responsável (orçamentista + arquiteto) e levar checklist.",
      scheduledOffsetHours: 72,
      scheduledHour: 9,
    },
  },
  {
    id: "review-feedback",
    label: "Revisar feedback recebido",
    description: "Avaliar contrapontos do cliente e ajustar proposta.",
    icon: RefreshCw,
    group: "Operacional",
    values: {
      type: "task",
      title: "Revisar feedback do cliente",
      description:
        "Listar pontos questionados, alinhar com produção e preparar resposta com alternativas.",
      scheduledOffsetHours: 24,
      scheduledHour: 9,
    },
  },
  {
    id: "payment-confirm",
    label: "Confirmar sinal/entrada",
    description: "Validar recebimento do primeiro pagamento.",
    icon: HandCoins,
    group: "Pós-venda",
    values: {
      type: "task",
      title: "Confirmar pagamento de sinal",
      description:
        "Conferir extrato bancário, dar baixa no financeiro e enviar comprovante para o cliente.",
      scheduledOffsetHours: 48,
      scheduledHour: 11,
    },
  },
  {
    id: "thank-you",
    label: "Agradecimento pós-venda",
    description: "Enviar mensagem de agradecimento após fechamento.",
    icon: Mail,
    group: "Pós-venda",
    values: {
      type: "email",
      title: "Enviar mensagem de agradecimento",
      description:
        "Mensagem personalizada agradecendo a confiança e reforçando próximos marcos do projeto.",
      scheduledOffsetHours: 24,
      scheduledHour: 10,
    },
  },
  {
    id: "checklist-kickoff",
    label: "Checklist de kickoff",
    description: "Validar todos os pré-requisitos antes do início da obra.",
    icon: CheckSquare,
    group: "Operacional",
    values: {
      type: "task",
      title: "Validar checklist de kickoff",
      description:
        "Confirmar contrato assinado, sinal pago, plantas finais aprovadas e equipe alocada.",
      scheduledOffsetHours: 72,
      scheduledHour: 9,
    },
  },
];

export const TEMPLATE_GROUP_ORDER: ActivityTemplate["group"][] = [
  "Comercial",
  "Operacional",
  "Pós-venda",
];
