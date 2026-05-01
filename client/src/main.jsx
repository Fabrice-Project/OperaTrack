import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';

// ── Interception du token d'invitation AVANT le rendu React ───────────────────
// Lit tous les formats possibles de Supabase (implicit, PKCE, token_hash, query)
// et redirige vers /set-password si un token d'invite/recovery est détecté.
(function interceptInviteToken() {
  const hash   = window.location.hash.substring(1);
  const hParams = new URLSearchParams(hash);

  const qParams    = new URLSearchParams(window.location.search);
  const code       = qParams.get('code');
  const tokenHash  = qParams.get('token_hash');
  const qType      = qParams.get('type');
  const qToken     = qParams.get('access_token');

  // Flux implicite — hash
  const hToken   = hParams.get('access_token');
  const hRefresh = hParams.get('refresh_token') || '';
  const hType    = hParams.get('type');

  const INVITE_TYPES = ['invite', 'recovery', 'signup', 'email', 'magiclink'];

  if (hToken && INVITE_TYPES.includes(hType)) {
    sessionStorage.setItem('opera_invite', JSON.stringify({
      flow: 'implicit', access_token: hToken, refresh_token: hRefresh,
    }));
    window.history.replaceState(null, '', '/set-password');

  } else if (qToken && INVITE_TYPES.includes(qType)) {
    // Flux implicite — query string
    sessionStorage.setItem('opera_invite', JSON.stringify({
      flow: 'implicit', access_token: qToken,
      refresh_token: qParams.get('refresh_token') || '',
    }));
    window.history.replaceState(null, '', '/set-password');

  } else if (tokenHash && INVITE_TYPES.includes(qType)) {
    // Flux email OTP / token_hash
    sessionStorage.setItem('opera_invite', JSON.stringify({
      flow: 'token_hash', token_hash: tokenHash, type: qType,
    }));
    window.history.replaceState(null, '', '/set-password');

  } else if (code) {
    // Flux PKCE — code d'autorisation
    sessionStorage.setItem('opera_invite', JSON.stringify({ flow: 'pkce', code }));
    window.history.replaceState(null, '', '/set-password');
  }
  // Si aucun token détecté : InviteSessionGuard dans App.jsx prend le relais
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
