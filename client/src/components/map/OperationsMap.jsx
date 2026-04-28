import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import { MARKER_COLORS, TYPE_CONFIG, STATUT_CONFIG, formatEur } from '../../utils/formatters';
import { TypeBadge, StatutBadge } from '../ui/Badge';

// Corriger le bug d'icônes Leaflet avec Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function createColoredIcon(color, hasAlert) {
  const size = 28;
  const pulse = hasAlert ? `
    <circle cx="14" cy="14" r="13" fill="none" stroke="#C0392B" stroke-width="2" opacity="0.6">
      <animate attributeName="r" values="13;18;13" dur="2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite"/>
    </circle>` : '';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 8}" viewBox="0 0 ${size} ${size + 8}">
      ${pulse}
      <circle cx="14" cy="14" r="11" fill="${color}" stroke="white" stroke-width="2.5"/>
      <circle cx="14" cy="14" r="5" fill="white" opacity="0.9"/>
      <polygon points="9,22 19,22 14,${size + 6}" fill="${color}"/>
    </svg>`;

  return L.divIcon({
    html: svg,
    className: 'custom-marker',
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 8],
    popupAnchor: [0, -(size + 4)]
  });
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.latitude, target.longitude], 16, { duration: 0.8 });
  }, [target, map]);
  return null;
}

const TYPE_FILTERS = [
  { key: 'construction_neuve', label: 'Construction neuve', color: MARKER_COLORS.construction_neuve },
  { key: 'rehabilitation',     label: 'Réhabilitation',     color: MARKER_COLORS.rehabilitation },
  { key: 'amenagement_vrd',    label: 'Aménagement VRD',    color: MARKER_COLORS.amenagement_vrd }
];

export function OperationsMap({ operations, selectedId, onSelect }) {
  const [filters, setFilters] = useState({ construction_neuve: true, rehabilitation: true, amenagement_vrd: true });

  const geolocated = operations.filter(op => op.latitude && op.longitude);
  const nonGeolocated = operations.filter(op => !op.latitude || !op.longitude);
  const filtered = geolocated.filter(op => filters[op.type]);
  const selectedOp = operations.find(op => op.id === selectedId && op.latitude && op.longitude);

  const toggleFilter = (type) => setFilters(prev => ({ ...prev, [type]: !prev[type] }));

  return (
    <div className="flex flex-col h-full">
      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-3">
        {TYPE_FILTERS.map(f => (
          <label key={f.key} className="flex items-center gap-2 cursor-pointer select-none text-sm">
            <input
              type="checkbox"
              checked={filters[f.key]}
              onChange={() => toggleFilter(f.key)}
              className="rounded"
            />
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: f.color }}
            />
            <span className="text-text-main text-xs">{f.label}</span>
          </label>
        ))}
      </div>

      {/* Carte */}
      <div className="flex-1 rounded-[10px] overflow-hidden border border-border" style={{ minHeight: 380 }}>
        <MapContainer
          center={[50.3236, 3.3952]}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {selectedOp && <FlyTo target={selectedOp} />}

          {filtered.map(op => {
            const hasAlert = op.alerts?.length > 0;
            const color = MARKER_COLORS[op.type] || '#2E75B6';
            const icon = createColoredIcon(color, hasAlert);

            return (
              <Marker
                key={op.id}
                position={[op.latitude, op.longitude]}
                icon={icon}
                eventHandlers={{ click: () => onSelect?.(op.id) }}
              >
                <Popup minWidth={220} maxWidth={280}>
                  <MapPopup op={op} />
                </Popup>
              </Marker>
            );
          })}

          {/* Légende */}
          <div className="leaflet-bottom leaflet-left">
            <div className="leaflet-control bg-white rounded-lg shadow p-3 text-xs m-3">
              <div className="font-semibold text-text-main mb-2 font-heading">Types</div>
              {TYPE_FILTERS.map(f => (
                <div key={f.key} className="flex items-center gap-2 mb-1">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: f.color }} />
                  <span className="text-text-muted">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </MapContainer>
      </div>

      {nonGeolocated.length > 0 && (
        <p className="text-text-muted text-xs mt-2 flex items-center gap-1">
          ℹ️ {nonGeolocated.length} opération(s) non géolocalisée(s) non affichée(s) sur la carte
        </p>
      )}
    </div>
  );
}

function MapPopup({ op }) {
  return (
    <div style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
      {op.image_url && (
        <img src={op.image_url} alt="" className="w-full h-24 object-cover rounded mb-2" />
      )}
      <div className="font-heading font-semibold text-sm text-text-main mb-2 leading-tight">
        {op.intitule}
      </div>
      <div className="flex gap-1.5 flex-wrap mb-2">
        <TypeBadge type={op.type} />
        <StatutBadge statut={op.statut} />
      </div>
      {op.charged && (
        <div className="text-xs text-text-muted mb-1">
          <span className="font-medium">Chargé :</span> {op.charged.full_name}
        </div>
      )}
      <div className="text-xs text-text-muted mb-3">
        <span className="font-medium">Enveloppe :</span>{' '}
        <span className="font-mono">{formatEur(op.enveloppe_ht)}</span>
      </div>
      {op.alerts?.length > 0 && (
        <div className="text-xs text-danger font-medium mb-2">
          ⚠ {op.alerts[0].message}
        </div>
      )}
      <Link
        to={`/operations/${op.id}`}
        className="block text-center text-xs font-semibold py-1.5 px-3 rounded"
        style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
      >
        Voir la fiche →
      </Link>
    </div>
  );
}
