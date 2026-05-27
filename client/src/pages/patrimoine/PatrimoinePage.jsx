import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { Plus, Route, Lightbulb, Building2, X, FileDown, Sheet, Briefcase, ChevronDown, ChevronRight, RefreshCw, ClipboardList, Edit2, Search, Undo2, Trash2, FileUp, MapPin, Bell, TrafficCone, Wrench } from 'lucide-react';
import { ImportEclairageModal } from './eclairage/ImportEclairageModal';
import { ImportFeuxModal } from './feux/ImportFeuxModal';
import { RapportModal } from '../../components/patrimoine/RapportModal';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { AppLayout } from '../../components/layout/AppLayout';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { InterventionModal } from '../../components/patrimoine/InterventionModal';
import { TabDemandes } from './TabDemandes';
import { api } from '../../utils/api';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const ETAT_COLORS = {
  bon: '#1E7E45',
  moyen: '#E8920A',
  degrade: '#C0392B',
  tres_degrade: '#1A1A1A',
  fonctionnel: '#1E7E45',
  defaillant: '#E8920A',
  hors_service: '#C0392B',
  en_travaux: '#2563EB',
};

const ETAT_LABELS = {
  bon: 'Bon',
  moyen: 'Moyen',
  degrade: 'Dégradé',
  tres_degrade: 'Très dégradé',
  fonctionnel: 'Fonctionnel',
  defaillant: 'Défaillant',
  hors_service: 'Hors service',
  en_travaux: 'En travaux',
};

function EtatBadge({ etat }) {
  const color = ETAT_COLORS[etat] || '#6B7280';
  const label = ETAT_LABELS[etat] || etat;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: color + '22', color }}
    >
      {label}
    </span>
  );
}

function KpiCard({ label, value, sub, color, onClick }) {
  return (
    <div
      className={`card p-4 flex flex-col gap-1 ${onClick ? 'cursor-pointer hover:shadow-md hover:ring-1 hover:ring-amber-300 transition-all' : ''}`}
      onClick={onClick}
      title={onClick ? 'Cliquer pour filtrer la liste' : undefined}
    >
      <div className="text-xs text-text-muted uppercase tracking-wide font-medium">{label}</div>
      <div className="font-mono font-bold text-2xl" style={{ color: color || 'var(--color-text-main)' }}>{value}</div>
      {sub && <div className="text-xs text-text-muted">{sub}</div>}
    </div>
  );
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtEur(v) {
  if (!v && v !== 0) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

// ── Helper Leaflet — ajuste la vue sur un ensemble de points/polylines ────────
function FitBoundsAll({ troncons }) {
  const map = useMap();
  useEffect(() => {
    const allPoints = [];
    troncons.forEach(t => {
      if (t.geom_points && t.geom_points.length >= 2) {
        // geom_points stockés comme [[lat, lng], ...]
        t.geom_points.forEach(p => allPoints.push(Array.isArray(p) ? p : [p.lat, p.lng]));
      } else if (t.latitude && t.longitude) {
        allPoints.push([t.latitude, t.longitude]);
      }
    });
    if (allPoints.length > 0) {
      map.fitBounds(L.latLngBounds(allPoints), { padding: [20, 20], maxZoom: 16 });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// ── Helpers Leaflet pour la modale de création ────────────────────────────────
function DrawClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

function FlyToLocation({ target }) {
  const map = useMap();
  const prevRef = useRef(null);
  useEffect(() => {
    if (target && target !== prevRef.current) {
      map.flyTo(target, 17, { duration: 1.2 });
      prevRef.current = target;
    }
  }, [target, map]);
  return null;
}

// Calcul de longueur Haversine (mètres)
function haversineTotal(pts) {
  if (!pts || pts.length < 2) return 0;
  const R = 6371000;
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [lat1, lon1] = pts[i];
    const [lat2, lon2] = pts[i + 1];
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return Math.round(total);
}

// Modale création tronçon
function CreateTronconModal({ onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    intitule: '', etat_general: 'bon', longueur_ml: '',
    largeur_m: '', revetement: '', annee_derniere_refection: '',
  });
  const [saving,    setSaving]    = useState(false);
  const [address,   setAddress]   = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [flyTarget, setFlyTarget] = useState(null);
  const [drawPoints, setDrawPoints] = useState([]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const computedLength = useMemo(() => haversineTotal(drawPoints), [drawPoints]);

  const handleMapClick = useCallback((latlng) => {
    setDrawPoints(pts => [...pts, [latlng.lat, latlng.lng]]);
  }, []);

  const geocode = async () => {
    const q = address.trim();
    if (!q) return;
    setGeocoding(true);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'fr' } }
      );
      const d = await r.json();
      if (d.length > 0) {
        setFlyTarget([parseFloat(d[0].lat), parseFloat(d[0].lon)]);
      } else {
        toast.error('Adresse introuvable');
      }
    } catch { toast.error('Erreur de géocodage'); }
    finally { setGeocoding(false); }
  };

  const handleSubmit = async () => {
    if (!form.intitule.trim()) { toast.error('L\'intitulé est requis'); return; }
    setSaving(true);
    try {
      const longueur = form.longueur_ml
        ? parseFloat(form.longueur_ml)
        : (computedLength > 0 ? computedLength : null);
      await api.post('/patrimoine/voirie', {
        ...form,
        longueur_ml:              longueur,
        largeur_m:                form.largeur_m ? parseFloat(form.largeur_m) : null,
        annee_derniere_refection: form.annee_derniere_refection ? parseInt(form.annee_derniere_refection) : null,
        geom_points:              drawPoints.length >= 2 ? drawPoints : null,
      });
      toast.success('Tronçon créé');
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-3">
      <div className="bg-white rounded-xl shadow-xl w-full flex flex-col"
        style={{ maxWidth: '1100px', height: '88vh' }}>

        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <h3 className="font-heading font-semibold text-text-main">Nouveau tronçon de voirie</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        {/* Corps : formulaire + carte */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Formulaire (gauche) ─────────────────────────────────────────── */}
          <div className="w-72 shrink-0 border-r border-border flex flex-col overflow-y-auto p-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Intitulé *</label>
              <input type="text" value={form.intitule}
                onChange={e => set('intitule', e.target.value)}
                className="input w-full" placeholder="Rue de la Paix…" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">État</label>
              <select value={form.etat_general} onChange={e => set('etat_general', e.target.value)} className="input w-full">
                {[['bon','Bon'],['moyen','Moyen'],['degrade','Dégradé'],['tres_degrade','Très dégradé']].map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Revêtement</label>
              <input type="text" value={form.revetement}
                onChange={e => set('revetement', e.target.value)}
                className="input w-full" placeholder="Enrobé, béton, pavés…" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Largeur (m)</label>
                <input type="number" step="0.1" min="0" value={form.largeur_m}
                  onChange={e => set('largeur_m', e.target.value)} className="input w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Dernière réfection</label>
                <input type="number" min="1950" max="2030" value={form.annee_derniere_refection}
                  onChange={e => set('annee_derniere_refection', e.target.value)}
                  className="input w-full" placeholder="2019" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Longueur (m)
                {computedLength > 0 && !form.longueur_ml && (
                  <span className="ml-1 text-blue-500">— auto : {computedLength} m</span>
                )}
              </label>
              <input type="number" step="0.1" min="0" value={form.longueur_ml}
                onChange={e => set('longueur_ml', e.target.value)}
                className="input w-full"
                placeholder={computedLength > 0 ? `${computedLength} m (tracé)` : 'ex : 120'} />
            </div>

            {/* Récap tracé */}
            <div className="mt-auto pt-3 border-t border-border text-xs text-text-muted space-y-1">
              <div className="flex justify-between">
                <span>Points tracés</span>
                <span className="font-mono font-semibold text-text-main">{drawPoints.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Longueur calculée</span>
                <span className="font-mono font-semibold text-text-main">
                  {computedLength > 0 ? `${computedLength} m` : '—'}
                </span>
              </div>
              {drawPoints.length < 2 && (
                <p className="text-xs text-orange-500 pt-1">
                  Tracez au moins 2 points sur la carte, ou créez sans tracé.
                </p>
              )}
            </div>
          </div>

          {/* ── Carte (droite) ───────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Barre recherche + contrôles tracé */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-gray-50 shrink-0 flex-wrap">
              <div className="flex flex-1 min-w-48 items-center gap-1">
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && geocode()}
                  className="input flex-1 text-sm"
                  placeholder="Rechercher une adresse…"
                />
                <button
                  onClick={geocode}
                  disabled={geocoding || !address.trim()}
                  className="btn-secondary px-2.5 py-1.5 flex items-center gap-1 text-sm"
                  title="Centrer la carte sur cette adresse"
                >
                  <Search size={13} />
                  {geocoding ? '…' : 'Aller'}
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDrawPoints(p => p.slice(0, -1))}
                  disabled={drawPoints.length === 0}
                  className="btn-secondary px-2 py-1.5 flex items-center gap-1 text-xs disabled:opacity-40"
                  title="Annuler le dernier point"
                >
                  <Undo2 size={12} /> Annuler
                </button>
                <button
                  onClick={() => setDrawPoints([])}
                  disabled={drawPoints.length === 0}
                  className="btn-secondary px-2 py-1.5 flex items-center gap-1 text-xs disabled:opacity-40 hover:text-red-500"
                  title="Effacer tout le tracé"
                >
                  <Trash2 size={12} /> Effacer
                </button>
              </div>
            </div>

            {/* Carte Leaflet */}
            <div className="flex-1 relative" style={{ cursor: 'crosshair' }}>
              <MapContainer
                center={[50.32, 3.39]}
                zoom={14}
                className="h-full w-full"
                style={{ cursor: 'crosshair' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <DrawClickHandler onMapClick={handleMapClick} />
                {flyTarget && <FlyToLocation target={flyTarget} />}

                {/* Polyline du tracé */}
                {drawPoints.length >= 2 && (
                  <Polyline positions={drawPoints} color="#1A3A5C" weight={4} opacity={0.85} />
                )}

                {/* Points du tracé */}
                {drawPoints.map((pt, i) => (
                  <CircleMarker key={i} center={pt} radius={i === 0 || i === drawPoints.length - 1 ? 7 : 5}
                    pathOptions={{
                      color: '#fff', fillColor: i === 0 ? '#1E7E45' : i === drawPoints.length - 1 ? '#C0392B' : '#1A3A5C',
                      fillOpacity: 1, weight: 2,
                    }}
                  />
                ))}
              </MapContainer>

              {/* Aide overlay */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000]
                              bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs
                              text-text-muted shadow pointer-events-none">
                {drawPoints.length === 0
                  ? '🖱 Cliquez sur la carte pour commencer le tracé'
                  : `${drawPoints.length} point${drawPoints.length > 1 ? 's' : ''} — ${computedLength} m`}
              </div>
            </div>
          </div>
        </div>

        {/* Pied de modale */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0 bg-gray-50">
          <p className="text-xs text-text-muted">
            Le tracé peut être modifié après la création depuis la fiche du tronçon.
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Annuler</button>
            <button
              onClick={handleSubmit}
              disabled={saving || !form.intitule.trim()}
              className="btn-primary"
            >
              {saving ? 'Création…' : 'Créer le tronçon'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const TYPE_LAMPE_OPTIONS = [
  { value: '',            label: '— Non renseigné —' },
  { value: 'led',         label: 'LED' },
  { value: 'sodium_hp',   label: 'Sodium haute pression (SHP)' },
  { value: 'fluocompacte',label: 'Fluocompacte' },
  { value: 'mercure',     label: 'Mercure haute pression' },
  { value: 'autre',       label: 'Autre' },
];

// Modale création point lumineux
function CreatePLModal({ onClose, onSaved }) {
  const toast = useToast();
  const [armoires, setArmoires] = useState([]);
  const [form, setForm] = useState({ reference: '', armoire_id: '', etat_general: 'fonctionnel', type_lampe: '', puissance_w: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    api.get('/patrimoine/eclairage/armoires').then(d => setArmoires(d || [])).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/patrimoine/eclairage/points', {
        ...form,
        puissance_w: form.puissance_w ? parseFloat(form.puissance_w) : null,
      });
      toast.success('Point lumineux créé');
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-heading font-semibold text-text-main">Nouveau point lumineux</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Référence *</label>
            <input type="text" value={form.reference} onChange={e => set('reference', e.target.value)} className="input w-full" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Armoire</label>
            <select value={form.armoire_id} onChange={e => set('armoire_id', e.target.value)} className="input w-full">
              <option value="">{'—'} Sélectionner {'—'}</option>
              {armoires.map(a => <option key={a.id} value={a.id}>{a.intitule} {a.localisation ? `(${a.localisation})` : ''}</option>)}
            </select>
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
              <input type="number" min="0" value={form.puissance_w} onChange={e => set('puissance_w', e.target.value)} className="input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">État</label>
            <select value={form.etat_general} onChange={e => set('etat_general', e.target.value)} className="input w-full">
              {['fonctionnel','defaillant','hors_service','en_travaux'].map(k => (
                <option key={k} value={k}>{ETAT_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'En cours...' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modale création bâtiment
function CreateBatimentModal({ onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ intitule: '', adresse: '', surface_plancher_m2: '', annee_construction: '', dpe_classe: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/patrimoine/batiments', {
        ...form,
        surface_plancher_m2: form.surface_plancher_m2 ? parseFloat(form.surface_plancher_m2) : null,
        annee_construction: form.annee_construction ? parseInt(form.annee_construction) : null,
        dpe_classe: form.dpe_classe || null,
      });
      toast.success('Bâtiment créé');
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-heading font-semibold text-text-main">Nouveau bâtiment</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Intitulé *</label>
            <input type="text" value={form.intitule} onChange={e => set('intitule', e.target.value)} className="input w-full" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Adresse</label>
            <input type="text" value={form.adresse} onChange={e => set('adresse', e.target.value)} className="input w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Surface m²</label>
              <input type="number" min="0" step="0.1" value={form.surface_plancher_m2} onChange={e => set('surface_plancher_m2', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Année construction</label>
              <input type="number" min="1800" max="2030" value={form.annee_construction} onChange={e => set('annee_construction', e.target.value)} className="input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Classe DPE</label>
            <select value={form.dpe_classe} onChange={e => set('dpe_classe', e.target.value)} className="input w-full">
              <option value="">{'—'} Inconnu {'—'}</option>
              {['A','B','C','D','E','F','G'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'En cours...' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Marchés
const MARCHE_TYPE_LABELS  = { investissement: 'Investissement', gros_entretien: 'Gros entretien' };
const MARCHE_TYPE_COLORS  = { investissement: '#1A3A5C', gros_entretien: '#E8920A' };
const MARCHE_STATUT_COLORS = {
  en_cours: { bg: '#DBEAFE', color: '#1D4ED8', label: 'En cours' },
  termine:  { bg: '#D1FAE5', color: '#065F46', label: 'Terminé' },
  suspendu: { bg: '#FEF3C7', color: '#92400E', label: 'Suspendu' },
};

const DOMAINE_CFG = {
  voirie:    { label: 'Voirie',           color: '#1A3A5C' },
  mobilier:  { label: 'Mobilier urbain',  color: '#7C3AED' },
  eclairage: { label: 'Eclairage public', color: '#D97706' },
  batiment:  { label: 'Bâtiments',        color: '#0D9488' },
};

function CreateMarcheModal({ onClose, onSaved, defaultDomaine = 'voirie', allowedDomains }) {
  const toast = useToast();
  const [form, setForm] = useState({
    domaine: defaultDomaine, intitule: '', numero_marche: '',
    type_travaux: 'investissement', prestataire: '',
    date_debut: '', date_fin: '', montant_ht: '', statut: 'en_cours', description: '',
  });
  const domainesAffiches = allowedDomains
    ? Object.entries(DOMAINE_CFG).filter(([k]) => allowedDomains.includes(k))
    : Object.entries(DOMAINE_CFG);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/patrimoine/voirie/marches', {
        ...form,
        montant_ht: form.montant_ht !== '' ? parseFloat(form.montant_ht) : null,
      });
      toast.success('Marché créé');
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white z-10">
          <h3 className="font-heading font-semibold text-text-main">Nouveau marché</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">

          {/* Domaine */}
          {domainesAffiches.length > 1 && (
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Domaine *</label>
              <div className="flex gap-3">
                {domainesAffiches.map(([val, cfg]) => (
                  <button key={val} type="button" onClick={() => set('domaine', val)}
                    className="flex-1 py-2 px-3 rounded-lg text-sm font-medium border-2 transition-colors"
                    style={form.domaine === val
                      ? { borderColor: cfg.color, backgroundColor: cfg.color + '12', color: cfg.color }
                      : { borderColor: '#E5E7EB', backgroundColor: 'white', color: '#6B7280' }}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>
          )}

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
              <label className="block text-xs font-medium text-text-muted mb-1">Type de travaux *</label>
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
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'En cours...' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SectionMarches({ refreshKey = 0, domainTab = 'voirie', onDomainChange, allowedDomains }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [marches, setMarches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [openType, setOpenType] = useState({ investissement: true, gros_entretien: true });
  const [syncing, setSyncing] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try { setMarches(await api.get('/patrimoine/voirie/marches') || []); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const marchesDomaine = marches.filter(m => (m.domaine || 'voirie') === domainTab);

  const byType = {
    investissement: marchesDomaine.filter(m => m.type_travaux === 'investissement'),
    gros_entretien: marchesDomaine.filter(m => m.type_travaux === 'gros_entretien'),
  };

  const kpiInvest = byType.investissement.reduce((s, m) => s + (m.total_engage || 0), 0);
  const kpiGros   = byType.gros_entretien.reduce((s, m) => s + (m.total_engage || 0), 0);

  const toggleType = (t) => setOpenType(s => ({ ...s, [t]: !s[t] }));

  const handleSyncMarche = async (m) => {
    if (!m.interventions_par_exercice?.length) return;
    setSyncing(s => ({ ...s, [m.id]: true }));
    try {
      await Promise.all(
        m.interventions_par_exercice.map(({ exercice, total_ht }) =>
          api.post(`/patrimoine/voirie/marches/${m.id}/engagements`, {
            exercice,
            montant_engage_ht: Math.round(total_ht * 100) / 100,
            create_only: true, // Ne pas écraser un montant autorisé déjà renseigné manuellement
          })
        )
      );
      toast.success(`Exercices synchronisés — ${m.intitule}`);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSyncing(s => ({ ...s, [m.id]: false })); }
  };

  const MarcheRow = ({ m }) => {
    const statutCfg = MARCHE_STATUT_COLORS[m.statut] || MARCHE_STATUT_COLORS.en_cours;
    const engRows   = m.engagements || [];
    const orphans   = m.orphan_iv   || [];
    const allRows   = [...engRows, ...orphans].sort((a, b) => a.exercice - b.exercice);
    const hasData   = allRows.length > 0;

    return (
      <tr className="border-b border-border hover:bg-gray-50 align-top">
        <td className="py-2.5 px-4 text-sm font-medium text-text-main max-w-xs">
          <div>{m.intitule}</div>
          {m.numero_marche && <div className="text-xs font-mono text-text-muted">N° {m.numero_marche}</div>}
        </td>
        <td className="py-2.5 px-4 text-sm text-text-muted">{m.prestataire || '—'}</td>
        <td className="py-2.5 px-4 font-mono text-sm text-right text-text-main">{fmtEur(m.montant_ht)}</td>

        <td className="py-2.5 px-4 text-right">
          {hasData ? (
            <div className="flex flex-col items-end gap-0.5">
              {allRows.map(row => (
                <span key={row.exercice} className="font-mono text-xs text-text-main">
                  <span className="text-text-muted mr-1">{row.exercice}</span>
                  {row.montant_engage_ht != null ? fmtEur(row.montant_engage_ht) : <span className="italic text-text-muted">{'—'}</span>}
                </span>
              ))}
              <span className="font-mono text-sm font-semibold text-primary mt-0.5">{fmtEur(m.total_engage)}</span>
            </div>
          ) : <span className="text-text-muted text-xs">{'—'}</span>}
        </td>

        <td className="py-2.5 px-4 text-right">
          {hasData ? (
            <div className="flex flex-col items-end gap-0.5">
              {allRows.map(row => {
                const iv  = row.total_interventions_ht || 0;
                const aut = row.montant_engage_ht || 0;
                const over = aut > 0 && iv > aut;
                return (
                  <span key={row.exercice} className="font-mono text-xs flex items-center gap-1">
                    {over && <span title="Dépassement autorisé" className="text-orange-500 font-bold">&#9888;</span>}
                    <span style={{ color: iv > 0 ? '#7C3AED' : undefined }}>{fmtEur(iv)}</span>
                  </span>
                );
              })}
              <span className="font-mono text-sm font-semibold mt-0.5" style={{ color: '#7C3AED' }}>{fmtEur(m.total_interventions)}</span>
            </div>
          ) : <span className="text-text-muted text-xs">{'—'}</span>}
        </td>

        <td className="py-2.5 px-4">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: statutCfg.bg, color: statutCfg.color }}>
            {statutCfg.label}
          </span>
        </td>
        <td className="py-2.5 px-3">
          <div className="flex items-center gap-1.5">
            {hasData && (
              <button
                onClick={() => handleSyncMarche(m)}
                disabled={!!syncing[m.id]}
                className="btn-secondary text-xs px-2 py-1 flex items-center gap-1"
                title="Créer les exercices manquants à partir des interventions (ne modifie pas un montant autorisé déjà renseigné)"
              >
                <RefreshCw size={11} className={syncing[m.id] ? 'animate-spin' : ''} />
                {syncing[m.id] ? 'Sync...' : 'Sync'}
              </button>
            )}
            <button onClick={() => navigate(`/patrimoine/voirie/marche/${m.id}`)} className="btn-secondary text-xs px-2 py-1">Voir</button>
          </div>
        </td>
      </tr>
    );
  };

  const TypeSection = ({ typeKey }) => {
    const items        = byType[typeKey] || [];
    const color        = MARCHE_TYPE_COLORS[typeKey];
    const label        = MARCHE_TYPE_LABELS[typeKey];
    const totalAutorise = items.reduce((s, m) => s + (m.total_engage || 0), 0);
    const totalEngage   = items.reduce((s, m) => s + (m.total_interventions || 0), 0);
    const isOpen = openType[typeKey];

    return (
      <div className="card overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-4 border-b border-border hover:bg-gray-50 transition-colors"
          onClick={() => toggleType(typeKey)}
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold"
              style={{ backgroundColor: color + '1A', color }}>
              {label}
            </span>
            <span className="text-sm text-text-muted">{items.length} marché{items.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <div className="text-xs text-text-muted">Autorisé par an</div>
              <div className="font-mono text-sm font-semibold text-primary">{fmtEur(totalAutorise)}</div>
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-xs text-text-muted">Engagé</div>
              <div className="font-mono text-sm font-semibold" style={{ color: '#7C3AED' }}>{fmtEur(totalEngage)}</div>
            </div>
            {isOpen ? <ChevronDown size={16} className="text-text-muted" /> : <ChevronRight size={16} className="text-text-muted" />}
          </div>
        </button>

        {isOpen && (
          items.length === 0 ? (
            <div className="p-6 text-center text-text-muted text-sm">Aucun marché enregistré.</div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 440 }}>
              <table className="w-full text-left">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                  <tr className="border-b border-border bg-gray-50/70">
                    <th className="py-2 px-4 text-xs font-semibold text-text-muted uppercase tracking-wide">Intitulé</th>
                    <th className="py-2 px-4 text-xs font-semibold text-text-muted uppercase tracking-wide">Prestataire</th>
                    <th className="py-2 px-4 text-xs font-semibold text-text-muted uppercase tracking-wide text-right">Montant HT</th>
                    <th className="py-2 px-4 text-xs font-semibold text-text-muted uppercase tracking-wide text-right">Autorisé par an</th>
                    <th className="py-2 px-4 text-xs font-semibold text-text-muted uppercase tracking-wide text-right" style={{ color: '#7C3AED' }}>Engagé</th>
                    <th className="py-2 px-4 text-xs font-semibold text-text-muted uppercase tracking-wide">Statut</th>
                    <th className="py-2 px-3 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {items.map(m => <MarcheRow key={m.id} m={m} />)}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-border">
                    <td colSpan={2} className="py-2 px-4 text-xs font-semibold text-text-muted uppercase">Total {label}</td>
                    <td className="py-2 px-4" />
                    <td className="py-2 px-4 font-mono font-bold text-sm text-right text-primary">{fmtEur(totalAutorise)}</td>
                    <td className="py-2 px-4 font-mono font-bold text-sm text-right" style={{ color: '#7C3AED' }}>{fmtEur(totalEngage)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-base text-text-main flex items-center gap-2">
          <Briefcase size={18} className="text-primary" /> Marchés
        </h3>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-xs flex items-center gap-1.5">
          <Plus size={13} /> Nouveau marché
        </button>
      </div>

      {/* Onglets domaines (masqué si un seul domaine autorisé) */}
      {(!allowedDomains || allowedDomains.length > 1) && (
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
          {Object.entries(DOMAINE_CFG)
            .filter(([val]) => !allowedDomains || allowedDomains.includes(val))
            .map(([val, cfg]) => (
            <button
              key={val}
              onClick={() => onDomainChange && onDomainChange(val)}
              className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={domainTab === val
                ? { backgroundColor: 'white', color: cfg.color, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                : { color: '#6B7280' }}
            >
              {cfg.label}
              <span className="ml-1.5 text-xs font-mono opacity-60">
                {marches.filter(m => (m.domaine || 'voirie') === val).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* KPIs du domaine actif */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4 flex flex-col gap-1">
          <div className="text-xs text-text-muted uppercase tracking-wide font-medium">Marchés</div>
          <div className="font-mono font-bold text-2xl text-text-main">{marchesDomaine.length}</div>
        </div>
        <div className="card p-4 flex flex-col gap-1">
          <div className="text-xs text-text-muted uppercase tracking-wide font-medium">En cours</div>
          <div className="font-mono font-bold text-2xl text-primary">{marchesDomaine.filter(m => m.statut === 'en_cours').length}</div>
        </div>
        <div className="card p-4 flex flex-col gap-1">
          <div className="text-xs text-text-muted uppercase tracking-wide font-medium">Autorisé investissement</div>
          <div className="font-mono font-bold text-xl" style={{ color: MARCHE_TYPE_COLORS.investissement }}>{fmtEur(kpiInvest)}</div>
        </div>
        <div className="card p-4 flex flex-col gap-1">
          <div className="text-xs text-text-muted uppercase tracking-wide font-medium">Autorisé gros entretien</div>
          <div className="font-mono font-bold text-xl" style={{ color: MARCHE_TYPE_COLORS.gros_entretien }}>{fmtEur(kpiGros)}</div>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : (
        <>
          <TypeSection typeKey="investissement" />
          <TypeSection typeKey="gros_entretien" />
        </>
      )}

      {showCreate && (
        <CreateMarcheModal
          defaultDomaine={domainTab}
          allowedDomains={allowedDomains}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}

// Section Interventions Voirie par catégorie
const STATUT_COLORS_IV = {
  signalee:   { bg: '#FEE2E2', color: '#991B1B', label: 'Signalée' },
  programmee: { bg: '#DBEAFE', color: '#1D4ED8', label: 'Programmée' },
  en_cours:   { bg: '#FEF3C7', color: '#92400E', label: 'En cours' },
  realisee:   { bg: '#D1FAE5', color: '#065F46', label: 'Réalisée' },
  cloturee:   { bg: '#F3F4F6', color: '#374151', label: 'Clôturée' },
};

function SectionInterventionsVoirie({ onSynced, theme = 'voirie' }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === 'read';
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState({ investissement: true, gros_entretien: true, __autres__: true });
  const [syncing, setSyncing] = useState({});
  const [ivModal, setIvModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api.get(`/patrimoine/voirie/interventions-voirie?theme=${theme}`)); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [theme]);

  useEffect(() => { load(); }, [load, theme]);

  const handleSyncEngagement = async (marcheId, exercice, totalHt) => {
    const key = `${marcheId}|${exercice}`;
    setSyncing(s => ({ ...s, [key]: true }));
    try {
      await api.post(`/patrimoine/voirie/marches/${marcheId}/engagements`, {
        exercice,
        montant_engage_ht: Math.round(totalHt * 100) / 100,
        create_only: true, // Ne pas écraser un montant autorisé déjà renseigné manuellement
      });
      toast.success(`Engagement ${exercice} mis à jour — ${fmtEur(totalHt)}`);
      load();
      onSynced && onSynced();
    } catch (err) { toast.error(err.message); }
    finally { setSyncing(s => ({ ...s, [key]: false })); }
  };

  if (loading) return <Skeleton className="h-40 rounded-xl" />;
  if (!data)   return null;

  const { interventions, totaux } = data;

  const MARCHE_CATEGORIES_SET = new Set(['investissement', 'gros_entretien']);

  const TypeBlock = ({ typeKey }) => {
    const isAutres  = typeKey === '__autres__';
    const label     = isAutres ? 'Autres interventions' : MARCHE_TYPE_LABELS[typeKey];
    const color     = isAutres ? '#6B7280' : MARCHE_TYPE_COLORS[typeKey];
    const items     = isAutres
      ? interventions.filter(iv => !MARCHE_CATEGORIES_SET.has(iv.categorie))
      : interventions.filter(iv => iv.categorie === typeKey);
    const totalHt   = items.reduce((s, iv) => s + (parseFloat(iv.montant_ht) || 0), 0);
    const totauxGrp = isAutres ? [] : totaux.filter(t => t.categorie === typeKey && t.marche_id);
    const isOpen    = open[typeKey];

    return (
      <div className="card overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between p-4 border-b border-border hover:bg-gray-50 transition-colors"
          onClick={() => setOpen(s => ({ ...s, [typeKey]: !s[typeKey] }))}
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold"
              style={{ backgroundColor: color + '1A', color }}>
              {label}
            </span>
            <span className="text-sm text-text-muted">{items.length} intervention{items.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <div className="text-xs text-text-muted">Total HT</div>
              <div className="font-mono text-sm font-semibold" style={{ color }}>{fmtEur(totalHt)}</div>
            </div>
            {isOpen ? <ChevronDown size={16} className="text-text-muted" /> : <ChevronRight size={16} className="text-text-muted" />}
          </div>
        </button>

        {isOpen && (
          <div>
            {items.length === 0 ? (
              <div className="p-6 text-center text-text-muted text-sm">Aucune intervention enregistrée.</div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 440 }}>
                <table className="w-full text-left">
                  <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                    <tr className="border-b border-border bg-gray-50/70">
                      <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Date</th>
                      <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">
                        {theme === 'mobilier' ? 'Mobilier' : theme === 'eclairage' ? 'Point lumineux' : theme === 'armoire' ? 'Armoire' : theme === 'batiment' ? 'Bâtiment' : theme === 'feux' ? 'Feu tricolore' : theme === 'armoire_feux' ? 'Armoire feux' : 'Tronçon'}
                      </th>
                      <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Nature</th>
                      <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Prestataire</th>
                      <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Marché</th>
                      <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide text-right">Montant HT</th>
                      <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Statut</th>
                      <th className="py-2 px-2 w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((iv, i) => {
                      const sc = STATUT_COLORS_IV[iv.statut] || STATUT_COLORS_IV.signalee;
                      return (
                        <tr key={iv.id}
                          className={`border-b border-border hover:bg-gray-50 ${['voirie','eclairage','armoire','batiment'].includes(theme) ? 'cursor-pointer' : ''} ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}
                          onClick={() => {
                            if (theme === 'voirie')    navigate(`/patrimoine/voirie/${iv.element_id}`);
                            if (theme === 'eclairage') navigate(`/patrimoine/eclairage/${iv.element_id}`);
                            if (theme === 'armoire')   navigate(`/patrimoine/eclairage/armoire/${iv.element_id}`);
                            if (theme === 'batiment')  navigate(`/patrimoine/batiments/${iv.element_id}`);
                          }}>
                          <td className="py-2 px-3 text-xs font-mono text-text-muted whitespace-nowrap">
                            {iv.date_signalement ? new Date(iv.date_signalement + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                          </td>
                          <td className="py-2 px-3 text-sm text-text-main">{iv.element_intitule}</td>
                          <td className="py-2 px-3 text-sm text-text-muted max-w-xs truncate">{iv.nature || '—'}</td>
                          <td className="py-2 px-3 text-sm text-text-muted">{iv.prestataire_nom || '—'}</td>
                          <td className="py-2 px-3 text-xs text-text-muted">
                            {iv.marche ? (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 font-mono text-xs">
                                {iv.marche.numero_marche || iv.marche.intitule}
                              </span>
                            ) : iv.reference_marche || '—'}
                          </td>
                          <td className="py-2 px-3 font-mono text-sm text-right font-semibold text-text-main">
                            {iv.montant_ht ? fmtEur(iv.montant_ht) : '—'}
                          </td>
                          <td className="py-2 px-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ backgroundColor: sc.bg, color: sc.color }}>
                              {sc.label}
                            </span>
                          </td>
                          <td className="py-2 px-2">
                            <button
                              onClick={e => { e.stopPropagation(); setIvModal(iv); }}
                              className="p-1.5 rounded hover:bg-blue-50 text-blue-400"
                              title={isReadOnly ? 'Visualiser' : 'Modifier'}
                            >
                              <Edit2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-border">
                      <td colSpan={5} className="py-2 px-3 text-xs font-semibold text-text-muted uppercase">Total</td>
                      <td className="py-2 px-3 font-mono font-bold text-sm text-right" style={{ color }}>{fmtEur(totalHt)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Mise à jour des engagements par marché + exercice */}
            {totauxGrp.length > 0 && (
              <div className="p-4 border-t border-border bg-blue-50/40">
                <div className="flex items-center gap-2 mb-3">
                  <RefreshCw size={13} className="text-primary" />
                  <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                    Mettre à jour les engagements marchés
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {totauxGrp.map(t => {
                    const key = `${t.marche_id}|${t.exercice}`;
                    return (
                      <div key={key} className="flex items-center justify-between gap-4 bg-white rounded-lg px-3 py-2 border border-border">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-text-main truncate block">
                            {t.marche?.intitule || '—'}
                            {t.marche?.numero_marche && <span className="text-xs font-mono text-text-muted ml-2">N° {t.marche.numero_marche}</span>}
                          </span>
                          <span className="text-xs text-text-muted">{t.count} intervention{t.count > 1 ? 's' : ''} · Exercice {t.exercice}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-sm text-primary">{fmtEur(t.total_ht)}</div>
                          <div className="text-xs text-text-muted">total HT</div>
                        </div>
                        <button
                          onClick={() => handleSyncEngagement(t.marche_id, t.exercice, t.total_ht)}
                          disabled={!!syncing[key]}
                          className="btn-primary text-xs flex items-center gap-1.5 shrink-0"
                        >
                          <RefreshCw size={12} className={syncing[key] ? 'animate-spin' : ''} />
                          {syncing[key] ? 'Sync...' : 'Synchroniser'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-base text-text-main flex items-center gap-2">
          <ClipboardList size={18} className="text-primary" />
          {theme === 'mobilier' ? 'Interventions mobilier par type de travaux' : 'Interventions par type de travaux'}
        </h3>
        <button onClick={load} className="btn-secondary text-xs flex items-center gap-1.5">
          <RefreshCw size={12} /> Actualiser
        </button>
      </div>
      <TypeBlock typeKey="investissement" />
      <TypeBlock typeKey="gros_entretien" />
      {/* Bloc de rattrapage pour les interventions avec catégories hors marchés (ex : feux tricolores) */}
      {interventions.some(iv => !MARCHE_CATEGORIES_SET.has(iv.categorie)) && (
        <TypeBlock typeKey="__autres__" />
      )}

      {ivModal && (
        <InterventionModal
          open={true}
          onClose={() => setIvModal(null)}
          onSaved={() => { setIvModal(null); load(); onSynced && onSynced(); }}
          theme={ivModal.theme || theme}
          elementId={ivModal.element_id}
          typeElement={ivModal.element_intitule}
          intervention={ivModal}
        />
      )}
    </div>
  );
}

// Onglet Voirie
function TabVoirie() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [showRapport, setShowRapport] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [marcheRefreshKey, setMarcheRefreshKey] = useState(0);
  const [domainTab, setDomainTab] = useState('voirie');
  const [tronçonsOpen, setTronçonsOpen] = useState(false);
  const [tronçonsSearch, setTronçonsSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get('/patrimoine/voirie');
      setData(d);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex flex-col gap-3"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;
  if (!data) return null;

  const { troncons, kpis } = data;

  const pieData = Object.entries(kpis.statsByEtat || {}).map(([etat, count]) => ({
    name: ETAT_LABELS[etat] || etat,
    value: count,
    color: ETAT_COLORS[etat] || '#6B7280',
  }));

  const mapCenter = (() => {
    const withLatLng = troncons.find(t => t.latitude && t.longitude);
    if (withLatLng) return [withLatLng.latitude, withLatLng.longitude];
    const withGeom = troncons.find(t => t.geom_points && t.geom_points.length > 0);
    if (withGeom) {
      const p = withGeom.geom_points[0];
      return Array.isArray(p) ? p : [p.lat, p.lng];
    }
    return [50.32, 3.39];
  })();

  return (
    <div className="flex flex-col gap-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard label="Surface totale" value={`${Math.round(kpis.totalSurface).toLocaleString('fr-FR')} m²`} />
        <KpiCard label="Tronçons" value={kpis.total} />
        <KpiCard
          label="Très dégradés"
          value={(kpis.statsByEtat?.tres_degrade || 0)}
          color={kpis.statsByEtat?.tres_degrade > 0 ? '#C0392B' : '#1E7E45'}
        />
      </div>

      {/* Graphique + carte */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pieData.length > 0 && (
          <div className="card p-4">
            <h4 className="font-heading font-semibold text-sm text-text-main mb-3">Répartition par état</h4>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="card overflow-hidden" style={{ minHeight: 260 }}>
          <MapContainer center={mapCenter} zoom={13} style={{ height: 260, width: '100%' }} zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitBoundsAll key={troncons.length} troncons={troncons} />
            {troncons.map(t => {
              const color = ETAT_COLORS[t.etat_general] || '#6B7280';
              if (t.geom_points && t.geom_points.length >= 2) {
                // geom_points stockés comme [[lat, lng], ...]
                const positions = t.geom_points.map(p => Array.isArray(p) ? p : [p.lat, p.lng]);
                return (
                  <Polyline key={t.id} positions={positions}
                    pathOptions={{ color, weight: 5, opacity: 0.85 }}>
                    <Popup>{t.intitule}<br />{ETAT_LABELS[t.etat_general]}</Popup>
                  </Polyline>
                );
              }
              if (t.latitude && t.longitude) {
                return (
                  <CircleMarker key={t.id} center={[t.latitude, t.longitude]}
                    radius={8} fillColor={color} color="#fff" weight={2} fillOpacity={0.85}>
                    <Popup>{t.intitule}<br />{ETAT_LABELS[t.etat_general]}</Popup>
                  </CircleMarker>
                );
              }
              return null;
            })}
          </MapContainer>
        </div>
      </div>

      {/* Tableau tronçons — repliable */}
      <div className="card overflow-hidden">
        <div
          className="flex items-center justify-between p-4 border-b border-border cursor-pointer select-none hover:bg-gray-50 transition-colors"
          onClick={() => setTronçonsOpen(o => !o)}
        >
          <div className="flex items-center gap-2">
            {tronçonsOpen ? <ChevronDown size={15} className="text-text-muted" /> : <ChevronRight size={15} className="text-text-muted" />}
            <h4 className="font-heading font-semibold text-sm text-text-main">
              Tronçons <span className="ml-1 font-mono text-xs font-normal text-text-muted">({troncons.length})</span>
            </h4>
          </div>
          <div className="flex gap-2" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowRapport(true)} className="btn-secondary text-xs flex items-center gap-1.5">
              <FileDown size={13} /> Rapport / Export
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-primary text-xs flex items-center gap-1.5">
              <Plus size={13} /> Nouveau
            </button>
          </div>
        </div>
        {tronçonsOpen && (
          troncons.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm">Aucun tronçon enregistré.</div>
          ) : (
            <>
              <div className="px-4 py-2.5 border-b border-border bg-gray-50/60 flex items-center gap-2">
                <Search size={13} className="text-text-muted shrink-0" />
                <input type="text" value={tronçonsSearch} onChange={e => setTronçonsSearch(e.target.value)}
                  placeholder="Filtrer par intitulé ou revêtement…"
                  className="text-sm bg-transparent outline-none flex-1 text-text-main placeholder:text-text-muted" />
                {tronçonsSearch && <button onClick={() => setTronçonsSearch('')} className="text-text-muted hover:text-text-main"><X size={13} /></button>}
              </div>
              <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 480 }}>
                {(() => {
                  const q = tronçonsSearch.toLowerCase();
                  const filtered = q ? troncons.filter(t => t.intitule?.toLowerCase().includes(q) || t.revetement?.toLowerCase().includes(q)) : troncons;
                  return (
                    <table className="w-full text-left">
                      <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                        <tr className="border-b border-border">
                          <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Intitulé</th>
                          <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Revêtement</th>
                          <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Longueur</th>
                          <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Surface</th>
                          <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">État</th>
                          <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Dernière réfection</th>
                          <th className="py-2 px-2 w-16" />
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.length === 0
                          ? <tr><td colSpan={7} className="py-6 text-center text-sm text-text-muted">Aucun résultat pour « {tronçonsSearch} »</td></tr>
                          : filtered.map((t, i) => (
                            <tr key={t.id} className={`border-b border-border hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                              <td className="py-2.5 px-3 text-sm font-medium text-text-main">{t.intitule}</td>
                              <td className="py-2.5 px-3 text-sm text-text-muted">{t.revetement || '—'}</td>
                              <td className="py-2.5 px-3 text-sm font-mono text-text-muted">{t.longueur_ml ? `${t.longueur_ml} m` : '—'}</td>
                              <td className="py-2.5 px-3 text-sm font-mono text-text-muted">
                                {t.longueur_ml && t.largeur_m ? `${Math.round(t.longueur_ml * t.largeur_m)} m²` : '—'}
                              </td>
                              <td className="py-2.5 px-3"><EtatBadge etat={t.etat_general} /></td>
                              <td className="py-2.5 px-3 text-xs font-mono text-text-muted">{t.annee_derniere_refection || '—'}</td>
                              <td className="py-2.5 px-2">
                                <button onClick={() => navigate(`/patrimoine/voirie/${t.id}`)} className="btn-secondary text-xs px-2 py-1">Voir</button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
              {tronçonsSearch && (
                <div className="px-4 py-2 text-xs text-text-muted border-t border-border">
                  {troncons.filter(t => t.intitule?.toLowerCase().includes(tronçonsSearch.toLowerCase()) || t.revetement?.toLowerCase().includes(tronçonsSearch.toLowerCase())).length} résultat(s) sur {troncons.length}
                </div>
              )}
            </>
          )
        )}
      </div>

      {showCreate && (
        <CreateTronconModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />
      )}
      {showRapport && <RapportModal domain="voirie" onClose={() => setShowRapport(false)} />}

      {/* Section Marchés */}
      <div className="mt-2 pt-4 border-t border-border">
        <SectionMarches refreshKey={marcheRefreshKey} domainTab={domainTab} onDomainChange={setDomainTab} />
      </div>

      {/* Section Interventions par catégorie */}
      <div className="mt-2 pt-4 border-t border-border">
        <SectionInterventionsVoirie onSynced={() => setMarcheRefreshKey(k => k + 1)} theme={domainTab} />
      </div>
    </div>
  );
}

// Onglet Éclairage
// Modale creation armoire
function CreateArmoireModal({ onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ intitule: '', localisation: '', type_armoire: '', puissance_kva: '', annee_pose: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/patrimoine/eclairage/armoires', {
        ...form,
        puissance_kva: form.puissance_kva ? parseFloat(form.puissance_kva) : null,
        annee_pose:    form.annee_pose    ? parseInt(form.annee_pose)       : null,
      });
      toast.success('Armoire creee');
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-heading font-semibold text-text-main">Nouvelle armoire</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Intitule *</label>
            <input type="text" value={form.intitule} onChange={e => set('intitule', e.target.value)} className="input w-full" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Localisation</label>
            <input type="text" value={form.localisation} onChange={e => set('localisation', e.target.value)} className="input w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Type d'armoire</label>
              <input type="text" value={form.type_armoire} onChange={e => set('type_armoire', e.target.value)} className="input w-full" placeholder="PCBT, coffret..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Puissance (kVA)</label>
              <input type="number" min="0" step="0.1" value={form.puissance_kva} onChange={e => set('puissance_kva', e.target.value)} className="input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Annee de pose</label>
            <input type="number" min="1950" max="2030" value={form.annee_pose} onChange={e => set('annee_pose', e.target.value)} className="input w-full" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'En cours...' : 'Creer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Onglet Eclairage
function TabEclairage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [subTab, setSubTab] = useState('points'); // 'points' | 'armoires'
  const [loading, setLoading] = useState(true);
  const [showRapport, setShowRapport] = useState(false);
  const [points, setPoints]   = useState([]);
  const [armoires, setArmoires] = useState([]);
  const [kpis, setKpis]       = useState(null);
  const [showCreatePL, setShowCreatePL]         = useState(false);
  const [showCreateArmoire, setShowCreateArmoire] = useState(false);
  const [showImportEclairage, setShowImportEclairage] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [marcheRefreshKey, setMarcheRefreshKey] = useState(0);
  // Tableau armoires — repliable
  const [armoiresOpen, setArmoiresOpen]     = useState(false);
  const [armoiresSearch, setArmoiresSearch] = useState('');
  // Sélection depuis la carte
  const [selectedPLId, setSelectedPLId] = useState(null);
  const [editingEtat, setEditingEtat]   = useState(null);
  const [savingEtat, setSavingEtat]     = useState(false);
  // Tableau repliable + filtres
  const [tableOpen, setTableOpen]     = useState(false);
  const [plSearch, setPlSearch]       = useState('');
  const [plEtatFilter, setPlEtatFilter] = useState(null); // null = tous, ou ['defaillant','hors_service']

  // ── Double-clic carte → sélectionne + scroll la ligne dans le tableau ────────
  const handleSelectPL = (id) => {
    const p = points.find(pt => pt.id === id);
    if (!p) return;
    setSelectedPLId(id);
    setEditingEtat(p.etat_general);
    setTableOpen(true);           // ouvre le tableau si replié
    setPlSearch('');              // réinitialise le filtre pour que la ligne soit visible
    setTimeout(() => {
      document.getElementById(`pl-row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  const handleSaveEtat = async () => {
    if (!selectedPLId) return;
    const p = points.find(pt => pt.id === selectedPLId);
    if (!p) return;
    if (editingEtat === p.etat_general) { setSelectedPLId(null); setEditingEtat(null); return; }
    setSavingEtat(true);
    try {
      await api.put(`/patrimoine/eclairage/points/${selectedPLId}`, { etat_general: editingEtat });
      setPoints(prev => prev.map(pt => pt.id === selectedPLId ? { ...pt, etat_general: editingEtat } : pt));
      toast.success('État mis à jour');
      setSelectedPLId(null);
      setEditingEtat(null);
    } catch (err) { toast.error(err.message); }
    finally { setSavingEtat(false); }
  };

  const handleCancelEtat = () => { setSelectedPLId(null); setEditingEtat(null); };

  const handleGeocode = async () => {
    setGeocoding(true);
    try {
      const token = localStorage.getItem('opera_token');
      let totalGeocoded = 0;
      let remaining = 1; // valeur initiale > 0 pour entrer dans la boucle
      while (remaining > 0) {
        const res = await fetch('/api/v1/import/eclairage/geocode', {
          method: 'POST', headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Erreur géocodage');
        totalGeocoded += json.data.geocoded;
        remaining = json.data.remaining;
        if (json.data.geocoded === 0) break; // sécurité anti-boucle infinie
      }
      toast.success(`${totalGeocoded} adresse${totalGeocoded > 1 ? 's' : ''} géocodée${totalGeocoded > 1 ? 's' : ''}`);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGeocoding(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pl, arm, k] = await Promise.all([
        api.get('/patrimoine/eclairage/points'),
        api.get('/patrimoine/eclairage/armoires'),
        api.get('/patrimoine/eclairage/kpis'),
      ]);
      setPoints(pl || []);
      setArmoires(arm || []);
      setKpis(k);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex flex-col gap-3"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;

  // KPIs points lumineux
  const statsByEtat = points.reduce((acc, p) => { acc[p.etat_general] = (acc[p.etat_general] || 0) + 1; return acc; }, {});
  const barData = Object.entries(statsByEtat).map(([etat, count]) => ({
    name: ETAT_LABELS[etat] || etat, count, fill: ETAT_COLORS[etat] || '#6B7280',
  }));
  const mapCenterPL = points.find(p => p.latitude && p.longitude)
    ? [points.find(p => p.latitude && p.longitude).latitude, points.find(p => p.latitude && p.longitude).longitude]
    : [50.32, 3.39];

  // KPIs armoires
  const nbArmoiresDefaillantes = armoires.filter(a => a.nb_defaillants > 0).length;
  const mapCenterArm = armoires.find(a => a.latitude && a.longitude)
    ? [armoires.find(a => a.latitude && a.longitude).latitude, armoires.find(a => a.latitude && a.longitude).longitude]
    : [50.32, 3.39];

  const SUB_TABS = [
    { id: 'points',   label: 'Points lumineux', count: points.length },
    { id: 'armoires', label: 'Armoires',         count: armoires.length },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={subTab === t.id
              ? { backgroundColor: 'white', color: '#D97706', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
              : { color: '#6B7280' }}>
            {t.label}
            <span className="ml-1.5 text-xs font-mono opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      {/* ── Points lumineux ── */}
      {subTab === 'points' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Points lumineux" value={kpis?.total || 0} />
            <KpiCard label="Défaillants / Hors service" value={kpis?.defaillants || 0}
              color={kpis?.defaillants > 0 ? '#C0392B' : '#1E7E45'}
              onClick={kpis?.defaillants > 0 ? () => {
                setTableOpen(true);
                setPlEtatFilter(['defaillant', 'hors_service']);
                setPlSearch('');
                setTimeout(() => document.getElementById('pl-table-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
              } : undefined}
            />
            <KpiCard label="% LED" value={`${kpis?.pctLed || 0}%`} color="#2563EB" />
            <KpiCard label="Cout prestataires 12m" value={fmtEur(kpis?.cout12Mois)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {barData.length > 0 && (
              <div className="card p-4">
                <h4 className="font-heading font-semibold text-sm text-text-main mb-3">Repartition par etat</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Points">
                      {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="card overflow-hidden" style={{ minHeight: 260 }}>
              <MapContainer center={mapCenterPL} zoom={13} style={{ height: 260, width: '100%' }} zoomControl={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {points.filter(p => p.latitude && p.longitude).map(p => (
                  <CircleMarker key={p.id} center={[p.latitude, p.longitude]}
                    radius={selectedPLId === p.id ? 9 : 6}
                    pathOptions={{
                      fillColor:   ETAT_COLORS[p.etat_general] || '#6B7280',
                      color:       selectedPLId === p.id ? '#D97706' : '#fff',
                      weight:      selectedPLId === p.id ? 3 : 2,
                      fillOpacity: 0.85,
                    }}
                    eventHandlers={{
                      dblclick: (e) => {
                        L.DomEvent.stop(e);
                        handleSelectPL(p.id);
                      },
                    }}
                  >
                    <Popup>
                      <strong>{p.reference}</strong><br />
                      {ETAT_LABELS[p.etat_general]}<br />
                      <em style={{ fontSize: 11 }}>Double-cliquer pour modifier l'état</em>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </div>

          <div id="pl-table-card" className="card overflow-hidden">
            {/* En-tête repliable */}
            <div
              className="flex items-center justify-between p-4 border-b border-border cursor-pointer select-none hover:bg-gray-50 transition-colors"
              onClick={() => setTableOpen(o => !o)}
            >
              <div className="flex items-center gap-2">
                {tableOpen ? <ChevronDown size={15} className="text-text-muted" /> : <ChevronRight size={15} className="text-text-muted" />}
                <h4 className="font-heading font-semibold text-sm text-text-main">
                  Points lumineux
                  <span className="ml-1.5 font-mono text-xs font-normal text-text-muted">({points.length})</span>
                  {!tableOpen && selectedPLId && (
                    <span className="ml-2 text-xs font-normal text-amber-600">• 1 sélectionné</span>
                  )}
                </h4>
              </div>
              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowRapport(true)} className="btn-secondary text-xs flex items-center gap-1.5">
                  <FileDown size={13} /> Rapport / Export
                </button>
                <button onClick={() => setShowImportEclairage(true)} className="btn-secondary text-xs flex items-center gap-1.5">
                  <FileUp size={13} /> Importer
                </button>
                <button onClick={() => setShowCreatePL(true)} className="btn-primary text-xs flex items-center gap-1.5">
                  <Plus size={13} /> Nouveau
                </button>
              </div>
            </div>

            {/* Contenu dépliable */}
            {tableOpen && (
              points.length === 0 ? (
                <div className="p-8 text-center text-text-muted text-sm">Aucun point lumineux enregistré.</div>
              ) : (
                <>
                  {/* Barre de recherche + badge filtre état */}
                  <div className="px-4 py-2.5 border-b border-border bg-gray-50/60 flex items-center gap-2 flex-wrap">
                    {plEtatFilter && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 shrink-0">
                        Défaillants / Hors service
                        <button onClick={() => setPlEtatFilter(null)} className="ml-0.5 hover:text-red-900" title="Effacer le filtre">
                          <X size={10} />
                        </button>
                      </span>
                    )}
                    <Search size={13} className="text-text-muted shrink-0" />
                    <input
                      type="text"
                      value={plSearch}
                      onChange={e => setPlSearch(e.target.value)}
                      placeholder="Filtrer par référence ou armoire…"
                      className="text-sm bg-transparent outline-none flex-1 text-text-main placeholder:text-text-muted"
                    />
                    {plSearch && (
                      <button onClick={() => setPlSearch('')} className="text-text-muted hover:text-text-main">
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Tableau avec hauteur max et scroll */}
                  <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 520 }}>
                    {(() => {
                      const q = plSearch.toLowerCase();
                      const filtered = points.filter(p => {
                        if (plEtatFilter && !plEtatFilter.includes(p.etat_general)) return false;
                        if (q && !p.reference?.toLowerCase().includes(q) && !p.armoires_eclairage?.intitule?.toLowerCase().includes(q)) return false;
                        return true;
                      });
                      return (
                        <table className="w-full text-left">
                          <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                            <tr className="border-b border-border">
                              <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Référence</th>
                              <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Armoire</th>
                              <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Type lampe</th>
                              <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Puissance</th>
                              <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">État</th>
                              <th className="py-2 px-2 w-16" />
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.length === 0 ? (
                              <tr><td colSpan={6} className="py-6 text-center text-sm text-text-muted">Aucun résultat pour « {plSearch} »</td></tr>
                            ) : filtered.map((p, i) => {
                              const isSelected = selectedPLId === p.id;
                              return (
                                <tr
                                  id={`pl-row-${p.id}`}
                                  key={p.id}
                                  className={`border-b border-border transition-colors ${
                                    isSelected
                                      ? 'bg-amber-50 outline outline-1 outline-amber-300'
                                      : `hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`
                                  }`}
                                >
                                  <td className="py-2.5 px-3 text-sm font-mono font-medium text-text-main">{p.reference}</td>
                                  <td className="py-2.5 px-3 text-sm text-text-muted">{p.armoires_eclairage?.intitule || '—'}</td>
                                  <td className="py-2.5 px-3 text-sm text-text-muted">{p.type_lampe || '—'}</td>
                                  <td className="py-2.5 px-3 text-sm font-mono text-text-muted">{p.puissance_w ? `${p.puissance_w} W` : '—'}</td>
                                  <td className="py-2.5 px-3">
                                    {isSelected ? (
                                      <div className="flex items-center gap-1.5">
                                        <select
                                          value={editingEtat ?? p.etat_general}
                                          onChange={e => setEditingEtat(e.target.value)}
                                          disabled={savingEtat}
                                          autoFocus
                                          className="text-xs border border-amber-300 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                                          onKeyDown={e => { if (e.key === 'Enter') handleSaveEtat(); if (e.key === 'Escape') handleCancelEtat(); }}
                                        >
                                          {['fonctionnel', 'defaillant', 'hors_service', 'en_travaux'].map(k => (
                                            <option key={k} value={k}>{ETAT_LABELS[k]}</option>
                                          ))}
                                        </select>
                                        <button onClick={handleSaveEtat} disabled={savingEtat}
                                          className="text-xs px-1.5 py-0.5 rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 font-bold"
                                          title="Enregistrer (Entrée)">✓</button>
                                        <button onClick={handleCancelEtat} disabled={savingEtat}
                                          className="text-xs px-1.5 py-0.5 rounded border border-gray-300 text-gray-500 hover:bg-gray-100"
                                          title="Annuler (Échap)">✗</button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => { setSelectedPLId(p.id); setEditingEtat(p.etat_general); }}
                                        className="text-left"
                                        title="Cliquer pour modifier l'état"
                                      >
                                        <EtatBadge etat={p.etat_general} />
                                      </button>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-2">
                                    <button onClick={() => navigate(`/patrimoine/eclairage/${p.id}`)} className="btn-secondary text-xs px-2 py-1">Voir</button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                  {(plSearch || plEtatFilter) && (
                    <div className="px-4 py-2 text-xs text-text-muted border-t border-border">
                      {points.filter(p => {
                        if (plEtatFilter && !plEtatFilter.includes(p.etat_general)) return false;
                        const q = plSearch.toLowerCase();
                        if (q && !p.reference?.toLowerCase().includes(q) && !p.armoires_eclairage?.intitule?.toLowerCase().includes(q)) return false;
                        return true;
                      }).length} résultat(s) sur {points.length}
                    </div>
                  )}
                </>
              )
            )}
          </div>
        </>
      )}

      {/* ── Armoires ── */}
      {subTab === 'armoires' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <KpiCard label="Armoires" value={armoires.length} />
            <KpiCard label="Armoires avec defaillants" value={nbArmoiresDefaillantes}
              color={nbArmoiresDefaillantes > 0 ? '#C0392B' : '#1E7E45'} />
            <KpiCard label="Points lumineux total" value={armoires.reduce((s, a) => s + (a.nb_points_lumineux || 0), 0)} />
          </div>

          <div className="card overflow-hidden" style={{ minHeight: 260 }}>
            <MapContainer center={mapCenterArm} zoom={13} style={{ height: 260, width: '100%' }} zoomControl={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {armoires.filter(a => a.latitude && a.longitude).map(a => (
                <CircleMarker key={a.id} center={[a.latitude, a.longitude]} radius={10}
                  fillColor={a.nb_defaillants > 0 ? '#C0392B' : '#D97706'} color="#fff" weight={2} fillOpacity={0.85}>
                  <Popup>
                    <strong>{a.intitule}</strong>
                    {a.localisation && <><br />{a.localisation}</>}
                    <br />{a.nb_points_lumineux} point{a.nb_points_lumineux !== 1 ? 's' : ''} lumineux
                    {a.nb_defaillants > 0 && <><br /><span style={{ color: '#C0392B' }}>{a.nb_defaillants} defaillant{a.nb_defaillants !== 1 ? 's' : ''}</span></>}
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>

          <div className="card overflow-hidden">
            <div
              className="flex items-center justify-between p-4 border-b border-border cursor-pointer select-none hover:bg-gray-50 transition-colors"
              onClick={() => setArmoiresOpen(o => !o)}
            >
              <div className="flex items-center gap-2">
                {armoiresOpen ? <ChevronDown size={15} className="text-text-muted" /> : <ChevronRight size={15} className="text-text-muted" />}
                <h4 className="font-heading font-semibold text-sm text-text-main">
                  Armoires <span className="ml-1 font-mono text-xs font-normal text-text-muted">({armoires.length})</span>
                </h4>
              </div>
              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                {armoires.some(a => !a.localisation && a.latitude) && (
                  <button onClick={handleGeocode} disabled={geocoding}
                    className="btn-secondary text-xs flex items-center gap-1.5"
                    title="Remplir automatiquement les adresses manquantes depuis les coordonnées GPS">
                    <MapPin size={13} /> {geocoding ? 'Géocodage…' : `Géocoder (${armoires.filter(a => !a.localisation && a.latitude).length})`}
                  </button>
                )}
                <button onClick={() => setShowImportEclairage(true)} className="btn-secondary text-xs flex items-center gap-1.5">
                  <FileUp size={13} /> Importer
                </button>
                <button onClick={() => setShowCreateArmoire(true)} className="btn-primary text-xs flex items-center gap-1.5">
                  <Plus size={13} /> Nouvelle armoire
                </button>
              </div>
            </div>
            {armoiresOpen && (
              armoires.length === 0 ? (
                <div className="p-8 text-center text-text-muted text-sm">Aucune armoire enregistrée.</div>
              ) : (
                <>
                  <div className="px-4 py-2.5 border-b border-border bg-gray-50/60 flex items-center gap-2">
                    <Search size={13} className="text-text-muted shrink-0" />
                    <input type="text" value={armoiresSearch} onChange={e => setArmoiresSearch(e.target.value)}
                      placeholder="Filtrer par intitulé ou localisation…"
                      className="text-sm bg-transparent outline-none flex-1 text-text-main placeholder:text-text-muted" />
                    {armoiresSearch && <button onClick={() => setArmoiresSearch('')} className="text-text-muted hover:text-text-main"><X size={13} /></button>}
                  </div>
                  <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 480 }}>
                    {(() => {
                      const q = armoiresSearch.toLowerCase();
                      const filtered = q ? armoires.filter(a => a.intitule?.toLowerCase().includes(q) || a.localisation?.toLowerCase().includes(q)) : armoires;
                      return (
                        <table className="w-full text-left">
                          <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                            <tr className="border-b border-border">
                              <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Intitulé</th>
                              <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Localisation</th>
                              <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide text-center">PL</th>
                              <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide text-center">Défaillants</th>
                              <th className="py-2 px-2 w-16" />
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.length === 0
                              ? <tr><td colSpan={5} className="py-6 text-center text-sm text-text-muted">Aucun résultat pour « {armoiresSearch} »</td></tr>
                              : filtered.map((a, i) => (
                                <tr key={a.id} className={`border-b border-border hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                                  <td className="py-2.5 px-3 text-sm font-medium text-text-main">{a.intitule}</td>
                                  <td className="py-2.5 px-3 text-sm text-text-muted">{a.localisation || '—'}</td>
                                  <td className="py-2.5 px-3 text-sm font-mono text-text-muted text-center">{a.nb_points_lumineux}</td>
                                  <td className="py-2.5 px-3 text-center">
                                    {a.nb_defaillants > 0
                                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">{a.nb_defaillants}</span>
                                      : <span className="text-text-muted text-sm">—</span>}
                                  </td>
                                  <td className="py-2.5 px-2">
                                    <button onClick={() => navigate(`/patrimoine/eclairage/armoire/${a.id}`)} className="btn-secondary text-xs px-2 py-1">Voir</button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                  {armoiresSearch && (
                    <div className="px-4 py-2 text-xs text-text-muted border-t border-border">
                      {armoires.filter(a => a.intitule?.toLowerCase().includes(armoiresSearch.toLowerCase()) || a.localisation?.toLowerCase().includes(armoiresSearch.toLowerCase())).length} résultat(s) sur {armoires.length}
                    </div>
                  )}
                </>
              )
            )}
          </div>
        </>
      )}

      {showCreatePL && (
        <CreatePLModal onClose={() => setShowCreatePL(false)} onSaved={() => { setShowCreatePL(false); load(); }} />
      )}
      {showCreateArmoire && (
        <CreateArmoireModal onClose={() => setShowCreateArmoire(false)} onSaved={() => { setShowCreateArmoire(false); load(); }} />
      )}
      {showRapport && <RapportModal domain="eclairage" onClose={() => setShowRapport(false)} />}
      <ImportEclairageModal
        open={showImportEclairage}
        onClose={() => setShowImportEclairage(false)}
        onSuccess={() => { load(); }}
      />

      {/* Marches eclairage — communs aux deux sous-onglets */}
      <div className="mt-2 pt-4 border-t border-border">
        <SectionMarches refreshKey={marcheRefreshKey} domainTab="eclairage" allowedDomains={['eclairage']} />
      </div>

      {/* Interventions — theme selon sous-onglet actif */}
      <div className="mt-2 pt-4 border-t border-border">
        <SectionInterventionsVoirie
          theme={subTab === 'armoires' ? 'armoire' : 'eclairage'}
          onSynced={() => setMarcheRefreshKey(k => k + 1)}
        />
      </div>
    </div>
  );
}

// Onglet Bâtiments
const DPE_COLORS = { A: '#1E7E45', B: '#3BAA5A', C: '#A3C93B', D: '#E8920A', E: '#D4680A', F: '#C0392B', G: '#7B0000' };

function TabBatiments() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [batiments, setBatiments] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [marcheRefreshKey, setMarcheRefreshKey] = useState(0);
  const [showRapport, setShowRapport] = useState(false);
  const [batimentsOpen, setBatimentsOpen]     = useState(false);
  const [batimentsSearch, setBatimentsSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get('/patrimoine/batiments');
      setBatiments(d || []);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex flex-col gap-3"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;

  const totalSurface = batiments.reduce((acc, b) => acc + (b.surface_plancher_m2 || 0), 0);

  const mapCenter = batiments.find(b => b.latitude && b.longitude)
    ? [batiments.find(b => b.latitude && b.longitude).latitude, batiments.find(b => b.latitude && b.longitude).longitude]
    : [50.32, 3.39];

  const dpeData = ['A','B','C','D','E','F','G'].map(cls => ({
    name: cls,
    value: batiments.filter(b => b.dpe_classe === cls).length,
    fill: DPE_COLORS[cls],
  })).filter(d => d.value > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard label="Bâtiments" value={batiments.length} />
        <KpiCard label="Surface totale" value={`${Math.round(totalSurface).toLocaleString('fr-FR')} m²`} />
        <KpiCard label="DPE F ou G" value={batiments.filter(b => b.dpe_classe === 'F' || b.dpe_classe === 'G').length}
          color={batiments.filter(b => b.dpe_classe === 'F' || b.dpe_classe === 'G').length > 0 ? '#C0392B' : '#1E7E45'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {dpeData.length > 0 && (
          <div className="card p-4">
            <h4 className="font-heading font-semibold text-sm text-text-main mb-3">Répartition DPE</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dpeData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" name="Bâtiments">
                  {dpeData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="card overflow-hidden" style={{ minHeight: 260 }}>
          <MapContainer center={mapCenter} zoom={13} style={{ height: 260, width: '100%' }} zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {batiments.filter(b => b.latitude && b.longitude).map(b => (
              <CircleMarker
                key={b.id}
                center={[b.latitude, b.longitude]}
                radius={10}
                fillColor={DPE_COLORS[b.dpe_classe] || '#6B7280'}
                color="#fff"
                weight={2}
                fillOpacity={0.85}
              >
                <Popup>{b.intitule}<br />DPE: {b.dpe_classe || '?'}<br />{b.surface_plancher_m2 ? `${b.surface_plancher_m2} m²` : ''}</Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div
          className="flex items-center justify-between p-4 border-b border-border cursor-pointer select-none hover:bg-gray-50 transition-colors"
          onClick={() => setBatimentsOpen(o => !o)}
        >
          <div className="flex items-center gap-2">
            {batimentsOpen ? <ChevronDown size={15} className="text-text-muted" /> : <ChevronRight size={15} className="text-text-muted" />}
            <h4 className="font-heading font-semibold text-sm text-text-main">
              Bâtiments <span className="ml-1 font-mono text-xs font-normal text-text-muted">({batiments.length})</span>
            </h4>
          </div>
          <div className="flex gap-2" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowRapport(true)} className="btn-secondary text-xs flex items-center gap-1.5">
              <FileDown size={13} /> Rapport / Export
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-primary text-xs flex items-center gap-1.5">
              <Plus size={13} /> Nouveau
            </button>
          </div>
        </div>
        {batimentsOpen && (
          batiments.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm">Aucun bâtiment enregistré.</div>
          ) : (
            <>
              <div className="px-4 py-2.5 border-b border-border bg-gray-50/60 flex items-center gap-2">
                <Search size={13} className="text-text-muted shrink-0" />
                <input type="text" value={batimentsSearch} onChange={e => setBatimentsSearch(e.target.value)}
                  placeholder="Filtrer par nom ou adresse…"
                  className="text-sm bg-transparent outline-none flex-1 text-text-main placeholder:text-text-muted" />
                {batimentsSearch && <button onClick={() => setBatimentsSearch('')} className="text-text-muted hover:text-text-main"><X size={13} /></button>}
              </div>
              <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 480 }}>
                {(() => {
                  const q = batimentsSearch.toLowerCase();
                  const filtered = q ? batiments.filter(b => b.intitule?.toLowerCase().includes(q) || b.adresse?.toLowerCase().includes(q)) : batiments;
                  return (
                    <table className="w-full text-left">
                      <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                        <tr className="border-b border-border">
                          <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Nom</th>
                          <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Adresse</th>
                          <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Surface</th>
                          <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">DPE</th>
                          <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Année</th>
                          <th className="py-2 px-2 w-16" />
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.length === 0
                          ? <tr><td colSpan={6} className="py-6 text-center text-sm text-text-muted">Aucun résultat pour « {batimentsSearch} »</td></tr>
                          : filtered.map((b, i) => (
                            <tr key={b.id} className={`border-b border-border hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                              <td className="py-2.5 px-3 text-sm font-medium text-text-main">{b.intitule}</td>
                              <td className="py-2.5 px-3 text-sm text-text-muted">{b.adresse || '—'}</td>
                              <td className="py-2.5 px-3 text-sm font-mono text-text-muted">{b.surface_plancher_m2 ? `${b.surface_plancher_m2} m²` : '—'}</td>
                              <td className="py-2.5 px-3">
                                {b.dpe_classe ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold"
                                    style={{ backgroundColor: DPE_COLORS[b.dpe_classe] + '22', color: DPE_COLORS[b.dpe_classe] }}>
                                    {b.dpe_classe}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="py-2.5 px-3 text-sm font-mono text-text-muted">{b.annee_construction || '—'}</td>
                              <td className="py-2.5 px-2">
                                <button onClick={() => navigate(`/patrimoine/batiments/${b.id}`)} className="btn-secondary text-xs px-2 py-1">Voir</button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
              {batimentsSearch && (
                <div className="px-4 py-2 text-xs text-text-muted border-t border-border">
                  {batiments.filter(b => b.intitule?.toLowerCase().includes(batimentsSearch.toLowerCase()) || b.adresse?.toLowerCase().includes(batimentsSearch.toLowerCase())).length} résultat(s) sur {batiments.length}
                </div>
              )}
            </>
          )
        )}
      </div>

      {/* Section Marchés bâtiments */}
      <div className="mt-2 pt-4 border-t border-border">
        <SectionMarches refreshKey={marcheRefreshKey} domainTab="batiment" allowedDomains={['batiment']} />
      </div>

      {/* Section Interventions bâtiments */}
      <div className="mt-2 pt-4 border-t border-border">
        <SectionInterventionsVoirie theme="batiment" onSynced={() => setMarcheRefreshKey(k => k + 1)} />
      </div>

      {showCreate && (
        <CreateBatimentModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />
      )}
      {showRapport && <RapportModal domain="batiments" onClose={() => setShowRapport(false)} />}
    </div>
  );
}

// Page principale
// ── Modales création feux tricolores ─────────────────────────────────────────

function CreateArmoireFeuxModal({ onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ intitule: '', localisation: '', type_controleur: '', marque: '', annee_pose: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/patrimoine/feux/armoires', {
        ...form,
        annee_pose: form.annee_pose ? parseInt(form.annee_pose) : null,
      });
      toast.success('Armoire créée');
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-heading font-semibold text-text-main">Nouvelle armoire feux</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Intitulé *</label>
            <input type="text" value={form.intitule} onChange={e => set('intitule', e.target.value)} className="input w-full" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Localisation</label>
            <input type="text" value={form.localisation} onChange={e => set('localisation', e.target.value)} className="input w-full" placeholder="Ex: Carrefour rue de la Paix…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Type de contrôleur</label>
              <input type="text" value={form.type_controleur} onChange={e => set('type_controleur', e.target.value)} className="input w-full" placeholder="UTC, UTMC…" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Marque</label>
              <input type="text" value={form.marque} onChange={e => set('marque', e.target.value)} className="input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Année de pose</label>
            <input type="number" min="1950" max="2030" value={form.annee_pose} onChange={e => set('annee_pose', e.target.value)} className="input w-full" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'En cours...' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateFeuModal({ onClose, onSaved }) {
  const toast = useToast();
  const [armoires, setArmoires] = useState([]);
  const [form, setForm] = useState({ reference: '', armoire_id: '', type_feu: 'vehicule', technologie: 'led', etat_general: 'fonctionnel', nb_feux: 3 });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    api.get('/patrimoine/feux/armoires').then(d => setArmoires(d || [])).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/patrimoine/feux/points', {
        ...form,
        nb_feux: form.nb_feux ? parseInt(form.nb_feux) : 3,
      });
      toast.success('Feu tricolore créé');
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-heading font-semibold text-text-main">Nouveau feu tricolore</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Référence *</label>
            <input type="text" value={form.reference} onChange={e => set('reference', e.target.value)} className="input w-full" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Armoire dédiée</label>
            <select value={form.armoire_id} onChange={e => set('armoire_id', e.target.value)} className="input w-full">
              <option value="">— Sélectionner —</option>
              {armoires.map(a => <option key={a.id} value={a.id}>{a.intitule}{a.localisation ? ` (${a.localisation})` : ''}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Type de feu</label>
              <select value={form.type_feu} onChange={e => set('type_feu', e.target.value)} className="input w-full">
                <option value="vehicule">Véhicules</option>
                <option value="pieton">Piétons</option>
                <option value="velo">Vélos</option>
                <option value="tram">Tramway</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Technologie</label>
              <select value={form.technologie} onChange={e => set('technologie', e.target.value)} className="input w-full">
                <option value="led">LED</option>
                <option value="incandescent">Incandescent</option>
                <option value="autre">Autre</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Nb feux</label>
              <input type="number" min="1" max="10" value={form.nb_feux} onChange={e => set('nb_feux', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">État</label>
              <select value={form.etat_general} onChange={e => set('etat_general', e.target.value)} className="input w-full">
                {['fonctionnel','defaillant','hors_service','en_travaux'].map(k => (
                  <option key={k} value={k}>{ETAT_LABELS[k]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'En cours...' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Onglet Feux tricolores ────────────────────────────────────────────────────
function TabFeux() {
  const navigate = useNavigate();
  const toast = useToast();
  const [subTab, setSubTab] = useState('feux');
  const [loading, setLoading] = useState(true);
  const [feux, setFeux]       = useState([]);
  const [armoires, setArmoires] = useState([]);
  const [kpis, setKpis]       = useState(null);
  const [showCreateFeu, setShowCreateFeu]           = useState(false);
  const [showCreateArmoire, setShowCreateArmoire]   = useState(false);
  const [showImportFeux, setShowImportFeux]         = useState(false);
  const [armoiresOpen, setArmoiresOpen]             = useState(false);
  const [armoiresSearch, setArmoiresSearch]         = useState('');
  const [selectedFeuxId, setSelectedFeuxId]         = useState(null);
  const [editingEtat, setEditingEtat]               = useState(null);
  const [savingEtat, setSavingEtat]                 = useState(false);
  const [tableOpen, setTableOpen]                   = useState(false);
  const [feuxSearch, setFeuxSearch]                 = useState('');
  const [feuxEtatFilter, setFeuxEtatFilter]         = useState(null);

  const handleSelectFeu = (id) => {
    const f = feux.find(ft => ft.id === id);
    if (!f) return;
    setSelectedFeuxId(id);
    setEditingEtat(f.etat_general);
    setTableOpen(true);
    setFeuxSearch('');
    setTimeout(() => {
      document.getElementById(`feu-row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  const handleSaveEtat = async () => {
    if (!selectedFeuxId) return;
    const f = feux.find(ft => ft.id === selectedFeuxId);
    if (!f) return;
    if (editingEtat === f.etat_general) { setSelectedFeuxId(null); setEditingEtat(null); return; }
    setSavingEtat(true);
    try {
      await api.put(`/patrimoine/feux/points/${selectedFeuxId}`, { etat_general: editingEtat });
      setFeux(prev => prev.map(ft => ft.id === selectedFeuxId ? { ...ft, etat_general: editingEtat } : ft));
      toast.success('État mis à jour');
      setSelectedFeuxId(null);
      setEditingEtat(null);
    } catch (err) { toast.error(err.message); }
    finally { setSavingEtat(false); }
  };

  const handleCancelEtat = () => { setSelectedFeuxId(null); setEditingEtat(null); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, arm, k] = await Promise.all([
        api.get('/patrimoine/feux/points'),
        api.get('/patrimoine/feux/armoires'),
        api.get('/patrimoine/feux/kpis'),
      ]);
      setFeux(f || []);
      setArmoires(arm || []);
      setKpis(k);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex flex-col gap-3"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;

  const statsByEtat = feux.reduce((acc, f) => { acc[f.etat_general] = (acc[f.etat_general] || 0) + 1; return acc; }, {});
  const barData = Object.entries(statsByEtat).map(([etat, count]) => ({
    name: ETAT_LABELS[etat] || etat, count, fill: ETAT_COLORS[etat] || '#6B7280',
  }));
  const mapCenterFeux = feux.find(f => f.latitude && f.longitude)
    ? [feux.find(f => f.latitude && f.longitude).latitude, feux.find(f => f.latitude && f.longitude).longitude]
    : [50.32, 3.39];
  const nbArmoiresDefaillantes = armoires.filter(a => a.nb_defaillants > 0).length;
  const mapCenterArm = armoires.find(a => a.latitude && a.longitude)
    ? [armoires.find(a => a.latitude && a.longitude).latitude, armoires.find(a => a.latitude && a.longitude).longitude]
    : [50.32, 3.39];

  const SUB_TABS = [
    { id: 'feux',    label: 'Feux tricolores', count: feux.length },
    { id: 'armoires', label: 'Armoires',       count: armoires.length },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={subTab === t.id
              ? { backgroundColor: 'white', color: '#DC2626', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
              : { color: '#6B7280' }}>
            {t.label}
            <span className="ml-1.5 text-xs font-mono opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      {/* ── Feux tricolores ── */}
      {subTab === 'feux' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Feux tricolores" value={kpis?.total || 0} />
            <KpiCard label="Défaillants / Hors service" value={kpis?.defaillants || 0}
              color={kpis?.defaillants > 0 ? '#C0392B' : '#1E7E45'}
              onClick={kpis?.defaillants > 0 ? () => {
                setTableOpen(true);
                setFeuxEtatFilter(['defaillant', 'hors_service']);
                setFeuxSearch('');
                setTimeout(() => document.getElementById('feux-table-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
              } : undefined}
            />
            <KpiCard label="% LED" value={`${kpis?.pctLed || 0}%`} color="#2563EB" />
            <KpiCard label="Coût prestataires 12m" value={fmtEur(kpis?.cout12Mois)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {barData.length > 0 && (
              <div className="card p-4">
                <h4 className="font-heading font-semibold text-sm text-text-main mb-3">Répartition par état</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Feux">
                      {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="card overflow-hidden" style={{ minHeight: 260 }}>
              <MapContainer center={mapCenterFeux} zoom={13} style={{ height: 260, width: '100%' }} zoomControl={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {feux.filter(f => f.latitude && f.longitude).map(f => (
                  <CircleMarker key={f.id} center={[f.latitude, f.longitude]}
                    radius={selectedFeuxId === f.id ? 9 : 6}
                    pathOptions={{
                      fillColor:   ETAT_COLORS[f.etat_general] || '#6B7280',
                      color:       selectedFeuxId === f.id ? '#DC2626' : '#fff',
                      weight:      selectedFeuxId === f.id ? 3 : 2,
                      fillOpacity: 0.85,
                    }}
                    eventHandlers={{
                      dblclick: (e) => { L.DomEvent.stop(e); handleSelectFeu(f.id); },
                    }}
                  >
                    <Popup>
                      <strong>{f.reference}</strong><br />
                      {ETAT_LABELS[f.etat_general]}<br />
                      <em style={{ fontSize: 11 }}>Double-cliquer pour modifier l'état</em>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </div>

          <div id="feux-table-card" className="card overflow-hidden">
            <div
              className="flex items-center justify-between p-4 border-b border-border cursor-pointer select-none hover:bg-gray-50 transition-colors"
              onClick={() => setTableOpen(o => !o)}
            >
              <div className="flex items-center gap-2">
                {tableOpen ? <ChevronDown size={15} className="text-text-muted" /> : <ChevronRight size={15} className="text-text-muted" />}
                <h4 className="font-heading font-semibold text-sm text-text-main">
                  Feux tricolores
                  <span className="ml-1.5 font-mono text-xs font-normal text-text-muted">({feux.length})</span>
                  {!tableOpen && selectedFeuxId && (
                    <span className="ml-2 text-xs font-normal text-red-600">• 1 sélectionné</span>
                  )}
                </h4>
              </div>
              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowImportFeux(true)} className="btn-secondary text-xs flex items-center gap-1.5">
                  <FileUp size={13} /> Importer
                </button>
                <button onClick={() => setShowCreateFeu(true)} className="btn-primary text-xs flex items-center gap-1.5">
                  <Plus size={13} /> Nouveau
                </button>
              </div>
            </div>

            {tableOpen && (
              feux.length === 0 ? (
                <div className="p-8 text-center text-text-muted text-sm">Aucun feu tricolore enregistré.</div>
              ) : (
                <>
                  <div className="px-4 py-2.5 border-b border-border bg-gray-50/60 flex items-center gap-2 flex-wrap">
                    {feuxEtatFilter && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 shrink-0">
                        Défaillants / Hors service
                        <button onClick={() => setFeuxEtatFilter(null)} className="ml-0.5 hover:text-red-900" title="Effacer le filtre">
                          <X size={10} />
                        </button>
                      </span>
                    )}
                    <Search size={13} className="text-text-muted shrink-0" />
                    <input
                      type="text"
                      value={feuxSearch}
                      onChange={e => setFeuxSearch(e.target.value)}
                      placeholder="Filtrer par référence ou armoire…"
                      className="text-sm bg-transparent outline-none flex-1 text-text-main placeholder:text-text-muted"
                    />
                    {feuxSearch && (
                      <button onClick={() => setFeuxSearch('')} className="text-text-muted hover:text-text-main">
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 520 }}>
                    {(() => {
                      const q = feuxSearch.toLowerCase();
                      const filtered = feux.filter(f => {
                        if (feuxEtatFilter && !feuxEtatFilter.includes(f.etat_general)) return false;
                        if (q && !f.reference?.toLowerCase().includes(q) && !f.armoires_feux?.intitule?.toLowerCase().includes(q)) return false;
                        return true;
                      });
                      return (
                        <table className="w-full text-left">
                          <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                            <tr className="border-b border-border">
                              <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Référence</th>
                              <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Armoire</th>
                              <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Type</th>
                              <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Techno</th>
                              <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">État</th>
                              <th className="py-2 px-2 w-16" />
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.length === 0 ? (
                              <tr><td colSpan={6} className="py-6 text-center text-sm text-text-muted">Aucun résultat</td></tr>
                            ) : filtered.map((f, i) => {
                              const isSelected = selectedFeuxId === f.id;
                              return (
                                <tr
                                  id={`feu-row-${f.id}`}
                                  key={f.id}
                                  className={`border-b border-border transition-colors ${
                                    isSelected
                                      ? 'bg-red-50 outline outline-1 outline-red-300'
                                      : `hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`
                                  }`}
                                >
                                  <td className="py-2.5 px-3 text-sm font-mono font-medium text-text-main">{f.reference}</td>
                                  <td className="py-2.5 px-3 text-sm text-text-muted">{f.armoires_feux?.intitule || '—'}</td>
                                  <td className="py-2.5 px-3 text-sm text-text-muted capitalize">{f.type_feu || '—'}</td>
                                  <td className="py-2.5 px-3 text-sm text-text-muted capitalize">{f.technologie || '—'}</td>
                                  <td className="py-2.5 px-3">
                                    {isSelected ? (
                                      <div className="flex items-center gap-1.5">
                                        <select
                                          value={editingEtat ?? f.etat_general}
                                          onChange={e => setEditingEtat(e.target.value)}
                                          disabled={savingEtat}
                                          autoFocus
                                          className="text-xs border border-red-300 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-red-400"
                                          onKeyDown={e => { if (e.key === 'Enter') handleSaveEtat(); if (e.key === 'Escape') handleCancelEtat(); }}
                                        >
                                          {['fonctionnel', 'defaillant', 'hors_service', 'en_travaux'].map(k => (
                                            <option key={k} value={k}>{ETAT_LABELS[k]}</option>
                                          ))}
                                        </select>
                                        <button onClick={handleSaveEtat} disabled={savingEtat}
                                          className="text-xs px-1.5 py-0.5 rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 font-bold"
                                          title="Enregistrer (Entrée)">✓</button>
                                        <button onClick={handleCancelEtat} disabled={savingEtat}
                                          className="text-xs px-1.5 py-0.5 rounded border border-gray-300 text-gray-500 hover:bg-gray-100"
                                          title="Annuler (Échap)">✗</button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => { setSelectedFeuxId(f.id); setEditingEtat(f.etat_general); }}
                                        className="text-left"
                                        title="Cliquer pour modifier l'état"
                                      >
                                        <EtatBadge etat={f.etat_general} />
                                      </button>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-2">
                                    <button onClick={() => navigate(`/patrimoine/feux/${f.id}`)} className="btn-secondary text-xs px-2 py-1">Voir</button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                  {(feuxSearch || feuxEtatFilter) && (
                    <div className="px-4 py-2 text-xs text-text-muted border-t border-border">
                      {feux.filter(f => {
                        if (feuxEtatFilter && !feuxEtatFilter.includes(f.etat_general)) return false;
                        const q = feuxSearch.toLowerCase();
                        if (q && !f.reference?.toLowerCase().includes(q) && !f.armoires_feux?.intitule?.toLowerCase().includes(q)) return false;
                        return true;
                      }).length} résultat(s) sur {feux.length}
                    </div>
                  )}
                </>
              )
            )}
          </div>
        </>
      )}

      {/* ── Armoires feux ── */}
      {subTab === 'armoires' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <KpiCard label="Armoires" value={armoires.length} />
            <KpiCard label="Armoires avec défaillants" value={nbArmoiresDefaillantes}
              color={nbArmoiresDefaillantes > 0 ? '#C0392B' : '#1E7E45'} />
            <KpiCard label="Feux total" value={armoires.reduce((s, a) => s + (a.nb_feux || 0), 0)} />
          </div>

          <div className="card overflow-hidden" style={{ minHeight: 260 }}>
            <MapContainer center={mapCenterArm} zoom={13} style={{ height: 260, width: '100%' }} zoomControl={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {armoires.filter(a => a.latitude && a.longitude).map(a => (
                <CircleMarker key={a.id} center={[a.latitude, a.longitude]} radius={10}
                  fillColor={a.nb_defaillants > 0 ? '#C0392B' : '#EF4444'} color="#fff" weight={2} fillOpacity={0.85}>
                  <Popup>
                    <strong>{a.intitule}</strong>
                    {a.localisation && <><br />{a.localisation}</>}
                    <br />{a.nb_feux} feu{a.nb_feux !== 1 ? 'x' : ''}
                    {a.nb_defaillants > 0 && <><br /><span style={{ color: '#C0392B' }}>{a.nb_defaillants} défaillant{a.nb_defaillants !== 1 ? 's' : ''}</span></>}
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>

          <div className="card overflow-hidden">
            <div
              className="flex items-center justify-between p-4 border-b border-border cursor-pointer select-none hover:bg-gray-50 transition-colors"
              onClick={() => setArmoiresOpen(o => !o)}
            >
              <div className="flex items-center gap-2">
                {armoiresOpen ? <ChevronDown size={15} className="text-text-muted" /> : <ChevronRight size={15} className="text-text-muted" />}
                <h4 className="font-heading font-semibold text-sm text-text-main">
                  Armoires <span className="ml-1 font-mono text-xs font-normal text-text-muted">({armoires.length})</span>
                </h4>
              </div>
              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowImportFeux(true)} className="btn-secondary text-xs flex items-center gap-1.5">
                  <FileUp size={13} /> Importer
                </button>
                <button onClick={() => setShowCreateArmoire(true)} className="btn-primary text-xs flex items-center gap-1.5">
                  <Plus size={13} /> Nouvelle armoire
                </button>
              </div>
            </div>
            {armoiresOpen && (
              armoires.length === 0 ? (
                <div className="p-8 text-center text-text-muted text-sm">Aucune armoire enregistrée.</div>
              ) : (
                <>
                  <div className="px-4 py-2.5 border-b border-border bg-gray-50/60 flex items-center gap-2">
                    <Search size={13} className="text-text-muted shrink-0" />
                    <input type="text" value={armoiresSearch} onChange={e => setArmoiresSearch(e.target.value)}
                      placeholder="Filtrer par intitulé ou localisation…"
                      className="text-sm bg-transparent outline-none flex-1 text-text-main placeholder:text-text-muted" />
                    {armoiresSearch && <button onClick={() => setArmoiresSearch('')} className="text-text-muted hover:text-text-main"><X size={13} /></button>}
                  </div>
                  <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 480 }}>
                    {(() => {
                      const q = armoiresSearch.toLowerCase();
                      const filtered = q ? armoires.filter(a => a.intitule?.toLowerCase().includes(q) || a.localisation?.toLowerCase().includes(q)) : armoires;
                      return (
                        <table className="w-full text-left">
                          <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                            <tr className="border-b border-border">
                              <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Intitulé</th>
                              <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Localisation</th>
                              <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide text-center">Feux</th>
                              <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide text-center">Défaillants</th>
                              <th className="py-2 px-2 w-16" />
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.length === 0
                              ? <tr><td colSpan={5} className="py-6 text-center text-sm text-text-muted">Aucun résultat pour « {armoiresSearch} »</td></tr>
                              : filtered.map((a, i) => (
                                <tr key={a.id} className={`border-b border-border hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                                  <td className="py-2.5 px-3 text-sm font-medium text-text-main">{a.intitule}</td>
                                  <td className="py-2.5 px-3 text-sm text-text-muted">{a.localisation || '—'}</td>
                                  <td className="py-2.5 px-3 text-sm font-mono text-text-muted text-center">{a.nb_feux}</td>
                                  <td className="py-2.5 px-3 text-center">
                                    {a.nb_defaillants > 0
                                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">{a.nb_defaillants}</span>
                                      : <span className="text-text-muted text-sm">—</span>}
                                  </td>
                                  <td className="py-2.5 px-2">
                                    <button onClick={() => navigate(`/patrimoine/feux/armoire/${a.id}`)} className="btn-secondary text-xs px-2 py-1">Voir</button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                </>
              )
            )}
          </div>
        </>
      )}

      {showCreateFeu && (
        <CreateFeuModal onClose={() => setShowCreateFeu(false)} onSaved={() => { setShowCreateFeu(false); load(); }} />
      )}
      {showCreateArmoire && (
        <CreateArmoireFeuxModal onClose={() => setShowCreateArmoire(false)} onSaved={() => { setShowCreateArmoire(false); load(); }} />
      )}
      <ImportFeuxModal
        open={showImportFeux}
        onClose={() => setShowImportFeux(false)}
        onSuccess={() => load()}
      />

      {/* Interventions — thème selon sous-onglet actif */}
      <div className="mt-2 pt-4 border-t border-border">
        <SectionInterventionsVoirie
          theme={subTab === 'armoires' ? 'armoire_feux' : 'feux'}
        />
      </div>
    </div>
  );
}

// ── ÉQUIPEMENTS DIVERS ────────────────────────────────────────────────────────

const CATEG_EQUIP_LABELS = {
  borne_escamotable: 'Borne escamotable',
  fontaine:          'Fontaine',
  abri_bus:          'Abri bus',
  distributeur:      'Distributeur',
  horloge:           'Horloge',
  panneau_info:      "Panneau d'information",
  autre:             'Autre',
};
const CATEG_EQUIP_ICONS = {
  borne_escamotable: '🚧', fontaine: '⛲', abri_bus: '🚌',
  distributeur: '🏧', horloge: '🕐', panneau_info: '📋', autre: '📦',
};

function CreateEquipementModal({ onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    intitule: '', categorie: 'autre', localisation: '',
    etat_general: 'fonctionnel', annee_pose: '',
  });
  // Compteurs à créer (propres à cet équipement)
  const [withElec, setWithElec] = useState(false);
  const [elecRef, setElecRef] = useState('');
  const [withEau, setWithEau] = useState(false);
  const [eauRef, setEauRef] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const isValid = withElec || withEau;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) {
      toast.error("Cochez au moins une alimentation électrique ou un compteur d'eau");
      return;
    }
    setSaving(true);
    try {
      const created = await api.post('/patrimoine/equipements-divers', form);
      const promises = [];
      if (withElec) {
        promises.push(api.post('/patrimoine/compteurs', {
          equipement_id: created.id,
          fluide: 'electricite',
          reference_compteur: elecRef || '',
          unite: 'kWh',
        }));
      }
      if (withEau) {
        promises.push(api.post('/patrimoine/compteurs', {
          equipement_id: created.id,
          fluide: 'eau',
          reference_compteur: eauRef || '',
          unite: 'm3',
        }));
      }
      await Promise.all(promises);
      toast.success('Équipement créé');
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-heading font-semibold text-text-main">Nouvel équipement</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16}/></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Intitulé *</label>
            <input type="text" value={form.intitule} onChange={e => set('intitule', e.target.value)}
              className="input w-full" required placeholder="Ex : Borne rue du Moulin"/>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Catégorie</label>
              <select value={form.categorie} onChange={e => set('categorie', e.target.value)} className="input w-full">
                {Object.entries(CATEG_EQUIP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">État</label>
              <select value={form.etat_general} onChange={e => set('etat_general', e.target.value)} className="input w-full">
                <option value="fonctionnel">Fonctionnel</option>
                <option value="defaillant">Défaillant</option>
                <option value="hors_service">Hors service</option>
                <option value="en_travaux">En travaux</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Localisation</label>
            <input type="text" value={form.localisation} onChange={e => set('localisation', e.target.value)}
              className="input w-full" placeholder="Ex : Place du Général de Gaulle"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Année de pose</label>
            <input type="number" value={form.annee_pose} onChange={e => set('annee_pose', e.target.value)}
              className="input w-full" placeholder="Ex : 2019" min="1900" max="2099"/>
          </div>

          {/* ── Alimentation / compteurs dédiés ── */}
          <div className="border border-border rounded-xl p-3 flex flex-col gap-2.5 bg-gray-50">
            <p className="text-xs font-semibold text-text-main">
              Alimentation <span className="text-red-500">*</span>
              <span className="font-normal text-text-muted ml-1">(au moins une requise)</span>
            </p>

            {/* Électricité */}
            <div className={`rounded-lg border p-2.5 transition-colors ${withElec ? 'border-yellow-300 bg-yellow-50' : 'border-border bg-white'}`}>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={withElec} onChange={e => setWithElec(e.target.checked)}
                  className="accent-yellow-500 shrink-0"/>
                <span className="text-xs font-medium text-text-main">⚡ Alimentation électrique</span>
              </label>
              {withElec && (
                <div className="mt-2 pl-5">
                  <label className="block text-xs text-text-muted mb-1">Référence compteur</label>
                  <input type="text" value={elecRef} onChange={e => setElecRef(e.target.value)}
                    className="input w-full text-xs" placeholder="Ex : PDL-12345"/>
                </div>
              )}
            </div>

            {/* Eau */}
            <div className={`rounded-lg border p-2.5 transition-colors ${withEau ? 'border-cyan-300 bg-cyan-50' : 'border-border bg-white'}`}>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={withEau} onChange={e => setWithEau(e.target.checked)}
                  className="accent-cyan-600 shrink-0"/>
                <span className="text-xs font-medium text-text-main">💧 Compteur d'eau</span>
              </label>
              {withEau && (
                <div className="mt-2 pl-5">
                  <label className="block text-xs text-text-muted mb-1">Référence compteur</label>
                  <input type="text" value={eauRef} onChange={e => setEauRef(e.target.value)}
                    className="input w-full text-xs" placeholder="Ex : EAU-67890"/>
                </div>
              )}
            </div>

            {!isValid && (
              <p className="text-xs text-red-500">⚠ Cochez au moins une alimentation.</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary text-sm">Annuler</button>
            <button type="submit" disabled={saving || !form.intitule} className="btn-primary text-sm">
              {saving ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TabEquipements() {
  const navigate = useNavigate();
  const toast = useToast();
  const { canEditPatrimoineReferentiel } = useAuth();

  const [equips, setEquips]       = useState([]);
  const [kpis, setKpis]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [search, setSearch]       = useState('');
  const [categFilter, setCategFilter] = useState(null);
  const [etatFilter, setEtatFilter]   = useState(null);
  const [selectedId, setSelectedId]   = useState(null);
  const [editingEtat, setEditingEtat] = useState(null);
  const [savingEtat, setSavingEtat]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eq, k] = await Promise.all([
        api.get('/patrimoine/equipements-divers'),
        api.get('/patrimoine/equipements-divers/kpis'),
      ]);
      setEquips(eq || []);
      setKpis(k);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveEtat = async () => {
    if (!selectedId) return;
    const eq = equips.find(e => e.id === selectedId);
    if (!eq || editingEtat === eq.etat_general) { setSelectedId(null); setEditingEtat(null); return; }
    setSavingEtat(true);
    try {
      await api.put(`/patrimoine/equipements-divers/${selectedId}`, { etat_general: editingEtat });
      setEquips(prev => prev.map(e => e.id === selectedId ? { ...e, etat_general: editingEtat } : e));
      toast.success('État mis à jour');
      setSelectedId(null); setEditingEtat(null);
    } catch (err) { toast.error(err.message); }
    finally { setSavingEtat(false); }
  };

  if (loading) return <div className="flex flex-col gap-3"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;

  const statsByEtat = equips.reduce((acc, e) => { acc[e.etat_general] = (acc[e.etat_general] || 0) + 1; return acc; }, {});
  const barData = Object.entries(statsByEtat).map(([etat, count]) => ({
    name: ETAT_LABELS[etat] || etat, count, fill: ETAT_COLORS[etat] || '#6B7280',
  }));

  const mapCenter = equips.find(e => e.latitude && e.longitude)
    ? [equips.find(e => e.latitude && e.longitude).latitude, equips.find(e => e.latitude && e.longitude).longitude]
    : [50.32, 3.39];

  const filtered = equips.filter(e => {
    if (etatFilter && e.etat_general !== etatFilter) return false;
    if (categFilter && e.categorie !== categFilter) return false;
    if (search && !(e.intitule?.toLowerCase().includes(search.toLowerCase()) || e.localisation?.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="text-2xl font-bold text-text-main">{kpis?.total ?? equips.length}</div>
          <div className="text-xs text-text-muted mt-0.5">Équipements</div>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="text-2xl font-bold text-red-600">{kpis?.defaillants ?? 0}</div>
          <div className="text-xs text-text-muted mt-0.5">Défaillants / hors service</div>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="text-2xl font-bold text-text-main">{Object.keys(kpis?.byCategorie || {}).length}</div>
          <div className="text-xs text-text-muted mt-0.5">Catégories</div>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="text-xl font-bold text-text-main">
            {kpis?.cout12Mois != null
              ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(kpis.cout12Mois)
              : '—'}
          </div>
          <div className="text-xs text-text-muted mt-0.5">Coût interventions 12 mois</div>
        </div>
      </div>

      {/* Graphiques + carte */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Répartition par état */}
        <div className="bg-white border border-border rounded-xl p-4">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Répartition par état</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip formatter={(v) => [v, 'Nb équipements']} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-32 text-text-muted text-sm">
              Aucun équipement
            </div>
          )}
        </div>

        {/* Répartition par catégorie */}
        <div className="bg-white border border-border rounded-xl p-4">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Par catégorie</h3>
          {Object.entries(kpis?.byCategorie || {}).length > 0 ? (
            <div className="flex flex-col gap-2">
              {Object.entries(kpis.byCategorie).sort((a, b) => b[1] - a[1]).map(([categ, count]) => (
                <div key={categ} className="flex items-center gap-2">
                  <span className="text-base">{CATEG_EQUIP_ICONS[categ] || '📦'}</span>
                  <div className="flex-1 text-xs text-text-main">{CATEG_EQUIP_LABELS[categ] || categ}</div>
                  <span className="text-xs font-bold text-text-main tabular-nums">{count}</span>
                  <div className="w-20 bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-purple-400"
                      style={{ width: `${Math.round((count / equips.length) * 100)}%` }}/>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-text-muted text-sm">
              Aucun équipement
            </div>
          )}
        </div>
      </div>

      {/* Carte */}
      {equips.some(e => e.latitude && e.longitude) && (
        <div className="bg-white border border-border rounded-xl p-4">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Localisation</h3>
          <div className="rounded-xl overflow-hidden" style={{ height: 300 }}>
            <MapContainer center={mapCenter} zoom={14} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'/>
              {equips.filter(e => e.latitude && e.longitude).map(e => (
                <CircleMarker
                  key={e.id}
                  center={[parseFloat(e.latitude), parseFloat(e.longitude)]}
                  radius={8}
                  pathOptions={{ color: ETAT_COLORS[e.etat_general] || '#7C3AED', fillColor: ETAT_COLORS[e.etat_general] || '#7C3AED', fillOpacity: 0.8 }}
                  eventHandlers={{ click: () => navigate(`/patrimoine/equipements-divers/${e.id}`) }}
                >
                  <Popup>{CATEG_EQUIP_ICONS[e.categorie] || '📦'} {e.intitule}<br/>{e.localisation || ''}</Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </div>
      )}

      {/* Tableau collapsible */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setTableOpen(o => !o)}
        >
          <div className="flex items-center gap-2">
            {tableOpen ? <ChevronDown size={16} className="text-text-muted"/> : <ChevronRight size={16} className="text-text-muted"/>}
            <h3 className="text-sm font-semibold text-text-main">Liste des équipements</h3>
            <span className="text-xs text-text-muted font-mono bg-gray-100 px-1.5 py-0.5 rounded">{equips.length}</span>
          </div>
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {canEditPatrimoineReferentiel && (
              <button onClick={() => setShowCreate(true)}
                className="btn-primary text-xs flex items-center gap-1.5">
                <Plus size={13}/> Nouveau
              </button>
            )}
          </div>
        </div>

        {tableOpen && (
          <div className="border-t border-border">
            {/* Filtres */}
            <div className="flex items-center gap-2 p-3 border-b border-border flex-wrap">
              <div className="relative flex-1 min-w-40">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"/>
                <input type="text" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)}
                  className="input pl-7 py-1.5 text-xs w-full"/>
              </div>
              <select value={categFilter || ''} onChange={e => setCategFilter(e.target.value || null)}
                className="input text-xs py-1.5 px-2">
                <option value="">Toutes catégories</option>
                {Object.entries(CATEG_EQUIP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={etatFilter || ''} onChange={e => setEtatFilter(e.target.value || null)}
                className="input text-xs py-1.5 px-2">
                <option value="">Tous états</option>
                <option value="fonctionnel">Fonctionnel</option>
                <option value="defaillant">Défaillant</option>
                <option value="hors_service">Hors service</option>
                <option value="en_travaux">En travaux</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-border">
                  <tr>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-text-muted">Intitulé</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-text-muted">Catégorie</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-text-muted">Localisation</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-text-muted">État</th>
                    <th className="px-3 py-2.5 w-24"/>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-text-muted text-sm">Aucun équipement</td></tr>
                  ) : filtered.map(e => (
                    <tr key={e.id} id={`equip-row-${e.id}`}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedId === e.id ? 'bg-purple-50' : ''}`}
                      onClick={() => { setSelectedId(e.id); setEditingEtat(e.etat_general); }}>
                      <td className="px-3 py-2.5 font-medium text-text-main">
                        <span className="mr-1">{CATEG_EQUIP_ICONS[e.categorie] || '📦'}</span>
                        {e.intitule}
                      </td>
                      <td className="px-3 py-2.5 text-text-muted text-xs">{CATEG_EQUIP_LABELS[e.categorie] || e.categorie}</td>
                      <td className="px-3 py-2.5 text-text-muted text-xs">{e.localisation || '—'}</td>
                      <td className="px-3 py-2.5">
                        {selectedId === e.id ? (
                          <div className="flex items-center gap-1" onClick={ev => ev.stopPropagation()}>
                            <select value={editingEtat} onChange={ev => setEditingEtat(ev.target.value)}
                              className="input text-xs py-0.5 px-1.5 w-32">
                              <option value="fonctionnel">Fonctionnel</option>
                              <option value="defaillant">Défaillant</option>
                              <option value="hors_service">Hors service</option>
                              <option value="en_travaux">En travaux</option>
                            </select>
                            <button onClick={handleSaveEtat} disabled={savingEtat}
                              className="p-1 rounded hover:bg-green-100 text-green-600"><RefreshCw size={11}/></button>
                            <button onClick={() => { setSelectedId(null); setEditingEtat(null); }}
                              className="p-1 rounded hover:bg-gray-100 text-text-muted"><Undo2 size={11}/></button>
                          </div>
                        ) : (
                          <EtatBadge etat={e.etat_general}/>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={ev => { ev.stopPropagation(); navigate(`/patrimoine/equipements-divers/${e.id}`); }}
                          className="text-xs text-primary hover:underline flex items-center gap-0.5">
                          Détails <ChevronRight size={11}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateEquipementModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}

const TABS = [
  { id: 'voirie',               label: 'Voirie',                    icon: Route },
  { id: 'eclairage',            label: 'Éclairage public',          icon: Lightbulb },
  { id: 'feux',                 label: 'Feux tricolores',           icon: TrafficCone },
  { id: 'equipements-divers',   label: 'Équipements divers',        icon: Wrench },
  { id: 'batiments',            label: 'Bâtiments',                 icon: Building2 },
  { id: 'demandes',             label: "Demandes d'intervention",   icon: Bell },
];

export default function PatrimoinePage({ defaultTab = 'voirie' }) {
  const tab = defaultTab;

  const breadcrumbs = [
    { label: 'Gestion Patrimoniale' },
    { label: TABS.find(t => t.id === tab)?.label || 'Patrimoine' },
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="max-w-6xl mx-auto">
        <div className="border-b border-border mb-5 flex gap-0">
          {TABS.map(t => (
            <NavLink
              key={t.id}
              to={`/patrimoine/${t.id}`}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-muted hover:text-text-main'
                }`
              }
            >
              <t.icon size={15} />
              {t.label}
            </NavLink>
          ))}
        </div>

        {tab === 'voirie'             && <TabVoirie />}
        {tab === 'eclairage'          && <TabEclairage />}
        {tab === 'feux'               && <TabFeux />}
        {tab === 'equipements-divers' && <TabEquipements />}
        {tab === 'batiments'          && <TabBatiments />}
        {tab === 'demandes'           && <TabDemandes />}
      </div>
    </AppLayout>
  );
}
