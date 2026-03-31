import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/AdminLayout";
import logoDark from "@/assets/logo-bwild-dark.png";

const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const BudgetEditorV2 = lazy(() => import("./pages/BudgetEditorV2"));
const BudgetEditor = lazy(() => import("./pages/BudgetEditor"));
const PublicBudget = lazy(() => import("./pages/PublicBudget"));
const OrcamentoPage = lazy(() => import("./pages/OrcamentoPage"));
const QAEvaluator = lazy(() => import("./pages/QAEvaluator"));
const FinancialHistory = lazy(() => import("./pages/FinancialHistory"));
const BudgetRequestsList = lazy(() => import("./pages/BudgetRequestsList"));
const NewBudgetRequest = lazy(() => import("./pages/NewBudgetRequest"));
const EstimatorDashboard = lazy(() => import("./pages/EstimatorDashboard"));
const CommercialDashboard = lazy(() => import("./pages/CommercialDashboard"));
const AdminOperationsDashboard = lazy(() => import("./pages/AdminOperationsDashboard"));
const BudgetInternalDetail = lazy(() => import("./pages/BudgetInternalDetail"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const VersionCompare = lazy(() => import("./pages/VersionCompare"));
const CatalogPage = lazy(() => import("./pages/CatalogPage"));
const SystemToolsPage = lazy(() => import("./pages/SystemToolsPage"));
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
      <AdminLayout>{children}</AdminLayout>
    </ProtectedRoute>
  );
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin" element={<AdminPage><AdminDashboard /></AdminPage>} />
            <Route path="/admin/budget/:budgetId" element={<AdminPage><BudgetEditorV2 /></AdminPage>} />
            <Route path="/admin/budget/:budgetId/legacy" element={<AdminPage><BudgetEditor /></AdminPage>} />
            <Route path="/admin/financeiro" element={<AdminPage><FinancialHistory /></AdminPage>} />
            <Route path="/admin/solicitacoes" element={<AdminPage><BudgetRequestsList /></AdminPage>} />
            <Route path="/admin/solicitacoes/nova" element={<AdminPage><NewBudgetRequest /></AdminPage>} />
            <Route path="/admin/producao" element={<AdminPage><EstimatorDashboard /></AdminPage>} />
            <Route path="/admin/comercial" element={<AdminPage><CommercialDashboard /></AdminPage>} />
            <Route path="/admin/operacoes" element={<AdminPage><AdminOperationsDashboard /></AdminPage>} />
            <Route path="/admin/usuarios" element={<AdminPage><UserManagement /></AdminPage>} />
            <Route path="/admin/demanda/:budgetId" element={<AdminPage><BudgetInternalDetail /></AdminPage>} />
            <Route path="/admin/comparar" element={<AdminPage><VersionCompare /></AdminPage>} />
            <Route path="/admin/catalogo" element={<AdminPage><CatalogPage /></AdminPage>} />
            <Route path="/o/:publicId" element={<PublicBudget />} />
            <Route path="/obra/:projectId/orcamento" element={<OrcamentoPage />} />
            <Route path="/qa" element={<AdminPage><QAEvaluator /></AdminPage>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
