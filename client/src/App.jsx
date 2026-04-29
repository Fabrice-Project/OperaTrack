import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import OperationsListPage from './pages/operations/OperationsListPage';
import OperationDetailPage from './pages/operations/OperationDetailPage';
import OperationFormPage from './pages/operations/OperationFormPage';
import MandatPage from './pages/mandat/MandatPage';
import MandatRapportPage from './pages/mandat/MandatRapportPage';
import SettingsPage from './pages/settings/SettingsPage';
import PatrimoinePage from './pages/patrimoine/PatrimoinePage';
import TronconPage from './pages/patrimoine/voirie/TronconPage';
import MarchePage from './pages/patrimoine/voirie/MarchePage';
import PointLumineuxPage from './pages/patrimoine/eclairage/PointLumineuxPage';
import ArmoirePage from './pages/patrimoine/eclairage/ArmoirePage';
import BatimentPage from './pages/patrimoine/batiments/BatimentPage';
import EnergieDashboardPage from './pages/patrimoine/energie/EnergieDashboardPage';

const WRITE_ROLES = ['write', 'charge_operation', 'compta'];

function ProtectedRoute({ children, hideForWrite = false }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-bg-page">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-text-muted text-sm">Chargement…</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (hideForWrite && WRITE_ROLES.includes(user?.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/operations" element={<ProtectedRoute><OperationsListPage /></ProtectedRoute>} />
            <Route path="/operations/new" element={<ProtectedRoute><OperationFormPage /></ProtectedRoute>} />
            <Route path="/operations/:id" element={<ProtectedRoute><OperationDetailPage /></ProtectedRoute>} />
            <Route path="/operations/:id/edit" element={<ProtectedRoute><OperationFormPage /></ProtectedRoute>} />
            <Route path="/mandat" element={<ProtectedRoute><MandatPage /></ProtectedRoute>} />
            <Route path="/mandat/rapport" element={<ProtectedRoute><MandatRapportPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute hideForWrite><SettingsPage /></ProtectedRoute>} />
            <Route path="/patrimoine/voirie" element={<ProtectedRoute><PatrimoinePage defaultTab="voirie" /></ProtectedRoute>} />
            <Route path="/patrimoine/eclairage" element={<ProtectedRoute><PatrimoinePage defaultTab="eclairage" /></ProtectedRoute>} />
            <Route path="/patrimoine/batiments" element={<ProtectedRoute><PatrimoinePage defaultTab="batiments" /></ProtectedRoute>} />
            <Route path="/patrimoine/voirie/marche/:marcheId" element={<ProtectedRoute><MarchePage /></ProtectedRoute>} />
            <Route path="/patrimoine/voirie/:id" element={<ProtectedRoute><TronconPage /></ProtectedRoute>} />
            <Route path="/patrimoine/eclairage/armoire/:id" element={<ProtectedRoute><ArmoirePage /></ProtectedRoute>} />
            <Route path="/patrimoine/eclairage/:id" element={<ProtectedRoute><PointLumineuxPage /></ProtectedRoute>} />
            <Route path="/patrimoine/batiments/:id" element={<ProtectedRoute><BatimentPage /></ProtectedRoute>} />
            <Route path="/patrimoine/energie" element={<ProtectedRoute><EnergieDashboardPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
