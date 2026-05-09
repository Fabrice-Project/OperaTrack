import { useState, useEffect, useCallback } from 'react';
import { Plus, Upload, Trash2, Edit2, X, Save, TrendingDown, TrendingUp, Zap, Flame, Droplets, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { api } from '../../../utils/api';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';

// ── Constantes ────────────────────────────────────────────────────────────────
const FLUIDES = [
  { id: 'electricite',   label: 'Électricité',       icon: '⚡', unite_def: 'kWh',    color: '#F59E0B' },
  { id: 'gaz',           label: 'Gaz',                icon: '🔥', unite_def: 'm3',     color: '#3B82F6' },
  { id: 'eau',           label: 'Eau',                icon: '💧', unite_def: 'm3',     color: '#06B6D4' },
  { id: 'fioul',         label: 'Fioul',              icon: '🛢️', unite_def: 'litres', color: '#8B5CF6' },
  { id: 'chaleur_urbain',label: 'Chaleur urbaine',    icon: '🌡️', unite_def: 'kWh',   color: '#EF4444' },
];

const MOIS_LABELS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

function fmtNum(v, unit = '') {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toLocaleString('fr-FR')}${unit ? ' ' + unit : ''}`;
}
function fmtEur(v) {
  if (v == null || isNaN(v)) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}
function fmtDate(d) {
  if (!d) return '—';
  const [y, m] = d.split('-');
  return `${MOIS_LABELS[parseInt(m) - 1]} ${y}`;
}
function periodeLabel(d) {
  if (!d) return '—';
  const [y, m] = d.split('-');
  return `${MOIS_LABELS[parseInt(m) - 1].substring(0, 3)} ${y}`;
}

// ── Modale ajout/édition relevé ───────────────────────────────────────────────
function ReleveModal({ compteur, releve, onClose, onSaved }) {
  const toast = useToast();
  const [mode, setMode]   = useState('direct'); // 'direct' | 'index'
  const [form, setForm]   = useState({
    periode:        releve?.periode?.substring(0, 7) || new Date().toISOString().substring(0, 7),
    index_debut:    releve?.index_debut  ?? '',
    index_fin:      releve?.index_fin    ?? '',
    consommation:   releve?.consommation ?? '',
    montant_ht:     releve?.montant_ht   ?? '',
    numero_facture: releve?.numero_facture || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Calcul auto si mode index
  useEffect(() => {
    if (mode === 'index' && form.index_debut !== '' && form.index_fin !== '') {
      const diff = parseFloat(form.index_fin) - parseFloat(form.index_debut);
      if (!isNaN(diff) && diff >= 0) set('consommation', diff.toFixed(2));
    }
  }, [mode, form.index_debut, form.index_fin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        periode:        form.periode,
        consommation:   parseFloat(form.consommation),
        montant_ht:     form.montant_ht !== '' ? parseFloat(form.montant_ht) : null,
        numero_facture: form.numero_facture || null,
        index_debut:    mode === 'index' && form.index_debut !== '' ? parseFloat(form.index_debut) : null,
        index_fin:      mode === 'index' && form.index_fin   !== '' ? parseFloat(form.index_fin)   : null,
      };
      if (releve) {
        await api.put(`/patrimoine/releves/${releve.id}`, body);
        toast.success('Relevé mis à jour');
      } else {
        await api.post(`/patrimoine/compteurs/${compteur.id}/releves`, body);
        toast.success('Relevé ajouté');
      }
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-heading font-semibold text-text-main">
            {releve ? 'Modifier le relevé' : 'Ajouter un relevé'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Période (mois) *</label>
            <input type="month" value={form.periode} onChange={e => set('periode', e.target.value)}
              className="input w-full" required />
          </div>

          {/* Mode saisie */}
          <div className="flex gap-2">
            <button type="button"
              onClick={() => setMode('direct')}
              className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${mode === 'direct' ? 'bg-primary text-white border-primary' : 'border-border text-text-muted hover:bg-gray-50'}`}>
              Consommation directe
            </button>
            <button type="button"
              onClick={() => setMode('index')}
              className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${mode === 'index' ? 'bg-primary text-white border-primary' : 'border-border text-text-muted hover:bg-gray-50'}`}>
              Index compteur
            </button>
          </div>

          {mode === 'index' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Index début</label>
                <input type="number" step="0.01" value={form.index_debut} onChange={e => set('index_debut', e.target.value)}
                  className="input w-full" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Index fin</label>
                <input type="number" step="0.01" value={form.index_fin} onChange={e => set('index_fin', e.target.value)}
                  className="input w-full" placeholder="0.00" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Consommation ({compteur.unite}) *
            </label>
            <input type="number" step="0.01" value={form.consommation} onChange={e => set('consommation', e.target.value)}
              className="input w-full" required placeholder="0.00"
              readOnly={mode === 'index' && form.index_debut !== '' && form.index_fin !== ''} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Montant HT (€)</label>
              <input type="number" step="0.01" value={form.montant_ht} onChange={e => set('montant_ht', e.target.value)}
                className="input w-full" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">N° facture</label>
              <input type="text" value={form.numero_facture} onChange={e => set('numero_facture', e.target.value)}
                className="input w-full" placeholder="FAC-2024-001" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary text-sm">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm flex items-center gap-1.5">
              <Save size={14} />{saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modale import CSV ─────────────────────────────────────────────────────────
function ImportCSVModal({ compteur, onClose, onSaved }) {
  const toast = useToast();
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState([]);
  const [errors, setErrors]   = useState([]);
  const [importing, setImporting] = useState(false);

  const FORMAT_EXAMPLE = `periode;consommation;montant_ht;numero_facture
2024-01;14200;2272;FAC-2024-001
2024-02;13100;2096;FAC-2024-002`;

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) { setPreview([]); setErrors(['Fichier vide ou entête manquant']); return; }
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());
    const rows = [];
    const errs = [];
    lines.slice(1).forEach((line, i) => {
      if (!line.trim()) return;
      const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
      const row = {};
      headers.forEach((h, j) => { row[h] = vals[j] || ''; });
      if (!/^\d{4}-\d{2}$/.test(row.periode || '')) errs.push(`Ligne ${i + 2} : période invalide (format AAAA-MM)`);
      if (isNaN(parseFloat(row.consommation))) errs.push(`Ligne ${i + 2} : consommation non numérique`);
      rows.push(row);
    });
    setPreview(rows);
    setErrors(errs);
  };

  const handleImport = async () => {
    if (errors.length > 0) return;
    setImporting(true);
    try {
      const result = await api.post(`/patrimoine/compteurs/${compteur.id}/import-csv`, { rows: preview });
      toast.success(`${result.imported} relevé(s) importé(s)`);
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setImporting(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <h3 className="font-heading font-semibold text-text-main">Importer un CSV</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
            <div className="font-semibold mb-1">Format attendu (séparateur ; ou ,) :</div>
            <pre className="font-mono whitespace-pre-wrap">{FORMAT_EXAMPLE}</pre>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Coller le contenu CSV</label>
            <textarea
              className="input w-full font-mono text-xs"
              rows={8}
              value={csvText}
              onChange={e => { setCsvText(e.target.value); parseCSV(e.target.value); }}
              placeholder={FORMAT_EXAMPLE}
            />
          </div>
          {errors.length > 0 && (
            <div className="bg-red-50 rounded-lg p-3">
              {errors.map((e, i) => <p key={i} className="text-xs text-red-700">{e}</p>)}
            </div>
          )}
          {preview.length > 0 && errors.length === 0 && (
            <div className="bg-green-50 rounded-lg p-2 text-xs text-green-700 font-medium">
              ✓ {preview.length} ligne(s) valide(s) prête(s) à l'import
            </div>
          )}
        </div>
        <div className="shrink-0 p-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm">Annuler</button>
          <button
            onClick={handleImport}
            disabled={importing || preview.length === 0 || errors.length > 0}
            className="btn-primary text-sm flex items-center gap-1.5">
            <Upload size={14} />{importing ? 'Import…' : `Importer ${preview.length} ligne(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Onglet par fluide ─────────────────────────────────────────────────────────
function OngletFluide({ compteur, batimentId, isReadOnly, anneeN }) {
  const toast = useToast();
  const [releves, setReleves]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [showCSV, setShowCSV]       = useState(false);
  const [editReleve, setEditReleve] = useState(null);
  const [delConfirm, setDelConfirm] = useState(null);

  const fluide = FLUIDES.find(f => f.id === compteur.fluide) || {};

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/patrimoine/compteurs/${compteur.id}/releves`);
      setReleves(data);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [compteur.id]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/patrimoine/releves/${id}`);
      toast.success('Relevé supprimé');
      setDelConfirm(null);
      load();
    } catch (err) { toast.error(err.message); }
  };

  // Données graphique — 24 mois glissants
  const chartData = (() => {
    const now = new Date();
    const months = [];
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ key, label: periodeLabel(key + '-01') });
    }
    const map = {};
    releves.forEach(r => { map[r.periode.substring(0, 7)] = r; });
    return months.map(m => ({
      mois: m.label,
      N: map[m.key]?.consommation ?? null,
      N1: map[`${parseInt(m.key.split('-')[0]) - 1}-${m.key.split('-')[1]}`]?.consommation ?? null,
    }));
  })();

  // KPIs annuels
  const anneeReleves = releves.filter(r => r.periode.startsWith(String(anneeN)));
  const totalConsoN  = anneeReleves.reduce((s, r) => s + parseFloat(r.consommation), 0);
  const totalMontant = anneeReleves.reduce((s, r) => s + (parseFloat(r.montant_ht) || 0), 0);
  const anneeN1Releves = releves.filter(r => r.periode.startsWith(String(anneeN - 1)));
  const totalConsoN1 = anneeN1Releves.reduce((s, r) => s + parseFloat(r.consommation), 0);
  const evolution = totalConsoN1 > 0 ? ((totalConsoN - totalConsoN1) / totalConsoN1) * 100 : null;

  return (
    <div className="flex flex-col gap-4">
      {/* En-tête compteur */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{fluide.icon}</span>
          <div>
            <div className="text-sm font-semibold text-text-main">
              {compteur.reference_compteur || 'Référence non renseignée'}
            </div>
            <div className="text-xs text-text-muted">
              {compteur.fournisseur || '—'} · {compteur.unite}
            </div>
          </div>
        </div>
        {!isReadOnly && (
          <div className="flex gap-2">
            <button onClick={() => setShowCSV(true)}
              className="btn-secondary text-xs flex items-center gap-1.5">
              <Upload size={13} /> Importer CSV
            </button>
            <button onClick={() => { setEditReleve(null); setShowModal(true); }}
              className="btn-primary text-xs flex items-center gap-1.5">
              <Plus size={13} /> Ajouter un relevé
            </button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-xs text-text-muted mb-1">Total {anneeN}</div>
          <div className="text-lg font-bold text-text-main">{fmtNum(Math.round(totalConsoN), compteur.unite)}</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-xs text-text-muted mb-1">Montant {anneeN}</div>
          <div className="text-lg font-bold text-text-main">{totalMontant > 0 ? fmtEur(totalMontant) : '—'}</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-xs text-text-muted mb-1">Évolution vs {anneeN - 1}</div>
          {evolution !== null ? (
            <div className={`text-lg font-bold flex items-center gap-1 ${evolution < 0 ? 'text-green-600' : 'text-red-500'}`}>
              {evolution < 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
              {evolution > 0 ? '+' : ''}{evolution.toFixed(1)}%
            </div>
          ) : <div className="text-lg font-bold text-text-muted">—</div>}
        </div>
      </div>

      {/* Graphique 24 mois */}
      {releves.length > 0 && (
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wide">
            Évolution 24 mois — {compteur.unite}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mois" tick={{ fontSize: 9 }} interval={2} />
              <YAxis tick={{ fontSize: 10 }} width={50}
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
              <Tooltip formatter={(v, n) => [fmtNum(v, compteur.unite), n === 'N' ? `${anneeN}` : `${anneeN - 1}`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => v === 'N' ? anneeN : anneeN - 1} />
              <Line type="monotone" dataKey="N" stroke={fluide.color || '#1A3A5C'} strokeWidth={2}
                dot={false} connectNulls={false} name="N" />
              <Line type="monotone" dataKey="N1" stroke="#CBD5E1" strokeWidth={1.5}
                strokeDasharray="4 2" dot={false} connectNulls={false} name="N1" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tableau des relevés */}
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-border">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold text-text-muted">Période</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-text-muted">Conso ({compteur.unite})</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-text-muted">Montant HT</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-text-muted">N° Facture</th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-text-muted">Source</th>
              {!isReadOnly && <th className="px-2 py-2 w-16" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-6 text-text-muted text-xs">Chargement…</td></tr>
            ) : releves.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-text-muted text-sm">
                Aucun relevé enregistré
              </td></tr>
            ) : releves.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-text-main">{fmtDate(r.periode)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.consommation)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-text-muted">{r.montant_ht ? fmtEur(r.montant_ht) : '—'}</td>
                <td className="px-3 py-2 text-text-muted text-xs">{r.numero_facture || '—'}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${r.source === 'import_csv' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>
                    {r.source === 'import_csv' ? 'Import' : 'Manuel'}
                  </span>
                </td>
                {!isReadOnly && (
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => { setEditReleve(r); setShowModal(true); }}
                        className="p-1 rounded hover:bg-gray-100 text-text-muted hover:text-primary">
                        <Edit2 size={13} />
                      </button>
                      {delConfirm === r.id ? (
                        <button onClick={() => handleDelete(r.id)}
                          className="p-1 rounded bg-red-100 text-red-600 text-xs font-medium px-2">
                          Confirmer
                        </button>
                      ) : (
                        <button onClick={() => setDelConfirm(r.id)}
                          className="p-1 rounded hover:bg-red-50 text-text-muted hover:text-red-500">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <ReleveModal
          compteur={compteur}
          releve={editReleve}
          onClose={() => { setShowModal(false); setEditReleve(null); }}
          onSaved={() => { setShowModal(false); setEditReleve(null); load(); }}
        />
      )}
      {showCSV && (
        <ImportCSVModal
          compteur={compteur}
          onClose={() => setShowCSV(false)}
          onSaved={() => { setShowCSV(false); load(); }}
        />
      )}
    </div>
  );
}

// ── Section Décret Tertiaire ──────────────────────────────────────────────────
function SectionDecretTertiaire({ batimentId, synthese, isAdmin, onRefresh }) {
  const toast = useToast();
  const { trajectoire, decret_tertiaire: dt } = synthese;
  const [showParams, setShowParams] = useState(false);
  const [form, setForm] = useState({
    annee_reference:    dt?.annee_reference    || 2020,
    conso_ref_kwh:      dt?.conso_ref_kwh      || '',
    identifiant_operat: dt?.identifiant_operat || '',
    soumis_decret:      dt?.soumis_decret      ?? true,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (!dt?.soumis_decret && !isAdmin) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/patrimoine/batiments/${batimentId}/decret-tertiaire`, form);
      toast.success('Paramètres Décret Tertiaire mis à jour');
      setShowParams(false);
      onRefresh();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const traj = trajectoire;
  const refKwh = dt?.conso_ref_kwh || 0;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="bg-blue-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="font-semibold text-sm">Décret Tertiaire OPERAT</div>
        {dt?.identifiant_operat && (
          <span className="text-xs text-blue-300">{dt.identifiant_operat}</span>
        )}
      </div>

      {!dt?.conso_ref_kwh ? (
        <div className="p-4 text-sm text-text-muted">
          Consommation de référence non renseignée.{isAdmin && ' Configurez les paramètres ci-dessous.'}
        </div>
      ) : traj ? (
        <div className="p-4 flex flex-col gap-4">
          {/* Tuiles */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-text-muted mb-1">Consommation {synthese.anneeN}</div>
              <div className="text-lg font-bold text-text-main">{fmtNum(traj.totalKwefN, 'kWhef')}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-text-muted mb-1">Intensité énergétique</div>
              <div className="text-lg font-bold text-text-main">
                {synthese.intensite != null ? fmtNum(synthese.intensite, 'kWhef/m²') : '—'}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-text-muted mb-1">Réduction vs référence</div>
              <div className={`text-lg font-bold flex items-center gap-1 ${traj.reduction_actuelle_pct > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {traj.reduction_actuelle_pct > 0 ? <TrendingDown size={16}/> : <TrendingUp size={16}/>}
                {traj.reduction_actuelle_pct > 0 ? '-' : '+'}{Math.abs(traj.reduction_actuelle_pct).toFixed(1)}%
              </div>
            </div>
            <div className={`rounded-xl p-3 ${traj.en_trajectoire ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="text-xs text-text-muted mb-1">Trajectoire 2030</div>
              <div className={`text-sm font-bold flex items-center gap-1 ${traj.en_trajectoire ? 'text-green-700' : 'text-red-600'}`}>
                {traj.en_trajectoire ? <><CheckCircle size={15}/> En trajectoire</> : <><AlertTriangle size={15}/> Hors trajectoire</>}
              </div>
            </div>
          </div>

          {/* Jauge */}
          <div className="flex flex-col gap-2">
            {[
              { label: `Réf. ${dt.annee_reference}`, val: refKwh, pct: 100, color: '#94A3B8' },
              { label: 'Objectif 2030 (−40%)', val: traj.objectif_2030, pct: 60, color: '#22C55E' },
              { label: 'Objectif 2040 (−50%)', val: traj.objectif_2040, pct: 50, color: '#F59E0B' },
              { label: `Conso ${synthese.anneeN}`, val: traj.totalKwefN, pct: Math.round((traj.totalKwefN / refKwh) * 100), color: traj.en_trajectoire ? '#16A34A' : '#EF4444', current: true },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`text-xs w-36 shrink-0 ${item.current ? 'font-semibold text-text-main' : 'text-text-muted'}`}>
                  {item.label}
                </div>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(item.pct, 100)}%`, backgroundColor: item.color }} />
                </div>
                <div className={`text-xs w-28 text-right tabular-nums shrink-0 ${item.current ? 'font-semibold' : 'text-text-muted'}`}>
                  {fmtNum(Math.round(item.val), 'kWhef')}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4 text-sm text-text-muted">Aucune donnée pour calculer la trajectoire.</div>
      )}

      {/* Paramètres admin */}
      {isAdmin && (
        <div className="border-t border-border">
          <button onClick={() => setShowParams(p => !p)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-text-muted hover:bg-gray-50">
            <span className="font-semibold uppercase tracking-wide">Paramètres (admin)</span>
            {showParams ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </button>
          {showParams && (
            <div className="p-4 flex flex-col gap-3 bg-gray-50">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Année de référence</label>
                  <input type="number" value={form.annee_reference}
                    onChange={e => set('annee_reference', parseInt(e.target.value))}
                    className="input w-full" min={2010} max={2030} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Conso référence (kWhef)</label>
                  <input type="number" value={form.conso_ref_kwh}
                    onChange={e => set('conso_ref_kwh', e.target.value)}
                    className="input w-full" placeholder="ex : 356400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Identifiant OPERAT</label>
                <input type="text" value={form.identifiant_operat}
                  onChange={e => set('identifiant_operat', e.target.value)}
                  className="input w-full" placeholder="OPERAT-59220-XXX-001" />
              </div>
              <div className="flex justify-end">
                <button onClick={handleSave} disabled={saving}
                  className="btn-primary text-sm flex items-center gap-1.5">
                  <Save size={13} />{saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export function TabConsommationsBatiment({ batimentId }) {
  const { user } = useAuth();
  const toast    = useToast();
  const isReadOnly = user?.role === 'read';
  const isAdmin    = user?.role === 'admin';

  const [compteurs, setCompteurs]   = useState([]);
  const [synthese, setSynthese]     = useState(null);
  const [compteurActifId, setCompteurActifId] = useState(null);
  const [anneeN, setAnneeN]         = useState(new Date().getFullYear() - 1);
  const [loading, setLoading]       = useState(true);
  const [showAddCompteur, setShowAddCompteur] = useState(false);
  const [addForm, setAddForm]       = useState({ fluide: 'electricite', reference_compteur: '', fournisseur: '', unite: 'kWh' });
  const [addSaving, setAddSaving]   = useState(false);
  const [editCompteur, setEditCompteur] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cpts, syn] = await Promise.all([
        api.get(`/patrimoine/compteurs?batiment_id=${batimentId}`),
        api.get(`/patrimoine/batiments/${batimentId}/synthese-energie?annee=${anneeN}`),
      ]);
      setCompteurs(cpts);
      setSynthese(syn);
      if (!compteurActifId && cpts.length > 0) setCompteurActifId(cpts[0].id);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [batimentId, anneeN]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleAddCompteur = async (e) => {
    e.preventDefault();
    setAddSaving(true);
    try {
      const added = await api.post('/patrimoine/compteurs', { ...addForm, batiment_id: batimentId });
      toast.success('Compteur ajouté');
      setShowAddCompteur(false);
      setAddForm({ fluide: 'electricite', reference_compteur: '', fournisseur: '', unite: 'kWh' });
      setCompteurActifId(added.id);
      loadAll();
    } catch (err) { toast.error(err.message); }
    finally { setAddSaving(false); }
  };

  const handleEditCompteur = async (e) => {
    e.preventDefault();
    setAddSaving(true);
    try {
      await api.put(`/patrimoine/compteurs/${editCompteur.id}`, {
        fluide:              editCompteur.fluide,
        reference_compteur: editCompteur.reference_compteur,
        fournisseur:        editCompteur.fournisseur,
        unite:              editCompteur.unite,
      });
      toast.success('Compteur mis à jour');
      setEditCompteur(null);
      loadAll();
    } catch (err) { toast.error(err.message); }
    finally { setAddSaving(false); }
  };

  const handleDeleteCompteur = async (cpt) => {
    if (!window.confirm(`Supprimer le compteur « ${cpt.reference_compteur || cpt.fluide} » et tous ses relevés ?`)) return;
    try {
      await api.delete(`/patrimoine/compteurs/${cpt.id}`);
      toast.success('Compteur supprimé');
      setCompteurActifId(compteurs.find(c => c.id !== cpt.id)?.id || null);
      loadAll();
    } catch (err) { toast.error(err.message); }
  };

  const compteurActif = compteurs.find(c => c.id === compteurActifId) || null;

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-text-muted text-sm gap-2">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
      Chargement des consommations…
    </div>
  );

  return (
    <div className="flex flex-col gap-5">

      {/* Sélecteur année + bouton ajout compteur */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted font-medium">Année :</label>
          <select value={anneeN} onChange={e => setAnneeN(parseInt(e.target.value))}
            className="input text-sm py-1 px-2">
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        {!isReadOnly && (
          <button onClick={() => setShowAddCompteur(true)}
            className="btn-secondary text-xs flex items-center gap-1.5">
            <Plus size={13}/> Ajouter un compteur
          </button>
        )}
      </div>

      {/* Modale ajout compteur */}
      {showAddCompteur && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-heading font-semibold text-text-main">Ajouter un compteur</h3>
              <button onClick={() => setShowAddCompteur(false)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16}/></button>
            </div>
            <form onSubmit={handleAddCompteur} className="p-4 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Fluide *</label>
                <select value={addForm.fluide} onChange={e => {
                    const f = FLUIDES.find(fl => fl.id === e.target.value);
                    setAddForm(a => ({ ...a, fluide: e.target.value, unite: f?.unite_def || 'kWh' }));
                  }} className="input w-full" required>
                  {FLUIDES.map(f => <option key={f.id} value={f.id}>{f.icon} {f.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Référence compteur</label>
                  <input type="text" value={addForm.reference_compteur}
                    onChange={e => setAddForm(a => ({ ...a, reference_compteur: e.target.value }))}
                    className="input w-full" placeholder="PDL-59220-XXX" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Unité *</label>
                  <select value={addForm.unite}
                    onChange={e => setAddForm(a => ({ ...a, unite: e.target.value }))}
                    className="input w-full" required>
                    <option value="kWh">kWh</option>
                    <option value="m3">m³</option>
                    <option value="litres">litres</option>
                    <option value="MWh">MWh</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Fournisseur</label>
                <input type="text" value={addForm.fournisseur}
                  onChange={e => setAddForm(a => ({ ...a, fournisseur: e.target.value }))}
                  className="input w-full" placeholder="EDF, ENGIE…" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowAddCompteur(false)} className="btn-secondary text-sm">Annuler</button>
                <button type="submit" disabled={addSaving} className="btn-primary text-sm">
                  {addSaving ? 'Ajout…' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale édition compteur */}
      {editCompteur && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-heading font-semibold text-text-main">Modifier le compteur</h3>
              <button onClick={() => setEditCompteur(null)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16}/></button>
            </div>
            <form onSubmit={handleEditCompteur} className="p-4 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Fluide *</label>
                <select value={editCompteur.fluide} onChange={e => {
                    const f = FLUIDES.find(fl => fl.id === e.target.value);
                    setEditCompteur(c => ({ ...c, fluide: e.target.value, unite: f?.unite_def || c.unite }));
                  }} className="input w-full" required>
                  {FLUIDES.map(f => <option key={f.id} value={f.id}>{f.icon} {f.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Référence compteur</label>
                  <input type="text" value={editCompteur.reference_compteur || ''}
                    onChange={e => setEditCompteur(c => ({ ...c, reference_compteur: e.target.value }))}
                    className="input w-full" placeholder="PDL-59220-XXX" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Unité *</label>
                  <select value={editCompteur.unite}
                    onChange={e => setEditCompteur(c => ({ ...c, unite: e.target.value }))}
                    className="input w-full" required>
                    <option value="kWh">kWh</option>
                    <option value="m3">m³</option>
                    <option value="litres">litres</option>
                    <option value="MWh">MWh</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Fournisseur</label>
                <input type="text" value={editCompteur.fournisseur || ''}
                  onChange={e => setEditCompteur(c => ({ ...c, fournisseur: e.target.value }))}
                  className="input w-full" placeholder="EDF, ENGIE…" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setEditCompteur(null)} className="btn-secondary text-sm">Annuler</button>
                <button type="submit" disabled={addSaving} className="btn-primary text-sm flex items-center gap-1.5">
                  <Save size={13}/>{addSaving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Aucun compteur */}
      {compteurs.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <Zap size={32} className="mx-auto mb-3 opacity-30"/>
          <p className="text-sm">Aucun compteur enregistré.</p>
          {!isReadOnly && <p className="text-xs mt-1">Ajoutez un compteur pour commencer le suivi des consommations.</p>}
        </div>
      ) : (
        <>
          {/* Onglets par compteur */}
          <div className="flex gap-1 flex-wrap items-center">
            {compteurs.map(cpt => {
              const f = FLUIDES.find(fl => fl.id === cpt.fluide) || {};
              const isActive = compteurActifId === cpt.id;
              return (
                <div key={cpt.id} className="flex items-center">
                  <button
                    onClick={() => setCompteurActifId(cpt.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      isActive
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white border-border text-text-muted hover:bg-gray-50'
                    }`}>
                    <span>{f.icon}</span>
                    <span>{cpt.reference_compteur || f.label}</span>
                  </button>
                  {!isReadOnly && isActive && (
                    <div className="flex items-center gap-0.5 ml-1">
                      <button
                        onClick={() => setEditCompteur({ ...cpt })}
                        className="p-1.5 rounded hover:bg-blue-50 text-blue-400"
                        title="Modifier le compteur"
                      ><Edit2 size={12}/></button>
                      <button
                        onClick={() => handleDeleteCompteur(cpt)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-400"
                        title="Supprimer le compteur et tous ses relevés"
                      ><Trash2 size={12}/></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Contenu de l'onglet actif */}
          {compteurActif && (
            <OngletFluide
              key={compteurActif.id}
              compteur={compteurActif}
              batimentId={batimentId}
              isReadOnly={isReadOnly}
              anneeN={anneeN}
            />
          )}

          {/* Synthèse Décret Tertiaire */}
          {synthese && (
            <SectionDecretTertiaire
              batimentId={batimentId}
              synthese={synthese}
              isAdmin={isAdmin}
              onRefresh={loadAll}
            />
          )}
        </>
      )}
    </div>
  );
}
