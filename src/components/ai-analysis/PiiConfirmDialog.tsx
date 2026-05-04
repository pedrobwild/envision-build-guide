/**
 * Diálogo modal para confirmar envio de dados sensíveis ao gateway de IA.
 *
 * Acionado pelo hook `useAdvancedAnalysis` quando `piiBlocked === true`
 * e o usuário clica em "Pedir interpretação".
 *
 * Apresenta lista de tipos de PII detectados, oferece duas ações:
 *  - "Mascarar antes de enviar" (default, preferido)
 *  - "Enviar mesmo assim" (com aviso explícito)
 *
 * Sempre passa o usuário por uma confirmação consciente.
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert } from "lucide-react";
import type { PiiKind } from "@/lib/data-analysis-security/pii";

interface Props {
  open: boolean;
  detectedKinds: readonly PiiKind[];
  onCancel: () => void;
  onMaskAndSend: () => void;
  onSendRaw: () => void;
}

const KIND_LABEL: Record<PiiKind, string> = {
  email: "E-mail",
  phone_br: "Telefone",
  cpf: "CPF",
  cnpj: "CNPJ",
  credit_card: "Cartão de crédito",
};

export function PiiConfirmDialog({
  open,
  detectedKinds,
  onCancel,
  onMaskAndSend,
  onSendRaw,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            Dados sensíveis detectados
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <span className="block">
              Detectamos os seguintes tipos de dados pessoais no dataset que
              você quer interpretar com a IA:
            </span>
            <span className="flex flex-wrap gap-1.5 pt-1">
              {detectedKinds.map((k) => (
                <Badge
                  key={k}
                  variant="outline"
                  className="border-amber-500/40 bg-amber-500/10 text-[11px] text-amber-700 dark:text-amber-400"
                >
                  {KIND_LABEL[k]}
                </Badge>
              ))}
            </span>
            <span className="block text-xs text-muted-foreground pt-2">
              Por padrão, mascaramos esses valores antes de enviar ao gateway
              externo (Lovable AI). Você pode optar por enviar os dados crus,
              mas isso fica registrado em log e contraria a política da
              plataforma para dados de cliente.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <button
            type="button"
            onClick={onSendRaw}
            className="inline-flex h-9 items-center justify-center rounded-md border border-destructive/40 bg-destructive/5 px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            Enviar dados crus
          </button>
          <AlertDialogAction onClick={onMaskAndSend}>
            Mascarar e enviar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
