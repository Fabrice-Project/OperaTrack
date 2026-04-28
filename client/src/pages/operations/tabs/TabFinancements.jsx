import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { Skeleton } from '../../../components/ui/Skeleton';
import { api } from '../../../utils/api';
import { formatEur, formatDate } from '../../../utils/formatters';

const FINANCEURS = [
  { value: 'etat',        label: 'État',         color: '#1E7E45', bg: '#E8F5EE' },
  { value: 'region',      label: 'Région',       color: '#C0392B', bg: '#FEE8E7' },
  { value: 'departement', label: 'Département',  color: '#7B3FA0', bg: '#F3E8FA' },
  { value: 'caph',        label: 'CAPH',         color: '#E8920A', bg: '#FEF3E2' },
  { value: 'autre',       label: 'Autre',        color: '#6B7A8D', bg: '#F0F2F5' },
];

const FINANCEUR_MAP = Object.fromEntries(FINANCEURS.map(f => [f.value, f]));

function useFinancements(operationId) {
  const [financements, setFinancements] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetch = useCallback(async () => {
    if (!operationId) return;
    setLoading(true);
    try {
      const data = await api.get(`/operations/${operationId}/financements`);
      setFinancements(data);
    } catch (err) {
      toast.error('Erreur chargement financements : ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [operationId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { financements, loading, refresh: fetch };
}

export function TabFinancements({ operationId, enveloppe }) {
  const { financements, loading, refresh } = useFinancements(operationId);
  const { isReadOnly } = useAuth();
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  if (loading) return <div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>;

  const totalAttribue = financements.reduce((s, f) => s + parseFloat(f.montant_attribue || 0), 0);
  const totalVerse    = financements.reduce((s, f) => s + parseFloat(f.montant_verse || 0), 0);
  const resteACharge  = (enveloppe || 0) - totalAttribue;
  const couverture    = enveloppe > 0 ? Math.min(100, Math.round((totalAttribue / enveloppe) * 100)) : 0;

  const handleDelete = async () => {
    try {
      await api.delete(`/operations/${operationId}/financements/${deleteTarget.id}`);
      toast.success('Financement supprimé');
      setDeleteTarget(null);
      refresh();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <FinKpi label="Enveloppe HT" value={formatEur(enveloppe)} color="var(--color-primary)" />
        <FinKpi label="Total financements" value={formatEur(totalAttribue)} color="var(--color-secondary)"
          sub={`${couverture}% de l'enveloppe`} />
        <FinKpi label="Total versé" value={formatEur(totalVerse)} color="var(--color-success)" />
        <FinKpi label="Reste à charge" value={formatEur(resteACharge)}
          color={resteACharge < 0 ? 'var(--color-danger)' : resteACharge === 0 ? 'var(--color-success)' : 'var(--color-text)'}
          alert={resteACharge < 0} />
      </div>

      {/* Barre de couverture */}
      <div className="card p-5">
        <div className="flex justify-between text-xs text-text-muted mb-1.5">
          <span className="font-medium">Couverture du plan de financement</span>
          <span className="font-mono font-semibold" style={{ color: couverture >= 100 ? 'var(--color-success)' : couverture >= 80 ? 'var(--color-accent)' : 'var(--color-danger)' }}>{couverture}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div className="h-3 rounded-full transition-all duration-500"
            style={{ width: `${couverture}%`, backgroundColor: couverture >= 100 ? '#1E7E45' : couverture >= 80 ? '#E8920A' : '#C0392B' }} />
        </div>
        {resteACharge > 0 && (
          <p className="text-xs text-text-muted mt-2">Reste à financer : <span className="font-mono font-semibold text-danger">{formatEur(resteACharge)}</span></p>
        )}
        {resteACharge === 0 && enveloppe > 0 && (
          <p className="text-xs text-success mt-2 font-medium">✅ Plan de financement équilibré</p>
        )}
      </div>

      {/* Tableau des financements */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="font-heading font-semibold text-text-main text-sm">
            Plan de financement ({financements.length} financeur{financements.length !== 1 ? 's' : ''})
          </h3>
          {!isReadOnly && (
            <button className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1" onClick={() => { setEditTarget(null); setShowModal(true); }}>
              <Plus size={13} /> Ajouter
            </button>
          )}
        </div>

        {financements.length === 0 ? (
          <div className="py-12 text-center text-text-muted text-sm">Aucun financement enregistré.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['Financeur', 'N° convention', 'Date convention', 'Montant attribué', 'Montant versé', 'Écart', ''].map(h => (
                  <th key={h} className="table-header text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {financements.map((f, i) => {
                const cfg = FINANCEUR_MAP[f.financeur] || FINANCEUR_MAP.autre;
                const ecart = parseFloat(f.montant_verse || 0) - parseFloat(f.montant_attribue || 0);
                return (
                  <tr key={f.id} className={i % 2 === 0 ? 'table-row-even' : 'table-row-odd'}>
                    <td className="table-cell">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                        {f.libelle || cfg.label}
                      </span>
                    </td>
                    <td className="table-cell font-mono text-xs text-text-muted">{f.numero_convention || '—'}</td>
                    <td className="table-cell font-mono text-xs">{formatDate(f.date_convention) || '—'}</td>
                    <td className="table-cell font-mono font-semibold">{formatEur(f.montant_attribue)}</td>
                    <td className="table-cell font-mono">{formatEur(f.montant_verse)}</td>
                    <td className={`table-cell font-mono text-xs ${ecart < 0 ? 'text-danger' : ecart > 0 ? 'text-success' : 'text-text-muted'}`}>
                      {ecart >= 0 ? '+' : ''}{formatEur(ecart)}
                    </td>
                    <td className="table-cell text-right">
                      {!isReadOnly && (
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => { setEditTarget(f); setShowModal(true); }}
                            className="p-1 rounded hover:bg-blue-50 text-text-muted hover:text-secondary transition-colors">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => setDeleteTarget(f)}
                            className="p-1 rounded hover:bg-red-50 text-text-muted hover:text-danger transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {/* Ligne total */}
              <tr className="bg-gray-50 font-semibold">
                <td className="table-cell" colSpan={3}>Total</td>
                <td className="table-cell font-mono">{formatEur(totalAttribue)}</td>
                <td className="table-cell font-mono">{formatEur(totalVerse)}</td>
                <td className="table-cell" colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <FinancementModal
          operationId={operationId}
          existing={editTarget}
          onClose={() => setShowModal(false)}
          onSaved={refresh}
        />
      )}
      <ConfirmModal
        open={!!deleteTarget}
        title="Supprimer ce financement"
        message={`Supprimer le financement "${deleteTarget?.libelle || FINANCEUR_MAP[deleteTarget?.financeur]?.label}" (${formatEur(deleteTarget?.montant_attribue)}) ?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
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

function FinancementModal({ operationId, existing, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    financeur: existing?.financeur || 'anru',
    libelle: existing?.libelle || '',
    montant_attribue: existing?.montant_attribue || '',
    montant_verse: existing?.montant_verse || '0',
    date_convention: existing?.date_convention || '',
    numero_convention: existing?.numero_convention || '',
    observations: existing?.observations || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (existing) {
        await api.put(`/operations/${operationId}/financements/${existing.id}`, form);
        toast.success('Financement modifié');
      } else {
        await api.post(`/operations/${operationId}/financements`, form);
        toast.success('Financement ajouté');
      }
      onSaved();
      onClose();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="card p-6 w-full max-w-lg">
        <h3 className="font-heading font-semibold text-text-main text-base mb-4">
          {existing ? 'Modifier le financement' : 'Ajouter un financement'}
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Financeur *</label>
              <select className="form-select" value={form.financeur}
                onChange={e => setForm(p => ({ ...p, financeur: e.target.value }))} disabled={!!existing}>
                {FINANCEURS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            {form.financeur === 'autre' && (
              <div>
                <label className="form-label">Libellé *</label>
                <input className="form-input" value={form.libelle}
                  onChange={e => setForm(p => ({ ...p, libelle: e.target.value }))}
                  placeholder="Ex : Fondation du Bâtiment" required />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Montant attribué HT (€) *</label>
              <input type="number" className="form-input font-mono" value={form.montant_attribue}
                onChange={e => setForm(p => ({ ...p, montant_attribue: e.target.value }))}
                min="0" step="0.01" required />
            </div>
            <div>
              <label className="form-label">Montant versé HT (€)</label>
              <input type="number" className="form-input font-mono" value={form.montant_verse}
                onChange={e => setForm(p => ({ ...p, montant_verse: e.target.value }))}
                min="0" step="0.01" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">N° de convention</label>
              <input className="form-input font-mono" value={form.numero_convention}
                onChange={e => setForm(p => ({ ...p, numero_convention: e.target.value }))}
                placeholder="ANRU-2023-001" />
            </div>
            <div>
              <label className="form-label">Date de convention</label>
              <input type="date" className="form-input" value={form.date_convention}
                onChange={e => setForm(p => ({ ...p, date_convention: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="form-label">Observations</label>
            <textarea className="form-input" rows={2} value={form.observations}
              onChange={e => setForm(p => ({ ...p, observations: e.target.value }))}
              placeholder="Conditions particulières, tranches de versement…" />
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : existing ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
