import { useState, useEffect } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { api } from '../../utils/api';
import { useConfig } from '../../hooks/useConfig';
import { formatEur } from '../../utils/formatters';

/* ── Config (identique à MandatPage) ─────────────────────── */
const NIVEAU_CONFIG = {
  non_renseigne: { label: 'Non renseigné', color: '#9CA3AF' },
  non_concerne:  { label: 'Non concerné',  color: '#6B7280' },
  partiel:       { label: 'Partiel',        color: '#D97706' },
  significatif:  { label: 'Significatif',   color: '#2563EB' },
  structurant:   { label: 'Structurant',    color: '#1E7E45' },
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

/* ── Sous-composants ─────────────────────────────────────── */
function Section({ title, children, breakBefore }) {
  return (
    <div style={{ breakBefore: breakBefore ? 'page' : 'auto', marginBottom: 24 }}>
      <div style={{
        borderLeft: '4px solid #1A3A5C', paddingLeft: 10, marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#1A3A5C', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function KpiGrid({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 4 }}>
      {items.map((item, i) => (
        <div key={i} style={{
          border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 14px', textAlign: 'center',
          borderTop: `3px solid ${item.color || '#1A3A5C'}`,
        }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: item.color || '#1A3A5C', lineHeight: 1.2 }}>{item.value}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginTop: 3 }}>{item.label}</div>
          {item.sublabel && <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{item.sublabel}</div>}
        </div>
      ))}
    </div>
  );
}

function NiveauDot({ niveau }) {
  const cfg = NIVEAU_CONFIG[niveau] || NIVEAU_CONFIG.non_renseigne;
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <circle cx="5" cy="5" r="5" fill={cfg.color} />
    </svg>
  );
}

function ScoreDots({ score }) {
  return (
    <div style={{ display: 'flex', gap: 3, justifyContent: 'center', alignItems: 'center' }}>
      {[0,1,2,3].map(i => (
        <svg key={i} width="9" height="9" viewBox="0 0 9 9" style={{ display: 'block' }}>
          <circle cx="4.5" cy="4.5" r="3.75" fill={i < score ? '#1A3A5C' : 'transparent'} stroke="#1A3A5C" strokeWidth="1.5" />
        </svg>
      ))}
    </div>
  );
}

function ProgressBar({ pct, label, value, unite }) {
  const color = pct >= 100 ? '#1E7E45' : pct >= 50 ? '#2563EB' : '#E8920A';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: '#374151', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: 'monospace' }}>
          {value} {unite} · {pct}%
        </span>
      </div>
      <div style={{ height: 7, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, backgroundColor: color, borderRadius: 4 }} />
      </div>
    </div>
  );
}

/* ── Page principale ─────────────────────────────────────── */
export default function MandatRapportPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { config } = useConfig();

  useEffect(() => {
    api.get('/mandat/dashboard')
      .then(d => setData(d))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#6B7280' }}>
      Chargement du rapport…
    </div>
  );

  if (error) return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#C0392B' }}>Erreur : {error}</div>
  );

  const { metriques, parType, parStatut, resilience, concordanceOps, pleinementResilientes, nonRenseignees, engagements } = data;

  const pieData = Object.entries(parType)
    .map(([k, v]) => ({ name: TYPE_LABELS[k], value: v, color: TYPE_COLORS[k] }))
    .filter(d => d.value > 0);

  const barData = Object.entries(parStatut)
    .map(([k, v]) => ({ name: STATUT_LABELS[k], value: v }))
    .filter(d => d.value > 0);

  const radarData = resilience.map(r => ({
    volet: VOLET_LABELS[r.volet],
    score: Math.round(r.score * 100) / 100,
    fullMark: 3,
  }));

  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <>
      {/* CSS d'impression intégré */}
      <style>{`
        @page { size: A4; margin: 15mm 12mm; }
        * {
          box-sizing: border-box;
          /* Force le rendu des couleurs de fond à l'impression (boules, barres, badges…) */
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        body { margin: 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #111827; background: white; }
        @media print {
          .no-print { display: none !important; }
          .page-break { break-before: page; }
        }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #E5E7EB; padding: 5px 8px; font-size: 10.5px; }
        th { background: #F9FAFB; font-weight: 600; color: #374151; }
      `}</style>

      {/* Barre d'action (masquée à l'impression) */}
      <div className="no-print" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        backgroundColor: '#1A3A5C', padding: '10px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>
          Rapport — Programme de Mandat · {config.collectivite}
        </span>
        <button
          onClick={() => window.print()}
          style={{
            backgroundColor: '#E8920A', color: 'white', border: 'none', borderRadius: 6,
            padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          ⬇ Enregistrer en PDF
        </button>
      </div>

      {/* Corps du rapport */}
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '60px 0 40px' }}>

        {/* ── EN-TÊTE ── */}
        <div style={{
          borderBottom: '2px solid #1A3A5C', paddingBottom: 14, marginBottom: 24,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#E8920A', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              {config.collectivite} · {config.libelle_mandat}
            </div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1A3A5C' }}>
              Tableau de bord — Programme de Mandat
            </h1>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }}>Rapport de suivi des opérations d'investissement</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#9CA3AF' }}>Généré le</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{today}</div>
          </div>
        </div>

        {/* ── MÉTRIQUES GLOBALES ── */}
        <Section title="Indicateurs clés du programme">
          <KpiGrid items={[
            {
              value: `${metriques.lancees}/${metriques.total}`,
              label: 'Opérations lancées',
              sublabel: `${metriques.total > 0 ? Math.round(metriques.lancees / metriques.total * 100) : 0}% du programme`,
              color: '#1A3A5C',
            },
            {
              value: `${metriques.livrees}/${metriques.total}`,
              label: 'Opérations livrées',
              sublabel: `${metriques.total > 0 ? Math.round(metriques.livrees / metriques.total * 100) : 0}% du programme`,
              color: '#1E7E45',
            },
            {
              value: `${(metriques.volumeTotal / 1_000_000).toFixed(1)} M€`,
              label: "Volume d'investissement",
              sublabel: 'Enveloppes HT totales',
              color: '#E8920A',
            },
            {
              value: `${metriques.tauxExecution}%`,
              label: "Taux d'exécution financière",
              sublabel: `${formatEur(metriques.mandate)} mandatés`,
              color: metriques.tauxExecution >= 75 ? '#1E7E45' : metriques.tauxExecution >= 40 ? '#2563EB' : '#E8920A',
            },
          ]} />
        </Section>

        {/* ── RÉPARTITION TYPE + STATUT ── */}
        <Section title="Répartition du portefeuille">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Donut type */}
            <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Par type de projet</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <PieChart width={120} height={120}>
                  <Pie data={pieData} cx={55} cy={55} innerRadius={30} outerRadius={52} dataKey="value" paddingAngle={3}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {pieData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
                        <circle cx="5" cy="5" r="5" fill={d.color} />
                      </svg>
                      <span style={{ fontSize: 10.5, color: '#374151' }}>{d.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 'auto', paddingLeft: 8 }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Barres statut */}
            <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Par statut</div>
              <BarChart width={280} height={120} data={barData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={80} />
                <Bar dataKey="value" fill="#1A3A5C" radius={[0, 3, 3, 0]} />
              </BarChart>
            </div>
          </div>
        </Section>

        {/* ── RÉSILIENCE ── */}
        <Section title="Concordance résilience du portefeuille">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Radar */}
            <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Radar par volet</div>
              <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 8 }}>Score moyen (0 = non concerné · 3 = structurant)</div>
              <RadarChart width={260} height={200} data={radarData} cx={130} cy={100}>
                <PolarGrid />
                <PolarAngleAxis dataKey="volet" tick={{ fontSize: 9 }} />
                <Radar name="Score" dataKey="score" stroke="#1A3A5C" fill="#1A3A5C" fillOpacity={0.3} />
                <Tooltip formatter={v => [v.toFixed(1) + '/3', 'Score']} />
              </RadarChart>
              <div style={{ fontSize: 10, color: '#6B7280', marginTop: 4, textAlign: 'center' }}>
                {pleinementResilientes} op. pleinement résilientes
                {nonRenseignees > 0 && <span style={{ color: '#D97706' }}> · {nonRenseignees} non évaluées</span>}
              </div>
            </div>

            {/* Légende niveaux */}
            <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Légende des niveaux</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(NIVEAU_CONFIG).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0 }}>
                      <circle cx="6" cy="6" r="6" fill={v.color} />
                    </svg>
                    <span style={{ fontSize: 11, color: '#374151' }}>{v.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #F3F4F6', fontSize: 10, color: '#6B7280' }}>
                V1 = Climatique · V2 = Énergétique · V3 = Social · V4 = Économique
              </div>
            </div>
          </div>
        </Section>

        {/* ── CONCORDANCE PAR OPÉRATION ── */}
        <Section title="Concordance résilience par opération" breakBefore>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', width: '45%' }}>Opération</th>
                <th style={{ textAlign: 'center', width: '10%' }}>V1</th>
                <th style={{ textAlign: 'center', width: '10%' }}>V2</th>
                <th style={{ textAlign: 'center', width: '10%' }}>V3</th>
                <th style={{ textAlign: 'center', width: '10%' }}>V4</th>
                <th style={{ textAlign: 'center', width: '15%' }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {concordanceOps.map(op => (
                <tr key={op.id}>
                  <td style={{ fontWeight: 500 }}>{op.intitule}</td>
                  {[op.v1, op.v2, op.v3, op.v4].map((v, i) => (
                    <td key={i} style={{ textAlign: 'center' }}>
                      <NiveauDot niveau={v} />
                    </td>
                  ))}
                  <td style={{ textAlign: 'center' }}>
                    <ScoreDots score={op.score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Légende compacte */}
          <div style={{ marginTop: 8, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {Object.entries(NIVEAU_CONFIG).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="9" height="9" viewBox="0 0 9 9" style={{ flexShrink: 0 }}>
                  <circle cx="4.5" cy="4.5" r="4.5" fill={v.color} />
                </svg>
                <span style={{ fontSize: 9.5, color: '#6B7280' }}>{v.label}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── ENGAGEMENTS DE MANDAT ── */}
        {engagements.length > 0 && (
          <Section title="Engagements de mandat — état d'avancement">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {engagements.map(eng => (
                <ProgressBar
                  key={eng.id}
                  label={eng.intitule}
                  value={`${eng.realise} / ${eng.cible}`}
                  unite={eng.unite || ''}
                  pct={eng.pct || 0}
                />
              ))}
            </div>
            <table style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Engagement</th>
                  <th style={{ textAlign: 'right' }}>Réalisé</th>
                  <th style={{ textAlign: 'right' }}>Cible</th>
                  <th style={{ textAlign: 'center' }}>Unité</th>
                  <th style={{ textAlign: 'right' }}>Avancement</th>
                </tr>
              </thead>
              <tbody>
                {engagements.map(eng => {
                  const pct = eng.pct || 0;
                  const color = pct >= 100 ? '#1E7E45' : pct >= 50 ? '#2563EB' : '#E8920A';
                  return (
                    <tr key={eng.id}>
                      <td>{eng.intitule}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{eng.realise}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{eng.cible ?? '—'}</td>
                      <td style={{ textAlign: 'center', color: '#6B7280' }}>{eng.unite || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color }}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>
        )}

        {/* ── PIED DE PAGE ── */}
        <div style={{
          marginTop: 32, paddingTop: 12, borderTop: '1px solid #E5E7EB',
          display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#9CA3AF',
        }}>
          <span>OpéraTrack — {config.collectivite}</span>
          <span>Document généré le {today} · Confidentiel</span>
        </div>

      </div>
    </>
  );
}
