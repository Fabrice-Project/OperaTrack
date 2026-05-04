import { useState, useEffect } from 'react';
import { Plus, Trash2, Download, AlertTriangle } from 'lucide-react';
import { useFinances } from '../../../hooks/useFinances';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { Skeleton } from '../../../components/ui/Skeleton';
import { api } from '../../../utils/api';
import { formatEur, formatDate } from '../../../utils/formatters';

export function TabFinances({ operationId }) {
  const { synthese, mouvements, credits, loading, refresh } = useFinances(operationId);
  const { isReadOnly } = useAuth();
  const toast = useToast();
  const [showMvtModal, setShowMvtModal] = useState(false);
  const [showCpModal, setShowCpModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  if (loading) return <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>;
  if (!synthese) return null;

  const { enveloppe_ht: env, montant_engage: eng, montant_mandate: man, reste_a_depenser: rad,
    taux_engagement: tauxEng, taux_mandatement: tauxMan, alerte_depassement: alerteDep, mode_financier } = synthese;

  const handleDeleteMvt = async () => {
    try {
      await api.delete(`/operations/${operationId}/mouvements/${deleteTarget.id}`);
      toast.success('Mouvement supprimé');
      setDeleteTarget(null);
      refresh();
    } catch (err) { toast.error(err.message); }
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('opera_token');
      const res = await fetch(`/api/v1/operations/${operationId}/exports/finances`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) { toast.error('Erreur lors de l\'export'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `suivi-financier-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Alerte dépassement */}
      {alerteDep && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 bg-red-50">
          <AlertTriangle size={18} className="text-danger shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-danger">Dépassement budgétaire détecté</p>
            <p className="text-sm text-danger/80 mt-0.5">
              Le montant engagé ({formatEur(eng)}) excède l'enveloppe autorisée ({formatEur(env)}) de {formatEur(eng - env)} (+{((eng / env - 1) * 100).toFixed(1)}%).
            </p>
          </div>
        </div>
      )}

      {/* Tuiles synthèse */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <FinKpi label="Enveloppe HT" value={formatEur(env)} color="var(--color-primary)" />
        <FinKpi label="Montant engagé" value={formatEur(eng)} sub={`${tauxEng}% de l'enveloppe`} color={alerteDep ? 'var(--color-danger)' : 'var(--color-success)'} alert={alerteDep} />
        <FinKpi label="Montant mandaté" value={formatEur(man)} sub={`${tauxMan}% du montant engagé`} color="var(--color-secondary)" />
        <FinKpi label="Reste à dépenser" value={formatEur(rad)} color={rad < 0 ? 'var(--color-danger)' : 'var(--color-text)'} alert={rad < 0} />
      </div>

      {/* Barres de progression */}
      <div className="card p-5 flex flex-col gap-4">
        <ProgressBar label="Taux d'engagement" pct={tauxEng} />
        <ProgressBar label="Taux de mandatement" pct={tauxMan} />
      </div>

      {/* Crédits de paiement AP/CP */}
      {mode_financier === 'ap_cp' && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h3 className="font-heading font-semibold text-text-main text-sm">Crédits de paiement annuels (AP/CP)</h3>
            {!isReadOnly && (
              <button className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1" onClick={() => setShowCpModal(true)}>
                <Plus size={13} /> Ajouter une année
              </button>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['Année', 'CP prévu', 'CP mandaté', 'Écart', 'Statut'].map(h => (
                  <th key={h} className="table-header text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {credits.map((cp, i) => {
                const ecart = cp.montant_mandate - cp.montant_prevu;
                return (
                  <tr key={cp.id} className={`${i % 2 === 0 ? 'table-row-even' : 'table-row-odd'}`}>
                    <td className="table-cell font-semibold">{cp.annee}</td>
                    <td className="table-cell font-mono">{formatEur(cp.montant_prevu)}</td>
                    <td className="table-cell font-mono">{formatEur(cp.montant_mandate)}</td>
                    <td className={`table-cell font-mono ${ecart < 0 ? 'text-danger' : 'text-success'}`}>{ecart >= 0 ? '+' : ''}{formatEur(ecart)}</td>
                    <td className="table-cell">
                      {cp.montant_mandate >= cp.montant_prevu ? '✅' : cp.montant_mandate > 0 ? '🟡' : '⬜'}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-gray-50 font-semibold">
                <td className="table-cell">Total</td>
                <td className="table-cell font-mono">{formatEur(credits.reduce((s, c) => s + parseFloat(c.montant_prevu || 0), 0))}</td>
                <td className="table-cell font-mono">{formatEur(credits.reduce((s, c) => s + parseFloat(c.montant_mandate || 0), 0))}</td>
                <td className="table-cell" colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Mouvements financiers */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="font-heading font-semibold text-text-main text-sm">
            Historique des mouvements ({mouvements.length})
          </h3>
          <div className="flex gap-2">
            <button className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1" onClick={handleExport}>
              <Download size={13} /> Exporter Excel
            </button>
            {!isReadOnly && (
              <button className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1" onClick={() => setShowMvtModal(true)}>
                <Plus size={13} /> Ajouter un mouvement
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['Date', 'Type', 'Marché', 'Libellé', 'Référence', 'Montant', ''].map(h => (
                  <th key={h} className="table-header text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mouvements.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-text-muted">Aucun mouvement enregistré.</td></tr>
              ) : mouvements.map((m, i) => (
                <tr key={m.id} className={`${i % 2 === 0 ? 'table-row-even' : 'table-row-odd'}`}>
                  <td className="table-cell font-mono text-xs">{formatDate(m.date_mouvement)}</td>
                  <td className="table-cell">
                    <span className="badge" style={m.type === 'engagement'
                      ? { backgroundColor: '#DBEAFE', color: '#1D4ED8' }
                      : { backgroundColor: '#D1FAE5', color: '#065F46' }}>
                      {m.type === 'engagement' ? 'Engagement' : 'Mandatement'}
                    </span>
                  </td>
                  <td className="table-cell text-xs">
                    {m.marches ? (
                      <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 font-mono text-xs text-text-main" title={m.marches.intitule}>
                        {m.marches.numero || m.marches.intitule}
                      </span>
                    ) : <span className="text-text-muted">—</span>}
                  </td>
                  <td className="table-cell max-w-xs truncate">{m.libelle}</td>
                  <td className="table-cell text-text-muted font-mono text-xs">{m.reference || '—'}</td>
                  <td className="table-cell font-mono font-semibold text-right">{formatEur(m.montant)}</td>
                  <td className="table-cell text-right">
                    {!isReadOnly && (
                      <button onClick={() => setDeleteTarget(m)} className="p-1 rounded hover:bg-red-50 text-text-muted hover:text-danger transition-colors">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showMvtModal && <MouvementModal operationId={operationId} onClose={() => setShowMvtModal(false)} onSaved={refresh} />}
      {showCpModal && <CreditPaiementModal operationId={operationId} onClose={() => setShowCpModal(false)} onSaved={refresh} />}
      <ConfirmModal
        open={!!deleteTarget}
        title="Supprimer ce mouvement"
        message={`Supprimer le mouvement "${deleteTarget?.libelle}" (${formatEur(deleteTarget?.montant)}) ?`}
        onConfirm={handleDeleteMvt}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function ProgressBar({ label, pct }) {
  const color = pct > 100 ? '#C0392B' : pct > 90 ? '#E8920A' : '#1E7E45';
  return (
    <div>
      <div className="flex justify-between text-xs text-text-muted mb-1.5">
        <span className="font-medium">{label}</span>
        <span className="font-mono font-semibold" style={{ color }}>{pct}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-3">
        <div className="h-3 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function FinKpi({ label, value, sub, color, alert }) {
  return (
    <div className={`card p-4 ${alert ? 'border border-red-200' : ''}`}>
      <div className="text-xs text-text-muted mb-1">{label}</div>
      <div className="font-mono font-bold text-lg leading-tight" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function MouvementModal({ operationId, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    type: 'engagement', libelle: '', montant: '',
    date_mouvement: new Date().toISOString().split('T')[0],
    reference: '', commentaire: '', marche_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [marches, setMarches] = useState([]);
  const [loadingMarches, setLoadingMarches] = useState(true);

  // Charger les marchés de l'opération
  useEffect(() => {
    api.get(`/operations/${operationId}/marches`)
      .then(data => setMarches(data || []))
      .catch(() => {})
      .finally(() => setLoadingMarches(false));
  }, [operationId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.marche_id) { toast.error('Veuillez sélectionner un marché'); return; }
    setSaving(true);
    try {
      await api.post(`/operations/${operationId}/mouvements`, form);
      toast.success('Mouvement ajouté avec succès');
      onSaved();
      onClose();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="card p-6 w-full max-w-lg">
        <h3 className="font-heading font-semibold text-text-main text-base mb-4">Ajouter un mouvement financier</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">

          {/* Marché — obligatoire */}
          <div>
            <label className="form-label">Marché *</label>
            {loadingMarches ? (
              <div className="form-input text-text-muted text-sm">Chargement…</div>
            ) : marches.length === 0 ? (
              <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Aucun marché enregistré sur cette opération. Créez d'abord un marché dans l'onglet Marchés.
              </div>
            ) : (
              <select
                className="form-select"
                value={form.marche_id}
                onChange={e => setForm(p => ({ ...p, marche_id: e.target.value }))}
                required
              >
                <option value="">— Sélectionner un marché —</option>
                {marches.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.numero ? `${m.numero} — ` : ''}{m.intitule}{m.titulaire_nom ? ` (${m.titulaire_nom})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Type *</label>
              <select className="form-select" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                <option value="engagement">Engagement</option>
                <option value="mandatement">Mandatement</option>
              </select>
            </div>
            <div>
              <label className="form-label">Date *</label>
              <input type="date" className="form-input" value={form.date_mouvement} onChange={e => setForm(p => ({ ...p, date_mouvement: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className="form-label">Libellé *</label>
            <input className="form-input" value={form.libelle} onChange={e => setForm(p => ({ ...p, libelle: e.target.value }))} required placeholder="Ex. : Acompte 30% travaux" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Montant HT (€) *</label>
              <input type="number" className="form-input font-mono" value={form.montant} onChange={e => setForm(p => ({ ...p, montant: e.target.value }))} required min="0" step="0.01" />
            </div>
            <div>
              <label className="form-label">Référence</label>
              <input className="form-input font-mono" value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} placeholder="FAC-2025-001" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={saving || marches.length === 0}>
              {saving ? 'Enregistrement…' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreditPaiementModal({ operationId, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ annee: new Date().getFullYear(), montant_prevu: '', montant_mandate: '0' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/operations/${operationId}/credits-paiement`, form);
      toast.success('Crédit de paiement enregistré');
      onSaved();
      onClose();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="card p-6 w-full max-w-md">
        <h3 className="font-heading font-semibold text-text-main text-base mb-4">Ajouter un crédit de paiement</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="form-label">Année *</label>
            <input type="number" className="form-input" value={form.annee} onChange={e => setForm(p => ({ ...p, annee: e.target.value }))} min="2000" max="2100" required />
          </div>
          <div>
            <label className="form-label">CP prévu (€) *</label>
            <input type="number" className="form-input font-mono" value={form.montant_prevu} onChange={e => setForm(p => ({ ...p, montant_prevu: e.target.value }))} min="0" step="0.01" required />
          </div>
          <div>
            <label className="form-label">CP mandaté (€)</label>
            <input type="number" className="form-input font-mono" value={form.montant_mandate} onChange={e => setForm(p => ({ ...p, montant_mandate: e.target.value }))} min="0" step="0.01" />
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Ajouter'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
