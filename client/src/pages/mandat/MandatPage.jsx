import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { AppLayout } from '../../components/layout/AppLayout';
import { Skeleton } from '../../components/ui/Skeleton';
import { api } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { useConfig } from '../../hooks/useConfig';
import { formatEur } from '../../utils/formatters';

const NIVEAU_CONFIG = {
  non_renseigne: { label: 'Non renseigné', color: '#9CA3AF', bg: '#F3F4F6', score: 0 },
  non_concerne:  { label: 'Non concerné',  color: '#6B7280', bg: '#F9FAFB', score: 0 },
  partiel:       { label: 'Partiel',        color: '#D97706', bg: '#FEF3C7', score: 1 },
  significatif:  { label: 'Significatif',   color: '#2563EB', bg: '#DBEAFE', score: 2 },
  structurant:   { label: 'Structurant',    color: '#1E7E45', bg: '#D1FAE5', score: 3 },
};

const STATUT_LABELS = {
  etudes: 'Études', consultation: 'Consultation', travaux: 'Travaux',
  reception: 'Réception', soldee: 'Soldée',
};
const TYPE_LABELS = {
  construction_neuve: 'Construction neuve',
  rehabilitation: 'Réhabilitation',
  amenagement_vrd: 'Aménagement VRD',
};
const TYPE_COLORS = { construction_neuve: '#1A3A5C', rehabilitation: '#E8920A', amenagement_vrd: '#1E7E45' };
const VOLET_LABELS = { 1: 'Climatique', 2: 'Énergétique', 3: 'Social', 4: 'Économique' };

function NiveauBadge({ niveau }) {
  const cfg = NIVEAU_CONFIG[niveau] || NIVEAU_CONFIG.non_renseigne;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function ScoreDots({ score }) {
  return (
    <div className="flex items-center gap-0.5">
      {[0,1,2,3].map(i => (
        <div key={i} className="w-2.5 h-2.5 rounded-full border"
          style={{ backgroundColor: i < score ? '#1A3A5C' : 'transparent', borderColor: '#1A3A5C' }} />
      ))}
    </div>
  );
}

function MetriqueCard({ value, label, sublabel, color }) {
  return (
    <div className="card p-5 text-center">
      <div className="text-3xl font-bold font-heading mb-1" style={{ color: color || '#1A3A5C' }}>{value}</div>
      <div className="text-sm font-medium text-text-main">{label}</div>
      {sublabel && <div className="text-xs text-text-muted mt-0.5">{sublabel}</div>}
    </div>
  );
}

function EngagementBar({ engagement }) {
  const pct = Math.min(100, engagement.pct || 0);
  const color = pct >= 100 ? '#1E7E45' : pct >= 50 ? '#2563EB' : '#E8920A';
  const opContribs = engagement.operation_engagements || [];

  return (
    <div className="py-3 border-b border-border last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-text-main">{engagement.intitule}</span>
        <span className="text-sm font-bold font-mono" style={{ color }}>
          {engagement.realise} / {engagement.cible} {engagement.unite}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1.5">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-text-muted">
          {opContribs.length > 0 && (
            <span>
              {opContribs.map((oe, i) => (
                <span key={i}>
                  {i > 0 && ' · '}
                  {oe.operations?.intitule || '—'} (+{oe.contribution})
                </span>
              ))}
            </span>
          )}
        </div>
        <span className="text-xs font-semibold" style={{ color }}>{pct}%</span>
      </div>
    </div>
  );
}

export default function MandatPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const { config } = useConfig();

  useEffect(() => {
    api.get('/mandat/dashboard')
      .then(d => setData(d))
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <AppLayout breadcrumbs={[{ label: 'Résilience & Mandat' }]}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </AppLayout>
  );

  const { metriques, parType, parStatut, resilience, concordanceOps, pleinementResilientes, nonRenseignees, engagements } = data;

  // Données pour le donut type
  const pieData = Object.entries(parType).map(([k, v]) => ({
    name: TYPE_LABELS[k], value: v, color: TYPE_COLORS[k]
  })).filter(d => d.value > 0);

  // Données pour le bar statut
  const barData = Object.entries(parStatut).map(([k, v]) => ({
    name: STATUT_LABELS[k], value: v
  })).filter(d => d.value > 0);

  // Données radar
  const radarData = resilience.map(r => ({
    volet: VOLET_LABELS[r.volet],
    score: Math.round(r.score * 100) / 100,
    fullMark: 3,
  }));

  return (
    <AppLayout breadcrumbs={[{ label: 'Résilience & Mandat' }]}>
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading font-bold text-2xl text-text-main">Tableau de bord — Programme de Mandat</h1>
          <p className="text-text-muted text-sm mt-0.5">{config.collectivite} · {config.libelle_mandat}</p>
        </div>
        <button
          onClick={() => window.open('/mandat/rapport', '_blank')}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <FileText size={15} />
          Exporter le rapport
        </button>
      </div>

      {/* Métriques globales */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <MetriqueCard
          value={`${metriques.lancees}/${metriques.total}`}
          label="Opérations lancées"
          sublabel={`${metriques.total > 0 ? Math.round(metriques.lancees/metriques.total*100) : 0}% du programme`}
          color="#1A3A5C"
        />
        <MetriqueCard
          value={`${metriques.livrees}/${metriques.total}`}
          label="Opérations livrées"
          sublabel={`${metriques.total > 0 ? Math.round(metriques.livrees/metriques.total*100) : 0}% du programme`}
          color="#1E7E45"
        />
        <MetriqueCard
          value={`${(metriques.volumeTotal/1000000).toFixed(1)} M€`}
          label="Volume d'investissement"
          sublabel="Enveloppes HT totales"
          color="#E8920A"
        />
        <MetriqueCard
          value={`${metriques.tauxExecution}%`}
          label="Taux d'exécution financière"
          sublabel={`${formatEur(metriques.mandate)} mandatés`}
          color={metriques.tauxExecution >= 75 ? '#1E7E45' : metriques.tauxExecution >= 40 ? '#2563EB' : '#E8920A'}
        />
      </div>

      {/* Répartition par type + statut */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        <div className="card p-5">
          <h3 className="font-heading font-semibold text-sm text-text-main mb-4">Répartition par type</h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v + ' opération' + (v>1?'s':''), n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2">
              {pieData.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-sm text-text-main">{d.name}</span>
                  <span className="font-bold text-sm ml-auto pl-4">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-heading font-semibold text-sm text-text-main mb-4">Répartition par statut</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
              <Tooltip />
              <Bar dataKey="value" fill="#1A3A5C" radius={[0,4,4,0]} name="Opérations" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Concordance résilience */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        <div className="card p-5">
          <h3 className="font-heading font-semibold text-sm text-text-main mb-1">Radar résilience du portefeuille</h3>
          <p className="text-xs text-text-muted mb-4">Score moyen par volet (0 = non concerné · 3 = structurant)</p>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="volet" tick={{ fontSize: 11 }} />
                <Radar name="Score" dataKey="score" stroke="#1A3A5C" fill="#1A3A5C" fillOpacity={0.3} />
                <Tooltip formatter={v => [v.toFixed(1) + '/3', 'Score']} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 text-xs text-text-muted mt-2 justify-center flex-wrap">
            <span>🟢 {pleinementResilientes} op. pleinement résilientes</span>
            {nonRenseignees > 0 && <span className="text-orange-500">⚠ {nonRenseignees} non renseignées</span>}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-heading font-semibold text-sm text-text-main mb-4">Concordance par opération</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 text-xs font-semibold text-text-muted">Opération</th>
                  <th className="pb-2 text-xs font-semibold text-text-muted text-center px-1">V1</th>
                  <th className="pb-2 text-xs font-semibold text-text-muted text-center px-1">V2</th>
                  <th className="pb-2 text-xs font-semibold text-text-muted text-center px-1">V3</th>
                  <th className="pb-2 text-xs font-semibold text-text-muted text-center px-1">V4</th>
                  <th className="pb-2 text-xs font-semibold text-text-muted text-center">Score</th>
                </tr>
              </thead>
              <tbody>
                {concordanceOps.map(op => (
                  <tr key={op.id} className="border-b border-border hover:bg-gray-50">
                    <td className="py-2 pr-2">
                      <Link to={`/operations/${op.id}`} className="text-xs font-medium text-primary hover:underline line-clamp-1">
                        {op.intitule}
                      </Link>
                    </td>
                    {[op.v1, op.v2, op.v3, op.v4].map((v, i) => {
                      const cfg = NIVEAU_CONFIG[v] || NIVEAU_CONFIG.non_renseigne;
                      return (
                        <td key={i} className="py-2 px-1 text-center">
                          <div className="w-3 h-3 rounded-full mx-auto" style={{ backgroundColor: cfg.color }} title={cfg.label} />
                        </td>
                      );
                    })}
                    <td className="py-2 text-center">
                      <ScoreDots score={op.score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3 mt-3 flex-wrap">
            {Object.entries(NIVEAU_CONFIG).filter(([k]) => k !== 'non_renseigne').map(([k, v]) => (
              <div key={k} className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: v.color }} />
                <span className="text-xs text-text-muted">{v.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Engagements de mandat */}
      <div className="card p-5">
        <h3 className="font-heading font-semibold text-sm text-text-main mb-4">Engagements de mandat</h3>
        {engagements.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-4">Aucun engagement défini.</p>
        ) : (
          <div>
            {engagements.map(eng => <EngagementBar key={eng.id} engagement={eng} />)}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
