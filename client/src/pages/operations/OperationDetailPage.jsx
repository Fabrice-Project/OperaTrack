import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Edit, Trash2, Upload, MapPin, Calendar, Euro, User, Building } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { AppLayout } from '../../components/layout/AppLayout';
import { TypeBadge, StatutBadge } from '../../components/ui/Badge';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Skeleton } from '../../components/ui/Skeleton';
import { TabFinances } from './tabs/TabFinances';
import { TabMarches } from './tabs/TabMarches';
import { TabFinancements } from './tabs/TabFinancements';
import { TabPlanning } from './tabs/TabPlanning';
import { TabDocuments } from './tabs/TabDocuments';
import { TabReception } from './tabs/TabReception';
import { TabResilience } from './tabs/TabResilience';
import { useOperation } from '../../hooks/useOperations';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../utils/api';
import { formatEur, formatDate } from '../../utils/formatters';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const ALL_TABS = [
  { id: 'general',      label: 'Général' },
  { id: 'finances',     label: 'Finances',      compta: true },
  { id: 'financements', label: 'Financements',  compta: true },
  { id: 'planning',     label: 'Planning' },
  { id: 'marches',      label: 'Marchés',       compta: true },
  { id: 'reception',    label: 'Réception',     compta: true },
  { id: 'documents',    label: 'Documents',    compta: true },
  { id: 'resilience',   label: 'Résilience' },
];

export default function OperationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { operation, loading, refresh } = useOperation(id);
  const { isAdmin, isReadOnly, isCompta, user } = useAuth();
  const toast = useToast();

  // Filtrage des onglets selon le profil
  // compta = role 'compta', détecté via isCompta ou via user.role directement
  const isComptaUser = isCompta || user?.role === 'compta';
  const TABS = isComptaUser
    ? ALL_TABS.filter(t => t.id === 'general' || t.compta)
    : ALL_TABS;

  const [tab, setTab] = useState('general');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleDelete = async () => {
    try {
      await api.delete(`/operations/${id}`);
      toast.success('Opération supprimée');
      navigate('/operations');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image trop volumineuse (max 5 Mo)'); return; }
    setUploading(true);
    try {
      await api.uploadImage(id, file);
      await refresh();
      toast.success('Image mise à jour avec succès');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout breadcrumbs={[{ label: 'Opérations', to: '/operations' }, { label: '…' }]}>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!operation) return null;

  const breadcrumbs = [
    { label: 'Opérations', to: '/operations' },
    { label: operation.intitule }
  ];

  const engPct = operation.enveloppe_ht > 0
    ? Math.round((operation.montant_engage / operation.enveloppe_ht) * 100)
    : 0;
  const mandPct = operation.enveloppe_ht > 0
    ? Math.round((operation.montant_mandate / operation.enveloppe_ht) * 100)
    : 0;

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="max-w-5xl mx-auto">
        {/* Image en-tête */}
        <div className="relative mb-5 rounded-[10px] overflow-hidden" style={{ paddingTop: '28%', backgroundColor: '#1A3A5C' }}>
          {operation.image_url ? (
            <img
              src={operation.image_url}
              alt={operation.intitule}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Building size={64} className="text-white/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* Badges & titre */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="flex gap-2 mb-2">
              <TypeBadge type={operation.type} />
              <StatutBadge statut={operation.statut} />
              {operation.alerts?.map((a, i) => (
                <span key={i} className={`badge ${a.type === 'rouge' ? 'animate-pulse-red' : ''}`}
                  style={{ backgroundColor: a.type === 'rouge' ? '#FEE2E2' : '#FEF3C7', color: a.type === 'rouge' ? '#991B1B' : '#92400E' }}>
                  ⚠ {a.message}
                </span>
              ))}
            </div>
            <h1 className="font-heading font-bold text-white text-2xl leading-tight">{operation.intitule}</h1>
          </div>

          {/* Actions */}
          <div className="absolute top-3 right-3 flex flex-wrap gap-1.5 justify-end max-w-[calc(100%-1.5rem)]">
            {!isReadOnly && (
              <>
                <label className="btn-secondary flex items-center gap-1 cursor-pointer text-xs px-2 py-1.5 sm:px-3">
                  <Upload size={13} />
                  <span className="hidden sm:inline">{uploading ? 'Upload…' : 'Photo'}</span>
                  <input type="file" accept="image/jpeg,image/png" onChange={handleImageUpload} className="hidden" />
                </label>
                <Link to={`/operations/${id}/edit`} className="btn-secondary flex items-center gap-1 text-xs px-2 py-1.5 sm:px-3">
                  <Edit size={13} /> <span className="hidden sm:inline">Modifier</span>
                </Link>
              </>
            )}
            {isAdmin && (
              <button onClick={() => setDeleteOpen(true)} className="btn-danger flex items-center gap-1 text-xs px-2 py-1.5 sm:px-3">
                <Trash2 size={13} /> <span className="hidden sm:inline">Supprimer</span>
              </button>
            )}
          </div>
        </div>

        {/* Onglets */}
        <div className="border-b border-border mb-5 flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => !t.disabled && setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text-main'
              } ${t.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              disabled={t.disabled}
            >
              {t.label}
              {t.disabled && <span className="ml-1 text-xs opacity-60">Phase 3+</span>}
            </button>
          ))}
        </div>

        {/* Contenu des onglets */}
        {tab === 'general' && <TabGeneral op={operation} />}
        {tab === 'finances' && <TabFinances operationId={operation.id} />}
        {tab === 'financements' && <TabFinancements operationId={operation.id} enveloppe={parseFloat(operation.enveloppe_ht || 0)} />}
        {tab === 'planning' && <TabPlanning op={operation} />}
        {tab === 'marches' && <TabMarches operationId={operation.id} />}
        {tab === 'reception' && <TabReception op={operation} onRefresh={refresh} />}
        {tab === 'documents' && <TabDocuments operationId={operation.id} />}
        {tab === 'resilience' && <TabResilience op={operation} />}
      </div>

      <ConfirmModal
        open={deleteOpen}
        title="Supprimer l'opération"
        message={`Supprimer définitivement "${operation.intitule}" ? Cette action est irréversible.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </AppLayout>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <Icon size={15} className="text-text-muted shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="text-xs text-text-muted font-medium uppercase tracking-wide mb-0.5">{label}</div>
        <div className="text-sm text-text-main">{value}</div>
      </div>
    </div>
  );
}

function TabGeneral({ op }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 flex flex-col gap-4">
        <div className="card p-5">
          <h3 className="font-heading font-semibold text-sm text-text-muted uppercase tracking-wide mb-3">Informations</h3>
          {op.charges?.length > 0 ? (
            <div className="flex items-start gap-3 py-2.5 border-b border-border">
              <User size={15} className="text-text-muted shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-xs text-text-muted font-medium uppercase tracking-wide mb-1">
                  Chargé{op.charges.length > 1 ? 's' : ''} d'opération
                </div>
                <div className="flex flex-col gap-1">
                  {op.charges.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm text-text-main">{c.full_name}</span>
                      {c.label && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-text-muted">{c.label}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <InfoRow icon={User} label="Chargé d'opération" value={op.charged?.full_name} />
          )}
          <InfoRow icon={Building} label="Maître d'œuvre" value={op.maitre_oeuvre} />
          <InfoRow icon={MapPin} label="Adresse" value={op.adresse} />
          <InfoRow icon={Euro} label="Mode financier" value={op.mode_financier === 'ap_cp' ? 'AP/CP' : 'Enveloppe globale'} />
          {op.description && (
            <div className="pt-3">
              <div className="text-xs text-text-muted font-medium uppercase tracking-wide mb-2">Description</div>
              <p className="text-sm text-text-main leading-relaxed">{op.description}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Mini-carte */}
        {op.latitude && op.longitude && (
          <div className="card overflow-hidden" style={{ height: 200 }}>
            <MapContainer
              center={[op.latitude, op.longitude]}
              zoom={15}
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[op.latitude, op.longitude]}>
                <Popup>{op.intitule}</Popup>
              </Marker>
            </MapContainer>
          </div>
        )}

        {/* KPIs rapides */}
        <div className="card p-4 flex flex-col gap-3">
          <MiniKpi label="Enveloppe HT" value={formatEur(op.enveloppe_ht)} />
          <MiniKpi label="Montant engagé" value={formatEur(op.montant_engage)} />
          <MiniKpi label="Montant mandaté" value={formatEur(op.montant_mandate)} />
          <div>
            <div className="text-xs text-text-muted mb-1">Taux d'engagement</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, op.enveloppe_ht > 0 ? (op.montant_engage / op.enveloppe_ht) * 100 : 0)}%`,
                    backgroundColor: op.montant_engage > op.enveloppe_ht * 1.05 ? '#C0392B' : '#1E7E45'
                  }}
                />
              </div>
              <span className="font-mono text-xs text-text-main font-semibold">
                {op.enveloppe_ht > 0 ? Math.round((op.montant_engage / op.enveloppe_ht) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}




function MiniKpi({ label, value }) {
  return (
    <div>
      <div className="text-xs text-text-muted">{label}</div>
      <div className="font-mono font-semibold text-text-main text-sm">{value}</div>
    </div>
  );
}


