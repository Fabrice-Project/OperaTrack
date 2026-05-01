import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { supabase } from './utils/supabaseClient';
import LoginPage from './pages/auth/LoginPage';
import SetPasswordPage from './pages/auth/SetPasswordPage';
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
import RapportEnergiePage from './pages/patrimoine/energie/RapportEnergiePage';

const WRITE_ROLES = ['write', 'charge_operation', 'compta', 'administratif', 'gestionnaire_patrimonial'];

// ── Garde de session Supabase ─────────────────────────────────────────────────
// Tourne UNE SEULE FOIS au chargement de l'app.
// Si Supabase a une session active (établie via cookie PKCE lors du clic sur
// le lien d'invitation) et qu'on n'est pas déjà sur /set-password → on y redirige.
// Cela fonctionne même quand l'admin est connecté et teste le lien d'invitation.
function InviteSessionGuard() {
  const navigate = useNavigate();

  useEffect(() => {
    if (window.location.pathname === '/set-password') return;
    if (sessionStorage.getItem('opera_invite')) return; // déjà traité dans main.jsx

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Vider la session de l'app pour ne pas afficher le tableau de bord admin
        localStorage.removeItem('opera_token');
        localStorage.removeItem('opera_user');
        navigate('/set-password', { replace: true });
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentionnellement vide

  return null;
}

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
      <InviteSessionGuard />
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login"        element={<LoginPage />} />
            <Route path="/set-password" element={<SetPasswordPage />} />
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
            <Route path="/patrimoine/energie/rapport" element={<ProtectedRoute><RapportEnergiePage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
