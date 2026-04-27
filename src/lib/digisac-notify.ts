// Helper para disparar mensagem WhatsApp via Digisac.
// Usado no fluxo de publicação de orçamento para notificar cliente automaticamente.
import { supabase } from "@/integrations/supabase/client";

import { logger } from "@/lib/logger";

interface SendBudgetNotificationParams {
  budgetId: string;
  clientName: string;
  clientPhone: string | null | undefined;
  publicId: string | null | undefined;
}

const PUBLIC_BASE_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}`
    : "";

/**
 * Envia mensagem WhatsApp para o cliente quando orçamento é publicado.
 * Falhas são silenciosas (log) — não bloqueiam o fluxo de publicação.
 */
export async function sendBudgetPublishedNotification(
  params: SendBudgetNotificationParams,
): Promise<{ success: boolean; error?: string }> {
  const { budgetId, clientName, clientPhone, publicId } = params;

  if (!clientPhone || !publicId) {
    return { success: false, error: "phone ou publicId ausente" };
  }

  const firstName = (clientName || "").split(/\s+/)[0] || "cliente";
  const link = `${PUBLIC_BASE_URL}/o/${publicId}`;
  const message =
    `Olá ${firstName}! Seu orçamento Bwild está pronto. Acesse o link: ${link}`;

  try {
    const { data, error } = await supabase.functions.invoke(
      "send-digisac-message",
      {
        body: {
          phone: clientPhone,
          message,
          budgetId,
        },
      },
    );
    if (error) throw error;
    if ((data as { error?: string })?.error) {
      return { success: false, error: (data as { error: string }).error };
    }
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    logger.warn("[digisac] notificação automática falhou:", msg);
    return { success: false, error: msg };
  }
}
