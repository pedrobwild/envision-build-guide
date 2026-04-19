// Central role and internal status constants
// Change these to evolve business rules without touching components

export type AppRole = 'admin' | 'comercial' | 'orcamentista';

export const ROLES: Record<AppRole, { label: string; description: string }> = {
  admin: { label: 'Administrador', description: 'Acesso total ao sistema' },
  comercial: { label: 'Comercial', description: 'Gestão de clientes e propostas' },
  orcamentista: { label: 'Orçamentista', description: 'Produção de orçamentos' },
};

export const INTERNAL_STATUSES = {
  mql: { label: 'MQL', color: 'bg-slate-100 text-slate-700', icon: '🎯' },
  qualificacao: { label: 'Qualificação', color: 'bg-cyan-100 text-cyan-800', icon: '🔎' },
  lead: { label: 'Lead', color: 'bg-sky-100 text-sky-800', icon: '👤' },
  validacao_briefing: { label: 'Validação de Briefing', color: 'bg-indigo-100 text-indigo-800', icon: '📝' },
  novo: { label: 'Novo', color: 'bg-blue-100 text-blue-800', icon: '🆕' },
  requested: { label: 'Solicitado', color: 'bg-blue-100 text-blue-800', icon: '📩' },
  triage: { label: 'Triagem', color: 'bg-purple-100 text-purple-800', icon: '🔍' },
  assigned: { label: 'Atribuído', color: 'bg-indigo-100 text-indigo-800', icon: '👤' },
  in_progress: { label: 'Em Produção', color: 'bg-yellow-100 text-yellow-800', icon: '🔨' },
  waiting_info: { label: 'Aguardando', color: 'bg-amber-100 text-amber-800', icon: '⏳' },
  ready_for_review: { label: 'Revisão', color: 'bg-orange-100 text-orange-800', icon: '📋' },
  delivered_to_sales: { label: 'Entregue ao Comercial', color: 'bg-teal-100 text-teal-800', icon: '📤' },
  sent_to_client: { label: 'Enviado ao Cliente', color: 'bg-emerald-100 text-emerald-800', icon: '✉️' },
  revision_requested: { label: 'Revisão Solicitada', color: 'bg-orange-100 text-orange-700 border-orange-300', icon: '🔄' },
  minuta_solicitada: { label: 'Minuta Solicitada', color: 'bg-violet-100 text-violet-700 border-violet-300', icon: '📝' },
  contrato_fechado: { label: 'Contrato Fechado', color: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: '🤝' },

  lost: { label: 'Perdido', color: 'bg-gray-100 text-gray-600', icon: '❌' },
  archived: { label: 'Arquivado', color: 'bg-gray-100 text-gray-500', icon: '📦' },
} as const;

export const VALID_INTERNAL_STATUSES = Object.keys(INTERNAL_STATUSES) as InternalStatus[];

export type InternalStatus = keyof typeof INTERNAL_STATUSES;

export function isValidInternalStatus(status: string): status is InternalStatus {
  return status in INTERNAL_STATUSES;
}

export const STATUS_GROUPS = {
  // Aguardando trabalho começar
  PENDING: ["novo", "requested", "triage", "assigned"] as const,

  ACTIVE_WORK: ["in_progress", "waiting_info", "revision_requested"] as const,

  // Aguardando revisão interna
  REVIEW: ["ready_for_review"] as const,

  // Entregue internamente ou ao cliente
  DELIVERED: ["delivered_to_sales", "sent_to_client"] as const,

  // Em fase comercial avançada
  COMMERCIAL_ADVANCED: ["minuta_solicitada", "contrato_fechado"] as const,

  // Encerrados
  FINISHED: ["lost", "archived"] as const,

  // Visíveis por padrão no painel do orçamentista (todos exceto delivered+finished)
  ESTIMATOR_DEFAULT_VISIBLE: ["novo", "requested", "triage", "assigned", "in_progress", "waiting_info", "revision_requested", "ready_for_review"] as const,

  // Considerados "ativos" para métricas de operações
  // 'novo' é incluído porque é o status default de novos orçamentos (DB default)
  OPERATIONS_ACTIVE: ["novo", "requested", "triage", "assigned", "in_progress", "waiting_info", "revision_requested", "ready_for_review"] as const,
} as const;

export type StatusGroup = keyof typeof STATUS_GROUPS;

/**
 * Allowed internal_status transitions — must mirror the DB trigger
 * `validate_internal_status_transition`. Keep in sync to avoid runtime errors.
 */
export const STATUS_TRANSITIONS: Partial<Record<InternalStatus, InternalStatus[]>> = {
  novo: ['requested', 'triage', 'assigned', 'in_progress', 'delivered_to_sales'],
  requested: ['triage', 'assigned', 'in_progress'],
  triage: ['assigned', 'in_progress'],
  assigned: ['in_progress'],
  in_progress: ['ready_for_review', 'waiting_info'],
  ready_for_review: ['delivered_to_sales', 'in_progress'],
  delivered_to_sales: ['sent_to_client', 'revision_requested'],
  sent_to_client: ['revision_requested', 'minuta_solicitada', 'lost', 'contrato_fechado'],
  revision_requested: ['in_progress'],
  waiting_info: ['in_progress'],
  minuta_solicitada: ['contrato_fechado', 'revision_requested'],
};

/**
 * Status flow is now fully flexible — any transition is allowed.
 * Confirmation/UX is handled at the application layer (see Kanban dialogs).
 * Kept as a function for compatibility with existing call sites.
 */
export function canTransitionStatus(_from: string, _to: InternalStatus): boolean {
  return true;
}

export const PRIORITIES = {
  baixa: { label: 'Baixa', color: 'bg-gray-100 text-gray-700' },
  normal: { label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  alta: { label: 'Alta', color: 'bg-orange-100 text-orange-700' },
  urgente: { label: 'Urgente', color: 'bg-red-100 text-red-700' },
} as const;

export type Priority = keyof typeof PRIORITIES;

export const PROPERTY_TYPES = [
  'Apartamento',
  'Casa',
  'Cobertura',
  'Studio',
  'Loft',
  'Sala Comercial',
  'Outro',
] as const;

export const LOCATION_TYPES = [
  'Short Stay',
  'Long Stay',
  'Moradia Própria',
  'Ainda está decidindo',
] as const;
