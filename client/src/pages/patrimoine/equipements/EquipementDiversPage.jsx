/**
 * EquipementDiversPage
 * Page de détail d'un équipement divers (borne escamotable, fontaine, etc.)
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Save, X, MapPin, Trash2 } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents } from 'react-leaflet';
import { AppLayout } from '../../../components/layout/AppLayout';
import { InterventionModal } from '../../../components/patrimoine/InterventionModal';
import { TabConsommationsEquipement } from '../energie/TabConsommationsEquipement';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../utils/api';

// ── Constantes ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'borne_escamotable', label: 'Borne escamotable' },
  { value: 'fontaine',          label: 'Fontaine' },
  { value: 'abri_bus',          label: 'Abri bus' },
  { value: 'distributeur',      label: 'Distributeur' },
  { value: 'horloge',           label: 'Horloge' },
  { value: 'panneau_info',      label: "Panneau d'information" },
  { value: 'autre',             label: 'Autre' },
];

const ETATS = [
  { value: 'fonctionnel',  label: 'Fonctionnel',  color: '#1E7E45' },
  { value: 'defaillant',   label: 'Défaillant',   color: '#E8920A' },
  { value: 'hors_service', label: 'Hors service', color: '#C0392B' },
  { value: 'en_travaux',   label: 'En travaux',   color: '#2563EB' },
];

const CATEG_ICONS = {
  borne_escamotable: '🚧',
  fontaine:          '⛲',
  abri_bus:          '🚌',
  distributeur:      '🏧',
  horloge:           '🕐',
  panneau_info:      '📋',
  autre:             '📦',
};

function categLabel(v) { return CATEGORIES.find(c => c.value === v)?.label || v || '—'; }
function etatLabel(v)  { return ETATS.find(e => e.value === v)?.label || v || '—'; }
function etatColor(v)  { return ETATS.find(e => e.value === v)?.color || '#6B7280'; }

function EtatBadge({ etat }) {
  const color = etatColor(etat);
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: color + '22', color }}>
      {etatLabel(etat)}
    </span>
  );
}

// ── Marker déplaçable ─────────────────────────────────────────────────────────
function DraggableMarker({ position, onMove }) {
  useMapEvents({
    click(e) { if (onMove) onMove(e.latlng.lat, e.latlng.lng); },
  });
  if (!position) return null;
  return (
    <CircleMarker center={position} radius={10} pathOptions={{ color: '#7C3AED', fillColor: '#7C3AED', fillOpacity: 0.85 }}>
      <Popup>Position actuelle<br/><small>Cliquez sur la carte pour déplacer</small></Popup>
    </CircleMarker>
  );
}

// ── Modale d'édition ─────────────────────────────────────────────────────────
function EditEquipementModal({ equip, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    intitule:     equip.intitule     || '',
    categorie:    equip.categorie    || 'autre',
    localisation: equip.localisation || '',
    etat_general: equip.etat_general || 'fonctionnel',
    annee_pose:   equip.annee_pose   != null ? String(equip.annee_pose) : '',
    marque:       equip.marque       || '',
    modele:       equip.modele       || '',
    numero_serie: equip.numero_serie || '',
    commentaire:  equip.commentaire  || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/patrimoine/equipements-divers/${equip.id}`, form);
      toast.success('Équipement mis à jour');
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-heading font-semibold text-text-main">Modifier l'équipement</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16}/></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-text-muted mb-1">Intitulé *</label>
              <input type="text" value={form.intitule} onChange={e => set('intitule', e.target.value)}
                className="input w-full" required/>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Catégorie</label>
              <select value={form.categorie} onChange={e => set('categorie', e.target.value)} className="input w-full">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">État général</label>
              <select value={form.etat_general} onChange={e => set('etat_general', e.target.value)} className="input w-full">
                {ETATS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-text-muted mb-1">Localisation</label>
              <input type="text" value={form.localisation} onChange={e => set('localisation', e.target.value)}
                className="input w-full" placeholder="Ex : Rue de la Paix"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Marque</label>
              <input type="text" value={form.marque} onChange={e => set('marque', e.target.value)} className="input w-full"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Modèle</label>
              <input type="text" value={form.modele} onChange={e => set('modele', e.target.value)} className="input w-full"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">N° série</label>
              <input type="text" value={form.numero_serie} onChange={e => set('numero_serie', e.target.value)} className="input w-full"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Année de pose</label>
              <input type="number" value={form.annee_pose} onChange={e => set('annee_pose', e.target.value)}
                className="input w-full" placeholder="Ex : 2019" min="1900" max="2099"/>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-text-muted mb-1">Commentaire</label>
              <textarea value={form.commentaire} onChange={e => set('commentaire', e.target.value)}
                className="input w-full resize-none" rows={2}/>
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

// ── Page principale ───────────────────────────────────────────────────────────
export default function EquipementDiversPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { canEditPatrimoineReferentiel } = useAuth();

  const [equip, setEquip] = useState(null);
  const [interventions, setInterventions] = useState([]);
  const [compteurs, setCompteurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('infos');
  const [showEdit, setShowEdit] = useState(false);
  const [showIntervention, setShowIntervention] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingPosition, setEditingPosition] = useState(false);
  const [mapPos, setMapPos] = useState(null);
  const [savingPos, setSavingPos] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/patrimoine/equipements-divers/${id}`);
      setEquip(data);
      setInterventions(data.interventions || []);
      setCompteurs(data.compteurs || []);
      if (data.latitude && data.longitude) {
        setMapPos([parseFloat(data.latitude), parseFloat(data.longitude)]);
      }
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/patrimoine/equipements-divers/${id}`);
      toast.success('Équipement supprimé');
      navigate('/patrimoine/equipements-divers');
    } catch (err) { toast.error(err.message); setDeleting(false); }
  };

  const handleSavePosition = async () => {
    if (!mapPos) return;
    setSavingPos(true);
    try {
      await api.put(`/patrimoine/equipements-divers/${id}`, { latitude: mapPos[0], longitude: mapPos[1] });
      toast.success('Position enregistrée');
      setEditingPosition(false);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSavingPos(false); }
  };

  if (loading) return (
    <AppLayout breadcrumbs={[{ label: 'Patrimoine' }, { label: 'Équipements divers' }]}>
      <div className="flex items-center justify-center py-24 text-text-muted text-sm gap-2">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
        Chargement…
      </div>
    </AppLayout>
  );

  if (!equip) return (
    <AppLayout breadcrumbs={[{ label: 'Patrimoine' }, { label: 'Équipements divers' }]}>
      <div className="text-center py-24 text-text-muted">Équipement introuvable.</div>
    </AppLayout>
  );

  const mapCenter  = mapPos || [50.32, 3.39];
  const categIcon  = CATEG_ICONS[equip.categorie] || '📦';
  const cptElec    = compteurs.find(c => c.fluide === 'electricite');
  const cptEau     = compteurs.find(c => c.fluide === 'eau');

  const breadcrumbs = [
    { label: 'Gestion Patrimoniale', to: '/patrimoine/equipements-divers' },
    { label: 'Équipements divers',   to: '/patrimoine/equipements-divers' },
    { label: equip.intitule },
  ];

  const TABS = [
    { id: 'infos',         label: 'Informations' },
    { id: 'position',      label: 'Position' },
    { id: 'consommations', label: 'Consommations' },
    { id: 'interventions', label: `Interventions (${interventions.length})` },
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="max-w-4xl mx-auto flex flex-col gap-5">

        {/* En-tête */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button onClick={() => navigate('/patrimoine/equipements-divers')}
              className="mt-0.5 p-1.5 rounded-lg hover:bg-gray-100 text-text-muted transition-colors">
              <ArrowLeft size={18}/>
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{categIcon}</span>
                <h1 className="font-heading font-bold text-text-main text-xl">{equip.intitule}</h1>
                <EtatBadge etat={equip.etat_general}/>
              </div>
              <div className="flex items-center gap-3 text-sm text-text-muted flex-wrap">
                <span>{categLabel(equip.categorie)}</span>
                {equip.localisation && (
                  <><span>·</span><span className="flex items-center gap-0.5"><MapPin size={12}/>{equip.localisation}</span></>
                )}
                {equip.annee_pose && <><span>·</span><span>Posé en {equip.annee_pose}</span></>}
              </div>
              {/* Badges alimentation */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {cptElec ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700">
                    ⚡ Électricité{cptElec.reference_compteur ? ` · ${cptElec.reference_compteur}` : ''}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-100 text-text-muted border border-border">
                    ⚡ Pas d'alimentation élec.
                  </span>
                )}
                {cptEau ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700">
                    💧 Eau{cptEau.reference_compteur ? ` · ${cptEau.reference_compteur}` : ''}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-100 text-text-muted border border-border">
                    💧 Pas de compteur eau
                  </span>
                )}
              </div>
            </div>
          </div>
          {canEditPatrimoineReferentiel && (
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setShowEdit(true)}
                className="btn-secondary text-sm flex items-center gap-1.5">
                <Edit2 size={14}/> Modifier
              </button>
              <button onClick={() => setShowDeleteConfirm(true)}
                className="text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 size={14}/> Supprimer
              </button>
            </div>
          )}
        </div>

        {/* Onglets */}
        <div className="border-b border-border flex gap-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text-main'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenu */}
        {activeTab === 'infos' && (
          <div className="grid grid-cols-2 gap-4">
            <InfoCard label="Catégorie"     value={categLabel(equip.categorie)} />
            <InfoCard label="État général"  value={<EtatBadge etat={equip.etat_general}/>} />
            <InfoCard label="Localisation"  value={equip.localisation} />
            <InfoCard label="Année de pose" value={equip.annee_pose} />
            <InfoCard label="Marque"        value={equip.marque} />
            <InfoCard label="Modèle"        value={equip.modele} />
            <InfoCard label="N° de série"   value={equip.numero_serie} />
            <InfoCard label="GPS"           value={
              equip.latitude && equip.longitude
                ? `${parseFloat(equip.latitude).toFixed(5)}, ${parseFloat(equip.longitude).toFixed(5)}`
                : null
            }/>
            {/* Alimentation électrique */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <div className="text-xs text-yellow-700 font-medium mb-1">⚡ Alimentation électrique</div>
              {cptElec ? (
                <div className="text-sm text-text-main">
                  <span className="font-medium">{cptElec.reference_compteur || 'Référence non renseignée'}</span>
                  {cptElec.fournisseur && <span className="text-text-muted"> · {cptElec.fournisseur}</span>}
                </div>
              ) : (
                <p className="text-sm text-text-muted">—</p>
              )}
            </div>
            {/* Compteur eau */}
            <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3">
              <div className="text-xs text-cyan-700 font-medium mb-1">💧 Compteur d'eau</div>
              {cptEau ? (
                <div className="text-sm text-text-main">
                  <span className="font-medium">{cptEau.reference_compteur || 'Référence non renseignée'}</span>
                  {cptEau.fournisseur && <span className="text-text-muted"> · {cptEau.fournisseur}</span>}
                </div>
              ) : (
                <p className="text-sm text-text-muted">—</p>
              )}
            </div>
            {equip.commentaire && (
              <div className="col-span-2 bg-gray-50 rounded-xl p-4">
                <div className="text-xs font-medium text-text-muted mb-1">Commentaire</div>
                <p className="text-sm text-text-main">{equip.commentaire}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'position' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-muted">
                {editingPosition ? "Cliquez sur la carte pour déplacer l'équipement." : "Visualisation de la position."}
              </p>
              {canEditPatrimoineReferentiel && (
                editingPosition ? (
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingPosition(false); if (equip.latitude) setMapPos([equip.latitude, equip.longitude]); }}
                      className="btn-secondary text-sm">Annuler</button>
                    <button onClick={handleSavePosition} disabled={savingPos}
                      className="btn-primary text-sm flex items-center gap-1.5">
                      <Save size={13}/>{savingPos ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setEditingPosition(true)}
                    className="btn-secondary text-sm flex items-center gap-1.5">
                    <MapPin size={13}/> Positionner
                  </button>
                )
              )}
            </div>
            <div className="rounded-xl overflow-hidden border border-border" style={{ height: 380 }}>
              <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'/>
                <DraggableMarker position={mapPos} onMove={editingPosition ? (lat, lng) => setMapPos([lat, lng]) : null}/>
              </MapContainer>
            </div>
            {mapPos && (
              <p className="text-xs text-text-muted text-center">
                Lat : {mapPos[0].toFixed(6)} · Lng : {mapPos[1].toFixed(6)}
              </p>
            )}
          </div>
        )}

        {activeTab === 'consommations' && (
          <TabConsommationsEquipement equipementId={id} />
        )}

        {activeTab === 'interventions' && (
          <div className="flex flex-col gap-3">
            {canEditPatrimoineReferentiel && (
              <div className="flex justify-end">
                <button onClick={() => setShowIntervention(true)}
                  className="btn-primary text-sm flex items-center gap-1.5">
                  + Signaler une intervention
                </button>
              </div>
            )}
            {interventions.length === 0 ? (
              <div className="text-center py-12 text-text-muted text-sm">Aucune intervention enregistrée.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {interventions.map(iv => (
                  <div key={iv.id} className="border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-text-main">{iv.nature || iv.categorie || '—'}</div>
                        <div className="text-xs text-text-muted mt-0.5">{iv.date_signalement || '—'} · {iv.statut}</div>
                      </div>
                      {iv.montant_ht && (
                        <div className="text-sm font-semibold text-text-main shrink-0">
                          {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(iv.montant_ht)}
                        </div>
                      )}
                    </div>
                    {iv.commentaire && <p className="text-xs text-text-muted mt-2 leading-relaxed">{iv.commentaire}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-600"/>
              </div>
              <div>
                <h3 className="font-heading font-semibold text-text-main">Supprimer l'équipement</h3>
                <p className="text-xs text-text-muted mt-0.5">Cette action est irréversible.</p>
              </div>
            </div>
            <p className="text-sm text-text-main">
              Confirmez-vous la suppression de <span className="font-medium">«&nbsp;{equip.intitule}&nbsp;»</span> ?
              <br/>
              <span className="text-text-muted text-xs">Les compteurs et interventions associés seront également supprimés.</span>
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                className="btn-secondary text-sm">Annuler</button>
              <button onClick={handleDelete} disabled={deleting}
                className="text-sm flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-50">
                <Trash2 size={14}/>{deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showEdit && (
        <EditEquipementModal equip={equip} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); load(); }}/>
      )}
      {showIntervention && (
        <InterventionModal
          open={true}
          theme="equipement_divers"
          elementId={id}
          onClose={() => setShowIntervention(false)}
          onSaved={() => { setShowIntervention(false); load(); }}
        />
      )}
    </AppLayout>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="text-xs text-text-muted mb-0.5">{label}</div>
      <div className="text-sm font-medium text-text-main">
        {value != null && value !== '' ? value : <span className="text-text-muted font-normal">—</span>}
      </div>
    </div>
  );
}
