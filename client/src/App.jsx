import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
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

// ── Intercepteur global d'invitation ──────────────────────────────────────────
// Détecte les tokens Supabase (flux PKCE ?code= ou flux implicite #access_token)
// sur n'importe quelle page et redirige vers /set-password avant que le client
// Supabase ne connecte automatiquement l'utilisateur.
function InviteTokenInterceptor() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Ne pas intercepter si on est déjà sur /set-password
    if (location.pathname === '/set-password') return;

    // Flux PKCE : ?code=xxx dans les query params
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');

    // Flux implicite : #access_token=xxx&type=invite dans le hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const hashToken = hashParams.get('access_token');
    const hashType  = hashParams.get('type');

    if (code) {
      // PKCE — rediriger vers /set-password en préservant le code
      navigate(`/set-password${window.location.search}`, { replace: true });
    } else if (hashToken && (hashType === 'invite' || hashType === 'recovery')) {
      // Implicite — rediriger vers /set-password en préservant le hash
      navigate(`/set-password${window.location.hash}`, { replace: true });
    }
  }, [navigate, location.pathname]);

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
      <InviteTokenInterceptor />
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
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
