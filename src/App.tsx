import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminLeadsPage from "./pages/admin/AdminLeadsPage";
import AdminLeadDetailPage from "./pages/admin/AdminLeadDetailPage";
import AdminNotificationsPage from "./pages/admin/AdminNotificationsPage";
import AdminSourcesPage from "./pages/admin/AdminSourcesPage";
import AdminClientOrderDetailPage from "./pages/admin/AdminClientOrderDetailPage";
import AdminMarginCalculatorPage from "./pages/admin/AdminMarginCalculatorPage";
import AdminWeddingCalculatorLayout from "./pages/admin/AdminWeddingCalculatorLayout";

const queryClient = new QueryClient();

const LegacyLeadDetailRedirect = () => {
  const { leadId } = useParams();
  return <Navigate to={`/admin/wedding-calculator/leads/${leadId ?? ""}`} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/wedding-calculator/leads" replace />} />
            <Route path="wedding-calculator" element={<AdminWeddingCalculatorLayout />}>
              <Route index element={<Navigate to="/admin/wedding-calculator/leads" replace />} />
              <Route path="leads" element={<AdminLeadsPage />} />
              <Route path="leads/:leadId" element={<AdminLeadDetailPage />} />
              <Route path="sources" element={<AdminSourcesPage />} />
              <Route path="notifications" element={<AdminNotificationsPage />} />
            </Route>
            <Route path="leads" element={<Navigate to="/admin/wedding-calculator/leads" replace />} />
            <Route path="leads/:leadId" element={<LegacyLeadDetailRedirect />} />
            <Route path="sources" element={<Navigate to="/admin/wedding-calculator/sources" replace />} />
            <Route path="notifications" element={<Navigate to="/admin/wedding-calculator/notifications" replace />} />
            <Route path="margin-calculator" element={<AdminMarginCalculatorPage />} />
            <Route path="margin-calculator/orders/:orderId" element={<AdminClientOrderDetailPage />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
