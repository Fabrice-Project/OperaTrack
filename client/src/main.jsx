import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';

// ── Interception du token d'invitation AVANT le rendu React ───────────────────
// React Router peut effacer le hash de l'URL pendant le rendu initial.
// On lit le token ici, en synchrone, avant que React ne touche au DOM.
(function interceptInviteToken() {
  // Flux implicite : #access_token=...&type=invite dans le hash
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const accessToken  = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token') || '';
  const type         = hashParams.get('type');

  // Flux PKCE : ?code=... dans les query params
  const searchParams = new URLSearchParams(window.location.search);
  const code = searchParams.get('code');

  if (accessToken && (type === 'invite' || type === 'recovery')) {
    sessionStorage.setItem('opera_invite', JSON.stringify({
      flow: 'implicit', access_token: accessToken, refresh_token: refreshToken,
    }));
    window.history.replaceState(null, '', '/set-password');
  } else if (code) {
    sessionStorage.setItem('opera_invite', JSON.stringify({
      flow: 'pkce', code,
    }));
    window.history.replaceState(null, '', '/set-password');
  }
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
