// Central role and internal status constants
// Change these to evolve business rules without touching components

export type AppRole = 'admin' | 'comercial' | 'orcamentista';

export const ROLES: Record<AppRole, { label: string; description: string }> = {
  admin: { label: 'Administrador', description: 'Acesso total ao sistema' },
  comercial: { label: 'Comercial', description: 'Gestão de clientes e propostas' },
  orcamentista: { label: 'Orçamentista', description: 'Produção de orçamentos' },
};

export const INTERNAL_STATUSES = {
  novo: { label: 'Novo', color: 'bg-blue-100 text-blue-800' },
  briefing: { label: 'Briefing', color: 'bg-purple-100 text-purple-800' },
  em_producao: { label: 'Em Produção', color: 'bg-yellow-100 text-yellow-800' },
  revisao: { label: 'Revisão', color: 'bg-orange-100 text-orange-800' },
  pronto: { label: 'Pronto', color: 'bg-green-100 text-green-800' },
  entregue: { label: 'Entregue', color: 'bg-emerald-100 text-emerald-800' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
} as const;

export type InternalStatus = keyof typeof INTERNAL_STATUSES;

export const PRIORITIES = {
  baixa: { label: 'Baixa', color: 'bg-gray-100 text-gray-700' },
  normal: { label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  alta: { label: 'Alta', color: 'bg-orange-100 text-orange-700' },
  urgente: { label: 'Urgente', color: 'bg-red-100 text-red-700' },
} as const;

export type Priority = keyof typeof PRIORITIES;
