// Central role and internal status constants
// Change these to evolve business rules without touching components

export type AppRole = 'admin' | 'comercial' | 'orcamentista';

export const ROLES: Record<AppRole, { label: string; description: string }> = {
  admin: { label: 'Administrador', description: 'Acesso total ao sistema' },
  comercial: { label: 'Comercial', description: 'Gestão de clientes e propostas' },
  orcamentista: { label: 'Orçamentista', description: 'Produção de orçamentos' },
};

export const INTERNAL_STATUSES = {
  requested: { label: 'Solicitado', color: 'bg-blue-100 text-blue-800', icon: '📩' },
  triage: { label: 'Triagem', color: 'bg-purple-100 text-purple-800', icon: '🔍' },
  assigned: { label: 'Atribuído', color: 'bg-indigo-100 text-indigo-800', icon: '👤' },
  in_progress: { label: 'Em Produção', color: 'bg-yellow-100 text-yellow-800', icon: '🔨' },
  waiting_info: { label: 'Aguardando Info', color: 'bg-amber-100 text-amber-800', icon: '⏳' },
  ready_for_review: { label: 'Revisão', color: 'bg-orange-100 text-orange-800', icon: '📋' },
  delivered_to_sales: { label: 'Entregue ao Comercial', color: 'bg-teal-100 text-teal-800', icon: '📤' },
  sent_to_client: { label: 'Enviado ao Cliente', color: 'bg-emerald-100 text-emerald-800', icon: '✉️' },
  approved: { label: 'Aprovado', color: 'bg-green-100 text-green-800', icon: '✅' },
  lost: { label: 'Perdido', color: 'bg-gray-100 text-gray-600', icon: '❌' },
  archived: { label: 'Arquivado', color: 'bg-gray-100 text-gray-500', icon: '📦' },
} as const;

export type InternalStatus = keyof typeof INTERNAL_STATUSES;

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
