import { FileText } from "lucide-react";

interface BudgetHeaderProps {
  projectName: string;
}

export function BudgetHeader({ projectName }: BudgetHeaderProps) {
  return (
    <header className="bg-card border-b border-border sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-display font-bold text-lg">B</span>
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-foreground leading-tight">Bwild</h1>
            <p className="text-xs text-muted-foreground font-body">Orçamento de Reforma</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-body font-medium">
          <FileText className="h-4 w-4" />
          Exportar PDF
        </button>
      </div>
    </header>
  );
}
