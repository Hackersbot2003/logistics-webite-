import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import HomePage from "./pages/HomePage";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Drivers from "./pages/Drivers";
import DriverDetail from "./pages/DriverDetail";
import Users from "./pages/Users";
import VehicleSheets from "./pages/VehicleSheets";
import Vehicles from "./pages/Vehicles";
import LogisticsPartners from "./pages/LogisticsPartners";
import Billing from "./pages/Billing";
import Accounts from "./pages/Accounts";
import Layout from "./components/Layout";
import LrGenerator from "./pages/LrGenerator";

const Placeholder = ({ title }) => (
  <div style={{ padding: 40, background: "#fff", minHeight: "100vh" }}>
    <h2 style={{ margin: 0, color: "#1E293B" }}>{title}</h2>
    <p style={{ color: "#64748B" }}>This section is coming soon.</p>
  </div>
);

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#080A0F" }}>
      <div style={{ width:40, height:40, border:"3px solid #1E2535", borderTopColor:"#2563EB", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
};

const AppRoutes = () => (
  <Routes>
    {/* Public routes */}
    <Route path="/home" element={<HomePage />} />
    <Route path="/login" element={<Login />} />

    {/* Protected app shell */}
    <Route path="/" element={
      <ProtectedRoute>
        <SocketProvider><Layout /></SocketProvider>
      </ProtectedRoute>
    }>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="dashboard"           element={<Dashboard />} />
      <Route path="drivers"             element={<Drivers />} />
      <Route path="drivers/:id"         element={<DriverDetail />} />
      <Route path="vehicles"            element={<Vehicles />} />
      <Route path="accounts"            element={<Accounts />} />
      <Route path="billing"             element={
        <ProtectedRoute roles={["superadmin","admin","manager"]}>
          <Billing />
        </ProtectedRoute>
      } />
      <Route path="lr-generator"        element={<LrGenerator />} />
      <Route path="vehicle-sheets"      element={
        <ProtectedRoute roles={["superadmin","admin"]}>
          <VehicleSheets />
        </ProtectedRoute>
      } />
      <Route path="ManageVehicleSheets" element={
        <ProtectedRoute roles={["superadmin","admin"]}>
          <VehicleSheets />
        </ProtectedRoute>
      } />
      {/* lockSheets is a filtered view of VehicleSheets for admins only */}
      <Route path="lockSheets"          element={
        <ProtectedRoute roles={["admin","superadmin"]}>
          <VehicleSheets lockMode />
        </ProtectedRoute>
      } />
      <Route path="logistics-partners"  element={<LogisticsPartners />} />
      <Route path="users"               element={
        <ProtectedRoute roles={["superadmin","admin"]}>
          <Users />
        </ProtectedRoute>
      } />
    </Route>

    {/* Default: show homepage for unauthenticated, dashboard for authenticated */}
    <Route path="*" element={<DefaultRedirect />} />
  </Routes>
);

function DefaultRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? "/dashboard" : "/home"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <Toaster position="top-right" toastOptions={{
        style: { background:"#fff", color:"#1E293B", border:"1px solid #E2E8F0", fontSize:"14px", boxShadow:"0 4px 12px rgba(0,0,0,0.1)" },
        success: { iconTheme: { primary:"#22C55E", secondary:"#fff" } },
        error:   { iconTheme: { primary:"#EF4444", secondary:"#fff" } },
      }} />
    </AuthProvider>
  );
}
