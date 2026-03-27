import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
const NotFound = lazy(() => import("./pages/NotFound"));

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <img src={logoDark} alt="Bwild" className="h-8 animate-pulse" />
      <span className="text-sm text-muted-foreground font-body animate-pulse">Carregando...</span>
    </div>
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
            <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/budget/:budgetId" element={<ProtectedRoute><BudgetEditorV2 /></ProtectedRoute>} />
            <Route path="/admin/budget/:budgetId/legacy" element={<ProtectedRoute><BudgetEditor /></ProtectedRoute>} />
            <Route path="/o/:publicId" element={<PublicBudget />} />
            <Route path="/obra/:projectId/orcamento" element={<OrcamentoPage />} />
            <Route path="/qa" element={<QAEvaluator />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
