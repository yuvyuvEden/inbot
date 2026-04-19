import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AccountantDashboard from "./pages/AccountantDashboard";
import AccountantClientView from "./pages/AccountantClientView";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center">טוען...</div>;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const RoleRoute = ({ role, children }: { role: string; children: React.ReactNode }) => {
  const { session, loading, userRole, roleLoading } = useAuth();
  
  // המתן עד שגם session וגם role נטענו
  if (loading || roleLoading) {
    return <div className="flex min-h-screen items-center justify-center text-[#1e3a5f] font-heebo">טוען...</div>;
  }
  
  if (!session) return <Navigate to="/login" replace />;
  if (userRole !== role) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const SmartRedirect = () => {
  const { session, loading, userRole, roleLoading } = useAuth();
  
  // המתן עד שגם session וגם role נטענו
  if (loading || roleLoading) {
    return <div className="flex min-h-screen items-center justify-center text-[#1e3a5f] font-heebo">טוען...</div>;
  }
  
  if (!session) return <Navigate to="/login" replace />;
  if (userRole === "admin") return <Navigate to="/admin" replace />;
  if (userRole === "accountant") return <Navigate to="/accountant" replace />;
  return <Navigate to="/dashboard" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<SmartRedirect />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/admin" element={<RoleRoute role="admin"><AdminDashboard /></RoleRoute>} />
            <Route path="/accountant" element={<RoleRoute role="accountant"><AccountantDashboard /></RoleRoute>} />
            <Route path="/accountant/client/:clientId" element={<RoleRoute role="accountant"><AccountantClientView /></RoleRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
