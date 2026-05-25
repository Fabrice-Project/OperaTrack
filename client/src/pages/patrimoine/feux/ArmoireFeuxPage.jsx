import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Edit2, X, Save, MapPin, Navigation2, Check, TrafficCone } from 'lucide-react';
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

function EtatBadge({ etat }) {
  const color = ETAT_COLORS[etat] || '#6B7280';
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: color + '22', color }}>
      {ETAT_LABELS[etat] || etat || '—'}
    </span>
  );
}

function InfoCell({ label, value }) {
  return (
    <div>
      <div className="text-xs text-text-muted mb-0.5">{label}</div>
      <div className="text-sm font-semibold text-text-main">{value || '—'}</div>
    </div>
  );
}

function MapClickHandler({ active, onMapClick }) {
  useMapEvents({ click(e) { if (active) onMapClick(e.latlng); } });
  return null;
}

// ── Modale edition armoire feux ───────────────────────────────────────────────
function EditArmoireFeuxModal({ armoire, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    intitule:        armoire.intitule        || '',
    localisation:    armoire.localisation    || '',
    type_controleur: armoire.type_controleur || '',
    marque:          armoire.marque          || '',
    modele:          armoire.modele          || '',
    annee_pose:      armoire.annee_pose      != null ? armoire.annee_pose : '',
    numero_serie:    armoire.numero_serie    || '',
    commentaire:     armoire.commentaire     || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/patrimoine/feux/armoires/${armoire.id}`, form);
      toast.success('Armoire mise à jour');
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white z-10">
          <h3 className="font-heading font-semibold text-text-main">Modifier l'armoire feux</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Intitulé *</label>
            <input type="text" value={form.intitule} onChange={e => set('intitule', e.target.value)}
              className="input w-full" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Localisation</label>
            <input type="text" value={form.localisation} onChange={e => set('localisation', e.target.value)}
              className="input w-full" placeholder="Ex: Carrefour rue de la Paix / rue Victor Hugo" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Type de contrôleur</label>
              <input type="text" value={form.type_controleur} onChange={e => set('type_controleur', e.target.value)}
                className="input w-full" placeholder="Ex: UTC, UTMC..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Marque</label>
              <input type="text" value={form.marque} onChange={e => set('marque', e.target.value)}
                className="input w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Modèle</label>
              <input type="text" value={form.modele} onChange={e => set('modele', e.target.value)}
                className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Année de pose</label>
              <input type="number" min="1950" max="2030" value={form.annee_pose}
                onChange={e => set('annee_pose', e.target.value)} className="input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Numéro de série</label>
            <input type="text" value={form.numero_serie} onChange={e => set('numero_serie', e.target.value)}
              className="input w-full" />
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
export default function ArmoireFeuxPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === 'read';

  const [armoire, setArmoire]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [interventionModal, setInterventionModal] = useState(null);
  const [tab, setTab] = useState('feux');

  const [placing, setPlacing]     = useState(false);
  const [tempPos, setTempPos]     = useState(null);
  const [savingPos, setSavingPos] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get(`/patrimoine/feux/armoires/${id}`);
      setArmoire(d);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleMapClick = (latlng) => {
    if (placing) setTempPos({ lat: latlng.lat, lng: latlng.lng });
  };

  const startPlacing = () => {
    setTempPos(armoire?.latitude && armoire?.longitude
      ? { lat: armoire.latitude, lng: armoire.longitude } : null);
    setPlacing(true);
  };

  const cancelPlacing = () => { setPlacing(false); setTempPos(null); };

  const savePosition = async () => {
    if (!tempPos) return;
    setSavingPos(true);
    try {
      await api.put(`/patrimoine/feux/armoires/${id}`, {
        latitude: tempPos.lat, longitude: tempPos.lng,
      });
      toast.success('Position enregistrée');
      setPlacing(false); setTempPos(null);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSavingPos(false); }
  };

  const removePosition = async () => {
    if (!window.confirm('Supprimer la position géographique de cette armoire ?')) return;
    try {
      await api.put(`/patrimoine/feux/armoires/${id}`, { latitude: null, longitude: null });
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
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }
  if (!armoire) return null;

  const breadcrumbs = [
    { label: 'Feux tricolores', to: '/patrimoine/feux' },
    { label: armoire.intitule },
  ];

  const feuxTricolores  = armoire.feux_tricolores || [];
  const interventions   = armoire.interventions   || [];
  const nbDefaillants   = feuxTricolores.filter(f =>
    f.etat_general === 'defaillant' || f.etat_general === 'hors_service').length;

  const markerPos = placing && tempPos
    ? [tempPos.lat, tempPos.lng]
    : armoire.latitude && armoire.longitude
      ? [armoire.latitude, armoire.longitude] : null;
  const mapCenter = markerPos || [50.32, 3.39];
  const mapZoom   = markerPos ? 17 : 13;

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="max-w-5xl mx-auto flex flex-col gap-4">

        {/* En-tête */}
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <h1 className="font-heading font-bold text-xl text-text-main mb-1">{armoire.intitule}</h1>
              {armoire.localisation && (
                <div className="flex items-center gap-1.5 text-sm text-text-muted mb-3">
                  <MapPin size={13} /> {armoire.localisation}
                </div>
              )}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-3 pt-3 border-t border-border">
                <InfoCell label="Feux tricolores"  value={feuxTricolores.length} />
                <InfoCell label="Défaillants"       value={nbDefaillants > 0 ? nbDefaillants : '—'} />
                <InfoCell label="Type de contrôleur" value={armoire.type_controleur} />
                <InfoCell label="Marque / Modèle"   value={[armoire.marque, armoire.modele].filter(Boolean).join(' ')} />
                <InfoCell label="Année de pose"     value={armoire.annee_pose} />
                <InfoCell label="Numéro de série"   value={armoire.numero_serie} />
                {armoire.commentaire && (
                  <div className="col-span-2 lg:col-span-4">
                    <div className="text-xs text-text-muted mb-0.5">Commentaire</div>
                    <div className="text-sm text-text-main">{armoire.commentaire}</div>
                  </div>
                )}
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
              {armoire.latitude && armoire.longitude && !placing && (
                <span className="text-xs font-mono text-text-muted">
                  {armoire.latitude.toFixed(6)}, {armoire.longitude.toFixed(6)}
                </span>
              )}
            </div>
            {!isReadOnly && (
              <div className="flex items-center gap-2">
                {!placing ? (
                  <>
                    <button onClick={startPlacing} className="btn-primary text-xs flex items-center gap-1.5">
                      <Navigation2 size={13} />
                      {armoire.latitude && armoire.longitude ? 'Déplacer' : 'Positionner'}
                    </button>
                    {armoire.latitude && armoire.longitude && (
                      <button onClick={removePosition}
                        className="btn-secondary text-xs text-red-500 hover:bg-red-50" title="Supprimer la position">
                        <X size={13} />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-xs text-amber-600 font-medium">
                      {tempPos ? 'Cliquez pour ajuster' : 'Cliquez sur la carte pour placer l\'armoire'}
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
              style={{ height: 360, width: '100%' }} zoomControl={true}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors' />
              <MapClickHandler active={placing} onMapClick={handleMapClick} />
              {markerPos && (
                <CircleMarker center={markerPos} radius={14}
                  fillColor={placing ? '#F59E0B' : '#EF4444'}
                  color="#fff" weight={3} fillOpacity={0.9}>
                  <Popup>
                    <strong>{armoire.intitule}</strong>
                    {armoire.localisation && <><br />{armoire.localisation}</>}
                    {placing && tempPos && <><br /><span className="text-xs text-amber-600">En cours de modification</span></>}
                  </Popup>
                </CircleMarker>
              )}
              {/* Feux de cette armoire */}
              {!placing && feuxTricolores.filter(f => f.latitude && f.longitude).map(f => (
                <CircleMarker key={f.id} center={[f.latitude, f.longitude]} radius={7}
                  fillColor={ETAT_COLORS[f.etat_general] || '#6B7280'}
                  color="#fff" weight={2} fillOpacity={0.85}>
                  <Popup>{f.reference}<br /><EtatBadge etat={f.etat_general} /></Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
          {!armoire.latitude && !armoire.longitude && !placing && (
            <div className="p-3 text-center text-sm text-text-muted border-t border-border bg-amber-50/40">
              Aucune position. Cliquez sur "Positionner" pour placer cette armoire sur la carte.
            </div>
          )}
        </div>

        {/* ── Onglets */}
        <div className="flex gap-1 border-b border-border pb-0">
          {[
            { id: 'feux',          label: `Feux tricolores (${feuxTricolores.length})` },
            { id: 'interventions', label: `Interventions (${interventions.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors -mb-px ${
                tab === t.id
                  ? 'border-primary text-primary bg-white'
                  : 'border-transparent text-text-muted hover:text-text-main'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Onglet Feux tricolores */}
        {tab === 'feux' && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-heading font-semibold text-sm text-text-main flex items-center gap-2">
                <TrafficCone size={15} className="text-red-500" />
                Feux tricolores ({feuxTricolores.length})
                {nbDefaillants > 0 && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                    {nbDefaillants} défaillant{nbDefaillants > 1 ? 's' : ''}
                  </span>
                )}
              </h3>
            </div>
            {feuxTricolores.length === 0 ? (
              <div className="p-6 text-center text-text-muted text-sm">Aucun feu tricolore rattaché.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border bg-gray-50">
                      <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Référence</th>
                      <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Type</th>
                      <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Technologie</th>
                      <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">État</th>
                      <th className="py-2 px-2 w-16" />
                    </tr>
                  </thead>
                  <tbody>
                    {feuxTricolores.map((f, i) => (
                      <tr key={f.id}
                        className={`border-b border-border hover:bg-gray-50 cursor-pointer ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}
                        onClick={() => navigate(`/patrimoine/feux/${f.id}`)}>
                        <td className="py-2.5 px-3 text-sm font-mono font-medium text-text-main">{f.reference}</td>
                        <td className="py-2.5 px-3 text-sm text-text-muted capitalize">{f.type_feu || '—'}</td>
                        <td className="py-2.5 px-3 text-sm text-text-muted capitalize">{f.technologie || '—'}</td>
                        <td className="py-2.5 px-3"><EtatBadge etat={f.etat_general} /></td>
                        <td className="py-2.5 px-2">
                          <button onClick={e => { e.stopPropagation(); navigate(`/patrimoine/feux/${f.id}`); }}
                            className="btn-secondary text-xs px-2 py-1">Voir</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Onglet Interventions */}
        {tab === 'interventions' && (
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
              siteLabel={armoire?.intitule || ''}
            />
          </div>
        )}

      </div>

      {showEdit && (
        <EditArmoireFeuxModal
          armoire={armoire}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load(); }}
        />
      )}

      {interventionModal !== null && (
        <InterventionModal
          open={true}
          onClose={() => setInterventionModal(null)}
          onSaved={() => { setInterventionModal(null); load(); }}
          theme="armoire_feux"
          elementId={id}
          typeElement={armoire.intitule}
          intervention={interventionModal?.id ? interventionModal : undefined}
        />
      )}
    </AppLayout>
  );
}
