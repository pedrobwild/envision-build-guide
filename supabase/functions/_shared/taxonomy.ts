/**
 * Shared taxonomy constants for supplier categorization.
 * Used by both sync-supplier-outbound and sync-supplier-inbound.
 * Must mirror the lists in src/components/catalog/SupplierDialog.tsx.
 */

export const SUBCATEGORIAS_PRESTADORES = [
  "Marcenaria", "Empreita", "Vidraçaria Box", "Vidraçaria Sacada",
  "Eletricista", "Pintor", "Instalador de Piso", "Técnico Ar-Condicionado",
  "Gesseiro", "Serviços Gerais", "Limpeza", "Pedreiro",
  "Instalador Fechadura Digital", "Cortinas", "Marmoraria", "Jardim Vertical",
] as const;

export const SUBCATEGORIAS_PRODUTOS = [
  "Eletrodomésticos", "Enxoval", "Espelhos", "Decoração", "Revestimentos",
  "Luminárias", "Torneiras", "Cadeiras e Mesas", "Camas", "Sofás e Poltronas",
  "Tapeçaria", "Torneiras e Cubas", "Materiais Elétricos",
  "Materiais de Construção", "Acessórios Banheiro", "Fechadura Digital", "Tintas",
] as const;

export function inferTipo(categoria: string | null): "prestadores" | "produtos" | null {
  if (!categoria) return null;
  if ((SUBCATEGORIAS_PRESTADORES as readonly string[]).includes(categoria)) return "prestadores";
  if ((SUBCATEGORIAS_PRODUTOS as readonly string[]).includes(categoria)) return "produtos";
  return null;
}
