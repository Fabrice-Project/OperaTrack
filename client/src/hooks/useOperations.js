import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';

export function useOperations() {
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast();

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/operations');
      setOperations(data);
    } catch (err) {
      setError(err.message);
      toast.error('Erreur lors du chargement des opérations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { operations, loading, error, refresh: fetch };
}

export function useOperation(id) {
  const [operation, setOperation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/operations/${id}`);
      setOperation(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);

  return { operation, loading, error, refresh: fetch };
}

export function useKPIs() {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/operations/kpis')
      .then(setKpis)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { kpis, loading };
}
