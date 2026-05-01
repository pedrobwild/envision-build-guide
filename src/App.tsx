import { lazy, Suspense } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { UserProfileProvider } from "@/hooks/useUserProfile";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/AdminLayout";
import { ChunkErrorBoundary } from "@/components/ChunkErrorBoundary";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import logoDark from "@/assets/logo-bwild-dark.png";
import { RoleRedirect } from "@/components/RoleRedirect";
import { RoleGuard } from "@/components/RoleGuard";
import { ConfirmProvider } from "@/hooks/useConfirm";

const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const BudgetEditorV2 = lazy(() => import("./pages/BudgetEditorV2"));

const PublicBudget = lazy(() => import("./pages/PublicBudget"));
const OrcamentoPage = lazy(() => import("./pages/OrcamentoPage"));
const QAEvaluator = lazy(() => import("./pages/QAEvaluator"));
const FinancialHistory = lazy(() => import("./pages/FinancialHistory"));
const BudgetRequestsList = lazy(() => import("./pages/BudgetRequestsList"));
const NewBudgetRequest = lazy(() => import("./pages/NewBudgetRequest"));
const EstimatorDashboard = lazy(() => import("./pages/EstimatorDashboard"));
const CommercialDashboard = lazy(() => import("./pages/CommercialDashboard"));
const ConversionDashboard = lazy(() => import("./pages/ConversionDashboard"));
const SalesKpisPage = lazy(() => import("./pages/SalesKpisPage"));
const AdminOperationsDashboard = lazy(() => import("./pages/AdminOperationsDashboard"));
const BudgetInternalDetail = lazy(() => import("./pages/BudgetInternalDetail"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const VersionCompare = lazy(() => import("./pages/VersionCompare"));
const CatalogPage = lazy(() => import("./pages/CatalogPage"));
const SystemToolsPage = lazy(() => import("./pages/SystemToolsPage"));
const TrashPage = lazy(() => import("./pages/TrashPage"));
const PhotoLibraryUpload = lazy(() => import("./pages/PhotoLibraryUpload"));
const BudgetTemplatesPage = lazy(() => import("./pages/BudgetTemplatesPage"));
const TemplateEditorPage = lazy(() => import("./pages/TemplateEditorPage"));
const ClientsList = lazy(() => import("./pages/ClientsList"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const LeadSourcesPage = lazy(() => import("./pages/LeadSourcesPage"));
const LeadRoutingRulesPage = lazy(() => import("./pages/LeadRoutingRulesPage"));
const AnalisesPage = lazy(() => import("./pages/AnalisesPage"));
const ForecastPage = lazy(() => import("./pages/ForecastPage"));
const AgendaPage = lazy(() => import("./pages/AgendaPage"));
const InsightsPage = lazy(() => import("./pages/InsightsPage"));
const DigisacPage = lazy(() => import("./pages/DigisacPage"));
const BudgetDiagnosticsPage = lazy(() => import("./pages/BudgetDiagnosticsPage"));
const BugReportsPage = lazy(() => import("./pages/BugReportsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <img src={logoDark} alt="Bwild" className="h-8 animate-pulse" />
      <span className="text-sm text-muted-foreground font-body animate-pulse">Carregando...</span>
    </div>
  );
}

function AdminPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <PageErrorBoundary>{children}</PageErrorBoundary>
      </AdminLayout>
    </ProtectedRoute>
  );
}

/** Redireciona /admin/budget/:budgetId/legacy → /admin/budget/:budgetId */
function LegacyBudgetRedirect() {
  const { budgetId } = useParams<{ budgetId: string }>();
  return <Navigate to={`/admin/budget/${budgetId ?? ""}`} replace />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2, // 2 min
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <UserProfileProvider>
        <TooltipProvider>
          <ConfirmProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ChunkErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
                  <Routes>
                    <Route path="/" element={<RoleRedirect />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/admin" element={<AdminPage><AdminDashboard /></AdminPage>} />
                    <Route path="/admin/budget/:budgetId" element={<AdminPage><BudgetEditorV2 /></AdminPage>} />
                    <Route path="/admin/budget/:budgetId/legacy" element={<LegacyBudgetRedirect />} />
                    <Route path="/admin/financeiro" element={<AdminPage><RoleGuard allowedRoles={["admin"]}><FinancialHistory /></RoleGuard></AdminPage>} />
                    <Route path="/admin/solicitacoes" element={<AdminPage><RoleGuard allowedRoles={["admin", "comercial", "orcamentista"]}><BudgetRequestsList /></RoleGuard></AdminPage>} />
                    <Route path="/admin/solicitacoes/nova" element={<AdminPage><RoleGuard allowedRoles={["admin", "comercial", "orcamentista"]}><NewBudgetRequest /></RoleGuard></AdminPage>} />
                    <Route path="/admin/producao" element={<AdminPage><RoleGuard allowedRoles={["admin", "orcamentista"]}><EstimatorDashboard /></RoleGuard></AdminPage>} />
                    <Route path="/admin/comercial" element={<AdminPage><RoleGuard allowedRoles={["admin", "comercial", "orcamentista"]}><CommercialDashboard /></RoleGuard></AdminPage>} />
                    <Route path="/admin/comercial/conversao" element={<AdminPage><RoleGuard allowedRoles={["admin", "comercial", "orcamentista"]}><ConversionDashboard /></RoleGuard></AdminPage>} />
                    <Route path="/admin/comercial/kpis" element={<AdminPage><RoleGuard allowedRoles={["admin", "comercial", "orcamentista"]}><SalesKpisPage /></RoleGuard></AdminPage>} />
                    <Route path="/admin/operacoes" element={<AdminPage><RoleGuard allowedRoles={["admin"]}><AdminOperationsDashboard /></RoleGuard></AdminPage>} />
                    <Route path="/admin/analises" element={<AdminPage><RoleGuard allowedRoles={["admin"]}><AnalisesPage /></RoleGuard></AdminPage>} />
                    <Route path="/admin/forecast" element={<AdminPage><RoleGuard allowedRoles={["admin"]}><ForecastPage /></RoleGuard></AdminPage>} />
                    <Route path="/admin/usuarios" element={<AdminPage><RoleGuard allowedRoles={["admin", "orcamentista"]}><UserManagement /></RoleGuard></AdminPage>} />
                    <Route path="/admin/demanda/:budgetId" element={<AdminPage><BudgetInternalDetail /></AdminPage>} />
                    <Route path="/admin/comparar" element={<AdminPage><VersionCompare /></AdminPage>} />
                    <Route path="/admin/catalogo" element={<AdminPage><RoleGuard allowedRoles={["admin", "orcamentista"]}><CatalogPage /></RoleGuard></AdminPage>} />
                    <Route path="/admin/sistema" element={<AdminPage><RoleGuard allowedRoles={["admin"]}><SystemToolsPage /></RoleGuard></AdminPage>} />
                    <Route path="/admin/lixeira" element={<AdminPage><RoleGuard allowedRoles={["admin"]}><TrashPage /></RoleGuard></AdminPage>} />
                    <Route path="/admin/biblioteca-fotos" element={<AdminPage><RoleGuard allowedRoles={["admin", "orcamentista"]}><PhotoLibraryUpload /></RoleGuard></AdminPage>} />
                    <Route path="/admin/templates" element={<AdminPage><RoleGuard allowedRoles={["admin", "orcamentista"]}><BudgetTemplatesPage /></RoleGuard></AdminPage>} />
                    <Route path="/admin/templates/:templateId/editar" element={<AdminPage><RoleGuard allowedRoles={["admin", "orcamentista"]}><TemplateEditorPage /></RoleGuard></AdminPage>} />
                    <Route path="/admin/crm" element={<AdminPage><RoleGuard allowedRoles={["admin", "comercial", "orcamentista"]}><ClientsList /></RoleGuard></AdminPage>} />
                    <Route path="/admin/crm/:clientId" element={<AdminPage><RoleGuard allowedRoles={["admin", "comercial", "orcamentista"]}><ClientDetail /></RoleGuard></AdminPage>} />
                    <Route path="/admin/leads" element={<AdminPage><RoleGuard allowedRoles={["admin", "comercial", "orcamentista"]}><LeadSourcesPage /></RoleGuard></AdminPage>} />
                    <Route path="/admin/leads/regras" element={<AdminPage><RoleGuard allowedRoles={["admin"]}><LeadRoutingRulesPage /></RoleGuard></AdminPage>} />
                    <Route path="/admin/agenda" element={<AdminPage><RoleGuard allowedRoles={["admin", "comercial", "orcamentista"]}><AgendaPage /></RoleGuard></AdminPage>}/>
                    <Route path="/admin/insights" element={<AdminPage><RoleGuard allowedRoles={["admin", "comercial", "orcamentista"]}><InsightsPage /></RoleGuard></AdminPage>}/>
                    <Route path="/admin/digisac" element={<AdminPage><RoleGuard allowedRoles={["admin"]}><DigisacPage /></RoleGuard></AdminPage>}/>
                    <Route path="/o/:publicId" element={<PublicBudget />} />
                    <Route path="/obra/:publicId/orcamento" element={<OrcamentoPage />} />
                    <Route path="/qa" element={<AdminPage><RoleGuard allowedRoles={["admin"]}><QAEvaluator /></RoleGuard></AdminPage>} />
                    <Route path="/admin/diagnostico" element={<AdminPage><RoleGuard allowedRoles={["admin", "comercial", "orcamentista"]}><BudgetDiagnosticsPage /></RoleGuard></AdminPage>} />
                    <Route path="/admin/bug-reports" element={<AdminPage><RoleGuard allowedRoles={["admin", "comercial", "orcamentista"]}><BugReportsPage /></RoleGuard></AdminPage>} />
                    <Route path="/admin/bug-reports/:bugId" element={<AdminPage><RoleGuard allowedRoles={["admin", "comercial", "orcamentista"]}><BugReportsPage /></RoleGuard></AdminPage>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </ChunkErrorBoundary>
            </BrowserRouter>
          </ConfirmProvider>
        </TooltipProvider>
      </UserProfileProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

