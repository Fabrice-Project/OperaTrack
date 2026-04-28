import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';

export function useFinances(operationId) {
  const [synthese, setSynthese] = useState(null);
  const [mouvements, setMouvements] = useState([]);
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetch = useCallback(async () => {
    if (!operationId) return;
    setLoading(true);
    try {
      const [syn, mvt, cp] = await Promise.all([
        api.get(`/operations/${operationId}/finances`),
        api.get(`/operations/${operationId}/mouvements`),
        api.get(`/operations/${operationId}/credits-paiement`)
      ]);
      setSynthese(syn);
      setMouvements(mvt);
      setCredits(cp);
    } catch (err) {
      toast.error('Erreur chargement finances : ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [operationId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { synthese, mouvements, credits, loading, refresh: fetch };
}

export function useMarches(operationId) {
  const [marches, setMarches] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetch = useCallback(async () => {
    if (!operationId) return;
    setLoading(true);
    try {
      const data = await api.get(`/operations/${operationId}/marches`);
      setMarches(data);
    } catch (err) {
      toast.error('Erreur chargement marchés : ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [operationId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { marches, loading, refresh: fetch };
}
