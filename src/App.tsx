import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import AdminDashboard from "./pages/AdminDashboard";
import BudgetEditor from "./pages/BudgetEditor";
import BudgetEditorV2 from "./pages/BudgetEditorV2";
import PublicBudget from "./pages/PublicBudget";
import QAEvaluator from "./pages/QAEvaluator";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/budget/:budgetId" element={<ProtectedRoute><BudgetEditorV2 /></ProtectedRoute>} />
          <Route path="/admin/budget/:budgetId/legacy" element={<ProtectedRoute><BudgetEditor /></ProtectedRoute>} />
          <Route path="/o/:publicId" element={<PublicBudget />} />
          <Route path="/qa" element={<QAEvaluator />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
