import { formatBRL } from "@/lib/formatBRL";
import { Layers, Home, Package, TrendingUp, Globe, MapPin } from "lucide-react";

interface ExecutiveSummaryProps {
  sections: any[];
  rooms: any[];
  total: number;
  projectName: string;
}

export function ExecutiveSummary({ sections, rooms, total, projectName }: ExecutiveSummaryProps) {
  const totalItems = sections.reduce((sum: number, s: any) => sum + (s.items?.length || 0), 0);
  const totalPackages = sections.length;
  const totalRooms = rooms.length;

  let generalCount = 0;
  let localCount = 0;
  sections.forEach((s: any) => {
    (s.items || []).forEach((item: any) => {
      if ((item.coverage_type || "geral") === "geral") generalCount++;
      else localCount++;
    });
  });

  const stats = [
    { icon: Package, label: "Pacotes", value: String(totalPackages), color: "text-primary" },
    { icon: Layers, label: "Itens", value: String(totalItems), color: "text-accent-foreground" },
    { icon: Home, label: "Ambientes", value: totalRooms > 0 ? String(totalRooms) : "—", color: "text-accent-foreground" },
    { icon: TrendingUp, label: "Investimento", value: formatBRL(total), color: "text-primary" },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-6 mb-8">
      <div className="mb-5">
        <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground">
          Visão Geral da Reforma
        </h2>
        <p className="text-sm text-muted-foreground font-body mt-1">
          Confira o escopo completo do projeto <strong className="text-foreground">{projectName}</strong> — 
          {totalPackages} pacotes de serviço cobrindo {totalItems} itens
          {totalRooms > 0 ? ` em ${totalRooms} ambientes` : ""}.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border border-border/50">
            <div className="p-2 rounded-lg bg-accent">
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-body">{stat.label}</p>
              <p className="text-sm font-bold text-foreground font-display">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {totalRooms > 0 && (generalCount > 0 || localCount > 0) && (
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-6 text-xs font-body text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-primary/70" />
              <span><strong className="text-foreground font-semibold">{generalCount}</strong> itens gerais</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary/70" />
              <span><strong className="text-foreground font-semibold">{localCount}</strong> itens específicos por ambiente</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
