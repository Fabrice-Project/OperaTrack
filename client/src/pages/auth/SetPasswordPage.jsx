import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { useToast } from '../../contexts/ToastContext';

export default function SetPasswordPage() {
  const navigate  = useNavigate();
  const toast     = useToast();
  const [password,     setPassword]     = useState('');
  const [confirm,      setConfirm]      = useState('');
  const [showPwd,      setShowPwd]      = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [tokenError,   setTokenError]   = useState('');

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');

    const hashParams   = new URLSearchParams(window.location.hash.substring(1));
    const accessToken  = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token') || '';
    const type         = hashParams.get('type');

    if (code) {
      // Flux PKCE : échange du code contre une session
      supabase.auth.exchangeCodeForSession(code)
        .then(({ data, error }) => {
          if (error || !data.session) {
            setTokenError('Lien invalide ou expiré. Contactez votre administrateur pour recevoir un nouvel email.');
          } else {
            setSessionReady(true);
            window.history.replaceState(null, '', window.location.pathname);
          }
        });
    } else if (accessToken && (type === 'invite' || type === 'recovery' || type === 'signup')) {
      // Flux implicite : injection directe de la session depuis le hash
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ data, error }) => {
          if (error || !data.session) {
            setTokenError('Lien invalide ou expiré. Contactez votre administrateur pour recevoir un nouvel email.');
          } else {
            setSessionReady(true);
            window.history.replaceState(null, '', window.location.pathname);
          }
        });
    } else {
      setTokenError('Lien invalide ou expiré. Contactez votre administrateur pour recevoir un nouvel email.');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error('Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Mot de passe défini avec succès !');
      await supabase.auth.signOut();
      navigate('/login');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #1A3A5C 0%, #2E75B6 100%)' }}
    >
      <div className="w-full max-w-md">

        {/* En-tête */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-4">
            <Building2 size={32} className="text-white" />
          </div>
          <h1 className="font-heading font-bold text-white text-2xl">OpéraTrack</h1>
          <p className="text-white/60 text-sm mt-1">Ville de Denain — Suivi des opérations</p>
        </div>

        <div className="card p-8">

          {/* Erreur de lien */}
          {tokenError && (
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertCircle size={40} className="text-red-400" />
              <p className="text-text-main font-medium">Lien invalide ou expiré</p>
              <p className="text-text-muted text-sm">{tokenError}</p>
              <button onClick={() => navigate('/login')} className="btn-secondary mt-2">
                Retour à la connexion
              </button>
            </div>
          )}

          {/* Chargement */}
          {!tokenError && !sessionReady && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-text-muted text-sm">Vérification du lien d'invitation…</p>
            </div>
          )}

          {/* Formulaire de création de mot de passe */}
          {!tokenError && sessionReady && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle size={22} className="text-green-500 shrink-0" />
                <h2 className="font-heading font-semibold text-text-main text-lg">
                  Bienvenue sur OpéraTrack !
                </h2>
              </div>
              <p className="text-text-muted text-sm mb-6 ml-7">
                Choisissez un mot de passe pour finaliser la création de votre compte.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="form-label">Nouveau mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      className="form-input pr-10"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="6 caractères minimum"
                      required
                      minLength={6}
                      autoFocus
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

                <div>
                  <label className="form-label">Confirmer le mot de passe</label>
                  <input
                    type="password"
                    className="form-input"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Répéter le mot de passe"
                    required
                    minLength={6}
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full justify-center mt-2"
                  disabled={loading}
                >
                  {loading ? 'Enregistrement…' : 'Définir mon mot de passe'}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
