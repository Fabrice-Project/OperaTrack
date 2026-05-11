import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Edit2, Zap, MapPin, Save, X, Navigation2, Check } from 'lucide-react';
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
  defaillant:  'Defaillant',
  hors_service:'Hors service',
  en_travaux:  'En travaux',
};

const TYPE_LAMPE_OPTIONS = [
  { value: '',             label: '— Non renseigne —' },
  { value: 'led',          label: 'LED' },
  { value: 'sodium_hp',    label: 'Sodium haute pression (SHP)' },
  { value: 'fluocompacte', label: 'Fluocompacte' },
  { value: 'mercure',      label: 'Mercure haute pression' },
  { value: 'autre',        label: 'Autre' },
];


function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function EtatBadge({ etat }) {
  const color = ETAT_COLORS[etat] || '#6B7280';
  const label = ETAT_LABELS[etat] || etat || '—';
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: color + '22', color }}>
      {label}
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

// ── Composant gestion des clics carte ────────────────────────────────────────
function MapClickHandler({ active, onMapClick }) {
  useMapEvents({
    click(e) {
      if (active) onMapClick(e.latlng);
    },
  });
  return null;
}

// ── Modale edition point lumineux ─────────────────────────────────────────────
function EditPLModal({ pl, armoires, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    reference:      pl.reference      || '',
    armoire_id:     pl.armoire_id     || '',
    localisation:   pl.localisation   || '',
    type_support:   pl.type_support   || '',
    hauteur_m:      pl.hauteur_m      != null ? pl.hauteur_m : '',
    type_lampe:     pl.type_lampe     || '',
    puissance_w:    pl.puissance_w    != null ? pl.puissance_w : '',
    annee_pose:     pl.annee_pose     != null ? pl.annee_pose : '',
    etat_general:   pl.etat_general   || 'fonctionnel',
    commentaire:    pl.commentaire    || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/patrimoine/eclairage/points/${pl.id}`, form);
      toast.success('Point lumineux mis a jour');
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white z-10">
          <h3 className="font-heading font-semibold text-text-main">Modifier le point lumineux</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Reference *</label>
              <input type="text" value={form.reference} onChange={e => set('reference', e.target.value)}
                className="input w-full" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Etat general</label>
              <select value={form.etat_general} onChange={e => set('etat_general', e.target.value)} className="input w-full">
                {Object.entries(ETAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Armoire</label>
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
            <label className="block text-xs font-medium text-text-muted mb-1">Localisation / Adresse</label>
            <input type="text" value={form.localisation} onChange={e => set('localisation', e.target.value)}
              className="input w-full" placeholder="Ex: Rue de la Paix, face au n 12" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Type de lampe</label>
              <select value={form.type_lampe} onChange={e => set('type_lampe', e.target.value)} className="input w-full">
                {TYPE_LAMPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Puissance (W)</label>
              <input type="number" min="0" value={form.puissance_w}
                onChange={e => set('puissance_w', e.target.value)} className="input w-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Type de support</label>
              <input type="text" value={form.type_support} onChange={e => set('type_support', e.target.value)}
                className="input w-full" placeholder="Mat, Console, ..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Hauteur mat (m)</label>
              <input type="number" min="0" step="0.1" value={form.hauteur_m}
                onChange={e => set('hauteur_m', e.target.value)} className="input w-full" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Annee de pose</label>
            <input type="number" min="1950" max="2030" value={form.annee_pose}
              onChange={e => set('annee_pose', e.target.value)} className="input w-full" />
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
export default function PointLumineuxPage() {
  const { id } = useParams();
  const toast = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === 'read';

  const [pl, setPl]                     = useState(null);
  const [armoires, setArmoires]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showEdit, setShowEdit]         = useState(false);
  const [interventionModal, setInterventionModal] = useState(null);

  // Carte / positionnement
  const [placing, setPlacing]       = useState(false);   // mode placement actif
  const [tempPos, setTempPos]       = useState(null);    // position temporaire pendant placement
  const [savingPos, setSavingPos]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, arm] = await Promise.all([
        api.get(`/patrimoine/eclairage/points/${id}`),
        api.get('/patrimoine/eclairage/armoires'),
      ]);
      setPl(d);
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
    setTempPos(pl?.latitude && pl?.longitude ? { lat: pl.latitude, lng: pl.longitude } : null);
    setPlacing(true);
  };

  const cancelPlacing = () => {
    setPlacing(false);
    setTempPos(null);
  };

  const savePosition = async () => {
    if (!tempPos) return;
    setSavingPos(true);
    try {
      await api.put(`/patrimoine/eclairage/points/${id}`, {
        latitude:  tempPos.lat,
        longitude: tempPos.lng,
      });
      toast.success('Position enregistree');
      setPlacing(false);
      setTempPos(null);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSavingPos(false); }
  };

  const removePosition = async () => {
    if (!window.confirm('Supprimer la position geographique de ce point lumineux ?')) return;
    try {
      await api.put(`/patrimoine/eclairage/points/${id}`, { latitude: null, longitude: null });
      toast.success('Position supprimee');
      load();
    } catch (err) { toast.error(err.message); }
  };

  if (loading) {
    return (
      <AppLayout breadcrumbs={[{ label: 'Eclairage public', to: '/patrimoine/eclairage' }, { label: '…' }]}>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!pl) return null;

  const breadcrumbs = [
    { label: 'Eclairage public', to: '/patrimoine/eclairage' },
    { label: pl.reference },
  ];

  const etatColor  = ETAT_COLORS[pl.etat_general] || '#6B7280';
  const interventions = pl.interventions || [];

  // Centre carte : position confirmee > temp > commune
  const activePos = placing && tempPos
    ? [tempPos.lat, tempPos.lng]
    : pl.latitude && pl.longitude
      ? [pl.latitude, pl.longitude]
      : null;
  const mapCenter = activePos || [50.32, 3.39];
  const mapZoom   = activePos ? 17 : 13;

  // Marqueur affiché sur la carte
  const markerPos = placing && tempPos
    ? [tempPos.lat, tempPos.lng]
    : pl.latitude && pl.longitude
      ? [pl.latitude, pl.longitude]
      : null;

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="max-w-5xl mx-auto flex flex-col gap-4">

        {/* En-tete */}
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Zap size={16} className="text-yellow-500" />
                <EtatBadge etat={pl.etat_general} />
                {pl.type_lampe === 'led' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">LED</span>
                )}
              </div>
              <h1 className="font-heading font-bold text-xl text-text-main mb-1">{pl.reference}</h1>
              {pl.armoires_eclairage && (
                <div className="text-sm text-text-muted mb-3">
                  Armoire : <span className="font-medium text-text-main">{pl.armoires_eclairage.intitule}</span>
                  {pl.armoires_eclairage.localisation && ` — ${pl.armoires_eclairage.localisation}`}
                </div>
              )}
              {pl.localisation && (
                <div className="flex items-center gap-1.5 text-xs text-text-muted mb-3">
                  <MapPin size={12} />
                  {pl.localisation}
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-border">
                <h4 className="text-xs text-text-muted uppercase tracking-wide font-semibold mb-3">Donnees techniques</h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <InfoCell label="Type de lampe"
                    value={TYPE_LAMPE_OPTIONS.find(o => o.value === pl.type_lampe)?.label || pl.type_lampe} />
                  <InfoCell label="Puissance"    value={pl.puissance_w  ? `${pl.puissance_w} W`  : null} />
                  <InfoCell label="Hauteur mat"  value={pl.hauteur_m    ? `${pl.hauteur_m} m`    : null} />
                  <InfoCell label="Annee pose"   value={pl.annee_pose} />
                  <InfoCell label="Type support" value={pl.type_support} />
                  <InfoCell label="Commentaire"  value={pl.commentaire} />
                </div>
              </div>
            </div>

            {!isReadOnly && (
              <button
                onClick={() => setShowEdit(true)}
                className="btn-secondary text-xs flex items-center gap-1.5 shrink-0"
              >
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
              <span className="text-sm font-semibold text-text-main">Position geographique</span>
              {pl.latitude && pl.longitude && !placing && (
                <span className="text-xs font-mono text-text-muted">
                  {pl.latitude.toFixed(6)}, {pl.longitude.toFixed(6)}
                </span>
              )}
            </div>

            {!isReadOnly && (
              <div className="flex items-center gap-2">
                {!placing ? (
                  <>
                    <button
                      onClick={startPlacing}
                      className="btn-primary text-xs flex items-center gap-1.5"
                    >
                      <Navigation2 size={13} />
                      {pl.latitude && pl.longitude ? 'Deplacer' : 'Positionner'}
                    </button>
                    {pl.latitude && pl.longitude && (
                      <button
                        onClick={removePosition}
                        className="btn-secondary text-xs text-red-500 hover:bg-red-50"
                        title="Supprimer la position"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-xs text-amber-600 font-medium">
                      {tempPos ? 'Cliquez pour ajuster' : 'Cliquez sur la carte pour placer le point'}
                    </span>
                    <button onClick={cancelPlacing} className="btn-secondary text-xs flex items-center gap-1">
                      <X size={12} /> Annuler
                    </button>
                    <button
                      onClick={savePosition}
                      disabled={!tempPos || savingPos}
                      className="btn-primary text-xs flex items-center gap-1.5"
                    >
                      <Check size={12} />
                      {savingPos ? 'En cours...' : 'Valider'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div style={{ cursor: placing ? 'crosshair' : 'default' }}>
            <MapContainer
              key={`map-${id}`}
              center={mapCenter}
              zoom={mapZoom}
              style={{ height: 380, width: '100%' }}
              zoomControl={true}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              <MapClickHandler active={placing} onMapClick={handleMapClick} />

              {/* Marqueur position actuelle ou temporaire */}
              {markerPos && (
                <CircleMarker
                  center={markerPos}
                  radius={12}
                  fillColor={placing ? '#F59E0B' : etatColor}
                  color="#fff"
                  weight={3}
                  fillOpacity={0.9}
                >
                  <Popup>
                    <strong>{pl.reference}</strong>
                    {placing && tempPos && (
                      <>
                        <br />
                        <span className="text-xs text-amber-600">Position en cours de modification</span>
                      </>
                    )}
                    <br />
                    <EtatBadge etat={pl.etat_general} />
                  </Popup>
                </CircleMarker>
              )}
            </MapContainer>
          </div>

          {!pl.latitude && !pl.longitude && !placing && (
            <div className="p-3 text-center text-sm text-text-muted border-t border-border bg-amber-50/40">
              Aucune position geographique. Cliquez sur "Positionner" pour placer ce point sur la carte.
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
              <button
                onClick={() => setInterventionModal({})}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <Plus size={13} /> Nouvelle intervention
              </button>
            )}
          </div>

          <InterventionList
            interventions={interventions}
            onRefresh={load}
            onEdit={(iv) => setInterventionModal(iv)}
            siteLabel={pl?.reference || ''}
          />
        </div>
      </div>

      {/* Modale edition */}
      {showEdit && (
        <EditPLModal
          pl={pl}
          armoires={armoires}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load(); }}
        />
      )}

      {/* Modale intervention */}
      {interventionModal !== null && (
        <InterventionModal
          open={true}
          onClose={() => setInterventionModal(null)}
          onSaved={() => { setInterventionModal(null); load(); }}
          theme="eclairage"
          elementId={id}
          typeElement={pl.reference}
          intervention={interventionModal?.id ? interventionModal : undefined}
        />
      )}
    </AppLayout>
  );
}
