import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Edit2, X, Save, MapPin, Navigation2, Check } from 'lucide-react';
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
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const ETAT_COLORS = {
  fonctionnel: '#1E7E45',
  defaillant:  '#E8920A',
  hors_service:'#C0392B',
  en_travaux:  '#2563EB',
};
const ETAT_LABELS = {
  fonctionnel: 'Fonctionnel',
  defaillant:  'Défaillant',
  hors_service:'Hors service',
  en_travaux:  'En travaux',
};

const TYPE_FEU_OPTIONS = [
  { value: 'vehicule', label: 'Véhicules' },
  { value: 'pieton',   label: 'Piétons' },
  { value: 'velo',     label: 'Vélos' },
  { value: 'tram',     label: 'Tramway' },
];

const TECHNOLOGIE_OPTIONS = [
  { value: 'led',         label: 'LED' },
  { value: 'incandescent',label: 'Incandescent' },
  { value: 'autre',       label: 'Autre' },
];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function EtatBadge({ etat }) {
  const color = ETAT_COLORS[etat] || '#6B7280';
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: color + '22', color }}>
      {ETAT_LABELS[etat] || etat || '—'}
    </span>
  );
}

function InfoCell({ label, value }) {
  return (
    <div>
      <div className="text-xs text-text-muted mb-0.5">{label}</div>
      <div className="font-mono text-sm font-semibold text-text-main">{value || '—'}</div>
    </div>
  );
}

function MapClickHandler({ active, onMapClick }) {
  useMapEvents({ click(e) { if (active) onMapClick(e.latlng); } });
  return null;
}

// ── Modale édition feu tricolore ──────────────────────────────────────────────
function EditFeuModal({ feu, armoires, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    reference:   feu.reference   || '',
    armoire_id:  feu.armoire_id  || '',
    localisation:feu.localisation|| '',
    type_feu:    feu.type_feu    || 'vehicule',
    nb_feux:     feu.nb_feux     != null ? feu.nb_feux : 3,
    technologie: feu.technologie || 'led',
    annee_pose:  feu.annee_pose  != null ? feu.annee_pose : '',
    etat_general:feu.etat_general|| 'fonctionnel',
    commentaire: feu.commentaire || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/patrimoine/feux/points/${feu.id}`, form);
      toast.success('Feu tricolore mis à jour');
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white z-10">
          <h3 className="font-heading font-semibold text-text-main">Modifier le feu tricolore</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Référence *</label>
              <input type="text" value={form.reference} onChange={e => set('reference', e.target.value)}
                className="input w-full" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">État général</label>
              <select value={form.etat_general} onChange={e => set('etat_general', e.target.value)} className="input w-full">
                {Object.entries(ETAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Armoire dédiée</label>
            <select value={form.armoire_id} onChange={e => set('armoire_id', e.target.value)} className="input w-full">
              <option value="">— Aucune —</option>
              {armoires.map(a => (
                <option key={a.id} value={a.id}>
                  {a.intitule}{a.localisation ? ` (${a.localisation})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Localisation</label>
            <input type="text" value={form.localisation} onChange={e => set('localisation', e.target.value)}
              className="input w-full" placeholder="Ex: Carrefour rue de la Paix / rue Victor Hugo" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Type de feu</label>
              <select value={form.type_feu} onChange={e => set('type_feu', e.target.value)} className="input w-full">
                {TYPE_FEU_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Technologie</label>
              <select value={form.technologie} onChange={e => set('technologie', e.target.value)} className="input w-full">
                {TECHNOLOGIE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Nombre de feux</label>
              <input type="number" min="1" max="10" value={form.nb_feux}
                onChange={e => set('nb_feux', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Année de pose</label>
              <input type="number" min="1950" max="2030" value={form.annee_pose}
                onChange={e => set('annee_pose', e.target.value)} className="input w-full" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Commentaire</label>
            <textarea value={form.commentaire} onChange={e => set('commentaire', e.target.value)}
              className="input w-full" rows={3} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-1.5">
              <Save size={13} />{saving ? 'En cours...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function FeuTricolorePage() {
  const { id } = useParams();
  const toast = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === 'read';

  const [feu, setFeu]                         = useState(null);
  const [armoires, setArmoires]               = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [showEdit, setShowEdit]               = useState(false);
  const [interventionModal, setInterventionModal] = useState(null);

  const [placing, setPlacing]     = useState(false);
  const [tempPos, setTempPos]     = useState(null);
  const [savingPos, setSavingPos] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, arm] = await Promise.all([
        api.get(`/patrimoine/feux/points/${id}`),
        api.get('/patrimoine/feux/armoires'),
      ]);
      setFeu(d);
      setArmoires(arm || []);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleMapClick = (latlng) => {
    if (!placing) return;
    setTempPos({ lat: latlng.lat, lng: latlng.lng });
  };

  const startPlacing = () => {
    setTempPos(feu?.latitude && feu?.longitude ? { lat: feu.latitude, lng: feu.longitude } : null);
    setPlacing(true);
  };

  const cancelPlacing = () => { setPlacing(false); setTempPos(null); };

  const savePosition = async () => {
    if (!tempPos) return;
    setSavingPos(true);
    try {
      await api.put(`/patrimoine/feux/points/${id}`, { latitude: tempPos.lat, longitude: tempPos.lng });
      toast.success('Position enregistrée');
      setPlacing(false);
      setTempPos(null);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSavingPos(false); }
  };

  const removePosition = async () => {
    if (!window.confirm('Supprimer la position géographique de ce feu ?')) return;
    try {
      await api.put(`/patrimoine/feux/points/${id}`, { latitude: null, longitude: null });
      toast.success('Position supprimée');
      load();
    } catch (err) { toast.error(err.message); }
  };

  if (loading) {
    return (
      <AppLayout breadcrumbs={[{ label: 'Feux tricolores', to: '/patrimoine/feux' }, { label: '…' }]}>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!feu) return null;

  const etatColor    = ETAT_COLORS[feu.etat_general] || '#6B7280';
  const interventions = feu.interventions || [];

  const markerPos = (placing && tempPos)
    ? [tempPos.lat, tempPos.lng]
    : (feu.latitude && feu.longitude ? [feu.latitude, feu.longitude] : null);
  const mapCenter = markerPos || [50.32, 3.39];
  const mapZoom   = markerPos ? 17 : 13;

  const breadcrumbs = [
    { label: 'Feux tricolores', to: '/patrimoine/feux' },
    { label: feu.reference },
  ];

  const typeFeuLabel = TYPE_FEU_OPTIONS.find(o => o.value === feu.type_feu)?.label || feu.type_feu;
  const techLabel    = TECHNOLOGIE_OPTIONS.find(o => o.value === feu.technologie)?.label || feu.technologie;

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="max-w-5xl mx-auto flex flex-col gap-4">

        {/* En-tête */}
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <EtatBadge etat={feu.etat_general} />
                {feu.technologie === 'led' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">LED</span>
                )}
              </div>
              <h1 className="font-heading font-bold text-xl text-text-main mb-1">{feu.reference}</h1>

              {feu.armoires_feux && (
                <div className="text-sm text-text-muted mb-2">
                  Armoire : <span className="font-medium text-text-main">{feu.armoires_feux.intitule}</span>
                  {feu.armoires_feux.localisation && ` — ${feu.armoires_feux.localisation}`}
                </div>
              )}
              {feu.localisation && (
                <div className="flex items-center gap-1.5 text-xs text-text-muted mb-3">
                  <MapPin size={12} />{feu.localisation}
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-border">
                <h4 className="text-xs text-text-muted uppercase tracking-wide font-semibold mb-3">Données techniques</h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <InfoCell label="Type de feu"   value={typeFeuLabel} />
                  <InfoCell label="Technologie"   value={techLabel} />
                  <InfoCell label="Nombre de feux" value={feu.nb_feux} />
                  <InfoCell label="Année de pose" value={feu.annee_pose} />
                  {feu.commentaire && (
                    <div className="col-span-2 lg:col-span-4">
                      <div className="text-xs text-text-muted mb-0.5">Commentaire</div>
                      <div className="text-sm text-text-main">{feu.commentaire}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {!isReadOnly && (
              <button onClick={() => setShowEdit(true)}
                className="btn-secondary text-xs flex items-center gap-1.5 shrink-0">
                <Edit2 size={13} /> Modifier
              </button>
            )}
          </div>
        </div>

        {/* Carte positionnement */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-border bg-gray-50/60">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-primary" />
              <span className="text-sm font-semibold text-text-main">Position géographique</span>
              {feu.latitude && feu.longitude && !placing && (
                <span className="text-xs font-mono text-text-muted">
                  {feu.latitude.toFixed(6)}, {feu.longitude.toFixed(6)}
                </span>
              )}
            </div>
            {!isReadOnly && (
              <div className="flex items-center gap-2">
                {!placing ? (
                  <>
                    <button onClick={startPlacing} className="btn-primary text-xs flex items-center gap-1.5">
                      <Navigation2 size={13} />
                      {feu.latitude && feu.longitude ? 'Déplacer' : 'Positionner'}
                    </button>
                    {feu.latitude && feu.longitude && (
                      <button onClick={removePosition}
                        className="btn-secondary text-xs text-red-500 hover:bg-red-50" title="Supprimer la position">
                        <X size={13} />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-xs text-amber-600 font-medium">
                      {tempPos ? 'Cliquez pour ajuster' : 'Cliquez sur la carte pour placer le feu'}
                    </span>
                    <button onClick={cancelPlacing} className="btn-secondary text-xs flex items-center gap-1">
                      <X size={12} /> Annuler
                    </button>
                    <button onClick={savePosition} disabled={!tempPos || savingPos}
                      className="btn-primary text-xs flex items-center gap-1.5">
                      <Check size={12} />{savingPos ? 'En cours...' : 'Valider'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <div style={{ cursor: placing ? 'crosshair' : 'default' }}>
            <MapContainer key={`map-${id}`} center={mapCenter} zoom={mapZoom}
              style={{ height: 320, width: '100%' }} zoomControl={true}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors' />
              <MapClickHandler active={placing} onMapClick={handleMapClick} />
              {markerPos && (
                <CircleMarker center={markerPos} radius={10}
                  fillColor={placing ? '#F59E0B' : etatColor}
                  color="#fff" weight={3} fillOpacity={0.9}>
                  <Popup>
                    <strong>{feu.reference}</strong>
                    {feu.localisation && <><br />{feu.localisation}</>}
                    <br /><EtatBadge etat={feu.etat_general} />
                    {placing && tempPos && <><br /><span className="text-xs text-amber-600">En cours de modification</span></>}
                  </Popup>
                </CircleMarker>
              )}
            </MapContainer>
          </div>
          {!feu.latitude && !feu.longitude && !placing && (
            <div className="p-3 text-center text-sm text-text-muted border-t border-border bg-amber-50/40">
              Aucune position. Cliquez sur "Positionner" pour placer ce feu sur la carte.
            </div>
          )}
        </div>

        {/* Interventions */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-heading font-semibold text-sm text-text-main">
              Interventions ({interventions.length})
            </h3>
            {!isReadOnly && (
              <button onClick={() => setInterventionModal({})}
                className="btn-primary text-xs flex items-center gap-1.5">
                <Plus size={13} /> Nouvelle intervention
              </button>
            )}
          </div>
          <InterventionList
            interventions={interventions}
            onRefresh={load}
            onEdit={(iv) => setInterventionModal(iv)}
            siteLabel={feu?.reference || ''}
          />
        </div>

      </div>

      {showEdit && (
        <EditFeuModal
          feu={feu}
          armoires={armoires}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load(); }}
        />
      )}

      {interventionModal !== null && (
        <InterventionModal
          open={true}
          onClose={() => setInterventionModal(null)}
          onSaved={() => { setInterventionModal(null); load(); }}
          theme="feux"
          elementId={id}
          typeElement={feu.reference}
          intervention={interventionModal?.id ? interventionModal : undefined}
        />
      )}
    </AppLayout>
  );
}
