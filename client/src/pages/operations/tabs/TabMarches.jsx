import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, Download, AlertTriangle, Hammer, PenTool, Shield, Package } from 'lucide-react';
import { useMarches } from '../../../hooks/useFinances';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { Skeleton } from '../../../components/ui/Skeleton';
import { api } from '../../../utils/api';
import { formatEur, formatDate } from '../../../utils/formatters';

const TYPE_MARCHE = {
  travaux: { label: 'Travaux', icon: Hammer, bg: '#DBEAFE', text: '#1E40AF' },
  maitrise_oeuvre: { label: 'Maîtrise d\'œuvre', icon: PenTool, bg: '#FEF3C7', text: '#92400E' },
  controle: { label: 'Contrôle', icon: Shield, bg: '#D1FAE5', text: '#065F46' },
  autre: { label: 'Autre', icon: Package, bg: '#F3F4F6', text: '#374151' }
};

const OS_CONFIG = {
  demarrage:    { label: 'Démarrage',    bg: '#D1FAE5', text: '#065F46' },
  arret:        { label: 'Arrêt',        bg: '#FEE2E2', text: '#991B1B' },
  reprise:      { label: 'Reprise',      bg: '#DBEAFE', text: '#1D4ED8' },
  modification: { label: 'Modification', bg: '#FEF3C7', text: '#B45309' },
  autre:        { label: 'Autre',        bg: '#F3F4F6', text: '#374151' }
};

const PROC_LABELS = {
  mapa: 'MAPA',
  appel_offres_ouvert: 'Appel d\'offres ouvert',
  appel_offres_restreint: 'Appel d\'offres restreint',
  marche_negocie: 'Marché négocié',
  accord_cadre: 'Accord-cadre'
};

export function TabMarches({ operationId }) {
  const { marches, loading, refresh } = useMarches(operationId);
  const { isReadOnly } = useAuth();
  const toast = useToast();
  const [expanded, setExpanded] = useState({});
  const [showNewMarche, setShowNewMarche] = useState(false);
  const [showAvenant, setShowAvenant] = useState(null);
  const [showOS, setShowOS] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  if (loading) return <div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>;

  const totalMarches = marches.reduce((s, m) => s + parseFloat(m.montant_actuel_ht || 0), 0);
  const nbActifs = marches.filter(m => m.statut === 'en_cours').length;

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const handleDeleteMarche = async () => {
    try {
      await api.delete(`/marches/${deleteTarget.id}`);
      toast.success('Marché supprimé');
      setDeleteTarget(null);
      refresh();
    } catch (err) { toast.error(err.message); }
  };

  const handleDeleteAvenant = async (avenantId) => {
    try {
      await api.delete(`/avenants/${avenantId}`);
      toast.success('Avenant supprimé');
      refresh();
    } catch (err) { toast.error(err.message); }
  };

  const handleDeleteOS = async (osId) => {
    try {
      await api.delete(`/os/${osId}`);
      toast.success('Ordre de service supprimé');
      refresh();
    } catch (err) { toast.error(err.message); }
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('opera_token');
      const res = await fetch(`/api/v1/operations/${operationId}/exports/marches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) { toast.error('Erreur lors de l\'export'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `suivi-marches-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Tuiles synthèse */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-xs text-text-muted mb-1">Marchés actifs</div>
          <div className="font-heading font-bold text-2xl text-primary">{nbActifs}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-text-muted mb-1">Montant total marchés</div>
          <div className="font-mono font-bold text-xl text-text-main">{formatEur(totalMarches)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-text-muted mb-1">Total marchés</div>
          <div className="font-heading font-bold text-2xl text-text-main">{marches.length}</div>
        </div>
      </div>

      {/* En-tête actions */}
      <div className="flex justify-end gap-2">
        <button className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1" onClick={handleExport}>
          <Download size={13} /> Exporter marchés
        </button>
        {!isReadOnly && (
          <button className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1" onClick={() => setShowNewMarche(true)}>
            <Plus size={13} /> Nouveau marché
          </button>
        )}
      </div>

      {/* Liste des marchés */}
      {marches.length === 0 ? (
        <div className="card p-8 text-center text-text-muted">Aucun marché enregistré pour cette opération.</div>
      ) : marches.map(marche => {
        const cfg = TYPE_MARCHE[marche.type] || TYPE_MARCHE.autre;
        const Icon = cfg.icon;
        const isOpen = expanded[marche.id];

        return (
          <div key={marche.id} className="card overflow-hidden">
            {/* Alerte échéance */}
            {marche.alerte_echeance && (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200">
                <AlertTriangle size={14} className="text-accent" />
                <span className="text-xs font-medium text-accent">
                  Ce marché arrive à échéance dans {marche.jours_avant_echeance} jour(s) ({formatDate(marche.date_fin_prev)})
                </span>
              </div>
            )}

            {/* En-tête card */}
            <div className="p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: cfg.bg }}>
                  <Icon size={16} style={{ color: cfg.text }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="badge" style={{ backgroundColor: cfg.bg, color: cfg.text }}>{cfg.label}</span>
                    <span className="text-xs text-text-muted font-mono">{marche.numero}</span>
                    <StatutBadgeMarche statut={marche.statut} />
                  </div>
                  <div className="font-heading font-semibold text-text-main text-sm">{marche.intitule}</div>
                  {marche.titulaire_nom && <div className="text-xs text-text-muted mt-0.5">{marche.titulaire_nom}</div>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-text-muted flex-wrap">
                    <span className="font-mono font-semibold text-text-main">{formatEur(marche.montant_initial_ht)}</span>
                    {marche.total_avenants !== 0 && (
                      <span className="font-mono" style={{ color: marche.total_avenants > 0 ? '#1E7E45' : '#C0392B' }}>
                        {marche.total_avenants > 0 ? '+' : ''}{formatEur(marche.total_avenants)} avenants
                      </span>
                    )}
                    <span className="font-mono font-bold text-secondary">= {formatEur(marche.montant_actuel_ht)}</span>
                    {marche.date_notification && <span>Notifié le {formatDate(marche.date_notification)}</span>}
                    {marche.date_fin_prev && <span>· Fin prévue {formatDate(marche.date_fin_prev)}</span>}
                  </div>
                </div>
              </div>
              <button
                onClick={() => toggleExpand(marche.id)}
                className="flex items-center gap-1.5 text-xs text-text-muted hover:text-primary transition-colors shrink-0 mt-1"
              >
                {isOpen ? <><ChevronUp size={14} /> Réduire</> : <><ChevronDown size={14} /> Voir détail</>}
              </button>
            </div>

            {/* Détail expandé */}
            {isOpen && (
              <div className="border-t border-border bg-gray-50/50 p-4 flex flex-col gap-5">
                {/* Informations marché */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <InfoItem label="Procédure" value={PROC_LABELS[marche.procedure] || '—'} />
                  <InfoItem label="SIRET titulaire" value={marche.titulaire_siret || '—'} mono />
                  <InfoItem label="Délai d'exécution" value={marche.delai_execution ? `${marche.delai_execution} jours` : '—'} />
                  <InfoItem label="Date notification" value={formatDate(marche.date_notification)} />
                  <InfoItem label="Fin prévue" value={formatDate(marche.date_fin_prev)} />
                  <InfoItem label="Fin réelle" value={formatDate(marche.date_fin_reelle)} />
                </div>

                {!isReadOnly && (
                  <div className="flex gap-2">
                    <button onClick={() => setDeleteTarget(marche)} className="btn-danger text-xs px-3 py-1.5 flex items-center gap-1">
                      <Trash2 size={12} /> Supprimer le marché
                    </button>
                  </div>
                )}

                {/* Avenants */}
                <SectionAvenants
                  marche={marche}
                  isReadOnly={isReadOnly}
                  onAdd={() => setShowAvenant(marche.id)}
                  onDelete={handleDeleteAvenant}
                />

                {/* Ordres de service */}
                <SectionOS
                  marche={marche}
                  isReadOnly={isReadOnly}
                  onAdd={() => setShowOS(marche.id)}
                  onDelete={handleDeleteOS}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Modales */}
      {showNewMarche && <MarcheModal operationId={operationId} onClose={() => setShowNewMarche(false)} onSaved={refresh} />}
      {showAvenant && <AvenantModal marcheId={showAvenant} onClose={() => setShowAvenant(null)} onSaved={refresh} />}
      {showOS && <OSModal marcheId={showOS} onClose={() => setShowOS(null)} onSaved={refresh} />}
      <ConfirmModal
        open={!!deleteTarget}
        title="Supprimer le marché"
        message={`Supprimer le marché "${deleteTarget?.numero} — ${deleteTarget?.intitule}" ? Ses avenants et OS seront également supprimés.`}
        onConfirm={handleDeleteMarche}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function StatutBadgeMarche({ statut }) {
  const cfg = {
    en_cours: { label: 'En cours', bg: '#D1FAE5', text: '#065F46' },
    termine: { label: 'Terminé', bg: '#EDE9FE', text: '#5B21B6' },
    resilie: { label: 'Résilié', bg: '#FEE2E2', text: '#991B1B' },
    suspendu: { label: 'Suspendu', bg: '#FEF3C7', text: '#B45309' }
  }[statut] || { label: statut, bg: '#F3F4F6', text: '#374151' };
  return <span className="badge" style={{ backgroundColor: cfg.bg, color: cfg.text }}>{cfg.label}</span>;
}

function InfoItem({ label, value, mono }) {
  return (
    <div>
      <div className="text-text-muted mb-0.5 uppercase tracking-wide" style={{ fontSize: 10 }}>{label}</div>
      <div className={`text-text-main font-medium text-xs ${mono ? 'font-mono' : ''}`}>{value || '—'}</div>
    </div>
  );
}

function SectionAvenants({ marche, isReadOnly, onAdd, onDelete }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide">Avenants ({(marche.avenants || []).length})</h4>
        {!isReadOnly && (
          <button onClick={onAdd} className="text-xs text-secondary hover:underline flex items-center gap-1">
            <Plus size={12} /> Avenant
          </button>
        )}
      </div>
      {(marche.avenants || []).length === 0 ? (
        <p className="text-xs text-text-muted italic">Aucun avenant.</p>
      ) : (
        <table className="w-full text-xs border border-border rounded overflow-hidden">
          <thead><tr className="bg-gray-100">
            {['N°', 'Objet', 'Montant HT', 'Date', ''].map(h => <th key={h} className="text-left px-3 py-2 text-text-muted font-medium">{h}</th>)}
          </tr></thead>
          <tbody>
            {marche.avenants.map(av => (
              <tr key={av.id} className="border-t border-border">
                <td className="px-3 py-2 font-semibold">N°{av.numero}</td>
                <td className="px-3 py-2">{av.objet}</td>
                <td className={`px-3 py-2 font-mono font-semibold ${parseFloat(av.montant_ht) >= 0 ? 'text-success' : 'text-danger'}`}>
                  {parseFloat(av.montant_ht) >= 0 ? '+' : ''}{formatEur(av.montant_ht)}
                </td>
                <td className="px-3 py-2 font-mono">{formatDate(av.date_avenant)}</td>
                <td className="px-3 py-2 text-right">
                  {!isReadOnly && <button onClick={() => onDelete(av.id)} className="text-text-muted hover:text-danger transition-colors"><Trash2 size={12} /></button>}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-border bg-gray-50 font-semibold">
              <td className="px-3 py-2" colSpan={2}>Total avenants</td>
              <td className="px-3 py-2 font-mono">{formatEur(marche.total_avenants)}</td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

function SectionOS({ marche, isReadOnly, onAdd, onDelete }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide">Ordres de service ({(marche.ordres_de_service || []).length})</h4>
        {!isReadOnly && (
          <button onClick={onAdd} className="text-xs text-secondary hover:underline flex items-center gap-1">
            <Plus size={12} /> Ordre de service
          </button>
        )}
      </div>
      {(marche.ordres_de_service || []).length === 0 ? (
        <p className="text-xs text-text-muted italic">Aucun ordre de service.</p>
      ) : (
        <table className="w-full text-xs border border-border rounded overflow-hidden">
          <thead><tr className="bg-gray-100">
            {['N°', 'Type', 'Date', 'Objet', ''].map(h => <th key={h} className="text-left px-3 py-2 text-text-muted font-medium">{h}</th>)}
          </tr></thead>
          <tbody>
            {marche.ordres_de_service.map(os => {
              const cfg = OS_CONFIG[os.type] || OS_CONFIG.autre;
              return (
                <tr key={os.id} className="border-t border-border">
                  <td className="px-3 py-2 font-semibold">OS {os.numero}</td>
                  <td className="px-3 py-2">
                    <span className="badge" style={{ backgroundColor: cfg.bg, color: cfg.text }}>{cfg.label}</span>
                  </td>
                  <td className="px-3 py-2 font-mono">{formatDate(os.date_os)}</td>
                  <td className="px-3 py-2 text-text-muted">{os.objet || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {!isReadOnly && <button onClick={() => onDelete(os.id)} className="text-text-muted hover:text-danger transition-colors"><Trash2 size={12} /></button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function MarcheModal({ operationId, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ numero: '', intitule: '', type: 'travaux', procedure: 'appel_offres_ouvert', titulaire_nom: '', titulaire_siret: '', montant_initial_ht: '', date_notification: '', delai_execution: '', statut: 'en_cours' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/operations/${operationId}/marches`, form);
      toast.success('Marché créé avec succès');
      onSaved();
      onClose();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-heading font-semibold text-text-main text-base mb-4">Nouveau marché</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">N° de marché *</label>
              <input className="form-input font-mono" value={form.numero} onChange={e => set('numero', e.target.value)} required placeholder="2025-001" />
            </div>
            <div>
              <label className="form-label">Type *</label>
              <select className="form-select" value={form.type} onChange={e => set('type', e.target.value)}>
                {Object.entries(TYPE_MARCHE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Intitulé *</label>
            <input className="form-input" value={form.intitule} onChange={e => set('intitule', e.target.value)} required placeholder="Ex. : Travaux de construction — lot unique" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Procédure</label>
              <select className="form-select" value={form.procedure} onChange={e => set('procedure', e.target.value)}>
                {Object.entries(PROC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Statut</label>
              <select className="form-select" value={form.statut} onChange={e => set('statut', e.target.value)}>
                <option value="en_cours">En cours</option>
                <option value="termine">Terminé</option>
                <option value="resilie">Résilié</option>
                <option value="suspendu">Suspendu</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Titulaire</label>
              <input className="form-input" value={form.titulaire_nom} onChange={e => set('titulaire_nom', e.target.value)} placeholder="Nom de l'entreprise" />
            </div>
            <div>
              <label className="form-label">SIRET</label>
              <input className="form-input font-mono" value={form.titulaire_siret} onChange={e => set('titulaire_siret', e.target.value)} placeholder="14 chiffres" maxLength={14} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="form-label">Montant initial HT (€) *</label>
              <input type="number" className="form-input font-mono" value={form.montant_initial_ht} onChange={e => set('montant_initial_ht', e.target.value)} required min="0" step="0.01" />
            </div>
            <div>
              <label className="form-label">Date notification</label>
              <input type="date" className="form-input" value={form.date_notification} onChange={e => set('date_notification', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Délai exécution (jours)</label>
              <input type="number" className="form-input" value={form.delai_execution} onChange={e => set('delai_execution', e.target.value)} min="0" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Créer le marché'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AvenantModal({ marcheId, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ objet: '', montant_ht: '', date_avenant: new Date().toISOString().split('T')[0], commentaire: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/marches/${marcheId}/avenants`, form);
      toast.success('Avenant ajouté avec succès');
      onSaved();
      onClose();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="card p-6 w-full max-w-md">
        <h3 className="font-heading font-semibold text-text-main text-base mb-4">Ajouter un avenant</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="form-label">Objet *</label>
            <input className="form-input" value={form.objet} onChange={e => setForm(p => ({ ...p, objet: e.target.value }))} required placeholder="Ex. : Modification réseau électrique" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Montant HT (€) *</label>
              <input type="number" className="form-input font-mono" value={form.montant_ht} onChange={e => setForm(p => ({ ...p, montant_ht: e.target.value }))} required step="0.01" placeholder="Positif ou négatif" />
            </div>
            <div>
              <label className="form-label">Date *</label>
              <input type="date" className="form-input" value={form.date_avenant} onChange={e => setForm(p => ({ ...p, date_avenant: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className="form-label">Commentaire</label>
            <textarea className="form-textarea" rows={2} value={form.commentaire} onChange={e => setForm(p => ({ ...p, commentaire: e.target.value }))} />
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

function OSModal({ marcheId, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ type: 'demarrage', date_os: new Date().toISOString().split('T')[0], objet: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/marches/${marcheId}/os`, form);
      toast.success('Ordre de service créé');
      onSaved();
      onClose();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="card p-6 w-full max-w-md">
        <h3 className="font-heading font-semibold text-text-main text-base mb-4">Nouvel ordre de service</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Type *</label>
              <select className="form-select" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                {Object.entries(OS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Date *</label>
              <input type="date" className="form-input" value={form.date_os} onChange={e => setForm(p => ({ ...p, date_os: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className="form-label">Objet</label>
            <textarea className="form-textarea" rows={2} value={form.objet} onChange={e => setForm(p => ({ ...p, objet: e.target.value }))} placeholder="Description de l'ordre de service…" />
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Créer l\'OS'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
