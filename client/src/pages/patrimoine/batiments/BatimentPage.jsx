import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Edit2, Trash2, AlertTriangle, Clock, FileText, X, MapPin, Zap,
         Folder, FolderPlus, Upload, Download, Home, ChevronRight, File } from 'lucide-react';
import { TabConsommationsBatiment } from '../energie/TabConsommationsBatiment';
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { AppLayout } from '../../../components/layout/AppLayout';
import { Skeleton } from '../../../components/ui/Skeleton';
import { InterventionModal } from '../../../components/patrimoine/InterventionModal';
import { InterventionList } from '../../../components/patrimoine/InterventionList';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../utils/api';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Capture les clics sur la carte pour positionner le bâtiment
function MapClickHandler({ active, onMapClick }) {
  useMapEvents({ click: (e) => { if (active) onMapClick(e.latlng); } });
  return null;
}

// ── Liste standardisée d'équipements ─────────────────────────────────────────
const EQUIPEMENTS_STANDARD = [
  { intitule: 'Structure / Gros œuvre',         categorie: 'Structure' },
  { intitule: 'Façades / Ravalement',           categorie: 'Enveloppe' },
  { intitule: 'Menuiseries extérieures',        categorie: 'Enveloppe' },
  { intitule: 'Couverture / Toiture',           categorie: 'Enveloppe' },
  { intitule: 'Étanchéité',                     categorie: 'Enveloppe' },
  { intitule: 'Menuiseries intérieures',        categorie: 'Aménagement intérieur' },
  { intitule: 'Sols / Revêtements',             categorie: 'Aménagement intérieur' },
  { intitule: 'Plafonds / Cloisons',            categorie: 'Aménagement intérieur' },
  { intitule: 'Plomberie / Sanitaires',         categorie: 'Fluides' },
  { intitule: 'Chauffage',                      categorie: 'Fluides' },
  { intitule: 'Eau chaude sanitaire (ECS)',     categorie: 'Fluides' },
  { intitule: 'Électricité / Courants forts',   categorie: 'Fluides' },
  { intitule: 'Courants faibles / GTB',         categorie: 'Fluides' },
  { intitule: 'Ventilation / Climatisation',    categorie: 'Fluides' },
  { intitule: 'Ascenseur / Élévateur',          categorie: 'Équipements techniques' },
  { intitule: 'Portes automatiques',            categorie: 'Équipements techniques' },
  { intitule: 'Sécurité incendie (SSI)',        categorie: 'Sécurité' },
  { intitule: 'Contrôle d\'accès',             categorie: 'Sécurité' },
  { intitule: 'Accessibilité PMR',              categorie: 'Accessibilité' },
  { intitule: 'Espaces extérieurs / VRD',       categorie: 'Abords' },
  { intitule: 'Parkings / Voiries internes',    categorie: 'Abords' },
];


const DPE_COLORS = { A: '#1E7E45', B: '#3BAA5A', C: '#A3C93B', D: '#E8920A', E: '#D4680A', F: '#C0392B', G: '#7B0000' };

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function controleDays(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr + 'T00:00:00') - new Date()) / 86400000);
}

function ControleStatus({ date }) {
  const days = controleDays(date);
  if (days === null) return <span className="text-text-muted text-xs">—</span>;
  if (days < 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: '#C0392B' }}>
      <AlertTriangle size={11} /> Échu ({Math.abs(days)}j)
    </span>
  );
  if (days <= 90) return (
    <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: '#E8920A' }}>
      <Clock size={11} /> Dans {days}j
    </span>
  );
  if (days <= 365) return (
    <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: '#2563EB' }}>
      <Clock size={11} /> Dans {days}j
    </span>
  );
  return <span className="text-xs text-text-muted">Dans {Math.round(days / 30)}m</span>;
}

// ── Modale édition bâtiment ───────────────────────────────────────────────────
const DPE_OPTIONS = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];

function EditBatimentModal({ batiment, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    intitule:           batiment.intitule           || '',
    adresse:            batiment.adresse            || '',
    surface_plancher_m2: batiment.surface_plancher_m2 || '',
    annee_construction: batiment.annee_construction || '',
    dpe_classe:         batiment.dpe_classe         || '',
    commentaire:        batiment.commentaire        || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/patrimoine/batiments/${batiment.id}`, {
        ...form,
        surface_plancher_m2: form.surface_plancher_m2 !== '' ? parseFloat(form.surface_plancher_m2) : null,
        annee_construction:  form.annee_construction  !== '' ? parseInt(form.annee_construction)    : null,
        dpe_classe:          form.dpe_classe || null,
      });
      toast.success('Bâtiment mis à jour');
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-heading font-semibold text-text-main">Modifier le bâtiment</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Intitulé *</label>
            <input type="text" value={form.intitule} onChange={e => set('intitule', e.target.value)}
              className="input w-full" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Adresse</label>
            <input type="text" value={form.adresse} onChange={e => set('adresse', e.target.value)}
              className="input w-full" placeholder="1 rue de la Mairie…" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Surface (m²)</label>
              <input type="number" min="0" step="1" value={form.surface_plancher_m2}
                onChange={e => set('surface_plancher_m2', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Année construction</label>
              <input type="number" min="1800" max="2100" value={form.annee_construction}
                onChange={e => set('annee_construction', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">DPE</label>
              <select value={form.dpe_classe} onChange={e => set('dpe_classe', e.target.value)} className="input w-full">
                {DPE_OPTIONS.map(v => (
                  <option key={v} value={v}>{v || '— Non renseigné —'}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Commentaire</label>
            <textarea value={form.commentaire} onChange={e => set('commentaire', e.target.value)}
              className="input w-full resize-none" rows={2} />
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

// ── Modale création/édition équipement ────────────────────────────────────────
function EquipementModal({ batimentId, equipement, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = !!equipement?.id;
  const [form, setForm] = useState({
    intitule: equipement?.intitule || '',
    categorie: equipement?.categorie || '',
    marque: equipement?.marque || '',
    modele: equipement?.modele || '',
    date_installation: equipement?.date_installation || '',
    date_prochain_controle: equipement?.date_prochain_controle || '',
    periodicite_controle_mois: equipement?.periodicite_controle_mois || '',
    commentaire: equipement?.commentaire || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Sélection d'un équipement standard → pré-remplit intitule + catégorie
  const handlePreset = (e) => {
    const val = e.target.value;
    if (!val) return;
    const preset = EQUIPEMENTS_STANDARD.find(p => p.intitule === val);
    if (preset) setForm(f => ({ ...f, intitule: preset.intitule, categorie: preset.categorie }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        periodicite_controle_mois: form.periodicite_controle_mois ? parseInt(form.periodicite_controle_mois) : null,
      };
      if (isEdit) {
        await api.put(`/patrimoine/equipements/${equipement.id}`, payload);
        toast.success('Équipement mis à jour');
      } else {
        await api.post(`/patrimoine/batiments/${batimentId}/equipements`, payload);
        toast.success('Équipement créé');
      }
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  // Grouper les presets par catégorie pour l'optgroup
  const presetGroups = EQUIPEMENTS_STANDARD.reduce((acc, p) => {
    if (!acc[p.categorie]) acc[p.categorie] = [];
    acc[p.categorie].push(p.intitule);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-heading font-semibold text-text-main">
            {isEdit ? 'Modifier l\'équipement' : '+ Nouvel équipement'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">

          {/* Sélecteur de preset standard (création uniquement) */}
          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Équipement standard</label>
              <select onChange={handlePreset} defaultValue="" className="input w-full">
                <option value="">— Choisir dans la liste standard —</option>
                {Object.entries(presetGroups).map(([cat, noms]) => (
                  <optgroup key={cat} label={cat}>
                    {noms.map(nom => (
                      <option key={nom} value={nom}>{nom}</option>
                    ))}
                  </optgroup>
                ))}
                <option value="__custom__">— Équipement personnalisé —</option>
              </select>
              <p className="text-xs text-text-muted mt-1">Sélectionnez un équipement standard ou saisissez un nom personnalisé ci-dessous.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-text-muted mb-1">Intitulé *</label>
              <input type="text" value={form.intitule} onChange={e => set('intitule', e.target.value)} className="input w-full" required
                placeholder="Ex : Chaudière gaz, Toiture terrasse…" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Catégorie</label>
              <input type="text" value={form.categorie} onChange={e => set('categorie', e.target.value)} className="input w-full"
                placeholder="Fluides, Structure…" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Marque / Fabricant</label>
              <input type="text" value={form.marque} onChange={e => set('marque', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Modèle / Référence</label>
              <input type="text" value={form.modele} onChange={e => set('modele', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Date installation</label>
              <input type="date" value={form.date_installation} onChange={e => set('date_installation', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Prochain contrôle</label>
              <input type="date" value={form.date_prochain_controle} onChange={e => set('date_prochain_controle', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Périodicité (mois)</label>
              <input type="number" min="1" value={form.periodicite_controle_mois} onChange={e => set('periodicite_controle_mois', e.target.value)} className="input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Commentaire / État</label>
            <textarea value={form.commentaire} onChange={e => set('commentaire', e.target.value)} className="input w-full resize-none" rows={2}
              placeholder="État général, observations…" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? '…' : isEdit ? 'Enregistrer' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Onglet Équipements ────────────────────────────────────────────────────────
function TabEquipements({ batimentId, equipements, onRefresh }) {
  const toast = useToast();
  const { isReadOnly, isAdmin } = useAuth();
  const [equipementModal, setEquipementModal] = useState(null);
  const [initializing, setInitializing] = useState(false);

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cet équipement ?')) return;
    try {
      await api.delete(`/patrimoine/equipements/${id}`);
      toast.success('Équipement supprimé');
      onRefresh();
    } catch (err) { toast.error(err.message); }
  };

  // Initialiser la liste standard : crée les équipements manquants
  const handleInitStandard = async () => {
    const existingIntitules = new Set(equipements.map(e => e.intitule));
    const manquants = EQUIPEMENTS_STANDARD.filter(p => !existingIntitules.has(p.intitule));
    if (manquants.length === 0) {
      toast.success('Tous les équipements standard sont déjà présents.');
      return;
    }
    if (!window.confirm(`Créer ${manquants.length} équipement(s) standard manquant(s) ?\n\n${manquants.map(p => `• ${p.intitule}`).join('\n')}`)) return;
    setInitializing(true);
    try {
      for (const preset of manquants) {
        await api.post(`/patrimoine/batiments/${batimentId}/equipements`, {
          intitule: preset.intitule,
          categorie: preset.categorie,
          marque: '',
          modele: '',
          date_installation: null,
          date_prochain_controle: null,
          periodicite_controle_mois: null,
          commentaire: '',
        });
      }
      toast.success(`${manquants.length} équipement(s) créé(s).`);
      onRefresh();
    } catch (err) { toast.error(err.message); }
    finally { setInitializing(false); }
  };

  // Grouper par catégorie (ordre de EQUIPEMENTS_STANDARD en priorité)
  const standardOrder = [...new Set(EQUIPEMENTS_STANDARD.map(p => p.categorie))];
  const grouped = equipements.reduce((acc, eq) => {
    const cat = eq.categorie || 'Autres';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(eq);
    return acc;
  }, {});
  // Trier : catégories standards d'abord, puis les autres par ordre alpha
  const sortedCats = [
    ...standardOrder.filter(c => grouped[c]),
    ...Object.keys(grouped).filter(c => !standardOrder.includes(c)).sort(),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm text-text-muted">
          {equipements.length} équipement{equipements.length !== 1 ? 's' : ''} enregistré{equipements.length !== 1 ? 's' : ''}
        </div>
        {!isReadOnly && (
          <div className="flex gap-2">
            <button
              onClick={handleInitStandard}
              disabled={initializing}
              className="btn-secondary text-xs flex items-center gap-1.5"
              title="Crée automatiquement les équipements standard manquants pour ce bâtiment"
            >
              {initializing ? '…' : '⚙ Initialiser la liste standard'}
            </button>
            <button onClick={() => setEquipementModal({})} className="btn-primary text-xs flex items-center gap-1.5">
              <Plus size={13} /> Ajouter un équipement
            </button>
          </div>
        )}
      </div>

      {equipements.length === 0 && (
        <div className="card p-8 text-center text-text-muted text-sm">Aucun équipement enregistré.</div>
      )}

      {sortedCats.map(categorie => {
        const eqs = grouped[categorie];
        return (
          <div key={categorie} className="card overflow-hidden">
            <div className="p-3 border-b border-border bg-gray-50">
              <h4 className="font-heading font-semibold text-sm text-text-main">{categorie}</h4>
            </div>
            <div className="divide-y divide-border">
              {eqs.map(eq => {
                const days = controleDays(eq.date_prochain_controle);
                const borderColor = days !== null && days < 0 ? '#C0392B' : days !== null && days <= 90 ? '#E8920A' : 'transparent';
                return (
                  <div key={eq.id} className="p-4 flex items-start justify-between gap-3 hover:bg-gray-50"
                    style={{ borderLeft: `3px solid ${borderColor}` }}>
                    <div className="flex-1">
                      <div className="font-medium text-sm text-text-main">{eq.intitule}</div>
                      {eq.marque && <div className="text-xs text-text-muted mt-0.5">{eq.marque}{eq.modele ? ` — ${eq.modele}` : ''}</div>}
                      <div className="flex gap-4 mt-2 flex-wrap">
                        {eq.date_installation && (
                          <div className="text-xs text-text-muted">Installation : {fmtDate(eq.date_installation)}</div>
                        )}
                        <div className="text-xs text-text-muted flex items-center gap-1">
                          Prochain contrôle : <ControleStatus date={eq.date_prochain_controle} />
                        </div>
                      </div>
                      {eq.commentaire && <div className="text-xs text-text-muted italic mt-1">{eq.commentaire}</div>}
                    </div>
                    {!isReadOnly && (
                      <div className="flex gap-1">
                        <button onClick={() => setEquipementModal(eq)} className="p-1.5 rounded hover:bg-blue-50 text-blue-400">
                          <Edit2 size={13} />
                        </button>
                        {isAdmin && (
                          <button onClick={() => handleDelete(eq.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {equipementModal !== null && (
        <EquipementModal
          batimentId={batimentId}
          equipement={equipementModal?.id ? equipementModal : undefined}
          onClose={() => setEquipementModal(null)}
          onSaved={() => { setEquipementModal(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ── Onglet Interventions ──────────────────────────────────────────────────────
function TabInterventions({ batimentId, batimentNom, equipements }) {
  const toast = useToast();
  const { isReadOnly } = useAuth();
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [interventionModal, setInterventionModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get(`/patrimoine/interventions?theme=batiment&element_id=${batimentId}`);
      setInterventions(d || []);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [batimentId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        {!isReadOnly && (
          <button onClick={() => setInterventionModal({})} className="btn-primary text-xs flex items-center gap-1.5">
            <Plus size={13} /> Nouvelle intervention
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <InterventionList
          interventions={interventions}
          onRefresh={load}
          onEdit={(iv) => setInterventionModal(iv)}
        />
      </div>

      {interventionModal !== null && (
        <InterventionModal
          open={true}
          onClose={() => setInterventionModal(null)}
          onSaved={() => { setInterventionModal(null); load(); }}
          theme="batiment"
          elementId={batimentId}
          typeElement={batimentNom}
          intervention={interventionModal?.id ? interventionModal : undefined}
        />
      )}
    </div>
  );
}

// ── Modale création/édition contrôle réglementaire ───────────────────────────
const TYPES_CONTROLE_PRESETS = [
  'Vérification électrique périodique',
  'Contrôle installation gaz',
  'Vérification ascenseur / élévateur',
  'Contrôle SSI (Système Sécurité Incendie)',
  'Vérification extincteurs',
  'Contrôle portes coupe-feu',
  'Diagnostic amiante',
  'Diagnostic plomb',
  'Contrôle accessibilité PMR',
  'Vérification toiture / étanchéité',
  'Contrôle chaufferie',
  'Vérification climatisation / CTA',
  'Contrôle groupe électrogène',
];

const STATUT_CONTROLE = {
  a_planifier: { label: 'À planifier', bg: '#F3F4F6', color: '#374151' },
  planifie:    { label: 'Planifié',    bg: '#DBEAFE', color: '#1D4ED8' },
  realise:     { label: 'Réalisé',     bg: '#D1FAE5', color: '#065F46' },
};

function ControleModal({ batimentId, controle, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = !!controle?.id;
  const [form, setForm] = useState({
    type_controle:          controle?.type_controle          || '',
    organisme:              controle?.organisme              || '',
    periodicite_mois:       controle?.periodicite_mois       || '',
    date_dernier_controle:  controle?.date_dernier_controle  || '',
    date_prochain_controle: controle?.date_prochain_controle || '',
    statut:                 controle?.statut                 || 'a_planifier',
    commentaire:            controle?.commentaire            || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-calcul date prochain contrôle depuis dernier + périodicité
  const autoCompute = () => {
    const { date_dernier_controle: dl, periodicite_mois: pm } = form;
    if (!dl || !pm) return;
    const d = new Date(dl + 'T00:00:00');
    d.setMonth(d.getMonth() + parseInt(pm));
    set('date_prochain_controle', d.toISOString().split('T')[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        periodicite_mois: form.periodicite_mois ? parseInt(form.periodicite_mois) : null,
      };
      if (isEdit) {
        await api.put(`/patrimoine/controles-batiment/${controle.id}`, payload);
        toast.success('Contrôle mis à jour');
      } else {
        await api.post(`/patrimoine/batiments/${batimentId}/controles`, payload);
        toast.success('Contrôle créé');
      }
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <h3 className="font-heading font-semibold text-text-main">
            {isEdit ? 'Modifier le contrôle' : 'Nouveau contrôle réglementaire'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3 overflow-y-auto">
          {/* Sélection rapide par type */}
          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Sélection rapide</label>
              <select
                className="input w-full"
                defaultValue=""
                onChange={e => { if (e.target.value) set('type_controle', e.target.value); }}
              >
                <option value="">— Choisir un type de contrôle —</option>
                {TYPES_CONTROLE_PRESETS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Type de contrôle *</label>
            <input type="text" value={form.type_controle}
              onChange={e => set('type_controle', e.target.value)}
              className="input w-full" required placeholder="Vérification électrique périodique…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Organisme</label>
              <input type="text" value={form.organisme}
                onChange={e => set('organisme', e.target.value)}
                className="input w-full" placeholder="Bureau Veritas, Apave…" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Périodicité (mois)</label>
              <input type="number" min="1" max="120" value={form.periodicite_mois}
                onChange={e => set('periodicite_mois', e.target.value)}
                className="input w-full" placeholder="12, 24, 36…" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Dernier contrôle</label>
              <input type="date" value={form.date_dernier_controle}
                onChange={e => set('date_dernier_controle', e.target.value)}
                className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Prochain contrôle
                {form.date_dernier_controle && form.periodicite_mois && (
                  <button type="button" onClick={autoCompute}
                    className="ml-2 text-blue-500 hover:underline text-xs font-normal">
                    Auto-calculer
                  </button>
                )}
              </label>
              <input type="date" value={form.date_prochain_controle}
                onChange={e => set('date_prochain_controle', e.target.value)}
                className="input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Statut</label>
            <select value={form.statut} onChange={e => set('statut', e.target.value)} className="input w-full">
              {Object.entries(STATUT_CONTROLE).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Commentaire</label>
            <textarea value={form.commentaire} onChange={e => set('commentaire', e.target.value)}
              className="input w-full resize-none" rows={2} />
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

// ── Onglet Contrôles réglementaires ──────────────────────────────────────────
function TabControles({ batimentId }) {
  const toast = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === 'read';
  const isAdmin    = user?.role === 'admin';

  const [controles, setControles] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null); // null | 'new' | {controle object}

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/patrimoine/batiments/${batimentId}/controles`);
      setControles(data || []);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [batimentId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (c) => {
    if (!window.confirm(`Supprimer « ${c.type_controle} » ?\nCette action est irréversible.`)) return;
    try {
      await api.delete(`/patrimoine/controles-batiment/${c.id}`);
      toast.success('Contrôle supprimé');
      load();
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return <Skeleton className="h-32 rounded-xl" />;

  return (
    <div className="flex flex-col gap-3">
      {!isReadOnly && (
        <div className="flex justify-end">
          <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={14} /> Ajouter un contrôle
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        {controles.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm">
            Aucun contrôle réglementaire enregistré pour ce bâtiment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-gray-50">
                  <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Type de contrôle</th>
                  <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Organisme</th>
                  <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Dernier contrôle</th>
                  <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Prochain contrôle</th>
                  <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Échéance</th>
                  <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Périodicité</th>
                  <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Statut</th>
                  {!isReadOnly && <th className="py-2 px-2 w-20" />}
                </tr>
              </thead>
              <tbody>
                {controles.map((c, i) => {
                  const cfg = STATUT_CONTROLE[c.statut] || STATUT_CONTROLE.a_planifier;
                  return (
                    <tr key={c.id}
                      className={`border-b border-border hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                      <td className="py-2.5 px-3 text-sm font-medium text-text-main max-w-xs truncate" title={c.type_controle}>
                        {c.type_controle}
                      </td>
                      <td className="py-2.5 px-3 text-sm text-text-muted">{c.organisme || '—'}</td>
                      <td className="py-2.5 px-3 text-xs font-mono text-text-muted whitespace-nowrap">
                        {fmtDate(c.date_dernier_controle)}
                      </td>
                      <td className="py-2.5 px-3 text-xs font-mono text-text-muted whitespace-nowrap">
                        {fmtDate(c.date_prochain_controle)}
                      </td>
                      <td className="py-2.5 px-3">
                        <ControleStatus date={c.date_prochain_controle} />
                      </td>
                      <td className="py-2.5 px-3 text-sm text-text-muted">
                        {c.periodicite_mois ? `${c.periodicite_mois} mois` : '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                          {cfg.label}
                        </span>
                      </td>
                      {!isReadOnly && (
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => setModal(c)}
                              className="p-1.5 rounded hover:bg-blue-50 text-blue-400 transition-colors" title="Modifier">
                              <Edit2 size={13} />
                            </button>
                            {isAdmin && (
                              <button onClick={() => handleDelete(c)}
                                className="p-1.5 rounded hover:bg-red-50 text-red-400 transition-colors" title="Supprimer">
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <ControleModal
          batimentId={batimentId}
          controle={modal === 'new' ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

// ── Onglet Documents ──────────────────────────────────────────────────────────
function TabDocuments({ batimentId }) {
  const toast = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === 'read';

  const [data, setData]           = useState({ folders: [], documents: [], breadcrumb: [] });
  const [currentFolder, setCurrentFolder] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging]   = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = currentFolder ? `?repertoire_id=${currentFolder}` : '';
      const d = await api.get(`/patrimoine/batiments/${batimentId}/docs${params}`);
      setData(d);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [batimentId, currentFolder]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (files) => {
    if (!files?.length || uploading) return;
    setUploading(true);
    let ok = 0, errors = 0;
    for (const file of files) {
      try {
        const token = localStorage.getItem('opera_token');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('nom_affichage', file.name);
        if (currentFolder) formData.append('repertoire_id', currentFolder);
        const res = await fetch(`/api/v1/patrimoine/batiments/${batimentId}/docs`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const json = await res.json();
        if (json.success) ok++; else errors++;
      } catch { errors++; }
    }
    setUploading(false);
    if (errors === 0) toast.success(`${ok} fichier${ok > 1 ? 's' : ''} déposé${ok > 1 ? 's' : ''}`);
    else toast.error(`${errors} erreur${errors > 1 ? 's' : ''} lors du dépôt`);
    load();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (!isReadOnly) handleUpload([...e.dataTransfer.files]);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      await api.post(`/patrimoine/batiments/${batimentId}/repertoires`, {
        nom: newFolderName.trim(),
        parent_id: currentFolder,
      });
      toast.success('Dossier créé');
      setShowNewFolder(false);
      setNewFolderName('');
      load();
    } catch (err) { toast.error(err.message); }
    finally { setCreatingFolder(false); }
  };

  const handleDeleteFolder = async (repId, e) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer ce dossier et tous les fichiers qu\'il contient ?')) return;
    try {
      await api.delete(`/patrimoine/batiments/${batimentId}/repertoires/${repId}`);
      toast.success('Dossier supprimé');
      load();
    } catch (err) { toast.error(err.message); }
  };

  const handleDeleteDoc = async (docId) => {
    if (!window.confirm('Supprimer ce document définitivement ?')) return;
    try {
      await api.delete(`/patrimoine/batiments/${batimentId}/docs/${docId}`);
      toast.success('Document supprimé');
      load();
    } catch (err) { toast.error(err.message); }
  };

  const handleDownload = async (docId, nom) => {
    try {
      const token = localStorage.getItem('opera_token');
      const res = await fetch(`/api/v1/patrimoine/batiments/${batimentId}/docs/${docId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erreur téléchargement');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nom; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast.error(err.message); }
  };

  const fmtSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const FileIcon = ({ mime }) => {
    if (!mime) return <File size={16} className="text-text-muted" />;
    if (mime.startsWith('image/')) return <File size={16} style={{ color: '#059669' }} />;
    if (mime === 'application/pdf') return <FileText size={16} style={{ color: '#DC2626' }} />;
    if (mime.includes('word') || mime.includes('document')) return <FileText size={16} style={{ color: '#2563EB' }} />;
    if (mime.includes('sheet') || mime.includes('excel')) return <FileText size={16} style={{ color: '#16A34A' }} />;
    if (mime.includes('presentation') || mime.includes('powerpoint')) return <FileText size={16} style={{ color: '#EA580C' }} />;
    return <File size={16} className="text-text-muted" />;
  };

  const isEmpty = data.folders.length === 0 && data.documents.length === 0;

  return (
    <div className="flex flex-col gap-3">

      {/* Barre d'outils */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Fil d'Ariane */}
        <nav className="flex items-center gap-1 text-sm text-text-muted min-w-0 flex-1">
          <button
            onClick={() => setCurrentFolder(null)}
            className={`flex items-center gap-1 hover:text-primary transition-colors ${!currentFolder ? 'text-primary font-medium' : ''}`}
          >
            <Home size={13} /> Racine
          </button>
          {data.breadcrumb.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1 min-w-0">
              <ChevronRight size={12} className="shrink-0" />
              <button
                onClick={() => setCurrentFolder(crumb.id)}
                className={`truncate hover:text-primary transition-colors ${i === data.breadcrumb.length - 1 ? 'text-text-main font-medium' : ''}`}
              >
                {crumb.nom}
              </button>
            </span>
          ))}
        </nav>

        {/* Actions */}
        {!isReadOnly && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setShowNewFolder(true); setNewFolderName(''); }}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <FolderPlus size={13} /> Nouveau dossier
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <Upload size={13} />
              {uploading ? 'Dépôt en cours…' : 'Déposer des fichiers'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={e => { handleUpload([...e.target.files]); e.target.value = ''; }}
            />
          </div>
        )}
      </div>

      {/* Zone de dépôt */}
      <div
        className={`card rounded-xl border-2 border-dashed transition-colors ${
          dragging ? 'border-primary bg-blue-50' : 'border-border'
        } ${isReadOnly ? '' : 'cursor-pointer'}`}
        onDragOver={e => { e.preventDefault(); if (!isReadOnly) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => { if (!isReadOnly && isEmpty && !uploading) fileInputRef.current?.click(); }}
      >
        {loading ? (
          <div className="p-6 text-center text-text-muted text-sm">Chargement…</div>
        ) : isEmpty ? (
          <div className="p-10 text-center">
            <Upload size={28} className="mx-auto mb-2 text-text-muted opacity-40" />
            <p className="text-sm text-text-muted">
              {isReadOnly ? 'Aucun document dans ce dossier.' : 'Glissez-déposez vos fichiers ici, ou cliquez sur « Déposer des fichiers »'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Dossiers */}
            {data.folders.map(folder => (
              <div
                key={folder.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer group"
                onClick={() => setCurrentFolder(folder.id)}
              >
                <Folder size={18} style={{ color: '#E8920A' }} className="shrink-0" />
                <span className="flex-1 text-sm font-medium text-text-main">{folder.nom}</span>
                <span className="text-xs text-text-muted">{fmtDate(folder.created_at)}</span>
                {!isReadOnly && (
                  <button
                    onClick={(e) => handleDeleteFolder(folder.id, e)}
                    className="p-1.5 rounded hover:bg-red-50 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Supprimer le dossier"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
            {/* Fichiers */}
            {data.documents.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group">
                <FileIcon mime={doc.type_mime} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-main truncate">{doc.nom_affichage}</div>
                  {doc.description && <div className="text-xs text-text-muted truncate">{doc.description}</div>}
                </div>
                <span className="text-xs text-text-muted shrink-0">{fmtSize(doc.taille_octets)}</span>
                <span className="text-xs text-text-muted shrink-0 hidden sm:block">{fmtDate(doc.created_at)}</span>
                <button
                  onClick={() => handleDownload(doc.id, doc.nom_affichage)}
                  className="p-1.5 rounded hover:bg-blue-50 text-blue-400 shrink-0"
                  title="Télécharger"
                >
                  <Download size={13} />
                </button>
                {!isReadOnly && (
                  <button
                    onClick={() => handleDeleteDoc(doc.id)}
                    className="p-1.5 rounded hover:bg-red-50 text-red-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Supprimer"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modale nouveau dossier */}
      {showNewFolder && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h3 className="font-heading font-semibold text-text-main mb-3">Nouveau dossier</h3>
            <input
              type="text"
              className="input w-full mb-4"
              placeholder="Nom du dossier"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNewFolder(false)} className="btn-secondary">Annuler</button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || creatingFolder}
                className="btn-primary flex items-center gap-1.5"
              >
                <FolderPlus size={13} />
                {creatingFolder ? 'Création…' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
const TABS_BAT = [
  { id: 'equipements',  label: 'Équipements' },
  { id: 'interventions',label: 'Interventions' },
  { id: 'controles',    label: 'Contrôles réglementaires' },
  { id: 'consommations',label: '⚡ Consommations' },
  { id: 'documents',    label: 'Documents' },
];

export default function BatimentPage() {
  const { id } = useParams();
  const toast = useToast();
  const { isReadOnly } = useAuth();
  const [batiment, setBatiment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('equipements');
  const [editModal, setEditModal] = useState(false);
  // Positionnement carte
  const [placing, setPlacing] = useState(false);
  const [tempPos, setTempPos] = useState(null);
  const [savingPos, setSavingPos] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get(`/patrimoine/batiments/${id}`);
      setBatiment(d);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSavePosition = async () => {
    if (!tempPos) return;
    setSavingPos(true);
    try {
      await api.put(`/patrimoine/batiments/${id}`, { latitude: tempPos.lat, longitude: tempPos.lng });
      toast.success('Position enregistrée');
      setPlacing(false);
      setTempPos(null);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSavingPos(false); }
  };

  if (loading) {
    return (
      <AppLayout breadcrumbs={[{ label: 'Bâtiments', to: '/patrimoine/batiments' }, { label: '…' }]}>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!batiment) return null;

  const breadcrumbs = [
    { label: 'Bâtiments', to: '/patrimoine/batiments' },
    { label: batiment.intitule },
  ];

  const equipements = batiment.equipements || [];
  const today = new Date().toISOString().split('T')[0];
  const in90d = new Date(); in90d.setDate(in90d.getDate() + 90);
  const in90d_str = in90d.toISOString().split('T')[0];

  const controlesEchus = equipements.filter(e => e.date_prochain_controle && e.date_prochain_controle < today).length;
  const controlesBientot = equipements.filter(e =>
    e.date_prochain_controle && e.date_prochain_controle >= today && e.date_prochain_controle <= in90d_str
  ).length;

  // Carte : centre sur la position actuelle ou temp, ou France par défaut
  const markerPos = tempPos
    ? [tempPos.lat, tempPos.lng]
    : batiment.latitude && batiment.longitude
      ? [batiment.latitude, batiment.longitude]
      : null;
  const mapCenter = markerPos || [50.3247, 3.3953]; // Denain
  const mapZoom   = markerPos ? 15 : 13;

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="max-w-5xl mx-auto flex flex-col gap-4">
        {/* En-tête */}
        <div className="card p-5">
          <div className="flex flex-col lg:flex-row gap-5">

            {/* ── Infos bâtiment ── */}
            <div className="flex-1">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {batiment.dpe_classe && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-sm font-bold"
                      style={{ backgroundColor: (DPE_COLORS[batiment.dpe_classe] || '#6B7280') + '22', color: DPE_COLORS[batiment.dpe_classe] || '#6B7280' }}>
                      DPE {batiment.dpe_classe}
                    </span>
                  )}
                </div>
                {!isReadOnly && (
                  <button onClick={() => setEditModal(true)}
                    className="p-1.5 rounded hover:bg-blue-50 text-blue-400 shrink-0" title="Modifier">
                    <Edit2 size={15} />
                  </button>
                )}
              </div>

              <h1 className="font-heading font-bold text-xl text-text-main mb-3">{batiment.intitule}</h1>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-text-muted mb-0.5">Adresse</div>
                  <div className="text-sm text-text-main">{batiment.adresse || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-0.5">Surface plancher</div>
                  <div className="font-mono text-sm font-semibold text-text-main">
                    {batiment.surface_plancher_m2 ? `${batiment.surface_plancher_m2} m²` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-0.5">Année construction</div>
                  <div className="font-mono text-sm font-semibold text-text-main">{batiment.annee_construction || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-0.5">Équipements</div>
                  <div className="font-mono text-sm font-semibold text-text-main">{equipements.length}</div>
                </div>
              </div>

              {batiment.commentaire && (
                <p className="mt-3 text-sm text-text-muted italic">{batiment.commentaire}</p>
              )}

              {/* Alertes contrôles */}
              {(controlesEchus > 0 || controlesBientot > 0) && (
                <div className="mt-3 flex gap-2 flex-wrap">
                  {controlesEchus > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
                      <AlertTriangle size={11} /> {controlesEchus} contrôle{controlesEchus > 1 ? 's' : ''} échu{controlesEchus > 1 ? 's' : ''}
                    </span>
                  )}
                  {controlesBientot > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                      <Clock size={11} /> {controlesBientot} contrôle{controlesBientot > 1 ? 's' : ''} dans les 90j
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* ── Carte positionnement ── */}
            <div className="lg:w-72 flex flex-col gap-2">
              {!isReadOnly && (
                <div className="flex gap-2">
                  {!placing ? (
                    <button
                      onClick={() => { setPlacing(true); setTempPos(null); }}
                      className="btn-secondary text-xs flex items-center gap-1.5 w-full justify-center"
                    >
                      <MapPin size={12} />
                      {batiment.latitude ? 'Déplacer sur la carte' : 'Positionner sur la carte'}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleSavePosition}
                        disabled={!tempPos || savingPos}
                        className="btn-primary text-xs flex-1"
                      >
                        {savingPos ? '…' : 'Valider la position'}
                      </button>
                      <button
                        onClick={() => { setPlacing(false); setTempPos(null); }}
                        className="btn-secondary text-xs px-2"
                      >
                        Annuler
                      </button>
                    </>
                  )}
                </div>
              )}
              {placing && (
                <p className="text-xs text-text-muted text-center">
                  Cliquez sur la carte pour placer le bâtiment
                </p>
              )}
              <div className="rounded-lg overflow-hidden border border-border" style={{ height: 240 }}>
                <MapContainer
                  key={`${mapCenter[0]}-${mapCenter[1]}-${mapZoom}`}
                  center={mapCenter}
                  zoom={mapZoom}
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={true}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapClickHandler active={placing} onMapClick={(latlng) => setTempPos({ lat: latlng.lat, lng: latlng.lng })} />
                  {markerPos && (
                    <CircleMarker
                      center={markerPos}
                      radius={10}
                      fillColor={tempPos ? '#F59E0B' : '#0D9488'}
                      color="#fff"
                      weight={2}
                      fillOpacity={0.9}
                    >
                      <Popup>{batiment.intitule}</Popup>
                    </CircleMarker>
                  )}
                </MapContainer>
              </div>
              {batiment.latitude && !placing && (
                <p className="text-xs text-text-muted text-center font-mono">
                  {batiment.latitude.toFixed(5)}, {batiment.longitude.toFixed(5)}
                </p>
              )}
            </div>

          </div>
        </div>

        {/* Onglets */}
        <div className="border-b border-border flex gap-0 overflow-x-auto">
          {TABS_BAT.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text-main'
              }`}
            >
              {t.label}
              {t.id === 'controles' && controlesEchus > 0 && (
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
                  {controlesEchus}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Contenu */}
        {tab === 'equipements' && (
          <TabEquipements batimentId={id} equipements={equipements} onRefresh={load} />
        )}
        {tab === 'interventions' && (
          <TabInterventions batimentId={id} batimentNom={batiment.intitule} equipements={equipements} />
        )}
        {tab === 'controles' && (
          <TabControles batimentId={id} />
        )}
        {tab === 'consommations' && (
          <TabConsommationsBatiment batimentId={id} />
        )}
        {tab === 'documents' && (
          <TabDocuments batimentId={id} />
        )}
      </div>

      {/* Modale édition bâtiment */}
      {editModal && (
        <EditBatimentModal
          batiment={batiment}
          onClose={() => setEditModal(false)}
          onSaved={() => { setEditModal(false); load(); }}
        />
      )}
    </AppLayout>
  );
}
