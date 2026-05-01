/**
 * Lógica de seleção dos grupos/seções/itens exibidos no bloco
 * "Itens do Projeto" da página pública do orçamento.
 *
 * Histórico:
 *   - Versão antiga filtrava itens sem imagem (apenas itens com `images.length > 0`),
 *     o que fazia o cliente ver o valor cheio do orçamento mas pouquíssimos itens
 *     visíveis (ou nenhum) — gerando a impressão de que itens haviam sido apagados.
 *   - Esta versão exibe TODOS os itens das seções, com ou sem imagem; o
 *     `ProductShowcaseCard` já tem fallback visual para itens sem imagem.
 *
 * Mantemos a função pura (sem React) para permitir testes unitários simples.
 */
import type { CategorizedGroup } from "@/lib/scope-categories";

export function buildPublicScopeGroups(
  categorizedGroups: CategorizedGroup[]
): CategorizedGroup[] {
  return categorizedGroups
    .map((group) => ({
      ...group,
      sections: group.sections
        .map((section) => ({
          ...section,
          items: section.items || [],
        }))
        .filter((section) => section.items.length > 0),
    }))
    .filter((group) => group.sections.length > 0);
}
