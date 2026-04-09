import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminLeadsPage from "./pages/admin/AdminLeadsPage";
import AdminLeadDetailPage from "./pages/admin/AdminLeadDetailPage";
import AdminNotificationsPage from "./pages/admin/AdminNotificationsPage";
import AdminSourcesPage from "./pages/admin/AdminSourcesPage";
import AdminMarginCalculatorPage from "./pages/admin/AdminMarginCalculatorPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/leads" replace />} />
            <Route path="leads" element={<AdminLeadsPage />} />
            <Route path="leads/:leadId" element={<AdminLeadDetailPage />} />
            <Route path="sources" element={<AdminSourcesPage />} />
            <Route path="notifications" element={<AdminNotificationsPage />} />
            <Route path="margin-calculator" element={<AdminMarginCalculatorPage />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
