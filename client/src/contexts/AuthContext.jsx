import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import { supabase } from '../utils/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token  = localStorage.getItem('opera_token');
    const stored = localStorage.getItem('opera_user');
    if (token && stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        // Vérifier le profil courant côté serveur (peut avoir changé depuis la dernière connexion)
        api.get('/auth/me').then(fresh => {
          const changed =
            fresh?.role                    !== parsed.role ||
            fresh?.habilitation_patrimoniale !== parsed.habilitation_patrimoniale;
          if (changed || fresh?.full_name !== parsed.full_name) {
            const updated = {
              ...parsed,
              role:                     fresh.role,
              habilitation_patrimoniale: fresh.habilitation_patrimoniale,
              full_name:                fresh.full_name || parsed.full_name,
            };
            localStorage.setItem('opera_user', JSON.stringify(updated));
            setUser(updated);
          }
        }).catch(() => {/* ignore — token expired géré par l'intercepteur */});
      } catch {}
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    localStorage.setItem('opera_token', data.access_token);
    localStorage.setItem('opera_user', JSON.stringify(data.user));
    setUser(data.user);
    // Effacer toute session Supabase résiduelle (ex: lien d'invitation non complété)
    supabase.auth.signOut().catch(() => {});
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout', {}); } catch {}
    localStorage.removeItem('opera_token');
    localStorage.removeItem('opera_user');
    setUser(null);
  }, []);

  // ── Helpers rôles ─────────────────────────────────────────────────────────
  const r = user?.role || 'directeur';

  const isAdmin         = r === 'admin'        || r === 'administrateur';
  const isChargeOp      = r === 'write'        || r === 'charge_operation';
  const isGestPatrim    = r === 'gestionnaire_patrimonial';
  const isDirecteur     = r === 'read'         || r === 'directeur';
  const isAdministratif = r === 'compta'       || r === 'administratif';

  const habilitationPatrimoniale = user?.habilitation_patrimoniale === true;

  // ── Permissions dérivées ──────────────────────────────────────────────────

  // Lecture seule (toutes actions d'écriture bloquées)
  const isReadOnly = isDirecteur;

  // Écriture fiches référentielles patrimoine (tronçons, bâtiments, équipements…)
  const canEditPatrimoineReferentiel =
    isAdmin || isGestPatrim || (isChargeOp && habilitationPatrimoniale);

  // Écriture coûts / factures / relevés patrimoine
  const canEditPatrimoineCouts =
    canEditPatrimoineReferentiel || isAdministratif;

  // Accès Module A en lecture (tous)
  const canReadModuleA = true;

  // Écriture Module A — opérations de construction
  const canWriteModuleA = isAdmin || isChargeOp;

  // Accès Module A en lecture/écriture (nav, formulaires)
  const canAccessModuleA = isAdmin || isChargeOp || isDirecteur || isAdministratif;

  // Gestion de la configuration (paramètres admin)
  const canManageConfig = isAdmin;

  return (
    <AuthContext.Provider value={{
      user, loading, login, logout,
      // Profils
      isAdmin,
      isChargeOp,
      isGestPatrim,
      isDirecteur,
      isAdministratif,
      habilitationPatrimoniale,
      // Permissions
      isReadOnly,
      canEditPatrimoineReferentiel,
      canEditPatrimoineCouts,
      canReadModuleA,
      canWriteModuleA,
      canAccessModuleA,
      canManageConfig,
      // Rétrocompatibilité anciens noms
      isCompta: isAdministratif,
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
