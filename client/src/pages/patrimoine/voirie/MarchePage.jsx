import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { AppLayout } from '../../../components/layout/AppLayout';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../utils/api';

const TYPE_LABELS = { investissement: 'Investissement', gros_entretien: 'Gros entretien' };
const TYPE_COLORS = { investissement: '#1A3A5C', gros_entretien: '#E8920A' };
const STATUT_LABELS = { en_cours: 'En cours', termine: 'Terminé', suspendu: 'Suspendu' };
const STATUT_COLORS = {
  en_cours:  { bg: '#DBEAFE', color: '#1D4ED8' },
  termine:   { bg: '#D1FAE5', color: '#065F46' },
  suspendu:  { bg: '#FEF3C7', color: '#92400E' },
};

function fmtEur(v) {
  if (!v && v !== 0) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function pct(part, total) {
  if (!total) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

// ── Modale engagement ─────────────────────────────────────────────────────────
function EngagementModal({ marcheId, existing, onClose, onSaved }) {
  const toast = useToast();
  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState({
    exercice: existing?.exercice ?? currentYear,
    montant_engage_ht: existing?.montant_engage_ht ?? '',
    montant_mandate_ht: existing?.montant_mandate_ht ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/patrimoine/voirie/marches/${marcheId}/engagements`, {
        exercice: parseInt(form.exercice),
        montant_engage_ht: form.montant_engage_ht !== '' ? parseFloat(form.montant_engage_ht) : 0,
        montant_mandate_ht: form.montant_mandate_ht !== '' ? parseFloat(form.montant_mandate_ht) : 0,
      });
      toast.success('Engagement enregistré');
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-heading font-semibold text-text-main">
            {existing ? 'Modifier' : 'Ajouter'} un engagement
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Exercice *</label>
            <input
              type="number" min="2000" max="2050" value={form.exercice}
              onChange={e => set('exercice', e.target.value)} className="input w-full" required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Montant autorisé HT (€)</label>
            <input
              type="number" min="0" step="0.01" value={form.montant_engage_ht}
              onChange={e => set('montant_engage_ht', e.target.value)} className="input w-full"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Montant mandaté HT (€)</label>
            <input
              type="number" min="0" step="0.01" value={form.montant_mandate_ht}
              onChange={e => set('montant_mandate_ht', e.target.value)} className="input w-full"
              placeholder="0"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-1.5">
              <Save size={13} />{saving ? '…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modale édition marché ─────────────────────────────────────────────────────
function EditMarcheModal({ marche, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    intitule: marche.intitule || '',
    numero_marche: marche.numero_marche || '',
    type_travaux: marche.type_travaux || 'investissement',
    prestataire: marche.prestataire || '',
    date_debut: marche.date_debut || '',
    date_fin: marche.date_fin || '',
    montant_ht: marche.montant_ht ?? '',
    statut: marche.statut || 'en_cours',
    description: marche.description || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/patrimoine/voirie/marches/${marche.id}`, {
        ...form,
        montant_ht: form.montant_ht !== '' ? parseFloat(form.montant_ht) : null,
      });
      toast.success('Marché mis à jour');
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white z-10">
          <h3 className="font-heading font-semibold text-text-main">Modifier le marché</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Intitulé *</label>
            <input type="text" value={form.intitule} onChange={e => set('intitule', e.target.value)} className="input w-full" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">N° marché</label>
              <input type="text" value={form.numero_marche} onChange={e => set('numero_marche', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Type de travaux</label>
              <select value={form.type_travaux} onChange={e => set('type_travaux', e.target.value)} className="input w-full">
                <option value="investissement">Investissement</option>
                <option value="gros_entretien">Gros entretien</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Prestataire</label>
              <input type="text" value={form.prestataire} onChange={e => set('prestataire', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Montant HT (€)</label>
              <input type="number" min="0" step="0.01" value={form.montant_ht} onChange={e => set('montant_ht', e.target.value)} className="input w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Date début</label>
              <input type="date" value={form.date_debut} onChange={e => set('date_debut', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Date fin</label>
              <input type="date" value={form.date_fin} onChange={e => set('date_fin', e.target.value)} className="input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Statut</label>
            <select value={form.statut} onChange={e => set('statut', e.target.value)} className="input w-full">
              <option value="en_cours">En cours</option>
              <option value="termine">Terminé</option>
              <option value="suspendu">Suspendu</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} className="input w-full" rows={3} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-1.5">
              <Save size={13} />{saving ? '…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function MarchePage() {
  const { marcheId } = useParams();
  const toast = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === 'read';
  const isAdmin = user?.role === 'admin';
  const [marche, setMarche] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditMarche, setShowEditMarche] = useState(false);
  const [engModal, setEngModal] = useState(null); // null | {} | existing engagement

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get(`/patrimoine/voirie/marches/${marcheId}`);
      setMarche(d);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [marcheId]);

  useEffect(() => { load(); }, [load]);

  const handleDeleteEng = async (engId) => {
    if (!window.confirm('Supprimer cet engagement ?')) return;
    try {
      await api.delete(`/patrimoine/voirie/engagements/${engId}`);
      toast.success('Engagement supprimé');
      load();
    } catch (err) { toast.error(err.message); }
  };

  // Détermine le libellé et l'URL de retour selon le domaine du marché
  const DOMAINE_BACK = {
    voirie:    { label: 'Voirie',            to: '/patrimoine/voirie' },
    mobilier:  { label: 'Voirie',            to: '/patrimoine/voirie' },
    eclairage: { label: 'Éclairage public',  to: '/patrimoine/eclairage' },
    batiment:  { label: 'Bâtiments',         to: '/patrimoine/batiments' },
  };

  if (loading) {
    return (
      <AppLayout breadcrumbs={[{ label: '…', to: '/patrimoine/voirie' }, { label: 'Marchés' }, { label: '…' }]}>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }
  if (!marche) return null;

  const backCfg = DOMAINE_BACK[marche.domaine] || DOMAINE_BACK.voirie;
  const breadcrumbs = [
    { label: backCfg.label, to: backCfg.to },
    { label: 'Marchés' },
    { label: marche.intitule },
  ];

  const typeCfg = { color: TYPE_COLORS[marche.type_travaux] || '#6B7280', label: TYPE_LABELS[marche.type_travaux] || marche.type_travaux };
  const statutCfg = STATUT_COLORS[marche.statut] || STATUT_COLORS.en_cours;
  const engagements = marche.engagements || [];
  const pctEngageSurAutorise = pct(marche.total_interventions, marche.total_engage);
  const pctAutoriseSurMontant = pct(marche.total_engage, marche.montant_ht);

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="max-w-4xl mx-auto flex flex-col gap-4">

        {/* En-tête marché */}
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: typeCfg.color + '1A', color: typeCfg.color }}>
                  {typeCfg.label}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: statutCfg.bg, color: statutCfg.color }}>
                  {STATUT_LABELS[marche.statut] || marche.statut}
                </span>
                {marche.numero_marche && (
                  <span className="text-xs font-mono text-text-muted bg-gray-100 px-2 py-0.5 rounded">
                    N° {marche.numero_marche}
                  </span>
                )}
              </div>
              <h1 className="font-heading font-bold text-xl text-text-main mb-3">{marche.intitule}</h1>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-text-muted mb-0.5">Prestataire</div>
                  <div className="text-sm font-medium text-text-main">{marche.prestataire || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-0.5">Montant HT</div>
                  <div className="font-mono text-sm font-semibold text-text-main">{fmtEur(marche.montant_ht)}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-0.5">Début</div>
                  <div className="font-mono text-sm text-text-main">{fmtDate(marche.date_debut)}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-0.5">Fin</div>
                  <div className="font-mono text-sm text-text-main">{fmtDate(marche.date_fin)}</div>
                </div>
              </div>
              {marche.description && (
                <p className="mt-3 pt-3 border-t border-border text-sm text-text-muted leading-relaxed">{marche.description}</p>
              )}
            </div>
            {!isReadOnly && (
              <button onClick={() => setShowEditMarche(true)} className="btn-secondary text-xs flex items-center gap-1.5 shrink-0">
                <Edit2 size={13} /> Modifier
              </button>
            )}
          </div>
        </div>

        {/* KPIs engagements */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="card p-4 flex flex-col gap-1">
            <div className="text-xs text-text-muted uppercase tracking-wide font-medium">Total autorisé</div>
            <div className="font-mono font-bold text-xl text-primary">{fmtEur(marche.total_engage)}</div>
            {marche.montant_ht > 0 && (
              <div className="text-xs text-text-muted">{pctAutoriseSurMontant}% du montant HT</div>
            )}
          </div>
          <div className="card p-4 flex flex-col gap-1">
            <div className="text-xs text-text-muted uppercase tracking-wide font-medium">Total engagé</div>
            <div className="font-mono font-bold text-xl" style={{ color: '#7C3AED' }}>{fmtEur(marche.total_interventions)}</div>
            {marche.total_engage > 0 && (
              <div className="text-xs text-text-muted">{pctEngageSurAutorise}% de l'autorisé</div>
            )}
          </div>
          <div className="card p-4 flex flex-col gap-1">
            <div className="text-xs text-text-muted uppercase tracking-wide font-medium">Reste à engager</div>
            <div className="font-mono font-bold text-xl" style={{ color: (marche.total_engage || 0) > (marche.total_interventions || 0) ? '#E8920A' : '#6B7280' }}>
              {fmtEur(Math.max(0, (marche.total_engage || 0) - (marche.total_interventions || 0)))}
            </div>
            {marche.montant_ht > 0 && (
              <div className="text-xs text-text-muted">
                Reste marché : {fmtEur(Math.max(0, marche.montant_ht - marche.total_engage))}
              </div>
            )}
          </div>
        </div>

        {/* Barre de progression */}
        {marche.montant_ht > 0 && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-text-muted">Avancement financier</span>
              <span className="text-xs font-mono text-text-muted">{fmtEur(marche.total_interventions)} / {fmtEur(marche.montant_ht)}</span>
            </div>
            <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pctAutoriseSurMontant}%`,
                  background: 'linear-gradient(90deg, #1A3A5C 0%, #E8920A 100%)',
                  position: 'relative',
                }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: marche.total_engage > 0 ? `${pct(marche.total_interventions, marche.total_engage)}%` : '0%',
                    backgroundColor: '#7C3AED',
                    opacity: 0.7,
                  }}
                />
              </div>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
              <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary mr-1" />Autorisé ({pctAutoriseSurMontant}%)</span>
              <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ backgroundColor: '#7C3AED' }} />Engagé ({pct(marche.total_interventions, marche.montant_ht)}%)</span>
            </div>
          </div>
        )}

        {/* Tableau des engagements par exercice */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-heading font-semibold text-sm text-text-main">
              Engagements par exercice ({engagements.length})
            </h3>
            {!isReadOnly && (
              <button
                onClick={() => setEngModal({})}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <Plus size={13} /> Ajouter un exercice
              </button>
            )}
          </div>

          {engagements.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm">Aucun engagement enregistré.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-gray-50">
                    <th className="py-2 px-4 text-xs font-semibold text-text-muted uppercase tracking-wide">Exercice</th>
                    <th className="py-2 px-4 text-xs font-semibold text-text-muted uppercase tracking-wide text-right">Autorisé HT</th>
                    <th className="py-2 px-4 text-xs font-semibold text-text-muted uppercase tracking-wide text-right" style={{ color: '#7C3AED' }}>Engagé HT</th>
                    <th className="py-2 px-4 text-xs font-semibold text-text-muted uppercase tracking-wide text-right">% engagé</th>
                    {!isReadOnly && <th className="py-2 px-3 w-20" />}
                  </tr>
                </thead>
                <tbody>
                  {engagements.map((eng, i) => {
                    const pctE = pct(eng.total_interventions_ht, eng.montant_engage_ht);
                    return (
                      <tr key={eng.id} className={`border-b border-border hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                        <td className="py-2.5 px-4 font-mono font-bold text-sm text-text-main">{eng.exercice}</td>
                        <td className="py-2.5 px-4 font-mono text-sm text-right text-text-main">{fmtEur(eng.montant_engage_ht)}</td>
                        <td className="py-2.5 px-4 font-mono text-sm text-right" style={{ color: '#7C3AED' }}>{fmtEur(eng.total_interventions_ht)}</td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pctE}%`, backgroundColor: pctE >= 100 ? '#7C3AED' : '#E8920A' }} />
                            </div>
                            <span className="text-xs font-mono text-text-muted w-8 text-right">{pctE}%</span>
                          </div>
                        </td>
                        {!isReadOnly && (
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setEngModal(eng)}
                                className="p-1.5 rounded hover:bg-blue-50 text-blue-400"
                                title="Modifier"
                              ><Edit2 size={13} /></button>
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteEng(eng.id)}
                                  className="p-1.5 rounded hover:bg-red-50 text-red-400"
                                  title="Supprimer"
                                ><Trash2 size={13} /></button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-border">
                    <td className="py-2.5 px-4 text-xs font-semibold text-text-muted uppercase">Total</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-sm text-right text-primary">{fmtEur(marche.total_engage)}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-sm text-right" style={{ color: '#7C3AED' }}>{fmtEur(marche.total_interventions)}</td>
                    <td className="py-2.5 px-4 text-right">
                      <span className="text-xs font-mono font-semibold text-text-muted">{pctEngageSurAutorise}%</span>
                    </td>
                    {!isReadOnly && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {showEditMarche && (
        <EditMarcheModal
          marche={marche}
          onClose={() => setShowEditMarche(false)}
          onSaved={() => { setShowEditMarche(false); load(); }}
        />
      )}

      {engModal !== null && (
        <EngagementModal
          marcheId={marcheId}
          existing={engModal?.id ? engModal : null}
          onClose={() => setEngModal(null)}
          onSaved={() => { setEngModal(null); load(); }}
        />
      )}
    </AppLayout>
  );
}
