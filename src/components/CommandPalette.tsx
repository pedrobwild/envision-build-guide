import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  FileText,
  Users,
  Briefcase,
  Hammer,
  Package,
  ImagePlus,
  LayoutTemplate,
  Settings,
  DollarSign,
  BarChart3,
  Plus,
  Search,
  Inbox,
  ExternalLink,
  CalendarClock,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import type { AppRole } from "@/lib/role-constants";
import { sanitizePostgrestPattern } from "@/lib/postgrest-escape";

interface ActionItem {
  id: string;
  label: string;
  icon: React.ElementType;
  to: string;
  roles: AppRole[] | "all";
  shortcut?: string;
  keywords?: string;
}

const NAV_ACTIONS: ActionItem[] = [
  { id: "nav-dashboard", label: "Painel Geral", icon: LayoutDashboard, to: "/admin", roles: "all", shortcut: "G D", keywords: "home dashboard inicio" },
  { id: "nav-comercial", label: "Pipeline Comercial", icon: Briefcase, to: "/admin/comercial", roles: ["admin", "comercial"], shortcut: "G C", keywords: "kanban vendas negocios" },
  { id: "nav-agenda", label: "Agenda", icon: CalendarClock, to: "/admin/agenda", roles: ["admin", "comercial"], shortcut: "G A", keywords: "tarefas compromissos atividades" },
  { id: "nav-clients", label: "Clientes (CRM)", icon: Users, to: "/admin/crm", roles: ["admin", "comercial"], shortcut: "G L", keywords: "carteira leads contatos" },
  { id: "nav-solicitacoes", label: "Solicitações", icon: FileText, to: "/admin/solicitacoes", roles: ["admin", "comercial"] },
  { id: "nav-producao", label: "Pipeline Orçamentos", icon: Hammer, to: "/admin/producao", roles: ["admin", "orcamentista"], shortcut: "G P", keywords: "estimativas producao" },
  { id: "nav-templates", label: "Templates", icon: LayoutTemplate, to: "/admin/templates", roles: ["admin", "orcamentista"] },
  { id: "nav-catalogo", label: "Catálogo", icon: Package, to: "/admin/catalogo", roles: ["admin", "orcamentista"] },
  { id: "nav-fotos", label: "Biblioteca de Fotos", icon: ImagePlus, to: "/admin/biblioteca-fotos", roles: ["admin", "orcamentista"] },
  { id: "nav-usuarios", label: "Usuários", icon: Users, to: "/admin/usuarios", roles: ["admin", "orcamentista"] },
  { id: "nav-operacoes", label: "Operações", icon: Settings, to: "/admin/operacoes", roles: ["admin"] },
  { id: "nav-analises", label: "Análises e Relatórios", icon: BarChart3, to: "/admin/analises", roles: ["admin"] },
  { id: "nav-financeiro", label: "Financeiro", icon: DollarSign, to: "/admin/financeiro", roles: ["admin"] },
  { id: "nav-leads", label: "Leads (Integrações)", icon: Inbox, to: "/admin/leads", roles: ["admin", "comercial"] },
];

const QUICK_ACTIONS: ActionItem[] = [
  { id: "act-new-budget", label: "Nova solicitação de orçamento", icon: Plus, to: "/admin/solicitacoes/nova", roles: ["admin", "comercial"], shortcut: "N", keywords: "criar novo" },
];

interface BudgetHit {
  id: string;
  project_name: string;
  client_name: string;
  sequential_code: string | null;
  status: string;
  public_id: string | null;
}

interface ClientHit {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

// Normaliza string removendo acentos para casamento case/diacritic-insensitive.
function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Quebra `text` em fragmentos, destacando trechos que casam com `query`.
// Comparação ignora maiúsculas/minúsculas e acentos, mas a renderização
// preserva os caracteres originais do texto.
function Highlight({ text, query }: { text: string; query: string }) {
  const trimmed = query.trim();
  if (!trimmed || !text) return <>{text}</>;

  const haystack = stripDiacritics(text).toLowerCase();
  const needle = stripDiacritics(trimmed).toLowerCase();
  if (!needle) return <>{text}</>;

  const parts: Array<{ value: string; match: boolean }> = [];
  let cursor = 0;
  while (cursor < text.length) {
    const idx = haystack.indexOf(needle, cursor);
    if (idx === -1) {
      parts.push({ value: text.slice(cursor), match: false });
      break;
    }
    if (idx > cursor) parts.push({ value: text.slice(cursor, idx), match: false });
    parts.push({ value: text.slice(idx, idx + needle.length), match: true });
    cursor = idx + needle.length;
  }

  return (
    <>
      {parts.map((part, i) =>
        part.match ? (
          <mark
            key={i}
            className="rounded-sm bg-primary/20 px-0.5 text-foreground font-medium"
          >
            {part.value}
          </mark>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </>
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [budgets, setBudgets] = useState<BudgetHit[]>([]);
  const [clients, setClients] = useState<ClientHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const userRoles = profile?.roles ?? [];

  // Global shortcut Cmd/Ctrl + K + custom event para mobile
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const openHandler = () => setOpen(true);
    window.addEventListener("keydown", handler);
    window.addEventListener("command-palette:open", openHandler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("command-palette:open", openHandler);
    };
  }, []);

  // Ao reabrir, devolver foco e posicionar o cursor no fim da query preservada.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const len = el.value.length;
      try {
        el.setSelectionRange(len, len);
      } catch {
        /* alguns inputs não suportam setSelectionRange */
      }
    }, 60);
    return () => window.clearTimeout(id);
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setBudgets([]);
      setClients([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const safe = sanitizePostgrestPattern(trimmed);
      if (!safe) {
        setBudgets([]);
        setClients([]);
        return;
      }
      const pattern = `%${safe}%`;

      const [budgetsRes, clientsRes] = await Promise.all([
        supabase
          .from("budgets")
          .select("id, project_name, client_name, sequential_code, status, public_id")
          .or(`project_name.ilike.${pattern},client_name.ilike.${pattern},sequential_code.ilike.${pattern}`)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("clients")
          .select("id, name, email, phone")
          .or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      if (cancelled) return;
      setBudgets((budgetsRes.data ?? []) as BudgetHit[]);
      setClients((clientsRes.data ?? []) as ClientHit[]);
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  const visibleNav = useMemo(
    () => NAV_ACTIONS.filter((a) => a.roles === "all" || (a.roles as AppRole[]).some((r) => userRoles.includes(r))),
    [userRoles]
  );

  const visibleQuick = useMemo(
    () => QUICK_ACTIONS.filter((a) => a.roles === "all" || (a.roles as AppRole[]).some((r) => userRoles.includes(r))),
    [userRoles]
  );

  // Ao escolher um resultado: fecha mas preserva a query digitada para retomada.
  const run = useCallback(
    (fn: () => void) => {
      setOpen(false);
      // Defer to allow dialog close animation
      setTimeout(fn, 0);
    },
    []
  );

  const clearQuery = useCallback(() => {
    setQuery("");
    setBudgets([]);
    setClients([]);
    inputRef.current?.focus();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <div className="relative">
        <CommandInput
          ref={inputRef}
          placeholder="Buscar orçamentos, clientes ou ações..."
          value={query}
          onValueChange={setQuery}
          autoFocus
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={clearQuery}
            aria-label="Limpar busca"
            className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <CommandList>
        <CommandEmpty>
          {query.trim().length < 2
            ? "Digite ao menos 2 caracteres para buscar."
            : "Nenhum resultado encontrado."}
        </CommandEmpty>

        {budgets.length > 0 && (
          <>
            <CommandGroup heading="Orçamentos">
              {budgets.map((b) => (
                <CommandItem
                  key={b.id}
                  value={`budget-${b.id} ${b.project_name} ${b.client_name} ${b.sequential_code ?? ""}`}
                  onSelect={() => run(() => navigate(`/admin/budget/${b.id}`))}
                >
                  <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm truncate">
                      <Highlight text={b.project_name} query={query} />
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {b.sequential_code ? (
                        <>
                          <Highlight text={b.sequential_code} query={query} />
                          {" · "}
                        </>
                      ) : null}
                      <Highlight text={b.client_name} query={query} />
                    </span>
                  </div>
                  {b.public_id && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        run(() => window.open(`/o/${b.public_id}`, "_blank"));
                      }}
                      className="ml-2 opacity-60 hover:opacity-100"
                      title="Abrir link público"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {clients.length > 0 && (
          <>
            <CommandGroup heading="Clientes">
              {clients.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`client-${c.id} ${c.name} ${c.email ?? ""} ${c.phone ?? ""}`}
                  onSelect={() => run(() => navigate(`/admin/crm/${c.id}`))}
                >
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm truncate">
                      <Highlight text={c.name} query={query} />
                    </span>
                    {(c.email || c.phone) && (
                      <span className="text-xs text-muted-foreground truncate">
                        <Highlight text={c.email || c.phone || ""} query={query} />
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {visibleQuick.length > 0 && (
          <>
            <CommandGroup heading="Ações rápidas">
              {visibleQuick.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`${a.label} ${a.keywords ?? ""}`}
                  onSelect={() => run(() => navigate(a.to))}
                >
                  <a.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{a.label}</span>
                  {a.shortcut && <CommandShortcut>{a.shortcut}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Navegação">
          {visibleNav.map((a) => (
            <CommandItem
              key={a.id}
              value={`${a.label} ${a.keywords ?? ""}`}
              onSelect={() => run(() => navigate(a.to))}
            >
              <a.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>{a.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/**
 * Trigger button to open the command palette.
 * Place in headers / sidebars.
 */
export function CommandPaletteTrigger({ className }: { className?: string }) {
  const dispatch = () => {
    window.dispatchEvent(new CustomEvent("command-palette:open"));
  };
  return (
    <button
      type="button"
      onClick={dispatch}
      aria-label="Buscar"
      className={
        className ??
        "inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      }
    >
      <Search className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Buscar...</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border/60 bg-muted px-1 py-0.5 text-[10px] font-mono">
        ⌘K
      </kbd>
    </button>
  );
}
