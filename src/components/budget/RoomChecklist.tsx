import { Check, X, MapPin } from "lucide-react";

interface RoomChecklistProps {
  roomId: string;
  roomName: string;
  sections: any[];
  onClear: () => void;
}

export function RoomChecklist({ roomId, roomName, sections, onClear }: RoomChecklistProps) {
  // Build a flat list of items with inclusion status for this room
  const itemResults: { title: string; sectionTitle: string; included: boolean }[] = [];

  sections.forEach((section: any) => {
    (section.items || []).forEach((item: any) => {
      const coverageType = item.coverage_type || "geral";
      const inc: string[] = item.included_rooms || [];
      const exc: string[] = item.excluded_rooms || [];
      let included = false;
      if (coverageType === "geral") {
        included = !exc.includes(roomId);
      } else {
        included = inc.includes(roomId);
      }
      itemResults.push({ title: item.title, sectionTitle: section.title, included });
    });
  });

  const includedItems = itemResults.filter(i => i.included);
  const excludedItems = itemResults.filter(i => !i.included);

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <h3 className="font-display font-bold text-foreground text-base">
            O que está contemplado em <span className="text-primary">{roomName}</span>
          </h3>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-primary hover:text-primary/80 font-body font-medium transition-colors"
        >
          Limpar
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {includedItems.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 font-body flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" /> Incluído ({includedItems.length})
            </h4>
            <ul className="space-y-1">
              {includedItems.map((item, i) => (
                <li key={i} className="text-sm text-foreground/80 font-body flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>
                    {item.title}
                    <span className="text-muted-foreground text-xs ml-1">({item.sectionTitle})</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {excludedItems.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 font-body flex items-center gap-1.5 text-destructive">
              <X className="h-3.5 w-3.5" /> Não incluído ({excludedItems.length})
            </h4>
            <ul className="space-y-1">
              {excludedItems.map((item, i) => (
                <li key={i} className="text-sm text-foreground/50 font-body flex items-start gap-2">
                  <X className="h-3.5 w-3.5 text-destructive/50 mt-0.5 flex-shrink-0" />
                  <span>{item.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {includedItems.length === 0 && (
        <p className="text-sm text-muted-foreground font-body">
          Nenhum item contempla diretamente este ambiente.
        </p>
      )}
    </div>
  );
}
