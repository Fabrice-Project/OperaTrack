import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Building2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

const DEMO_ACCOUNTS = [
  { email: 'admin@denain.fr', label: 'Administrateur' },
  { email: 'sophie.marchand@denain.fr', label: 'Chargée d\'opération' },
  { email: 'thomas.duval@denain.fr', label: 'Chargé d\'opération' },
  { email: 'direction@denain.fr', label: 'Direction' }
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Bienvenue sur OpéraTrack !');
    } catch (err) {
      toast.error(err.message || 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (email) => setForm({ email, password: 'Demo2026!' });

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #1A3A5C 0%, #2E75B6 100%)' }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-4">
            <Building2 size={32} className="text-white" />
          </div>
          <h1 className="font-heading font-bold text-white text-2xl">OpéraTrack</h1>
          <p className="text-white/60 text-sm mt-1">Ville de Denain — Suivi des opérations</p>
        </div>

        {/* Carte formulaire */}
        <div className="card p-8">
          <h2 className="font-heading font-semibold text-text-main text-lg mb-6">Connexion</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="form-label">Adresse e-mail</label>
              <input
                type="email"
                className="form-input"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="votre@email.fr"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="form-label">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="form-input pr-10"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main transition-colors"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full justify-center mt-2"
              disabled={loading}
            >
              {loading ? 'Connexion en cours…' : 'Se connecter'}
            </button>
          </form>

          {/* Comptes démo */}
          <div className="mt-6 pt-5 border-t border-border">
            <p className="text-xs text-text-muted text-center mb-3 font-medium uppercase tracking-wide">
              Comptes de démonstration
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.email}
                  onClick={() => fillDemo(acc.email)}
                  className="text-left px-3 py-2 rounded-lg border border-border hover:border-secondary hover:bg-blue-50 transition-all text-xs"
                >
                  <div className="font-semibold text-text-main">{acc.label}</div>
                  <div className="text-text-muted truncate">{acc.email}</div>
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-text-muted mt-2">Mot de passe : <code className="font-mono bg-gray-100 px-1 rounded">Demo2026!</code></p>
          </div>
        </div>
      </div>
    </div>
  );
}
