import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit2, X, Save, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../../../utils/api';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';

// ── Helpers ───────────────────────────────────────────────────────────────────
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
function fmtSemestre(d) {
  if (!d) return '—';
  const [y, m] = d.split('-');
  return parseInt(m, 10) <= 6 ? `S1 ${y}` : `S2 ${y}`;
}
function defaultSemestrePeriode() {
  const now = new Date();
  const m = now.getMonth() < 6 ? '01' : '07';
  return `${now.getFullYear()}-${m}`;
}

const FLUIDE_COLORS = {
  electricite: '#F59E0B',
  eau: '#06B6D4',
  gaz: '#8B5CF6',
  fioul: '#EF4444',
  chaleur_urbain: '#F97316',
};
const FLUIDE_LABELS = {
  electricite: 'Électricité',
  eau: 'Eau',
  gaz: 'Gaz',
  fioul: 'Fioul',
  chaleur_urbain: 'Chaleur urbaine',
};

// ── Modale relevé ─────────────────────────────────────────────────────────────
function ReleveModal({ compteur, releve, onClose, onSaved }) {
  const toast  = useToast();
  const isEau  = compteur.fluide === 'eau';
  const initPeriode = releve?.periode?.substring(0, 7) || (isEau
    ? defaultSemestrePeriode()
    : new Date().toISOString().substring(0, 7));
  const [form, setForm] = useState({
    periode:        initPeriode,
    consommation:   releve?.consommation ?? '',
    montant_ht:     releve?.montant_ht   ?? '',
    numero_facture: releve?.numero_facture || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const periodeYear = form.periode.split('-')[0] || String(new Date().getFullYear());
  const periodeSem  = parseInt(form.periode.split('-')[1] || '1', 10) <= 6 ? '01' : '07';
  const setSemestre = (year, sem) => set('periode', `${year}-${sem}`);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        periode:        form.periode,
        consommation:   parseFloat(form.consommation),
        montant_ht:     form.montant_ht !== '' ? parseFloat(form.montant_ht) : null,
        numero_facture: form.numero_facture || null,
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-heading font-semibold text-text-main">
            {releve ? 'Modifier le relevé' : 'Ajouter un relevé'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          {isEau ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Année *</label>
                <select value={periodeYear}
                  onChange={e => setSemestre(e.target.value, periodeSem)}
                  className="input w-full">
                  {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Semestre *</label>
                <select value={periodeSem}
                  onChange={e => setSemestre(periodeYear, e.target.value)}
                  className="input w-full">
                  <option value="01">S1 — jan. à juin</option>
                  <option value="07">S2 — juil. à déc.</option>
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Période *</label>
              <input type="month" value={form.periode} onChange={e => set('periode', e.target.value)}
                className="input w-full" required />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Consommation ({compteur.unite || 'kWh'}) *
            </label>
            <input type="number" step="0.01" value={form.consommation} onChange={e => set('consommation', e.target.value)}
              className="input w-full" required placeholder="0.00"/>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Montant HT (€)</label>
              <input type="number" step="0.01" value={form.montant_ht} onChange={e => set('montant_ht', e.target.value)}
                className="input w-full" placeholder="0.00"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">N° facture</label>
              <input type="text" value={form.numero_facture} onChange={e => set('numero_facture', e.target.value)}
                className="input w-full"/>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary text-sm">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm flex items-center gap-1.5">
              <Save size={14}/>{saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modale création compteur ──────────────────────────────────────────────────
function CreateCompteurModal({ equipementId, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ fluide: 'electricite', reference_compteur: '', fournisseur: '', unite: 'kWh' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Mise à jour auto de l'unité selon le fluide
  const handleFluide = (v) => {
    const uniteMap = { electricite: 'kWh', gaz: 'm3', eau: 'm3', fioul: 'litres', chaleur_urbain: 'MWh' };
    setForm(f => ({ ...f, fluide: v, unite: uniteMap[v] || 'kWh' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/patrimoine/compteurs', {
        equipement_id: equipementId,
        fluide: form.fluide,
        reference_compteur: form.reference_compteur || '',
        fournisseur: form.fournisseur || null,
        unite: form.unite || 'kWh',
      });
      toast.success('Compteur créé');
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-heading font-semibold text-text-main">Créer un compteur</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Fluide *</label>
            <select value={form.fluide} onChange={e => handleFluide(e.target.value)} className="input w-full">
              {Object.entries(FLUIDE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Référence compteur</label>
            <input type="text" value={form.reference_compteur} onChange={e => set('reference_compteur', e.target.value)}
              className="input w-full" placeholder="Ex : EDF-12345"/>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Fournisseur</label>
              <input type="text" value={form.fournisseur} onChange={e => set('fournisseur', e.target.value)}
                className="input w-full" placeholder="Ex : EDF, Enedis"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Unité</label>
              <input type="text" value={form.unite} onChange={e => set('unite', e.target.value)}
                className="input w-full"/>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary text-sm">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm flex items-center gap-1.5">
              <Save size={14}/>{saving ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export function TabConsommationsEquipement({ equipementId }) {
  const { user } = useAuth();
  const toast    = useToast();
  const isReadOnly = user?.role === 'read';

  const [compteurs, setCompteurs]   = useState([]);
  const [selectedCpt, setSelectedCpt] = useState(null);
  const [synthese, setSynthese]     = useState(null);
  const [releves, setReleves]       = useState([]);
  const [anneeN, setAnneeN]         = useState(new Date().getFullYear() - 1);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [showCreateCpt, setShowCreateCpt] = useState(false);
  const [editReleve, setEditReleve] = useState(null);
  const [delConfirm, setDelConfirm] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cpts, syn] = await Promise.all([
        api.get(`/patrimoine/compteurs?equipement_id=${equipementId}`),
        api.get(`/patrimoine/equipements-divers/${equipementId}/synthese-energie?annee=${anneeN}`),
      ]);
      setCompteurs(cpts);
      setSynthese(syn);

      // Charger les relevés du compteur sélectionné (ou premier)
      const cptToLoad = selectedCpt ? cpts.find(c => c.id === selectedCpt?.id) : cpts[0];
      if (cptToLoad) {
        setSelectedCpt(cptToLoad);
        const rels = await api.get(`/patrimoine/compteurs/${cptToLoad.id}/releves`);
        setReleves(rels);
      } else {
        setSelectedCpt(null);
        setReleves([]);
      }
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [equipementId, anneeN]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSelectCompteur = async (cpt) => {
    setSelectedCpt(cpt);
    try {
      const rels = await api.get(`/patrimoine/compteurs/${cpt.id}/releves`);
      setReleves(rels);
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/patrimoine/releves/${id}`);
      toast.success('Relevé supprimé');
      setDelConfirm(null);
      loadAll();
    } catch (err) { toast.error(err.message); }
  };

  const compteur = selectedCpt || compteurs[0] || null;
  const isEau    = compteur?.fluide === 'eau';

  // Graphique mensuel (non-eau)
  const chartData = (() => {
    if (isEau) return [];
    const map = {};
    releves.forEach(r => {
      map[r.periode.substring(0, 7)] = parseFloat(r.consommation);
    });
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(anneeN, i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return { mois: MOIS_LABELS[i], N: map[key] ?? null };
    });
  })();

  // Graphique semestriel (eau) — 4 ans
  const chartDataEau = (() => {
    if (!isEau) return [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentSem  = now.getMonth() < 6 ? '01' : '07';
    const currentKey  = `${currentYear}-${currentSem}`;
    const semestres = [];
    for (let i = 3; i >= 0; i--) {
      const y = currentYear - i;
      ['01', '07'].forEach(s => {
        const key = `${y}-${s}`;
        if (key <= currentKey) semestres.push({ key, label: fmtSemestre(key) });
      });
    }
    const map = {};
    releves.forEach(r => {
      const [y, m] = r.periode.substring(0, 7).split('-');
      const sem = parseInt(m, 10) <= 6 ? '01' : '07';
      map[`${y}-${sem}`] = r;
    });
    return semestres.map(s => ({
      sem:   s.label,
      conso: map[s.key]?.consommation ?? null,
    }));
  })();

  // Totaux année
  const anneeReleves = releves.filter(r => r.periode.startsWith(String(anneeN)));
  const totalN  = anneeReleves.reduce((s, r) => s + parseFloat(r.consommation), 0);
  const totalMontant = anneeReleves.reduce((s, r) => s + (parseFloat(r.montant_ht) || 0), 0);
  const anneeN1Releves = releves.filter(r => r.periode.startsWith(String(anneeN - 1)));
  const totalN1 = anneeN1Releves.reduce((s, r) => s + parseFloat(r.consommation), 0);
  const evolution = totalN1 > 0 ? ((totalN - totalN1) / totalN1) * 100 : null;

  const barFill = FLUIDE_COLORS[compteur?.fluide] || '#6B7280';

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-text-muted text-sm gap-2">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
      Chargement…
    </div>
  );

  if (compteurs.length === 0) return (
    <div className="text-center py-12 text-text-muted">
      <Zap size={32} className="mx-auto mb-3 opacity-30"/>
      <p className="text-sm">Aucun compteur enregistré pour cet équipement.</p>
      {!isReadOnly && (
        <button onClick={() => setShowCreateCpt(true)}
          className="btn-primary text-xs mt-3 inline-flex items-center gap-1.5">
          <Plus size={13}/> Créer un compteur
        </button>
      )}
      {showCreateCpt && (
        <CreateCompteurModal
          equipementId={equipementId}
          onClose={() => setShowCreateCpt(false)}
          onSaved={() => { setShowCreateCpt(false); loadAll(); }}
        />
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">

      {/* Sélecteur compteur + année */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {compteurs.length > 1 ? (
            <div className="flex gap-1 flex-wrap">
              {compteurs.map(c => (
                <button key={c.id}
                  onClick={() => handleSelectCompteur(c)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    compteur?.id === c.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-text-muted hover:border-primary'
                  }`}>
                  {FLUIDE_LABELS[c.fluide] || c.fluide}
                  {c.reference_compteur && <span className="ml-1 opacity-60">· {c.reference_compteur}</span>}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-text-muted font-medium">Compteur :</span>
              <span className="font-semibold text-text-main">{compteur?.reference_compteur || FLUIDE_LABELS[compteur?.fluide] || '—'}</span>
              {compteur?.fournisseur && <span className="text-text-muted">· {compteur.fournisseur}</span>}
            </div>
          )}
          {!isReadOnly && (
            <button onClick={() => setShowCreateCpt(true)}
              className="text-xs text-text-muted hover:text-primary flex items-center gap-0.5 ml-1">
              <Plus size={12}/> Ajouter
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted font-medium">Année :</label>
          <select value={anneeN} onChange={e => setAnneeN(parseInt(e.target.value))}
            className="input text-sm py-1 px-2">
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {!isReadOnly && (
            <button onClick={() => { setEditReleve(null); setShowModal(true); }}
              className="btn-primary text-xs flex items-center gap-1.5">
              <Plus size={13}/> Ajouter
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-3 border border-border" style={{ backgroundColor: barFill + '15' }}>
          <div className="text-xs mb-1" style={{ color: barFill }}>Consommation {anneeN}</div>
          <div className="text-xl font-bold text-text-main">
            {fmtNum(Math.round(totalN), compteur?.unite || 'kWh')}
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-xs text-text-muted mb-1">Facture {anneeN}</div>
          <div className="text-xl font-bold text-text-main">{totalMontant > 0 ? fmtEur(totalMontant) : '—'}</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-xs text-text-muted mb-1">Évolution vs {anneeN - 1}</div>
          {evolution !== null ? (
            <div className={`text-xl font-bold flex items-center gap-1 ${evolution < 0 ? 'text-green-600' : 'text-red-500'}`}>
              {evolution < 0 ? <TrendingDown size={18}/> : <TrendingUp size={18}/>}
              {evolution > 0 ? '+' : ''}{evolution.toFixed(1)}%
            </div>
          ) : (
            <div className="text-xl font-bold text-text-main">—</div>
          )}
        </div>
      </div>

      {/* Graphique */}
      <div className="bg-white border border-border rounded-xl p-4">
        {isEau ? (
          <>
            <div className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wide">
              Évolution semestrielle — {compteur?.unite || 'm³'}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartDataEau} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="sem" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={50}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip formatter={v => [fmtNum(v, compteur?.unite || 'm³'), 'Consommation']} />
                <Bar dataKey="conso" fill={barFill} radius={[3, 3, 0, 0]} name="Consommation" />
              </BarChart>
            </ResponsiveContainer>
          </>
        ) : (
          <>
            <div className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wide">
              Consommations mensuelles {anneeN} — {compteur?.unite || 'kWh'}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mois" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={50}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip formatter={v => [fmtNum(v, compteur?.unite || 'kWh'), String(anneeN)]} />
                <Bar dataKey="N" fill={barFill} radius={[3, 3, 0, 0]} name={String(anneeN)} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* Tableau des relevés */}
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-border">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold text-text-muted">Période</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-text-muted">
                Conso ({compteur?.unite || 'kWh'})
              </th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-text-muted">Montant HT</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-text-muted">N° Facture</th>
              {!isReadOnly && <th className="px-2 py-2 w-16"/>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {releves.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-text-muted text-sm">
                Aucun relevé enregistré
              </td></tr>
            ) : releves.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-text-main">
                  {isEau ? fmtSemestre(r.periode) : fmtDate(r.periode)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.consommation)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-text-muted">
                  {r.montant_ht ? fmtEur(r.montant_ht) : '—'}
                </td>
                <td className="px-3 py-2 text-text-muted text-xs">{r.numero_facture || '—'}</td>
                {!isReadOnly && (
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => { setEditReleve(r); setShowModal(true); }}
                        className="p-1 rounded hover:bg-gray-100 text-text-muted hover:text-primary">
                        <Edit2 size={13}/>
                      </button>
                      {delConfirm === r.id ? (
                        <button onClick={() => handleDelete(r.id)}
                          className="p-1 rounded bg-red-100 text-red-600 text-xs font-medium px-2">
                          Confirmer
                        </button>
                      ) : (
                        <button onClick={() => setDelConfirm(r.id)}
                          className="p-1 rounded hover:bg-red-50 text-text-muted hover:text-red-500">
                          <Trash2 size={13}/>
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

      {showModal && compteur && (
        <ReleveModal
          compteur={compteur}
          releve={editReleve}
          onClose={() => { setShowModal(false); setEditReleve(null); }}
          onSaved={() => { setShowModal(false); setEditReleve(null); loadAll(); }}
        />
      )}

      {showCreateCpt && (
        <CreateCompteurModal
          equipementId={equipementId}
          onClose={() => setShowCreateCpt(false)}
          onSaved={() => { setShowCreateCpt(false); loadAll(); }}
        />
      )}
    </div>
  );
}
