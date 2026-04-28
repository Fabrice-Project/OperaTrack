import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, CheckCircle, Trash2, X, Save } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../utils/api';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { Skeleton } from '../../../components/ui/Skeleton';
import { formatEur } from '../../../utils/formatters';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtDateShort(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysUntil(d) {
  if (!d) return null;
  return Math.ceil((new Date(d + 'T00:00:00') - new Date()) / 86400000);
}

const STATUT_RESERVE = {
  ouverte:  { label: 'Ouverte',   color: '#C0392B', bg: '#FEE2E2' },
  en_cours: { label: 'En cours',  color: '#E8920A', bg: '#FEF3C7' },
  levee:    { label: 'Levée',     color: '#1E7E45', bg: '#D1FAE5' },
};

const STATUT_DGD = {
  non_etabli: { label: 'Non établi', color: '#6B7280', bg: '#F3F4F6' },
  en_cours:   { label: 'En cours',   color: '#2563EB', bg: '#DBEAFE' },
  signe:      { label: 'Signé',      color: '#1E7E45', bg: '#D1FAE5' },
  solde:      { label: 'Soldé',      color: '#7B3FA0', bg: '#F3E8FA' },
};

function ReceptionBanner({ op, reserves }) {
  const gpaDate = op.date_fin_gpa;
  const daysGpa = daysUntil(gpaDate);
  const reservesOuvertes = reserves.filter(r => r.statut !== 'levee').length;
  const reservesLevees = reserves.filter(r => r.statut === 'levee').length;

  if (!op.date_reception) {
    return (
      <div className="rounded-xl p-4 mb-5 flex items-center gap-3" style={{ backgroundColor: '#F3F4F6' }}>
        <span className="text-2xl">🏗️</span>
        <div>
          <div className="font-semibold text-text-main text-sm">En attente de réception</div>
          <div className="text-xs text-text-muted mt-0.5">Renseignez la date de réception pour activer le suivi GPA et des réserves.</div>
        </div>
      </div>
    );
  }

  let bg = '#D1FAE5', border = '#6EE7B7', emoji = '✅';
  if (daysGpa !== null && daysGpa < 0) { bg = '#FEE2E2'; border = '#FCA5A5'; emoji = '🔴'; }
  else if (reservesOuvertes > 0 || (daysGpa !== null && daysGpa <= 60)) { bg = '#FEF3C7'; border = '#FCD34D'; emoji = '⚠️'; }

  return (
    <div className="rounded-xl p-4 mb-5 border" style={{ backgroundColor: bg, borderColor: border }}>
      <div className="flex items-start gap-3">
        <span className="text-xl">{emoji}</span>
        <div className="flex-1 flex flex-col gap-1">
          <div className="font-semibold text-text-main text-sm">
            Opération réceptionnée le {fmtDate(op.date_reception)}
          </div>
          {gpaDate && (
            <div className="text-sm text-text-main">
              📅 Fin de GPA : <strong>{fmtDate(gpaDate)}</strong>
              {daysGpa !== null && (
                <span className="ml-2 font-medium" style={{ color: daysGpa < 0 ? '#C0392B' : daysGpa <= 60 ? '#E8920A' : '#1E7E45' }}>
                  {daysGpa < 0 ? `— expirée depuis ${Math.abs(daysGpa)} jours` : `— dans ${daysGpa} jours`}
                </span>
              )}
            </div>
          )}
          {op.doe_date_remise && (
            <div className="text-sm text-text-main">📋 DOE remis le {fmtDate(op.doe_date_remise)}</div>
          )}
          {reserves.length > 0 && (
            <div className="text-sm text-text-main">
              📌 Réserves : {reservesLevees} levée{reservesLevees > 1 ? 's' : ''} / {reserves.length}
              {reservesOuvertes > 0 && <span className="ml-1 font-medium" style={{ color: '#C0392B' }}>— {reservesOuvertes} en cours</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReceptionHeader({ op, onSaved, isReadOnly }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ date_reception: op.date_reception || '', doe_date_remise: op.doe_date_remise || '' });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/operations/${op.id}`, {
        date_reception: form.date_reception || null,
        doe_date_remise: form.doe_date_remise || null,
      });
      toast.success('Dates enregistrées');
      onSaved();
      setEditing(false);
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  if (!editing) return (
    <div className="card p-4 mb-4 flex items-center justify-between">
      <div className="flex gap-6 flex-wrap">
        <div>
          <div className="text-xs text-text-muted mb-0.5">Date de réception</div>
          <div className="text-sm font-medium text-text-main">{fmtDateShort(op.date_reception) || '—'}</div>
        </div>
        <div>
          <div className="text-xs text-text-muted mb-0.5">Fin de GPA (auto)</div>
          <div className="text-sm font-medium text-text-main">{fmtDateShort(op.date_fin_gpa) || '—'}</div>
        </div>
        <div>
          <div className="text-xs text-text-muted mb-0.5">DOE remis le</div>
          <div className="text-sm font-medium text-text-main">{fmtDateShort(op.doe_date_remise) || '—'}</div>
        </div>
      </div>
      {!isReadOnly && (
        <button onClick={() => setEditing(true)} className="btn-secondary text-xs flex items-center gap-1.5">
          <Edit2 size={13} /> Modifier
        </button>
      )}
    </div>
  );

  return (
    <div className="card p-4 mb-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <div className="text-xs text-text-muted mb-1">Date de réception</div>
          <input type="date" value={form.date_reception} onChange={e => setForm(f => ({ ...f, date_reception: e.target.value }))} className="input py-1 text-sm w-36" />
        </div>
        <div>
          <div className="text-xs text-text-muted mb-1">DOE remis le</div>
          <input type="date" value={form.doe_date_remise} onChange={e => setForm(f => ({ ...f, doe_date_remise: e.target.value }))} className="input py-1 text-sm w-36" />
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1 px-3">{saving ? '…' : 'Enregistrer'}</button>
          <button onClick={() => setEditing(false)} className="btn-secondary text-xs py-1 px-3">Annuler</button>
        </div>
      </div>
    </div>
  );
}

function ReserveModal({ reserve, operationId, onSaved, onClose }) {
  const isLever = reserve?._lever;
  const [form, setForm] = useState(isLever ? { date_levee: '', commentaire: '' } : {
    description: reserve?.description || '',
    lot_concerne: reserve?.lot_concerne || '',
    responsable: reserve?.responsable || '',
    delai_levee: reserve?.delai_levee || '',
    statut: reserve?.statut || 'ouverte',
    commentaire: reserve?.commentaire || '',
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isLever) {
        await api.put(`/operations/${operationId}/reserves/${reserve.id}/lever`, form);
        toast.success('Réserve levée');
      } else if (reserve?.id) {
        await api.put(`/operations/${operationId}/reserves/${reserve.id}`, form);
        toast.success('Réserve mise à jour');
      } else {
        await api.post(`/operations/${operationId}/reserves`, form);
        toast.success('Réserve ajoutée');
      }
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-heading font-semibold text-text-main">
            {isLever ? '✅ Lever la réserve' : reserve?.id ? 'Modifier la réserve' : '+ Nouvelle réserve'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          {isLever ? (
            <>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Date de levée effective *</label>
                <input type="date" value={form.date_levee} onChange={e => setForm(f => ({ ...f, date_levee: e.target.value }))} className="input w-full" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Commentaire</label>
                <textarea value={form.commentaire} onChange={e => setForm(f => ({ ...f, commentaire: e.target.value }))} className="input w-full resize-none" rows={2} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Description *</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input w-full resize-none" rows={2} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Lot concerné</label>
                  <input type="text" value={form.lot_concerne} onChange={e => setForm(f => ({ ...f, lot_concerne: e.target.value }))} className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Responsable</label>
                  <input type="text" value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} className="input w-full" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Délai de levée</label>
                  <input type="date" value={form.delai_levee} onChange={e => setForm(f => ({ ...f, delai_levee: e.target.value }))} className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Statut</label>
                  <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))} className="input w-full">
                    <option value="ouverte">Ouverte</option>
                    <option value="en_cours">En cours</option>
                    <option value="levee">Levée</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Commentaire</label>
                <textarea value={form.commentaire} onChange={e => setForm(f => ({ ...f, commentaire: e.target.value }))} className="input w-full resize-none" rows={2} />
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? '…' : 'Enregistrer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DGDModal({ marche, onSaved, onClose }) {
  const [form, setForm] = useState({
    marche_id: marche.id,
    montant_ht: marche.dgd?.montant_ht || '',
    date_dgd: marche.dgd?.date_dgd || '',
    statut: marche.dgd?.statut || 'en_cours',
    commentaire: marche.dgd?.commentaire || '',
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/operations/${marche.operation_id}/dgd`, form);
      toast.success('DGD enregistré');
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-heading font-semibold text-text-main text-sm">DGD — {marche.numero}</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Montant HT (€)</label>
              <input type="number" step="0.01" value={form.montant_ht} onChange={e => setForm(f => ({ ...f, montant_ht: e.target.value }))} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Date DGD</label>
              <input type="date" value={form.date_dgd} onChange={e => setForm(f => ({ ...f, date_dgd: e.target.value }))} className="input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Statut</label>
            <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))} className="input w-full">
              <option value="non_etabli">Non établi</option>
              <option value="en_cours">En cours</option>
              <option value="signe">Signé</option>
              <option value="solde">Soldé</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Commentaire</label>
            <textarea value={form.commentaire} onChange={e => setForm(f => ({ ...f, commentaire: e.target.value }))} className="input w-full resize-none" rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? '…' : 'Enregistrer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TabReception({ op, onRefresh }) {
  const { isReadOnly, isAdmin } = useAuth();
  const toast = useToast();
  const operationId = op.id;

  const [reserves, setReserves] = useState([]);
  const [dgds, setDgds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reserveModal, setReserveModal] = useState(null);
  const [dgdModal, setDgdModal] = useState(null);
  const [deleteReserve, setDeleteReserve] = useState(null);
  const [soldering, setSoldering] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, d] = await Promise.all([
        api.get(`/operations/${operationId}/reserves`),
        api.get(`/operations/${operationId}/dgd`),
      ]);
      setReserves(r || []);
      setDgds(d || []);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [operationId]);

  useEffect(() => { load(); }, [load]);

  const handleDeleteReserve = async () => {
    try {
      await api.delete(`/operations/${operationId}/reserves/${deleteReserve}`);
      toast.success('Réserve supprimée');
      load();
    } catch (err) { toast.error(err.message); }
    finally { setDeleteReserve(null); }
  };

  const handleSolder = async () => {
    setSoldering(true);
    try {
      await api.post(`/operations/${operationId}/solder`, {});
      toast.success('Opération soldée');
      onRefresh();
    } catch (err) { toast.error(err.message); }
    finally { setSoldering(false); }
  };

  const reservesLevees = reserves.filter(r => r.statut === 'levee').length;
  const pctReserves = reserves.length > 0 ? Math.round((reservesLevees / reserves.length) * 100) : 0;
  const tousLeves = reserves.length === 0 || reserves.every(r => r.statut === 'levee');
  const tousDGDSoldes = dgds.length === 0 || dgds.every(m => m.dgd?.statut === 'solde');
  const peutSolder = op.date_reception && tousLeves && tousDGDSoldes && op.statut !== 'soldee';

  if (loading) return <div className="flex flex-col gap-3"><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>;

  return (
    <div>
      <ReceptionBanner op={op} reserves={reserves} />
      <ReceptionHeader op={op} onSaved={onRefresh} isReadOnly={isReadOnly} />

      {/* Réserves */}
      <div className="card overflow-hidden mb-4">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h4 className="font-heading font-semibold text-sm text-text-main">Réserves</h4>
            {reserves.length > 0 && (
              <div className="flex items-center gap-2 mt-1">
                <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pctReserves}%`, backgroundColor: pctReserves === 100 ? '#1E7E45' : '#E8920A' }} />
                </div>
                <span className="text-xs text-text-muted">{reservesLevees}/{reserves.length} levée{reservesLevees > 1 ? 's' : ''} ({pctReserves}%)</span>
              </div>
            )}
          </div>
          {!isReadOnly && (
            <button onClick={() => setReserveModal({})} className="btn-primary text-xs flex items-center gap-1.5">
              <Plus size={13} /> Ajouter
            </button>
          )}
        </div>

        {reserves.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm">Aucune réserve enregistrée.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-gray-50">
                  <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide w-10">N°</th>
                  <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Description</th>
                  <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Lot</th>
                  <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Responsable</th>
                  <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide w-28">Délai</th>
                  <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide w-28">Statut</th>
                  <th className="py-2 px-2 w-24" />
                </tr>
              </thead>
              <tbody>
                {reserves.map((r, i) => {
                  const cfg = STATUT_RESERVE[r.statut] || STATUT_RESERVE.ouverte;
                  return (
                    <tr key={r.id} className={`border-b border-border hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                      <td className="py-2.5 px-3 text-sm font-mono text-text-muted">{r.numero}</td>
                      <td className="py-2.5 px-3">
                        <div className="text-sm text-text-main">{r.description}</div>
                        {r.commentaire && <div className="text-xs text-text-muted italic mt-0.5">{r.commentaire}</div>}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-text-muted">{r.lot_concerne || '—'}</td>
                      <td className="py-2.5 px-3 text-xs text-text-muted">{r.responsable || '—'}</td>
                      <td className="py-2.5 px-3 text-xs font-mono text-text-muted">{fmtDateShort(r.delai_levee)}</td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        {!isReadOnly && (
                          <div className="flex gap-1 justify-end">
                            {r.statut !== 'levee' && (
                              <button onClick={() => setReserveModal({ ...r, _lever: true })}
                                className="p-1.5 rounded hover:bg-green-50 text-green-600" title="Lever">
                                <CheckCircle size={13} />
                              </button>
                            )}
                            <button onClick={() => setReserveModal(r)}
                              className="p-1.5 rounded hover:bg-blue-50 text-blue-400" title="Modifier">
                              <Edit2 size={13} />
                            </button>
                            <button onClick={() => setDeleteReserve(r.id)}
                              className="p-1.5 rounded hover:bg-red-50 text-red-400" title="Supprimer">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DGD */}
      {dgds.length > 0 && (
        <div className="card overflow-hidden mb-4">
          <div className="p-4 border-b border-border">
            <h4 className="font-heading font-semibold text-sm text-text-main">Décomptes Généraux et Définitifs (DGD)</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-gray-50">
                  <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Marché</th>
                  <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Titulaire</th>
                  <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide text-right">Montant initial</th>
                  <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide text-right">Montant DGD</th>
                  <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide w-28">Date DGD</th>
                  <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide w-28">Statut</th>
                  <th className="py-2 px-2 w-16" />
                </tr>
              </thead>
              <tbody>
                {dgds.map((m, i) => {
                  const cfg = STATUT_DGD[m.dgd?.statut || 'non_etabli'];
                  return (
                    <tr key={m.id} className={`border-b border-border hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                      <td className="py-2.5 px-3">
                        <div className="text-sm font-medium text-text-main">{m.numero}</div>
                        <div className="text-xs text-text-muted">{m.objet}</div>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-text-muted">{m.titulaire || '—'}</td>
                      <td className="py-2.5 px-3 text-sm font-mono text-text-main text-right">{formatEur(m.montant_ht)}</td>
                      <td className="py-2.5 px-3 text-sm font-mono text-text-main text-right">
                        {m.dgd?.montant_ht ? formatEur(m.dgd.montant_ht) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-xs font-mono text-text-muted">{fmtDateShort(m.dgd?.date_dgd)}</td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        {!isReadOnly && (
                          <button onClick={() => setDgdModal({ ...m, operation_id: operationId })}
                            className="p-1.5 rounded hover:bg-blue-50 text-blue-400" title="Renseigner DGD">
                            <Edit2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Clôture */}
      {peutSolder && isAdmin && (
        <div className="card p-5 border-2 border-dashed" style={{ borderColor: '#1E7E45' }}>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🏁</span>
            <div className="flex-1">
              <div className="font-semibold text-text-main mb-1">Toutes les conditions sont réunies pour solder l'opération.</div>
              <div className="text-xs text-text-muted mb-3">Cette action passera le statut à "Soldée" et verrouillera l'ensemble des données.</div>
              <button onClick={handleSolder} disabled={soldering} className="btn-primary flex items-center gap-1.5">
                {soldering ? 'Soldage…' : '🏁 Solder l\'opération'}
              </button>
            </div>
          </div>
        </div>
      )}

      {reserveModal !== null && (
        <ReserveModal
          reserve={reserveModal}
          operationId={operationId}
          onSaved={() => { load(); setReserveModal(null); }}
          onClose={() => setReserveModal(null)}
        />
      )}
      {dgdModal && (
        <DGDModal
          marche={dgdModal}
          onSaved={() => { load(); setDgdModal(null); }}
          onClose={() => setDgdModal(null)}
        />
      )}
      <ConfirmModal
        open={!!deleteReserve}
        title="Supprimer la réserve"
        message="Supprimer cette réserve définitivement ?"
        onConfirm={handleDeleteReserve}
        onCancel={() => setDeleteReserve(null)}
      />
    </div>
  );
}
