import seloReclameAqui from "@/assets/selo-reclame-aqui.png";

export function ReclameAquiSeal() {
  return (
    <a
      href="https://www.reclameaqui.com.br/empresa/bwild-reformas/sobre/#info-rav"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 backdrop-blur-md transition-all text-xs font-body font-medium border border-emerald-400/20 group"
    >
      <img
        src={seloReclameAqui}
        alt="Selo RA Verificada - Reclame Aqui"
        className="h-6 w-6 sm:h-7 sm:w-7 object-contain"
      />
      <span className="text-emerald-300 group-hover:text-emerald-200">
        Selo ReclameAqui: 0 reclamações há 6 meses
      </span>
    </a>
  );
}
