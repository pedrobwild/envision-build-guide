import { useState, useRef, useEffect, createRef } from "react";
import { Badge } from "@/components/ui/badge";
import { ProjectMap } from "./ProjectMap";
import { ProjectSidebarCard } from "./ProjectSidebarCard";
import type { ProjetoBairro } from "@/data/brooklin-projects";

interface BrooklinProjectsMapSectionProps {
  projects: ProjetoBairro[];
  bairro: string;
  center: [number, number];
}

export function BrooklinProjectsMapSection({
  projects,
  bairro,
  center,
}: BrooklinProjectsMapSectionProps) {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const apiKey = (import.meta.env.VITE_MAPTILER_API_KEY as string) || "FQaugVdcxiB24tG5rETf";

  // Auto-scroll card into view when selected via map marker
  useEffect(() => {
    if (selectedProject) {
      const el = cardRefs.current.get(selectedProject);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedProject]);

  const setCardRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  };

  return (
    <div className="py-12 lg:py-16">
      {/* Header */}
      <div className="mb-6">
        <Badge variant="outline" className="mb-3 text-xs font-body">
          {projects.length} projetos entregues
        </Badge>
        <h2 className="font-display text-2xl lg:text-3xl font-bold text-foreground">
          Projetos realizados no {bairro}
        </h2>
        <p className="text-muted-foreground text-base font-body mt-1">
          Conheça obras que já entregamos na região do seu futuro imóvel.
        </p>
      </div>

      {/* Desktop: side by side */}
      <div className="hidden lg:flex gap-6">
        <div className="flex-[3] min-w-0">
          <ProjectMap
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={setSelectedProject}
            center={center}
            apiKey={apiKey}
          />
        </div>
        <div className="flex-[2] max-h-[600px] overflow-y-auto space-y-3 scrollbar-thin pr-1">
          {projects.map((proj) => (
            <ProjectSidebarCard
              key={proj.id}
              ref={setCardRef(proj.id)}
              project={proj}
              isSelected={selectedProject === proj.id}
              onSelect={setSelectedProject}
            />
          ))}
        </div>
      </div>

      {/* Mobile: map on top, cards below as horizontal scroll */}
      <div className="lg:hidden space-y-4">
        <ProjectMap
          projects={projects}
          selectedProject={selectedProject}
          onSelectProject={setSelectedProject}
          center={center}
          apiKey={apiKey}
        />
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1 scrollbar-thin">
          {projects.map((proj) => (
            <div key={proj.id} className="min-w-[280px] snap-center flex-shrink-0">
              <ProjectSidebarCard
                ref={setCardRef(proj.id)}
                project={proj}
                isSelected={selectedProject === proj.id}
                onSelect={setSelectedProject}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
