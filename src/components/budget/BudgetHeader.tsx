import { Download } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import logoDark from "@/assets/logo-bwild-dark.png";
import logoWhite from "@/assets/logo-bwild-white.png";

interface BudgetHeaderProps {
  projectName: string;
  onExportPdf?: () => void;
  exporting?: boolean;
}

export function BudgetHeader({ projectName, onExportPdf, exporting }: BudgetHeaderProps) {
  return (
    <header className="bg-card border-b border-border sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logoDark} alt="Bwild" className="h-8 dark:hidden" />
          <img src={logoWhite} alt="Bwild" className="h-8 hidden dark:block" />
          <div className="h-6 w-px bg-border" />
          <p className="text-sm text-muted-foreground font-body">Orçamento de Reforma</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={onExportPdf}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-body font-medium disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exporting ? "Gerando..." : "Exportar PDF"}
          </button>
        </div>
      </div>
    </header>
  );
}
