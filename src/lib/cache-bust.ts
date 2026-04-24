/**
 * Cache-busting helpers para a rota pública do orçamento.
 *
 * Por que isto existe:
 * - Quando publicamos uma versão nova, o HTML antigo cacheado pelo navegador/CDN
 *   referencia chunks JS/CSS que já não existem (Vite renomeia por hash) → tela branca.
 * - Service workers legados (de versões antigas que tentaram PWA) podem servir
 *   conteúdo obsoleto e interceptar navegação.
 *
 * Este módulo NÃO registra service workers; ao contrário, ele garante que nenhum
 * SW antigo continue ativo na rota pública e oferece um reload "limpo" com
 * timestamp para forçar revalidação completa.
 */

const CACHE_BUSTED_FLAG = "bwild_cache_busted";

/**
 * Desregistra qualquer service worker legado e limpa o Cache Storage.
 * Seguro de chamar em qualquer ambiente — é no-op se as APIs não existirem.
 */
export async function purgeStaleCaches(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    // Ignorar — APIs podem estar bloqueadas em sandboxes/iframes
  }

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // Ignorar
  }
}

/**
 * Recarrega a página garantindo bypass de cache:
 * - limpa caches/SW antes
 * - adiciona ?_cb=<timestamp> na URL para invalidar HTML em CDN
 * - usa location.replace para evitar entrada extra no histórico
 */
export async function hardReloadWithCacheBust(): Promise<void> {
  await purgeStaleCaches();

  const url = new URL(window.location.href);
  url.searchParams.set("_cb", Date.now().toString(36));
  // Marca para evitar loop caso algo dispare reload novamente
  sessionStorage.setItem(CACHE_BUSTED_FLAG, "1");
  window.location.replace(url.toString());
}

/**
 * Indica se a navegação atual já é resultado de um cache-bust (para evitar loops).
 */
export function wasJustCacheBusted(): boolean {
  try {
    const flag = sessionStorage.getItem(CACHE_BUSTED_FLAG);
    if (flag) {
      sessionStorage.removeItem(CACHE_BUSTED_FLAG);
      return true;
    }
  } catch {
    // sessionStorage pode estar bloqueado
  }
  return false;
}

/**
 * Aplica garantias de cache-busting nas rotas públicas do orçamento.
 * Chamar uma vez no bootstrap do app, antes do React renderizar.
 */
export function initPublicBudgetCacheGuard(): void {
  const path = window.location.pathname;
  const isPublicBudgetRoute = path.startsWith("/o/") || path.startsWith("/obra/");
  if (!isPublicBudgetRoute) return;

  // Em rotas públicas, nunca queremos um SW ativo interceptando requisições.
  // Limpamos de forma assíncrona — não bloqueia o render inicial.
  void purgeStaleCaches();
}
