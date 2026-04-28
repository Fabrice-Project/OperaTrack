import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('opera_token');
    const stored = localStorage.getItem('opera_user');
    if (token && stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        // Vérifier le rôle courant côté serveur (peut avoir changé depuis la dernière connexion)
        api.get('/auth/me').then(fresh => {
          if (fresh?.role && fresh.role !== parsed.role) {
            const updated = { ...parsed, role: fresh.role, full_name: fresh.full_name || parsed.full_name };
            localStorage.setItem('opera_user', JSON.stringify(updated));
            setUser(updated);
          }
        }).catch(() => {/* ignore — token expired sera géré par l'intercepteur */});
      } catch {}
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    localStorage.setItem('opera_token', data.access_token);
    localStorage.setItem('opera_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout', {}); } catch {}
    localStorage.removeItem('opera_token');
    localStorage.removeItem('opera_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, loading, login, logout,
      isAdmin:         user?.role === 'admin',
      isCompta:        user?.role === 'compta',
      canManageConfig: user?.role === 'admin' || user?.role === 'read' || user?.role === 'direction',
      isReadOnly:      false,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
