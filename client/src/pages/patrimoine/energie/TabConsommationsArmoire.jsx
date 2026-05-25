import { useState, useEffect, useCallback } from 'react';
import { Plus, Upload, Trash2, Edit2, X, Save, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
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
function periodeLabel(d) {
  if (!d) return '—';
  const [y, m] = d.split('-');
  return `${MOIS_LABELS[parseInt(m) - 1].substring(0, 3)}`;
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
            <label className="block text-xs font-medium text-text-muted mb-1">Consommation (kWh) *</label>
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

// ── Composant principal ───────────────────────────────────────────────────────
export function TabConsommationsArmoire({ armoireId }) {
  const { user } = useAuth();
  const toast    = useToast();
  const isReadOnly = user?.role === 'read';

  const [compteurs, setCompteurs]   = useState([]);
  const [synthese, setSynthese]     = useState(null);
  const [releves, setReleves]       = useState([]);
  const [anneeN, setAnneeN]         = useState(new Date().getFullYear() - 1);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editReleve, setEditReleve] = useState(null);
  const [delConfirm, setDelConfirm] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cpts, syn] = await Promise.all([
        api.get(`/patrimoine/compteurs?armoire_id=${armoireId}`),
        api.get(`/patrimoine/armoires/${armoireId}/synthese-energie?annee=${anneeN}`),
      ]);
      setCompteurs(cpts);
      setSynthese(syn);

      // Charger les relevés du premier compteur actif
      if (cpts.length > 0) {
        const rels = await api.get(`/patrimoine/compteurs/${cpts[0].id}/releves`);
        setReleves(rels);
      }
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [armoireId, anneeN]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/patrimoine/releves/${id}`);
      toast.success('Relevé supprimé');
      setDelConfirm(null);
      loadAll();
    } catch (err) { toast.error(err.message); }
  };

  const compteur = compteurs[0] || null;
  const isEau    = compteur?.fluide === 'eau';

  // Graphique 12 mois (non-eau)
  const chartData = (() => {
    if (isEau) return [];
    const map = {};
    releves.forEach(r => {
      map[r.periode.substring(0, 7)] = { N: parseFloat(r.consommation) };
    });
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(anneeN, i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return { mois: MOIS_LABELS[i], N: map[key]?.N ?? null };
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

  // Synthèse année
  const anneeReleves = releves.filter(r => r.periode.startsWith(String(anneeN)));
  const totalN  = anneeReleves.reduce((s, r) => s + parseFloat(r.consommation), 0);
  const totalMontant = anneeReleves.reduce((s, r) => s + (parseFloat(r.montant_ht) || 0), 0);
  const anneeN1Releves = releves.filter(r => r.periode.startsWith(String(anneeN - 1)));
  const totalN1 = anneeN1Releves.reduce((s, r) => s + parseFloat(r.consommation), 0);
  const evolution = totalN1 > 0 ? ((totalN - totalN1) / totalN1) * 100 : null;

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-text-muted text-sm gap-2">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
      Chargement…
    </div>
  );

  if (!compteur) return (
    <div className="text-center py-12 text-text-muted">
      <Zap size={32} className="mx-auto mb-3 opacity-30"/>
      <p className="text-sm">Aucun compteur électrique enregistré.</p>
      {!isReadOnly && (
        <button onClick={async () => {
          try {
            await api.post('/patrimoine/compteurs', {
              armoire_id: armoireId, fluide: 'electricite',
              reference_compteur: '', fournisseur: 'Enedis', unite: 'kWh',
            });
            toast.success('Compteur ajouté');
            loadAll();
          } catch (err) { toast.error(err.message); }
        }} className="btn-primary text-xs mt-3 inline-flex items-center gap-1.5">
          <Plus size={13}/> Créer un compteur
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">

      {/* Sélecteur année */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-muted font-medium">Compteur :</span>
          <span className="font-semibold text-text-main">{compteur.reference_compteur || '—'}</span>
          <span className="text-text-muted">· {compteur.fournisseur || '—'}</span>
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
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
          <div className="text-xs text-yellow-700 mb-1">Consommation annuelle {anneeN}</div>
          <div className="text-xl font-bold text-yellow-800">{fmtNum(Math.round(totalN), 'kWh')}</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-xs text-text-muted mb-1">Ratio / point lumineux</div>
          <div className="text-xl font-bold text-text-main">
            {synthese?.ratioPL != null ? fmtNum(synthese.ratioPL, 'kWh/PL') : '—'}
          </div>
          {synthese?.nbPL > 0 && <div className="text-xs text-text-muted mt-0.5">{synthese.nbPL} point(s) lumineux</div>}
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-xs text-text-muted mb-1">Facture {anneeN}</div>
          <div className="text-xl font-bold text-text-main">{totalMontant > 0 ? fmtEur(totalMontant) : '—'}</div>
          {evolution !== null && (
            <div className={`text-xs mt-0.5 flex items-center gap-0.5 ${evolution < 0 ? 'text-green-600' : 'text-red-500'}`}>
              {evolution < 0 ? <TrendingDown size={11}/> : <TrendingUp size={11}/>}
              {evolution > 0 ? '+' : ''}{evolution.toFixed(1)}% vs {anneeN - 1}
            </div>
          )}
        </div>
      </div>

      {/* Graphique */}
      <div className="bg-white border border-border rounded-xl p-4">
        {isEau ? (
          <>
            <div className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wide">
              Évolution semestrielle — {compteur.unite}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartDataEau} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="sem" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={50}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip formatter={v => [fmtNum(v, compteur.unite), 'Consommation']} />
                <Bar dataKey="conso" fill="#06B6D4" radius={[3, 3, 0, 0]} name="Consommation" />
              </BarChart>
            </ResponsiveContainer>
          </>
        ) : (
          <>
            <div className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wide">
              Consommations mensuelles {anneeN} — kWh
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mois" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={50}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip formatter={v => [fmtNum(v, 'kWh'), `${anneeN}`]} />
                <Bar dataKey="N" fill="#F59E0B" radius={[3, 3, 0, 0]} name={String(anneeN)} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* Analyse LED */}
      {synthese?.analyseLED && synthese.analyseLED.nbLED + synthese.analyseLED.nbAutres > 0 && (
        <div className="border border-border rounded-xl p-4">
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
            Analyse LED
          </div>
          <div className="grid grid-cols-2 gap-3">
            {synthese.analyseLED.nbLED > 0 && (
              <div className="bg-green-50 rounded-xl p-3">
                <div className="text-xs text-green-700 font-medium mb-0.5">Points LED</div>
                <div className="text-lg font-bold text-green-800">{synthese.analyseLED.nbLED}</div>
                {synthese.analyseLED.puissanceMoyenneLed && (
                  <div className="text-xs text-green-600 mt-0.5">
                    {Math.round(synthese.analyseLED.puissanceMoyenneLed)} W moy.
                  </div>
                )}
              </div>
            )}
            {synthese.analyseLED.nbAutres > 0 && (
              <div className="bg-orange-50 rounded-xl p-3">
                <div className="text-xs text-orange-700 font-medium mb-0.5">Autres technologies</div>
                <div className="text-lg font-bold text-orange-800">{synthese.analyseLED.nbAutres}</div>
                {synthese.analyseLED.puissanceMoyenneAutre && (
                  <div className="text-xs text-orange-600 mt-0.5">
                    {Math.round(synthese.analyseLED.puissanceMoyenneAutre)} W moy.
                  </div>
                )}
              </div>
            )}
          </div>
          {synthese.analyseLED.nbLED > 0 && synthese.analyseLED.nbAutres > 0 && synthese.ratioPL && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
              <strong>Potentiel de sobriété :</strong> En remplaçant les {synthese.analyseLED.nbAutres} point(s) non-LED par des LED,
              l'économie estimée est de ~{fmtNum(Math.round(synthese.analyseLED.nbAutres * (synthese.ratioPL * 0.6)), 'kWh/an')} (estimation −60%).
            </div>
          )}
        </div>
      )}

      {/* Tableau des relevés */}
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-border">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold text-text-muted">Période</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-text-muted">Conso (kWh)</th>
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
                <td className="px-3 py-2 text-right tabular-nums text-text-muted">{r.montant_ht ? fmtEur(r.montant_ht) : '—'}</td>
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

      {showModal && (
        <ReleveModal
          compteur={compteur}
          releve={editReleve}
          onClose={() => { setShowModal(false); setEditReleve(null); }}
          onSaved={() => { setShowModal(false); setEditReleve(null); loadAll(); }}
        />
      )}
    </div>
  );
}
