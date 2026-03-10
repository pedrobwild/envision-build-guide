# AUDITORIA DE UI/UX — BWILD ORÇAMENTOS

> Documento gerado em 10/03/2026 para análise externa de especialista em UX.
> Cobre a totalidade da arquitetura front-end, design system, fluxos, animações, responsividade, acessibilidade, performance, SEO e integrações.

---

## 1. ARQUITETURA DE ROTAS E NAVEGAÇÃO

| Rota | Componente Principal | Layout usado | Auth? | Descrição |
|------|---------------------|-------------|-------|-----------|
| `/` | `<Navigate to="/login">` | — (redirect) | Não | Redirect automático para login |
| `/login` | `Login.tsx` | Fullscreen com background image (`auth-bg.png`) | Não | Tela de autenticação (login, signup, forgot password) |
| `/reset-password` | `ResetPassword.tsx` | Fullscreen centralizado | Não | Formulário de redefinição de senha (ativado por link de e-mail) |
| `/admin` | `AdminDashboard.tsx` | Header fixo + conteúdo centralizado (max-w-6xl) | **Sim** (`ProtectedRoute`) | Painel administrativo com lista de orçamentos, métricas e notificações |
| `/admin/budget/:budgetId` | `BudgetEditorV2.tsx` | Header sticky + stepper + conteúdo centralizado | **Sim** (`ProtectedRoute`) | Editor de orçamento v2 (fluxo multi-step) |
| `/admin/budget/:budgetId/legacy` | `BudgetEditor.tsx` | Header + formulário | **Sim** (`ProtectedRoute`) | Editor legacy (edição direta de seções/itens) |
| `/o/:publicId` | `PublicBudget.tsx` | Fullscreen, 2 colunas desktop, 1 coluna mobile | Não | Visualização pública do orçamento (link compartilhável) |
| `/obra/:projectId/orcamento` | `OrcamentoPage.tsx` | 2 colunas com sidebar sticky | Não | Página interna de orçamento (versão narrativa) |
| `/qa` | `QAEvaluator.tsx` | Fullscreen com inline styles | Não | Ferramenta interna de QA para validação de implementação |
| `*` (404) | `NotFound.tsx` | Fullscreen centralizado | Não | Página de erro 404 |

### Navegação

- **Não há navbar global.** Cada rota tem seu próprio header contextual.
- **ProtectedRoute** (`src/components/ProtectedRoute.tsx`): wrapper que verifica `useAuth()`. Se `loading`, exibe spinner. Se `!user`, redireciona para `/login`.
- **useAuth** (`src/hooks/useAuth.tsx`): hook baseado em `supabase.auth.onAuthStateChange` + `getSession`. Retorna `{ user, session, loading, signOut }`.

---

## 2. MAPA DE COMPONENTES POR PÁGINA

### `/login`
```
Login.tsx
├── <div> (background: auth-bg.png, fullscreen)
│   ├── <img> Logo Bwild (mobile-only, absolute top-right)
│   ├── <h1> "Orçamentos Bwild."
│   ├── [formError alert] (condicional)
│   ├── <form>
│   │   ├── <Label> + <Input> Email
│   │   ├── <Label> + <Input> Password (com toggle show/hide + Caps Lock warning)
│   │   ├── "Esqueci minha senha" link (condicional: mode=login)
│   │   └── <Button> Submit (Entrar / Criar conta / Enviar e-mail)
│   ├── Toggle mode link (login ↔ signup ↔ forgot)
│   ├── Footer: "Problemas? Falar com suporte"
│   └── Footer: ShieldCheck + "Acesso seguro · LGPD" + Copyright
```

### `/reset-password`
```
ResetPassword.tsx
├── <div> (centralizado)
│   ├── <h1> "Nova senha"
│   ├── <p> Subtítulo
│   └── <form>
│       ├── <input> Nova senha
│       └── <button> "Salvar nova senha"
```

### `/admin`
```
AdminDashboard.tsx
├── <header> (bg-card, border-b)
│   ├── Logo Bwild (dark/white swap)
│   ├── Separador
│   ├── "Painel Admin" + email
│   ├── Notification Bell (com badge de contagem)
│   │   └── Dropdown de notificações (condicional)
│   ├── ThemeToggle
│   └── Botão Logout
├── <main> (max-w-6xl)
│   ├── Metrics Grid (4 cards: Total, Publicados, Rascunhos, Valor total)
│   ├── Controls Row
│   │   ├── Search Input (com ícone Search)
│   │   ├── Select (filtro de status)
│   │   ├── Botão "Importar" (abre ImportExcelModal)
│   │   └── Botão "Novo" (cria orçamento)
│   ├── Budget List (ou empty state)
│   │   └── Budget Row (para cada orçamento)
│   │       ├── Nome do projeto (Link para /admin/budget/:id)
│   │       ├── Badge de status
│   │       ├── Metadata (cliente, data, seções, views)
│   │       ├── Valor total
│   │       └── Action buttons (Publicar, Ver, Copiar link, Menu ⋯)
│   │           └── Context menu: Arquivar, Excluir
│   └── ImportExcelModal (condicional)
```

### `/admin/budget/:budgetId` (Editor V2)
```
BudgetEditorV2.tsx
├── <header> (sticky top, bg-card)
│   ├── Botão ← Voltar
│   ├── Título do projeto + metadata
│   ├── EditorStepper (5 steps: metadata → floor-plan → rooms → spreadsheet → coverage)
│   ├── Status de auto-save
│   └── Botão copiar link
├── <main> (conteúdo dinâmico conforme step)
│   ├── [step=metadata] → MetadataStep
│   ├── [step=floor-plan] → FloorPlanUploadStep
│   ├── [step=rooms] → RoomDrawingStep
│   ├── [step=spreadsheet] → SpreadsheetImportStep
│   └── [step=coverage] → CoverageMappingStep
```

### `/o/:publicId` (Orçamento Público)
```
PublicBudget.tsx
├── ReadingProgressBar (fixed top, 3px)
├── BudgetHeader
│   ├── Background (header-bg.png + gradient overlay)
│   ├── Nav: Logo Bwild + ThemeToggle + Botão PDF
│   ├── Hero (grid 2 colunas desktop)
│   │   ├── Left: Tag "Orçamento Bwild", H1, Subtitle, Value badges (3), Status strip
│   │   └── Right: Glassmorphism card
│   │       ├── Cliente + Obra (grid 2 colunas)
│   │       └── Meta items grid (Metragem, Versão, Data, Validade, Consultora)
├── <main> (max-w-7xl, grid 3 colunas desktop)
│   ├── Content Column (col-span-2)
│   │   ├── [condicional] PackageProgressBars (distribuição do investimento)
│   │   ├── AnimatedSection > ArquitetonicoExpander
│   │   │   ├── Bullets com CheckCircle2
│   │   │   ├── Callout "Lorena"
│   │   │   ├── Gallery tabs (Projeto 3D / Projeto Executivo)
│   │   │   ├── Embla Carousel (imagens + vídeo)
│   │   │   │   ├── Nav arrows
│   │   │   │   └── Dot indicators
│   │   │   └── Accordion "Saiba mais" (executiveDetails)
│   │   ├── AnimatedSection > EngenhariaExpander
│   │   │   ├── Icon + título + subtítulo
│   │   │   ├── Grid 2×2 de bullets com ícones
│   │   │   ├── Chips "O que você evita" (Badges destructive)
│   │   │   └── Callout citação
│   │   ├── AnimatedSection > PortalShowcase
│   │   │   ├── Feature grid (6 cards com ícones)
│   │   │   ├── Botão "Ver demonstração" (abre Dialog com vídeo placeholder)
│   │   │   └── Texto footer
│   │   ├── [condicional] AnimatedSection > FloorPlanViewer
│   │   │   ├── Planta baixa (imagem)
│   │   │   ├── SVG overlay com polígonos clicáveis (rooms)
│   │   │   └── Room chips (filtros)
│   │   ├── Label "Escopo técnico detalhado"
│   │   ├── SectionCard × N (filtrado: exclui "Projetos")
│   │   │   ├── Cover image (ou ícone Package)
│   │   │   ├── Subtotal strip
│   │   │   ├── Items list (com thumbnails, tooltip, qty)
│   │   │   ├── Expand/collapse (se >4 itens)
│   │   │   └── Included/Excluded bullets
│   │   ├── AnimatedSection > ProjectSecurity
│   │   │   ├── Score 92% + Progress bar
│   │   │   ├── Checklist (7 itens)
│   │   │   └── Delivery callout
│   │   └── AnimatedSection > NextSteps
│   │       └── Grid 5 colunas com numbered steps
│   ├── Desktop Sidebar (hidden lg:block, sticky)
│   │   ├── BudgetSummary
│   │   │   ├── Header "Resumo do Orçamento"
│   │   │   ├── Sections list (com tooltips, clicáveis para scroll)
│   │   │   ├── Adjustments (condicional)
│   │   │   ├── Total com badge "Sem custos ocultos"
│   │   │   └── Footer "Gerado em..."
│   │   ├── InstallmentSimulator (6x / 10x / 12x)
│   │   └── ApprovalCTA
│   │       ├── [idle] "Iniciar meu projeto" + "Falar com especialista"
│   │       ├── [form] Input nome + "Confirmar"
│   │       ├── [loading] Spinner
│   │       └── [done] "Orçamento Aprovado!" com PartyPopper
│   ├── Mobile bottom bar (fixed, lg:hidden)
│   │   ├── "Ver detalhes" → expande drawer
│   │   │   ├── BudgetSummary
│   │   │   ├── InstallmentSimulator
│   │   │   └── ApprovalCTA
│   │   └── Sticky bar: Total + "Iniciar meu projeto"
│   ├── BudgetFAQ (5 perguntas, Accordion)
│   └── [condicional] Disclaimer
├── WhatsAppButton (fixed bottom-right, FAB verde)
└── Lightbox (modal fullscreen para imagens)
```

### `/obra/:projectId/orcamento` (Orçamento Interno)
```
OrcamentoPage.tsx
├── <div> (max-w-7xl, flex gap-8)
│   ├── Main content (flex-1, stagger animations)
│   │   ├── BudgetHero (H1, badges, included card)
│   │   ├── ServicesSection (collapsible service cards)
│   │   ├── JourneySection (6-step interactive stepper)
│   │   ├── ScopeSection (searchable accordion)
│   │   └── PortalWarrantyNextSteps (tabs + CTAs)
│   └── Sidebar (hidden lg:block, w-[280px], sticky)
│       └── StickyBudgetSummary
│           ├── Meta info (Área, Versão, Validade)
│           ├── Included checklist
│           ├── CTAs (Agendar briefing, WhatsApp)
│           └── Section navigation (scrollspy)
├── Mobile bottom CTA (fixed, lg:hidden)
│   ├── Button "Agendar briefing"
│   └── Button WhatsApp (icon)
```

### `/qa`
```
QAEvaluator.tsx
├── Header (navy, score display)
├── Stats grid (4 cards)
├── Tab bar (Manual / IA)
├── [Manual tab]
│   ├── Prompt selector (1-4)
│   └── Criteria cards (status buttons + notes)
├── [AI tab]
│   ├── Textarea (code input)
│   ├── Button "Avaliar com IA"
│   └── AI report (rendered markdown)
```

---

## 3. DESIGN SYSTEM E TOKENS

### 3.1 Cores

#### Light Mode (`:root`)
| Variável | Valor HSL | Uso |
|----------|-----------|-----|
| `--background` | `210 20% 98%` | Fundo geral da aplicação |
| `--foreground` | `213 27% 16%` | Texto principal |
| `--card` | `0 0% 100%` | Fundo de cards |
| `--card-foreground` | `213 27% 16%` | Texto em cards |
| `--popover` | `0 0% 100%` | Fundo de popovers |
| `--popover-foreground` | `213 27% 16%` | Texto em popovers |
| `--primary` | `210 55% 25%` | Cor primária (Azul Marinho/Navy) |
| `--primary-foreground` | `0 0% 100%` | Texto sobre primária |
| `--secondary` | `210 15% 95%` | Cor secundária |
| `--secondary-foreground` | `213 27% 16%` | Texto sobre secundária |
| `--muted` | `210 12% 95%` | Fundos atenuados |
| `--muted-foreground` | `213 10% 46%` | Texto atenuado |
| `--accent` | `210 20% 96%` | Cor de destaque |
| `--accent-foreground` | `210 55% 25%` | Texto sobre destaque |
| `--destructive` | `0 72% 51%` | Cor de erro/exclusão |
| `--destructive-foreground` | `0 0% 100%` | Texto sobre destrutiva |
| `--border` | `214 14% 89%` | Bordas |
| `--input` | `214 14% 89%` | Bordas de inputs |
| `--ring` | `210 55% 25%` | Cor de foco (ring) |
| `--radius` | `0.5rem` | Border-radius base |
| `--gold` | `40 70% 50%` | Token custom: dourado |
| `--gold-light` | `40 60% 92%` | Dourado claro |
| `--charcoal` | `213 27% 12%` | Cinza escuro (headers, hero) |
| `--charcoal-light` | `213 20% 22%` | Cinza escuro claro |
| `--cream` | `210 20% 97%` | Creme (texto hero) |
| `--success` | `152 55% 42%` | Verde de sucesso |
| `--success-foreground` | `0 0% 100%` | Texto sobre sucesso |
| `--warning` | `38 92% 50%` | Amarelo de alerta |
| `--warning-foreground` | `0 0% 100%` | Texto sobre alerta |

#### Dark Mode (`.dark`)
| Variável | Valor HSL |
|----------|-----------|
| `--background` | `213 27% 8%` |
| `--foreground` | `210 20% 92%` |
| `--card` | `213 22% 12%` |
| `--primary` | `210 55% 50%` |
| `--secondary` | `213 18% 18%` |
| `--muted` | `213 15% 16%` |
| `--muted-foreground` | `213 10% 55%` |
| `--accent` | `213 18% 18%` |
| `--accent-foreground` | `210 45% 65%` |
| `--destructive` | `0 62% 30%` |
| `--border` | `213 15% 20%` |
| `--input` | `213 15% 20%` |
| `--ring` | `210 55% 50%` |

#### Sidebar tokens
| Variável (light) | Valor HSL |
|-------------------|-----------|
| `--sidebar-background` | `213 27% 12%` |
| `--sidebar-foreground` | `210 20% 92%` |
| `--sidebar-primary` | `210 55% 45%` |
| `--sidebar-accent` | `213 20% 18%` |
| `--sidebar-border` | `213 15% 20%` |

### 3.2 Tipografia

**Fontes carregadas** (Google Fonts):
- **Display**: `Plus Jakarta Sans` (400, 500, 600, 700, 800) — usada em títulos (h1-h4), labels de seção, badges
- **Body**: `Inter` (300, 400, 500, 600, 700) — usada em parágrafos, formulários, dados tabulares

**Classes utilitárias**:
- `.font-display` → `font-family: var(--font-display)` — Plus Jakarta Sans
- `.font-body` → `font-family: var(--font-body)` — Inter

**Escala tipográfica observada**:
| Elemento | Tamanho | Peso | Fonte |
|----------|---------|------|-------|
| H1 Hero (public) | `clamp(1.75rem, 5vw, 3.5rem)` | 800 (extrabold) | display |
| H1 Login | `text-3xl sm:text-4xl md:text-5xl` | 700 (bold) | display |
| H1 Landing | `text-4xl sm:text-5xl lg:text-6xl` | 700 | display |
| H2 Section title | `text-base sm:text-lg` | 700 | display |
| H3 Card title | `text-base sm:text-lg` | 700 | display |
| H4 Sub-section | `text-sm` | 700 | display |
| Body text | `text-xs sm:text-sm` | 400 | body |
| Caption/meta | `text-[10px] sm:text-[11px]` | 400-600 | body |
| Badge/tag | `text-[9px] sm:text-[10px]` | 600 | display ou body |
| Tabular numbers | `text-xs` | 600 | body + `tabular-nums` |

### 3.3 Espaçamento

- **Sistema**: Tailwind CSS default (4px base: `p-1`=4px, `p-2`=8px, `p-4`=16px, etc.)
- **Container**: `max-w-7xl` (público), `max-w-6xl` (admin), `max-w-5xl` (landing), `max-w-sm` (reset-password)
- **Padding padrão**: `px-4 sm:px-6 lg:px-8` (content), `px-3 sm:px-4 py-2.5 sm:py-3` (callouts)
- **Gap padrão**: `gap-2` (badges/chips), `gap-3 sm:gap-4` (sections), `gap-4 lg:gap-6` (grid principal)
- **Card padding**: `p-4 sm:p-5 md:p-6`

### 3.4 Breakpoints

| Breakpoint | Largura | Uso |
|-----------|---------|-----|
| `sm` | 640px | Ajustes tipográficos, padding |
| `md` | 768px | Grids 2 colunas, padding |
| `lg` | 1024px | Layout 2/3 colunas, sidebar visível, bottom bar oculta |
| `xl` | 1280px | Card info mais largo (360px) |
| `2xl` | 1400px | Container máximo |

### 3.5 Sombras, bordas e border-radius

**Border-radius tokens**:
- `--radius`: `0.5rem` (8px)
- `rounded-lg`: `var(--radius)` = 8px
- `rounded-md`: `calc(var(--radius) - 2px)` = 6px
- `rounded-sm`: `calc(var(--radius) - 4px)` = 4px
- Uso frequente de `rounded-xl` (12px), `rounded-2xl` (16px), `rounded-full`

**Sombras**:
- `shadow-sm`: cards de seção (hover: `shadow-md`)
- `shadow-lg`: BudgetSummary, WhatsApp FAB
- `shadow-2xl`: Lightbox image, mobile drawer
- Nenhum token custom de shadow definido

**Bordas**:
- Padrão: `border border-border` (1px)
- Destaque: `border-primary/20`, `border-primary/10`
- Sucesso: `border-success/30`, `border-2`
- Glassmorphism: `border-white/[0.1]`

---

## 4. COMPONENTES COMPARTILHADOS / UI KIT

### Componentes shadcn/ui

| Componente | Props principais | Variantes | Onde é usado |
|-----------|-----------------|-----------|-------------|
| `Button` | `variant`, `size`, `disabled` | default, outline, ghost, destructive | CTAs, ações do admin, forms |
| `Card` / `CardContent` | `className` | — | Todas as seções de conteúdo |
| `Accordion` / `AccordionItem` | `type`, `collapsible` | single | ArquitetonicoExpander, BudgetFAQ |
| `Badge` | `variant` | default, secondary, outline | Status, tags, chips |
| `Dialog` / `DialogContent` | `open`, `onOpenChange` | — | PortalShowcase (vídeo demo) |
| `Progress` | `value` | — | ProjectSecurity (score 92%) |
| `Tooltip` | `side`, `delayDuration` | — | BudgetSummary, SectionCard items |
| `AspectRatio` | `ratio` | — | PortalShowcase dialog |
| `Input` | `type`, `disabled` | — | Login, forms |
| `Label` | `htmlFor` | — | Login form |
| `Select` | — | — | Admin filter |
| `Separator` | — | — | Dividers |
| `Skeleton` | — | — | Loading states |
| `Toaster` (shadcn) | — | — | App root |
| `Sonner` (sonner) | — | — | App root, toast notifications |
| `ScrollArea` | — | — | (disponível, não usado ativamente) |

### Componentes custom de budget

| Componente | Props | Onde é usado |
|-----------|-------|-------------|
| `BudgetHeader` | `budget`, `onExportPdf`, `exporting` | PublicBudget |
| `BudgetSummary` | `sections`, `adjustments`, `total`, `generatedAt` | PublicBudget (sidebar + mobile drawer) |
| `SectionCard` | `section`, `compact`, `showItemQty`, `highlightZone` | PublicBudget (N instâncias) |
| `AnimatedSection` | `children`, `id`, `index` | PublicBudget (wrapper de todas as seções) |
| `ArquitetonicoExpander` | — (dados estáticos) | PublicBudget |
| `EngenhariaExpander` | — (dados estáticos) | PublicBudget |
| `PortalShowcase` | — (dados estáticos) | PublicBudget |
| `ProjectSecurity` | — (dados estáticos) | PublicBudget |
| `NextSteps` | — (dados estáticos) | PublicBudget |
| `FloorPlanViewer` | `floorPlanUrl`, `rooms`, `sections`, `activeRoom`, `onRoomClick` | PublicBudget |
| `PackageProgressBars` | `sections`, `total` | PublicBudget |
| `InstallmentSimulator` | `total` | PublicBudget |
| `ApprovalCTA` | `budgetId`, `publicId`, `approvedAt`, `approvedByName` | PublicBudget |
| `BudgetFAQ` | — (dados estáticos) | PublicBudget |
| `ReadingProgressBar` | — | PublicBudget |
| `ValidityCountdown` | `date`, `validityDays` | (disponível, não usado no header atual) |
| `WhatsAppButton` | `projectName`, `publicId`, `phone?` | PublicBudget |
| `Lightbox` | `images`, `initialIndex`, `open`, `onClose` | ArquitetonicoExpander, SectionCard |
| `ImportExcelModal` | `open`, `onClose` | AdminDashboard |
| `ThemeToggle` | — | AdminDashboard, BudgetHeader |

### Componentes de orcamento (rota interna)

| Componente | Props | Onde é usado |
|-----------|-------|-------------|
| `BudgetHero` | `meta`, `included` | OrcamentoPage |
| `ServicesSection` | `services` | OrcamentoPage |
| `JourneySection` | `steps` | OrcamentoPage |
| `ScopeSection` | `scope` | OrcamentoPage |
| `PortalWarrantyNextSteps` | `portalTabs` | OrcamentoPage |
| `StickyBudgetSummary` | `meta`, `included` | OrcamentoPage |

### Componentes do editor

| Componente | Props | Onde é usado |
|-----------|-------|-------------|
| `EditorStepper` | `current`, `onStepClick`, `completedSteps` | BudgetEditorV2 |
| `MetadataStep` | `budget`, `onFieldChange`, `onNext` | BudgetEditorV2 |
| `FloorPlanUploadStep` | `budgetId`, `floorPlanUrl`, `onUploaded`, `onNext` | BudgetEditorV2 |
| `RoomDrawingStep` | `floorPlanUrl`, `rooms`, `onRoomsChange`, `onNext`, `onBack` | BudgetEditorV2 |
| `SpreadsheetImportStep` | `packages`, `onImported`, `onNext`, `onBack` | BudgetEditorV2 |
| `CoverageMappingStep` | `floorPlanUrl`, `rooms`, `packages`, `onPackagesChange`, `onSave`, `onBack`, `saving`, `budgetId` | BudgetEditorV2 |
| `ItemImageUpload` | — | CoverageMappingStep |

---

## 5. ESTADO E DATA FLOW

### 5.1 Estado Global

| Solução | Escopo | Propriedades |
|---------|--------|-------------|
| `ThemeProvider` (next-themes) | App inteiro | `theme` (light/dark/system), `setTheme` |
| `QueryClientProvider` (TanStack React Query) | App inteiro | Cache de queries |
| `TooltipProvider` (Radix) | App inteiro | Delay de tooltips |

**Não há** Context API customizado para estado global compartilhado entre páginas. Cada página gerencia seu próprio estado local.

### 5.2 Dados do Servidor

**React Query** (`@tanstack/react-query`):
| Query Key | Hook | Endpoint | Usado em |
|-----------|------|----------|----------|
| `["orcamento-budget", projectId]` | `useOrcamentoBudget` | `supabase.from("budgets")` + `sections` + `items` | OrcamentoPage |

**Fetch direto (Supabase client)**:
| Operação | Descrição | Usado em |
|----------|-----------|----------|
| `fetchPublicBudget(publicId)` | Busca budget + sections + items + item_images + adjustments + rooms | PublicBudget |
| `supabase.from('budgets').select(...)` | Lista budgets com sections/items | AdminDashboard |
| `supabase.from('budgets').select(...)` | Carrega budget individual | BudgetEditorV2 |
| `supabase.from('rooms').select(...)` | Carrega rooms | BudgetEditorV2 |
| `supabase.from('notifications').select(...)` | Carrega notificações | AdminDashboard |
| `fetch(supabaseUrl/rest/v1/budgets...)` | PATCH direto (view count, approval) | PublicBudget, ApprovalCTA |
| `supabase.functions.invoke('notify-budget-view')` | Edge function (notificação de 1ª visualização) | PublicBudget |
| `supabase.auth.signInWithPassword` | Login | Login |
| `supabase.auth.signUp` | Cadastro | Login |
| `supabase.auth.resetPasswordForEmail` | Reset senha | Login |
| `supabase.auth.updateUser` | Atualiza senha | ResetPassword |

### 5.3 Estado Local Relevante

| Página | Estado complexo | Descrição |
|--------|----------------|-----------|
| `PublicBudget` | `budget`, `searchQuery`, `compactMode`, `showMobileSummary`, `activeRoom`, `exporting` | Controla busca, filtro por cômodo, modo compacto, drawer mobile e exportação PDF |
| `AdminDashboard` | `budgets`, `searchQuery`, `statusFilter`, `menuOpen`, `notifications`, `showNotifications` | Lista filtrada, menus contextuais, notificações |
| `BudgetEditorV2` | `currentStep`, `completedSteps`, `floorPlanUrl`, `rooms`, `packages`, `saving`, `roomSaveStatus` | Wizard multi-step com 5 etapas, auto-save |
| `BudgetEditor` (legacy) | `sections`, `adjustments`, `expandedSections`, `saving` | Edição direta de seções/itens |
| `Login` | `mode` (`login`/`signup`/`forgot`), `showPassword`, `capsLockOn`, `formError` | Formulário multi-modo |
| `ArquitetonicoExpander` | `activeTab`, `lightboxOpen`, `lightboxIndex`, `currentSlide` | Gallery tabs + carousel + lightbox |
| `SectionCard` | `expanded`, `lightboxOpen`, `lightboxImages`, `lightboxIndex` | Expand/collapse + lightbox |
| `FloorPlanViewer` | `hoveredRoom` | Hover state dos polígonos SVG |
| `ApprovalCTA` | `step` (`idle`/`form`/`loading`/`done`), `name` | Fluxo de aprovação multi-step |

---

## 6. FLUXOS DE USUÁRIO CRÍTICOS

### Fluxo 1: Login e acesso ao painel
1. Usuário acessa `/` → redirecionado para `/login`
2. Vê tela com background premium, campo email + senha
3. Digita credenciais e clica "Entrar"
4. `supabase.auth.signInWithPassword` é chamado
5. Se sucesso → `navigate("/admin")`
6. Se erro → mensagem contextual (credenciais inválidas, email não confirmado, rate limit)
7. Alternativas: "Criar conta" (signup), "Esqueci minha senha" (forgot → email de reset)

### Fluxo 2: Criar e publicar orçamento
1. Admin em `/admin` clica "Novo"
2. `supabase.from('budgets').insert(...)` cria budget com dados padrão
3. Redirecionado para `/admin/budget/:id` (Editor V2)
4. **Step 1 — Metadata**: Preenche nome do projeto, cliente, condomínio, bairro, metragem, versão (auto-save 800ms)
5. **Step 2 — Floor Plan**: Upload de planta baixa para Supabase Storage
6. **Step 3 — Rooms**: Desenha polígonos sobre a planta para delimitar cômodos (auto-save instantâneo)
7. **Step 4 — Spreadsheet**: Importa planilha Excel (.xlsx) com pacotes/itens
8. **Step 5 — Coverage**: Mapeia itens a cômodos, adiciona imagens por item
9. Clica "Salvar e Publicar" → gera `public_id`, atualiza status para `published`, copia link

### Fluxo 3: Visualização pública do orçamento
1. Cliente recebe link `/o/:publicId`
2. `fetchPublicBudget` carrega budget + sections + items + images + rooms
3. View count é incrementado via PATCH direto
4. Se é a 1ª visualização → `notify-budget-view` edge function é chamada → gera notificação in-app + email (se Resend configurado)
5. Cliente navega pela narrativa linear: Arquitetura → Engenharia → Portal → Planta → Escopo → Segurança → Próximos Passos
6. Sidebar (desktop) mostra resumo + simulador de parcelas + CTA
7. Mobile: bottom bar com total + "Iniciar meu projeto" + drawer expansível

### Fluxo 4: Aprovação do orçamento pelo cliente
1. Cliente vê ApprovalCTA na sidebar (desktop) ou drawer (mobile)
2. Clica "Iniciar meu projeto" → formulário pede nome completo
3. Digita nome e clica "Confirmar e iniciar projeto"
4. PATCH direto atualiza `approved_at` e `approved_by_name` no budget
5. UI muda para estado "done" com PartyPopper e confirmação

### Fluxo 5: Exportação de PDF
1. No header do orçamento público, clica botão "PDF"
2. `html2canvas` captura o elemento `#budget-content` (com `[data-pdf-hide]` elementos ocultos)
3. `jsPDF` gera documento A4 multi-página
4. Arquivo baixado automaticamente

### Fluxo 6: Navegação no Admin Dashboard
1. Lista de budgets com busca (nome/cliente) e filtro de status (Todos/Rascunhos/Publicados/Arquivados)
2. Métricas: Total, Publicados, Rascunhos, Valor total
3. Ações por budget: Editar (link), Publicar (gera public_id), Ver público (nova aba), Copiar link, Arquivar, Excluir
4. Notificações: badge de contagem, dropdown com lista de notificações não lidas

### Fluxo 7: Reset de senha
1. Na tela de login, clica "Esqueci minha senha"
2. Modo muda para "forgot", campo de senha desaparece
3. Digita email e clica "Enviar e-mail"
4. `supabase.auth.resetPasswordForEmail` envia link para `/reset-password`
5. Ao clicar no link do email, abre `/reset-password` com token no hash
6. Digita nova senha e salva via `supabase.auth.updateUser`
7. Redirecionado para `/admin`

---

## 7. ANIMAÇÕES E TRANSIÇÕES

| Elemento | Tipo | Biblioteca | Trigger | Duração/Config |
|---------|------|-----------|---------|----------------|
| `ReadingProgressBar` | Scale X (progress bar) | Framer Motion (`useSpring`) | Scroll | Spring: stiffness 100, damping 30 |
| `BudgetHeader` fade up | Opacity + translateY | Framer Motion (`variants`) | Mount | 0.5s, cubic-bezier(0.22,1,0.36,1), staggered (0.1s delay) |
| `AnimatedSection` | Opacity + translateY(30px) | Framer Motion (`whileInView`) | Scroll into view | 0.5s, cubic-bezier, once, margin -60px |
| `BudgetSummary` | Opacity + translateY(16px) | Framer Motion | Mount | 0.5s, easeOut |
| `BudgetSummary` items | Opacity + translateX(-4px) | Framer Motion | Mount | 0.2s, staggered 0.02s |
| `BudgetSummary` total | Opacity + scale(0.9→1) | Framer Motion | Mount | 0.4s, delay 0.5s |
| `SectionCard` | Opacity + translateY(16px) | Framer Motion (`whileInView`) | Scroll | 0.4s, once, margin -40px |
| `EngenhariaExpander` bullets | Opacity + translateX(-8px) | Framer Motion (`whileInView`) | Scroll | 0.3s, staggered 0.05s |
| `PortalShowcase` features | Opacity + translateY(8px) | Framer Motion (`whileInView`) | Scroll | 0.3s, staggered 0.04s |
| `ProjectSecurity` score | Opacity + scale(0.8→1) | Framer Motion (`whileInView`) | Scroll | once |
| `ProjectSecurity` checklist | Opacity + translateX(8px) | Framer Motion (`whileInView`) | Scroll | 0.2s, staggered 0.03s |
| `NextSteps` cards | Opacity + translateY(12px) | Framer Motion (`whileInView`) | Scroll | 0.3s, staggered 0.06s |
| `BudgetFAQ` | Opacity + translateY(20px) | Framer Motion (`whileInView`) | Scroll | 0.5s |
| `WhatsAppButton` | Scale(0→1) + opacity | Framer Motion | Mount | delay 1.5s, spring stiffness 200 |
| `WhatsAppButton` hover/tap | Scale 1.1 / 0.95 | Framer Motion | Hover/Tap | — |
| `ApprovalCTA` state transitions | AnimatePresence + opacity/y | Framer Motion | State change | wait mode |
| `ApprovalCTA` done icon | Scale(0→1) | Framer Motion | Mount | spring stiffness 200, delay 0.1s |
| `InstallmentSimulator` value | Opacity + translateY(4px) | Framer Motion | Tab change | — |
| `ValidityCountdown` | Opacity + translateX(10px) | Framer Motion | Mount | delay 0.6s |
| Mobile drawer | translateY("100%"→0) | Framer Motion | Toggle | spring damping 30, stiffness 300 |
| Mobile overlay | Opacity 0→1 | Framer Motion + AnimatePresence | Toggle | — |
| `OrcamentoPage` sections | Opacity + translateY(30px) | Framer Motion (stagger) | Mount + scroll | 0.6s, stagger 0.15s |
| `OrcamentoPage` sidebar | Opacity + translateX(20px) | Framer Motion | Mount | 0.5s, delay 0.3s |
| Accordion (CSS) | Height (0 → content height) | CSS (`tailwindcss-animate`) | Toggle | 0.2s ease-out |
| Fade-in (CSS) | Opacity + translateY(8px) | CSS keyframe | — | 0.4s ease-out |
| Slide-in-right (CSS) | Opacity + translateX(16px) | CSS keyframe | — | 0.4s ease-out |
| Embla Carousel | CSS transforms (slide) | embla-carousel-react | Swipe/click | Native |

---

## 8. RESPONSIVIDADE

### `/o/:publicId` — Orçamento Público

| Aspecto | Desktop (>1024px) | Tablet (768-1024px) | Mobile (<768px) |
|---------|-------------------|---------------------|-----------------|
| Layout | 3 colunas (2+1 sidebar) | 1 coluna | 1 coluna |
| Header | Grid 2 colunas (título + card info) | Grid 1 coluna, card abaixo | 1 coluna, card empilhado |
| Título H1 | `clamp(1.75rem,5vw,3.5rem)` ~3.5rem | ~2.5rem | ~1.75rem |
| Sidebar | Sticky, visível | Oculta | Oculta |
| Bottom bar | Oculta | Fixa com total + CTA | Fixa com total + CTA + drawer |
| BudgetSummary | Na sidebar | No drawer mobile | No drawer mobile |
| WhatsApp FAB | `bottom-6 right-6` | `bottom-24 right-4` | `bottom-24 right-4` |
| SectionCard cover | `h-40` | `h-32` | `h-32` |
| NextSteps | Grid 5 colunas | Grid 1 coluna (flex row) | Grid 1 coluna (flex row) |
| ProjectSecurity | Grid 2 colunas (score + checklist) | Grid 1 coluna | Grid 1 coluna |
| Gallery carousel | Arrows visíveis | Arrows visíveis | Arrows + swipe |
| PDF button label | "PDF" | Apenas ícone | Apenas ícone |

### `/admin` — Admin Dashboard

| Aspecto | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| Metrics grid | 4 colunas | 4 colunas | 2 colunas |
| Controls | Row com search + filtro + botões | Empilhado | Empilhado |
| Budget list | Cards em row | Cards em row | Cards em row |
| Notification dropdown | 320px, right-aligned | 320px | 320px |

### `/admin/budget/:id` — Editor V2

| Aspecto | Desktop | Mobile |
|---------|---------|--------|
| Stepper | Horizontal em header | Horizontal (compacto) |
| Conteúdo | max-w-7xl centralizado | Full width com padding |

### `/login`

| Aspecto | Desktop | Mobile |
|---------|---------|--------|
| Layout | Form alinhado à esquerda (`md:items-start`) | Form centralizado |
| Logo Bwild | Oculta (logo está no branding do form) | Visível (absolute top-right) |
| H1 | `md:text-5xl`, alinhado esquerda | `text-3xl`, centralizado |

### Componentes mobile-only

- **Sticky bottom bar** (`PublicBudget`): `lg:hidden`, exibe total + CTA + drawer expansível
- **Mobile bottom CTA** (`OrcamentoPage`): `lg:hidden`, botões "Agendar briefing" + WhatsApp
- **Logo mobile** (`Login`): `md:hidden`, posição absolute

---

## 9. ACESSIBILIDADE

### Semantic HTML
- ❌ **Não usa** `<main>` de forma consistente (usado em PublicBudget e AdminDashboard, mas não em Login)
- ❌ **Não usa** `<nav>` (não há navbar global)
- ❌ **Não usa** `<section>` ou `<article>` (exceto BudgetHero usa `<section>`)
- ✅ Usa `<header>` em BudgetHeader e AdminDashboard
- ✅ Usa `<footer>` na landing page
- ✅ Usa `<aside>` no OrcamentoPage

### ARIA Labels
- ✅ `aria-label` nos botões de navegação do carousel ("Anterior", "Próxima")
- ✅ `aria-label` nos dots do carousel ("Slide 1", "Slide 2")
- ✅ `aria-label` no botão de show/hide password
- ✅ `aria-label` no botão de fechar lightbox
- ✅ `role="alert"` e `aria-live="assertive"` no form error do Login
- ❌ Faltam ARIA labels na maioria dos botões de ação (exportar, publicar, etc.)
- ❌ Faltam `aria-label` nos chips de room do FloorPlanViewer

### Keyboard Navigation
- ✅ Accordion e Dialog (Radix) possuem keyboard navigation nativa
- ✅ Lightbox responde a Escape, ArrowLeft, ArrowRight
- ✅ Botões do formulário suportam Enter para submit
- ❌ FloorPlanViewer (SVG) não suporta navegação por teclado
- ❌ Carousel (Embla) não tem keyboard navigation explícita

### Contraste de Cores
- ⚠️ Texto `text-white/40` e `text-white/30` no header pode ter contraste insuficiente (≤2:1)
- ⚠️ Texto `text-[9px]` pode ser muito pequeno para leitura em telas de baixa resolução
- ✅ Cores primárias sobre fundos claros têm bom contraste
- ✅ Dark mode mantém contraste adequado para texto principal

### Focus States
- ✅ Inputs têm `focus:outline-none focus:ring-2 focus:ring-primary/30` (Login, Admin)
- ✅ Buttons shadcn possuem focus ring nativo
- ❌ Botões customizados (carousel arrows, room chips) não têm focus ring visível
- ❌ Gallery tabs não têm indicador de foco visível

---

## 10. PERFORMANCE E CARREGAMENTO

### Lazy Loading
- ✅ Imagens de seções: `loading="lazy"` em `SectionCard`, `ArquitetonicoExpander`
- ✅ Vídeo: `preload="metadata"` no ArquitetonicoExpander
- ❌ **Não há** `React.lazy()` ou code splitting por rota
- ❌ **Não há** `Suspense` boundaries

### Imagens
| Tipo | Formato | Otimização | Strategy |
|------|---------|-----------|----------|
| Logos | PNG (dark/white) | Estáticas em `src/assets/`, importadas como ES6 | Eager |
| Header BG | PNG (`header-bg.png`) | Estática, CSS background-image | Eager |
| Auth BG | PNG (`auth-bg.png`) | Estática, CSS background-image | Eager |
| Section covers | JPEG (Unsplash) | URLs externas, `w=800&h=450` params | Lazy |
| Item thumbnails | JPEG (Unsplash) | URLs externas, `w=200&h=200` params | Lazy |
| Floor plan | JPEG | Estática em `public/images/` | Eager |
| Gallery 3D | PNG | Estáticas em `public/images/` | Lazy |
| Gallery exec | JPEG | Estáticas em `public/images/` | Lazy |
| Gallery video | MP4 | Estático em `public/images/` | preload="metadata" |

### Code Splitting
- ❌ **Não implementado.** Todas as rotas são importadas estaticamente no `App.tsx`
- Recomendação: usar `React.lazy()` + `Suspense` para `/admin`, `/qa`, BudgetEditor, BudgetEditorV2

### Bundle
- Vite como bundler (tree-shaking automático)
- Dependências pesadas: `xlsx`, `html2canvas`, `jspdf`, `framer-motion`, `embla-carousel-react`, `recharts`

---

## 11. SEO E META

### index.html
```html
<title>Lovable App</title> <!-- ❌ GENÉRICO — deveria ser "Bwild Orçamentos" -->
<meta name="description" content="Lovable Generated Project"> <!-- ❌ GENÉRICO -->
<meta name="author" content="Lovable" /> <!-- ❌ Deveria ser "Bwild" -->
<meta property="og:title" content="Lovable App"> <!-- ❌ GENÉRICO -->
<meta property="og:description" content="Lovable Generated Project"> <!-- ❌ GENÉRICO -->
<meta property="og:type" content="website" /> <!-- ✅ -->
<meta property="og:image" content="...preview screenshot..."> <!-- ✅ OG image presente -->
<meta name="twitter:card" content="summary_large_image" /> <!-- ✅ -->
```

### Problemas identificados
- ❌ **Título genérico** — deveria ser "Bwild — Orçamentos Visuais de Reforma"
- ❌ **Meta description genérica** — deveria descrever o produto
- ❌ **Sem H1 único por página** — PublicBudget tem H1 no header, mas é fixo ("Projeto e Reforma")
- ❌ **Sem canonical URL**
- ❌ **Sem JSON-LD** (estrutura de dados do orçamento poderia usar schema.org)
- ❌ **Sem sitemap.xml** (apenas robots.txt presente)
- ❌ **Sem meta tags dinâmicas** por rota (SPA limitation)
- ✅ `lang="en"` no HTML (deveria ser `"pt-BR"`)
- ✅ Viewport meta tag presente

---

## 12. INTEGRAÇÕES E SERVIÇOS EXTERNOS

| Serviço | Uso | Onde no código |
|---------|-----|---------------|
| **Supabase Auth** | Login, signup, reset password, session management | `useAuth.tsx`, `Login.tsx`, `ResetPassword.tsx`, `ProtectedRoute.tsx` |
| **Supabase Database (Postgres)** | Budgets, sections, items, item_images, rooms, adjustments, notifications, media_library | `supabase-helpers.ts`, `AdminDashboard.tsx`, `BudgetEditorV2.tsx`, `PublicBudget.tsx` |
| **Supabase Storage** | Upload de planta baixa, imagens de itens | `FloorPlanUploadStep.tsx`, `ItemImageUpload.tsx` |
| **Supabase Edge Functions** | Notificação de 1ª visualização (`notify-budget-view`) | `PublicBudget.tsx` → `supabase.functions.invoke` |
| **Resend** (opcional) | Envio de email na 1ª visualização | `notify-budget-view/index.ts` (requer `RESEND_API_KEY`) |
| **WhatsApp** | Link direto para conversa (`wa.me`) | `WhatsAppButton.tsx`, `ApprovalCTA.tsx` |
| **Unsplash** | Imagens de exemplo (demo budget) | `demo-budget-data.ts` (URLs estáticas) |
| **Google Fonts** | Plus Jakarta Sans + Inter | `index.css` (CSS import) |
| **html2canvas + jsPDF** | Exportação de PDF | `pdf-export.ts` |
| **xlsx** | Importação de planilhas Excel | `SpreadsheetImportStep.tsx`, `ImportExcelModal.tsx` |
| **Embla Carousel** | Carrossel de galeria | `ArquitetonicoExpander.tsx` |
| **Framer Motion** | Animações e transições | 15+ componentes |
| **next-themes** | Toggle dark/light mode | `main.tsx`, `ThemeToggle.tsx` |
| **TanStack React Query** | Cache e fetch de dados do servidor | `useOrcamentoBudget.ts`, `App.tsx` |

---

## 13. SCREENSHOTS / DESCRIÇÃO VISUAL

### `/login` — Tela de Login
- **Layout**: Fullscreen com imagem de fundo escura (foto de obra/construção). Formulário alinhado à esquerda no desktop, centralizado no mobile.
- **Hierarquia visual**: H1 "Orçamentos Bwild." em branco bold ocupa a atenção principal. Formulário com campos de vidro transparente (bg-white/10) abaixo. Botão branco sólido "Entrar" como CTA principal.
- **Cores dominantes**: Background escuro (foto), texto branco, inputs semi-transparentes, botão branco.
- **Densidade**: Baixa — formulário limpo com espaçamento generoso. Footer minimalista com "Acesso seguro · LGPD".

### `/admin` — Admin Dashboard
- **Layout**: Header com logo + ações no topo. Conteúdo centralizado (max-w-6xl). Grid de métricas (4 cards em row). Barra de busca + filtros. Lista vertical de orçamentos como cards.
- **Proporções**: Full width, sem sidebar. Cards de métricas ocupam 1/4 cada.
- **CTAs**: Botões "Importar" (outline) e "Novo" (primary, navy) no canto superior direito. Ações inline por orçamento (publicar, ver, copiar, menu).
- **Hierarquia**: Métricas com números grandes + labels pequenos. Lista com nome bold + metadata muted + valor alinhado à direita.
- **Cores**: Background claro, cards brancos, badges coloridos por status (draft=muted, published=green, approved=primary).

### `/o/:publicId` — Orçamento Público
- **Layout**: Header hero com background escuro (foto), conteúdo em 2+1 colunas no desktop.
- **Header**: Título "Projeto e Reforma" extra-bold à esquerda. Card de glassmorphism à direita com Cliente/Obra em grid 2 colunas + metadados. Badges de valor abaixo do título. Status strip (Etapa, Próximo, Início).
- **Content column (2/3)**: Sequência vertical de cards com espaçamento consistente. Cards institucionais (Arquitetura, Engenharia, Portal) no topo com carrossel e badges. Planta baixa interativa com polígonos SVG. Escopo técnico com cover images e listas de itens expandíveis.
- **Sidebar (1/3)**: Sticky, contém BudgetSummary (lista de seções clicáveis + total), InstallmentSimulator (toggle 6x/10x/12x), ApprovalCTA (CTA verde "Iniciar meu projeto" + WhatsApp).
- **Mobile**: Sidebar desaparece. Bottom bar fixa com total + CTA + drawer expansível. WhatsApp FAB fixo no canto inferior direito.
- **Cores dominantes**: Escuro no header (charcoal/navy), claro no conteúdo (white/cream), primary (navy) para destaques, success (verde) para CTAs de aprovação.
- **Densidade**: Média — cards compactos com informações densas, mas bem espaçados entre si. Animações reveal-on-scroll reduzem a carga cognitiva.

### `/obra/:projectId/orcamento` — Orçamento Interno
- **Layout**: 2 colunas (flex-1 + 280px sidebar). Sem header hero — diretamente conteúdo.
- **Content**: Seções verticais com animações stagger. BudgetHero com H1, badges e card de inclusions. ServicesSection com cards colapsáveis. JourneySection com stepper de 6 etapas. ScopeSection com accordion searchable. PortalWarrantyNextSteps com tabs.
- **Sidebar**: Sticky, com meta info, checklist, CTAs (Agendar briefing, WhatsApp), navegação scrollspy com indicador de seção ativa (border-left azul).
- **Mobile**: Sidebar oculta. Bottom bar fixa com 2 botões (Agendar + WhatsApp).

---

## APÊNDICE: ARQUIVOS RELEVANTES NÃO COBERTOS ACIMA

| Arquivo | Descrição |
|---------|-----------|
| `src/App.css` | Provavelmente vazio ou com estilos residuais (não lido) |
| `src/components/NavLink.tsx` | Componente de link de navegação (não usado atualmente no routing) |
| `src/components/budget/BudgetContext.tsx` | Context para budget (não importado em nenhuma página — possivelmente deprecado) |
| `src/components/budget/ClientJourney.tsx` | Jornada do cliente (disponível mas não usado no PublicBudget atual) |
| `src/components/budget/ExecutiveSummary.tsx` | Sumário executivo (disponível mas não usado) |
| `src/components/budget/InvestmentImpact.tsx` | Impacto no investimento (disponível mas não usado) |
| `src/components/budget/RoomChecklist.tsx` | Checklist por cômodo (disponível mas não usado) |
| `src/components/budget/RoomDetailModal.tsx` | Modal de detalhe do cômodo (disponível mas não usado) |
| `src/components/budget/SectionNav.tsx` | Navegação de seções (disponível mas não usado) |
| `src/components/budget/WhatIsIncluded.tsx` | Seção "O que está incluso" (disponível mas não usado) |
| `src/lib/orcamento-mock-data.ts` | Dados mock para OrcamentoPage |
| `src/lib/orcamento-types.ts` | Types: BudgetMeta, ServiceCard, JourneyStep, ScopeItem, ScopeCategory, PortalTab, BudgetSummary |
| `src/components/budget/ValidityCountdown.tsx` | Countdown de validade — componente disponível mas **não integrado** no header atual |
| `public/robots.txt` | Presente (conteúdo não verificado) |
| `public/test-data/orcamento-teste.xlsx` | Planilha de teste para importação |

---

## NOTAS FINAIS

### Pontos fortes
1. Design system consistente com tokens semânticos HSL e suporte dark mode
2. Tipografia dual (display + body) bem aplicada
3. Animações reveal-on-scroll criam senso de progressão na narrativa
4. Bottom bar mobile garante CTAs sempre visíveis
5. Lightbox e carousel nativos para galeria visual

### Oportunidades de melhoria
1. **Code splitting**: Não implementado — todas as rotas são eager-loaded
2. **SEO**: Títulos e metas genéricos, `lang="en"` deveria ser `"pt-BR"`, sem JSON-LD
3. **Acessibilidade**: Faltam ARIA labels, keyboard nav em SVG/carousel, contraste de texto no header
4. **Componentes não utilizados**: 7+ componentes criados mas não integrados (BudgetContext, ClientJourney, ExecutiveSummary, InvestmentImpact, RoomChecklist, RoomDetailModal, SectionNav, WhatIsIncluded)
5. **Estado**: Sem estado global — cada página refetch dados independentemente
6. **Types**: `PublicBudget.tsx` usa `any` extensivamente em vez de types tipados
7. **ValidityCountdown**: Componente pronto mas não integrado ao header

---

*Documento gerado para auditoria externa. Todos os caminhos de arquivo são relativos à raiz do projeto.*
