import { AlertCircle, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { CatalogAlertResult } from "@/hooks/useCatalogAlerts";

export function CatalogItemAlertIcon({ result }: { result: CatalogAlertResult }) {
  if (result.worst === "none") return null;
  const Icon = result.worst === "error" ? AlertCircle : AlertTriangle;
  const color = result.worst === "error" ? "text-destructive" : "text-amber-500";
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center ${color}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <ul className="text-xs space-y-0.5">
            {result.issues.map((i) => (
              <li key={i.code}>• {i.message}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
