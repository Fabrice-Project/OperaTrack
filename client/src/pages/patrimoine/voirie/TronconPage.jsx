import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Plus, Edit2, X, Save, MapPin, Trash2, Package,
  Pencil, Check, Undo2, RotateCcw, Navigation2,
} from 'lucide-react';
import {
  MapContainer, TileLayer, CircleMarker, Polyline,
  Popup, Tooltip, useMapEvents, useMap,
} from 'react-leaflet';
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

// ── Constantes ────────────────────────────────────────────────────────────────

const ETAT_COLORS = {
  bon: '#1E7E45', moyen: '#E8920A', degrade: '#C0392B', tres_degrade: '#1A1A1A',
};
const ETAT_LABELS = {
  bon: 'Bon', moyen: 'Moyen', degrade: 'Dégradé', tres_degrade: 'Très dégradé',
};

const MOBILIER_TYPES = [
  { value: 'poubelle',      label: 'Poubelle',      abbr: 'PB' },
  { value: 'potelet',       label: 'Potelet',       abbr: 'PT' },
  { value: 'banc',          label: 'Banc',          abbr: 'BN' },
  { value: 'panneau',       label: 'Panneau',       abbr: 'PA' },
  { value: 'corbeille',     label: 'Corbeille',     abbr: 'CO' },
  { value: 'fontaine',      label: 'Fontaine',      abbr: 'FO' },
  { value: 'barriere',      label: 'Barrière',      abbr: 'BA' },
  { value: 'lampe_solaire', label: 'Lampe solaire', abbr: 'LS' },
  { value: 'autre',         label: 'Autre',         abbr: '?' },
];
const ETAT_MOBILIER = {
  bon:          { label: 'Bon',          color: '#1E7E45' },
  moyen:        { label: 'Moyen',        color: '#E8920A' },
  degrade:      { label: 'Dégradé',      color: '#C0392B' },
  hors_service: { label: 'Hors service', color: '#1A1A1A' },
};

function getMobilierType(value) {
  return MOBILIER_TYPES.find(t => t.value === value) || { label: value, abbr: '?' };
}

function createMobilierIcon(item) {
  const etatCfg = ETAT_MOBILIER[item.etat_general] || ETAT_MOBILIER.bon;
  const abbr    = getMobilierType(item.type).abbr;
  return L.divIcon({
    html: `<div style="background:${etatCfg.color};color:white;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);line-height:1">${abbr}</div>`,
    className: '',
    iconSize:   [26, 26],
    iconAnchor: [13, 13],
    popupAnchor:[0, -13],
  });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function EtatBadge({ etat }) {
  const color = ETAT_COLORS[etat] || '#6B7280';
  const label = ETAT_LABELS[etat] || etat;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: color + '22', color }}>
      {label}
    </span>
  );
}

// ── Helpers carte ─────────────────────────────────────────────────────────────

/** Écoute les clics sur la carte */
function MapClickHandler({ mode, onMapClick }) {
  useMapEvents({
    click(e) { if (mode !== 'view') onMapClick(e.latlng); },
  });
  return null;
}

/** Recentre et adapte le zoom à une liste de points */
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points && points.length >= 2) {
      map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 18 });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// ── Modale édition tronçon ────────────────────────────────────────────────────
function EditTronconModal({ troncon, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    intitule:                  troncon.intitule || '',
    categorie:                 troncon.categorie || '',
    revetement:                troncon.revetement || '',
    longueur_ml:               troncon.longueur_ml ?? '',
    largeur_m:                 troncon.largeur_m ?? '',
    annee_derniere_refection:  troncon.annee_derniere_refection ?? '',
    etat_general:              troncon.etat_general || 'moyen',
    latitude:                  troncon.latitude ?? '',
    longitude:                 troncon.longitude ?? '',
    commentaire:               troncon.commentaire || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/patrimoine/voirie/${troncon.id}`, {
        intitule:                 form.intitule,
        categorie:                form.categorie || null,
        revetement:               form.revetement || null,
        longueur_ml:              form.longueur_ml !== '' ? parseFloat(form.longueur_ml) : null,
        largeur_m:                form.largeur_m !== '' ? parseFloat(form.largeur_m) : null,
        annee_derniere_refection: form.annee_derniere_refection !== '' ? parseInt(form.annee_derniere_refection) : null,
        etat_general:             form.etat_general,
        latitude:                 form.latitude !== '' ? parseFloat(form.latitude) : null,
        longitude:                form.longitude !== '' ? parseFloat(form.longitude) : null,
        commentaire:              form.commentaire || null,
      });
      toast.success('Tronçon mis à jour');
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white z-10">
          <h3 className="font-heading font-semibold text-text-main">Modifier le tronçon</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Intitulé *</label>
            <input type="text" value={form.intitule} onChange={e => set('intitule', e.target.value)} className="input w-full" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Catégorie</label>
              <input type="text" value={form.categorie} onChange={e => set('categorie', e.target.value)} className="input w-full" placeholder="Principale, secondaire…" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Revêtement</label>
              <input type="text" value={form.revetement} onChange={e => set('revetement', e.target.value)} className="input w-full" placeholder="Enrobé, béton, pavés…" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Longueur (m)</label>
              <input type="number" step="0.1" min="0" value={form.longueur_ml} onChange={e => set('longueur_ml', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Largeur (m)</label>
              <input type="number" step="0.1" min="0" value={form.largeur_m} onChange={e => set('largeur_m', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Année réfection</label>
              <input type="number" min="1950" max="2030" value={form.annee_derniere_refection} onChange={e => set('annee_derniere_refection', e.target.value)} className="input w-full" placeholder="2019" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">État</label>
            <select value={form.etat_general} onChange={e => set('etat_general', e.target.value)} className="input w-full">
              {Object.entries(ETAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Latitude</label>
              <input type="number" step="0.000001" value={form.latitude} onChange={e => set('latitude', e.target.value)} className="input w-full" placeholder="50.3218…" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Longitude</label>
              <input type="number" step="0.000001" value={form.longitude} onChange={e => set('longitude', e.target.value)} className="input w-full" placeholder="3.3951…" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Description / commentaire</label>
            <textarea value={form.commentaire} onChange={e => set('commentaire', e.target.value)} className="input w-full" rows={3} />
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

// ── Modale mobilier urbain ────────────────────────────────────────────────────
function MobilierModal({ tronconId, item, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = !!item?.id;
  const [form, setForm] = useState({
    type:              item?.type              || 'poubelle',
    quantite:          item?.quantite          ?? 1,
    etat_general:      item?.etat_general      || 'bon',
    marque:            item?.marque            || '',
    reference_terrain: item?.reference_terrain || '',
    date_pose:         item?.date_pose         ?? '',
    commentaire:       item?.commentaire       || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        quantite:  parseInt(form.quantite) || 1,
        date_pose: form.date_pose !== '' ? parseInt(form.date_pose) : null,
      };
      if (isEdit) {
        await api.put(`/patrimoine/mobilier/${item.id}`, payload);
        toast.success('Mobilier mis à jour');
      } else {
        await api.post(`/patrimoine/voirie/${tronconId}/mobilier`, payload);
        toast.success('Mobilier ajouté');
      }
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white z-10">
          <h3 className="font-heading font-semibold text-text-main">
            {isEdit ? 'Modifier le mobilier' : 'Ajouter du mobilier'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Type *</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} className="input w-full" required>
                {MOBILIER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Quantité</label>
              <input type="number" min="1" value={form.quantite} onChange={e => set('quantite', e.target.value)} className="input w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">État</label>
              <select value={form.etat_general} onChange={e => set('etat_general', e.target.value)} className="input w-full">
                {Object.entries(ETAT_MOBILIER).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Année de pose</label>
              <input type="number" min="1950" max="2050" value={form.date_pose} onChange={e => set('date_pose', e.target.value)} className="input w-full" placeholder="2020" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Marque / Fabricant</label>
              <input type="text" value={form.marque} onChange={e => set('marque', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Référence terrain</label>
              <input type="text" value={form.reference_terrain} onChange={e => set('reference_terrain', e.target.value)} className="input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Commentaire</label>
            <textarea value={form.commentaire} onChange={e => set('commentaire', e.target.value)} className="input w-full resize-none" rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-1.5">
              <Save size={13} />{saving ? '…' : isEdit ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function TronconPage() {
  const { id } = useParams();
  const toast = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === 'read';

  const [troncon, setTroncon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [interventionModal, setInterventionModal] = useState(null);

  // Mobilier
  const [mobilier, setMobilier] = useState([]);
  const [mobilierModal, setMobilierModal]     = useState(null);
  const [mobilierIvModal, setMobilierIvModal] = useState(null);

  // Carte
  const [mapMode, setMapMode]       = useState('view'); // 'view' | 'draw' | 'place'
  const [drawPoints, setDrawPoints] = useState([]);     // [[lat,lng], …] pendant le dessin
  const [placingItem, setPlacingItem] = useState(null); // mobilier en cours de placement

  // ── Chargement ───────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get(`/patrimoine/voirie/${id}`);
      setTroncon(d);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [id]);

  const loadMobilier = useCallback(async () => {
    try {
      const d = await api.get(`/patrimoine/voirie/${id}/mobilier`);
      setMobilier(d || []);
    } catch (err) {}
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadMobilier(); }, [loadMobilier]);

  // ── Gestion carte ─────────────────────────────────────────────────────────

  const startDraw = useCallback(() => {
    setDrawPoints(troncon?.geom_points || []);
    setMapMode('draw');
  }, [troncon]);

  const undoLastPoint = () => setDrawPoints(pts => pts.slice(0, -1));
  const clearDraw     = () => setDrawPoints([]);
  const cancelDraw    = () => { setDrawPoints([]); setMapMode('view'); };

  const saveDraw = useCallback(async () => {
    try {
      await api.put(`/patrimoine/voirie/${id}`, { geom_points: drawPoints.length > 0 ? drawPoints : null });
      setTroncon(t => ({ ...t, geom_points: drawPoints.length > 0 ? drawPoints : null }));
      toast.success(drawPoints.length > 0 ? 'Tracé enregistré' : 'Tracé supprimé');
      setMapMode('view');
      setDrawPoints([]);
    } catch (err) { toast.error(err.message); }
  }, [id, drawPoints]);

  const startPlacing = (item) => {
    setPlacingItem(item);
    setMapMode('place');
  };
  const cancelPlace = () => { setPlacingItem(null); setMapMode('view'); };

  const handleMapClick = useCallback(async (latlng) => {
    if (mapMode === 'draw') {
      setDrawPoints(pts => [...pts, [latlng.lat, latlng.lng]]);
    } else if (mapMode === 'place' && placingItem) {
      try {
        await api.put(`/patrimoine/mobilier/${placingItem.id}`, {
          latitude:  latlng.lat,
          longitude: latlng.lng,
        });
        toast.success(`Position enregistrée — ${getMobilierType(placingItem.type).label}`);
        setMapMode('view');
        setPlacingItem(null);
        loadMobilier();
      } catch (err) { toast.error(err.message); }
    }
  }, [mapMode, placingItem, loadMobilier]);

  const removeLocation = useCallback(async (item) => {
    try {
      await api.put(`/patrimoine/mobilier/${item.id}`, { latitude: null, longitude: null });
      toast.success('Position supprimée');
      loadMobilier();
    } catch (err) { toast.error(err.message); }
  }, [loadMobilier]);

  const handleDeleteMobilier = async (item) => {
    if (!window.confirm(`Supprimer ce ${getMobilierType(item.type).label} ?`)) return;
    try {
      await api.delete(`/patrimoine/mobilier/${item.id}`);
      toast.success('Mobilier supprimé');
      loadMobilier();
    } catch (err) { toast.error(err.message); }
  };

  // ── Centre de carte ──────────────────────────────────────────────────────────

  const mapCenter = (() => {
    const pts = troncon?.geom_points;
    if (pts && pts.length > 0) {
      const lats = pts.map(p => p[0]);
      const lngs = pts.map(p => p[1]);
      return [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2];
    }
    if (troncon?.latitude && troncon?.longitude) return [troncon.latitude, troncon.longitude];
    const withCoords = mobilier.filter(m => m.latitude && m.longitude);
    if (withCoords.length > 0) return [
      withCoords.reduce((s, m) => s + m.latitude, 0) / withCoords.length,
      withCoords.reduce((s, m) => s + m.longitude, 0) / withCoords.length,
    ];
    return [50.32, 3.39];
  })();

  const roadPoints = mapMode === 'draw' ? drawPoints : (troncon?.geom_points || []);
  const roadColor  = ETAT_COLORS[troncon?.etat_general] || '#1A3A5C';

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout breadcrumbs={[{ label: 'Voirie', to: '/patrimoine/voirie' }, { label: '…' }]}>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }
  if (!troncon) return null;

  const breadcrumbs = [{ label: 'Voirie', to: '/patrimoine/voirie' }, { label: troncon.intitule }];
  const interventions = troncon.interventions || [];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="max-w-5xl mx-auto flex flex-col gap-4">

        {/* ── En-tête fiche tronçon ─────────────────────────────────────────── */}
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <EtatBadge etat={troncon.etat_general} />
                {troncon.revetement && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{troncon.revetement}</span>
                )}
                {troncon.categorie && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">{troncon.categorie}</span>
                )}
              </div>
              <h1 className="font-heading font-bold text-xl text-text-main mb-3">{troncon.intitule}</h1>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-text-muted mb-0.5">Longueur</div>
                  <div className="font-mono text-sm font-semibold text-text-main">{troncon.longueur_ml ? `${troncon.longueur_ml} m` : '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-0.5">Largeur</div>
                  <div className="font-mono text-sm font-semibold text-text-main">{troncon.largeur_m ? `${troncon.largeur_m} m` : '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-0.5">Surface</div>
                  <div className="font-mono text-sm font-semibold text-text-main">
                    {troncon.longueur_ml && troncon.largeur_m
                      ? `${Math.round(troncon.longueur_ml * troncon.largeur_m).toLocaleString('fr-FR')} m²` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-0.5">Dernière réfection</div>
                  <div className="font-mono text-sm font-semibold text-text-main">{troncon.annee_derniere_refection || '—'}</div>
                </div>
              </div>
              {(troncon.adresse || (troncon.latitude && troncon.longitude)) && (
                <div className="flex items-center gap-1.5 mt-3 text-xs text-text-muted">
                  <MapPin size={12} />
                  {troncon.adresse || `${troncon.latitude}, ${troncon.longitude}`}
                </div>
              )}
            </div>
            {!isReadOnly && (
              <button onClick={() => setShowEdit(true)} className="btn-secondary text-xs flex items-center gap-1.5 shrink-0">
                <Edit2 size={13} /> Modifier
              </button>
            )}
          </div>
          {troncon.commentaire && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-sm text-text-muted leading-relaxed">{troncon.commentaire}</p>
            </div>
          )}
        </div>

        {/* ── Carte interactive ─────────────────────────────────────────────── */}
        <div className="card overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between p-3 border-b border-border gap-2 flex-wrap">
            <h3 className="font-heading font-semibold text-sm text-text-main flex items-center gap-2">
              <MapPin size={15} className="text-primary" /> Carte
              {mobilier.filter(m => m.latitude && m.longitude).length > 0 && (
                <span className="text-xs font-normal text-text-muted">
                  · {mobilier.filter(m => m.latitude && m.longitude).length} mobilier{mobilier.filter(m => m.latitude && m.longitude).length > 1 ? 's' : ''} placé{mobilier.filter(m => m.latitude && m.longitude).length > 1 ? 's' : ''}
                </span>
              )}
            </h3>

            {/* Légende mobilier */}
            <div className="flex items-center gap-2 flex-wrap">
              {!isReadOnly && (
                <>
                  {mapMode === 'view' && (
                    <button
                      onClick={startDraw}
                      className="btn-secondary text-xs flex items-center gap-1.5"
                    >
                      <Pencil size={12} />
                      {troncon.geom_points?.length ? 'Modifier le tracé' : 'Tracer la rue'}
                    </button>
                  )}
                  {mapMode === 'draw' && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-primary font-medium px-2 py-1 bg-blue-50 rounded">
                        ✏️ {drawPoints.length} point{drawPoints.length !== 1 ? 's' : ''} — cliquez sur la carte
                      </span>
                      <button onClick={undoLastPoint} disabled={drawPoints.length === 0} className="btn-secondary text-xs flex items-center gap-1 disabled:opacity-40">
                        <Undo2 size={11} /> Annuler dernier
                      </button>
                      <button onClick={clearDraw} className="btn-secondary text-xs flex items-center gap-1 text-red-500 hover:bg-red-50">
                        <RotateCcw size={11} /> Tout effacer
                      </button>
                      <button onClick={cancelDraw} className="btn-secondary text-xs">Annuler</button>
                      <button onClick={saveDraw} className="btn-primary text-xs flex items-center gap-1.5">
                        <Check size={12} /> Valider
                      </button>
                    </div>
                  )}
                  {mapMode === 'place' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: '#7C3AED18', color: '#7C3AED' }}>
                        <Navigation2 size={11} className="inline mr-1" />
                        Placer : {getMobilierType(placingItem?.type).label} — cliquez sur la carte
                      </span>
                      <button onClick={cancelPlace} className="btn-secondary text-xs">Annuler</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Légende des types de mobilier */}
          {mobilier.length > 0 && (
            <div className="px-3 py-2 bg-gray-50 border-b border-border flex items-center gap-3 flex-wrap">
              <span className="text-xs text-text-muted font-medium">Légende :</span>
              {MOBILIER_TYPES.filter(t => mobilier.some(m => m.type === t.value)).map(t => (
                <span key={t.value} className="flex items-center gap-1 text-xs text-text-muted">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[9px] font-bold"
                    style={{ backgroundColor: '#6B7280' }}>{t.abbr}</span>
                  {t.label}
                </span>
              ))}
              <span className="ml-2 text-xs text-text-muted">— couleur = état :</span>
              {Object.entries(ETAT_MOBILIER).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1 text-xs">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: v.color }} />
                  <span className="text-text-muted">{v.label}</span>
                </span>
              ))}
            </div>
          )}

          {/* Carte Leaflet */}
          <div style={{ cursor: mapMode !== 'view' ? 'crosshair' : 'default' }}>
            <MapContainer
              center={mapCenter}
              zoom={16}
              style={{ height: 440, width: '100%' }}
              zoomControl={true}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />

              <MapClickHandler mode={mapMode} onMapClick={handleMapClick} />

              {/* FitBounds — clé basée sur le mode pour forcer le remontage après sauvegarde */}
              {roadPoints.length >= 2 && <FitBounds key={`${mapMode}-${roadPoints.length}`} points={roadPoints} />}

              {/* Tracé de la rue (polyline) */}
              {roadPoints.length >= 2 && (
                <Polyline
                  positions={roadPoints}
                  pathOptions={{
                    color:   roadColor,
                    weight:  7,
                    opacity: mapMode === 'draw' ? 0.6 : 0.85,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              )}

              {/* Points du tracé en cours */}
              {mapMode === 'draw' && drawPoints.map((pt, i) => (
                <CircleMarker
                  key={i}
                  center={pt}
                  radius={5}
                  pathOptions={{ color: roadColor, fillColor: 'white', fillOpacity: 1, weight: 2 }}
                >
                  <Tooltip permanent direction="top" className="text-xs">{i + 1}</Tooltip>
                </CircleMarker>
              ))}

              {/* Marqueurs mobilier */}
              {mobilier
                .filter(item => item.latitude && item.longitude)
                .map(item => {
                  const etatCfg  = ETAT_MOBILIER[item.etat_general] || ETAT_MOBILIER.bon;
                  const typeInfo = getMobilierType(item.type);
                  return (
                    <CircleMarker
                      key={item.id}
                      center={[item.latitude, item.longitude]}
                      radius={12}
                      pathOptions={{
                        color:       'white',
                        weight:      2,
                        fillColor:   etatCfg.color,
                        fillOpacity: 0.85,
                      }}
                    >
                      <Tooltip permanent direction="top" className="text-xs font-bold">{typeInfo.abbr}</Tooltip>
                      <Popup>
                        <div className="text-sm">
                          <strong>{typeInfo.label}</strong>
                          {item.reference_terrain && <div className="text-xs text-gray-500">Réf: {item.reference_terrain}</div>}
                          <div className="text-xs mt-0.5">Qté: {item.quantite} · <span style={{ color: etatCfg.color }}>{etatCfg.label}</span></div>
                          {item.marque && <div className="text-xs text-gray-500">{item.marque}</div>}
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
            </MapContainer>
          </div>

          {/* Note si aucune donnée géo */}
          {!troncon.geom_points?.length && mobilier.filter(m => m.latitude && m.longitude).length === 0 && (
            <div className="p-3 text-center text-xs text-text-muted border-t border-border">
              {isReadOnly
                ? 'Aucune donnée géographique disponible.'
                : <>Utilisez <strong>Tracer la rue</strong> pour colorier le tronçon, ou <strong>📍 Placer</strong> depuis le tableau mobilier.</>}
            </div>
          )}
        </div>

        {/* ── Mobilier urbain ──────────────────────────────────────────────────── */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-heading font-semibold text-sm text-text-main flex items-center gap-2">
              <Package size={15} className="text-purple-500" /> Mobilier urbain ({mobilier.length})
            </h3>
            {!isReadOnly && (
              <button onClick={() => setMobilierModal({})} className="btn-primary text-xs flex items-center gap-1.5">
                <Plus size={13} /> Ajouter
              </button>
            )}
          </div>

          {mobilier.length === 0 ? (
            <div className="p-6 text-center text-text-muted text-sm">Aucun mobilier enregistré.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-gray-50">
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Type</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide text-center">Qté</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">État</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Marque / Réf.</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Pose</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Carte</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Interventions</th>
                    <th className="py-2 px-2 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {mobilier.map((item, i) => {
                    const etatCfg  = ETAT_MOBILIER[item.etat_general] || ETAT_MOBILIER.bon;
                    const typeInfo = getMobilierType(item.type);
                    const hasPos   = !!(item.latitude && item.longitude);
                    return (
                      <tr key={item.id} className={`border-b border-border hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                        <td className="py-2.5 px-3 text-sm font-medium text-text-main">
                          <span className="flex items-center gap-1.5">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[9px] font-bold shrink-0"
                              style={{ backgroundColor: etatCfg.color }}>{typeInfo.abbr}</span>
                            {typeInfo.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-sm text-center font-mono text-text-main">{item.quantite}</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ backgroundColor: etatCfg.color + '22', color: etatCfg.color }}>
                            {etatCfg.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-text-muted">
                          {[item.marque, item.reference_terrain].filter(Boolean).join(' — ') || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-xs font-mono text-text-muted">{item.date_pose || '—'}</td>

                        {/* Colonne carte : placement */}
                        <td className="py-2.5 px-3">
                          {!isReadOnly ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => startPlacing(item)}
                                className={`text-xs flex items-center gap-1 px-2 py-1 rounded font-medium transition-colors ${
                                  placingItem?.id === item.id
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'text-purple-600 hover:bg-purple-50'
                                }`}
                                title="Cliquez puis pointez sur la carte"
                              >
                                <Navigation2 size={11} />
                                {hasPos ? 'Déplacer' : 'Placer'}
                              </button>
                              {hasPos && (
                                <button
                                  onClick={() => removeLocation(item)}
                                  className="p-1 rounded hover:bg-red-50 text-red-300 hover:text-red-500"
                                  title="Supprimer la position"
                                >
                                  <X size={10} />
                                </button>
                              )}
                            </div>
                          ) : (
                            hasPos
                              ? <span className="text-xs text-green-600 flex items-center gap-1"><MapPin size={10} /> Placé</span>
                              : <span className="text-xs text-text-muted">—</span>
                          )}
                        </td>

                        {/* Interventions */}
                        <td className="py-2.5 px-3">
                          <button
                            onClick={() => setMobilierIvModal(item)}
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
                          >
                            <Plus size={11} />
                            {item.nb_interventions > 0 ? `${item.nb_interventions} intervention${item.nb_interventions > 1 ? 's' : ''}` : 'Ajouter'}
                          </button>
                        </td>

                        {/* Actions */}
                        {!isReadOnly && (
                          <td className="py-2.5 px-2">
                            <div className="flex items-center gap-1">
                              <button onClick={() => setMobilierModal(item)} className="p-1.5 rounded hover:bg-blue-50 text-blue-400"><Edit2 size={13} /></button>
                              <button onClick={() => handleDeleteMobilier(item)} className="p-1.5 rounded hover:bg-red-50 text-red-400"><Trash2 size={13} /></button>
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

        {/* ── Interventions voirie ──────────────────────────────────────────────── */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-heading font-semibold text-sm text-text-main">
              Interventions voirie ({interventions.length})
            </h3>
            {!isReadOnly && (
              <button onClick={() => setInterventionModal({})} className="btn-primary text-xs flex items-center gap-1.5">
                <Plus size={13} /> Nouvelle intervention
              </button>
            )}
          </div>

          <InterventionList
            interventions={interventions}
            onRefresh={load}
            onEdit={(iv) => setInterventionModal(iv)}
          />
        </div>
      </div>

      {/* ── Modales ────────────────────────────────────────────────────────────── */}

      {showEdit && (
        <EditTronconModal troncon={troncon} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); load(); }} />
      )}

      {interventionModal !== null && (
        <InterventionModal
          open={true}
          onClose={() => setInterventionModal(null)}
          onSaved={() => { setInterventionModal(null); load(); }}
          theme="voirie"
          elementId={id}
          typeElement={troncon.intitule}
          intervention={interventionModal?.id ? interventionModal : undefined}
        />
      )}

      {mobilierModal !== null && (
        <MobilierModal
          tronconId={id}
          item={mobilierModal?.id ? mobilierModal : null}
          onClose={() => setMobilierModal(null)}
          onSaved={() => { setMobilierModal(null); loadMobilier(); }}
        />
      )}

      {mobilierIvModal !== null && (
        <InterventionModal
          open={true}
          onClose={() => setMobilierIvModal(null)}
          onSaved={() => { setMobilierIvModal(null); loadMobilier(); }}
          theme="mobilier"
          elementId={mobilierIvModal.id}
          typeElement={`${getMobilierType(mobilierIvModal.type).label} — ${troncon.intitule}`}
        />
      )}
    </AppLayout>
  );
}
