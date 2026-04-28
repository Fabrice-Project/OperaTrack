import { useState, useEffect } from 'react';
import { api } from '../utils/api';

// Valeurs par défaut utilisées avant le chargement et en cas d'erreur
export const CONFIG_DEFAULTS = {
  collectivite:   'Ville de Denain',
  libelle_mandat: 'Mandat 2020-2026',
};

export function useConfig() {
  const [config, setConfig] = useState(CONFIG_DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/settings/config')
      .then(data => setConfig({ ...CONFIG_DEFAULTS, ...data }))
      .catch(() => {/* garde les valeurs par défaut */})
      .finally(() => setLoading(false));
  }, []);

  return { config, loading };
}
