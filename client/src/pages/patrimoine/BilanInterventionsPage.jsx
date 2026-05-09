import { useState, useCallback, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { BarChart3, Download, RefreshCw } from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { api } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';

// ── Constantes ────────────────────────────────────────────────────────────────
const THEMES = [
  { value: '',          label: 'Tous les thèmes' },
  { value: 'batiment',  label: 'Bâtiments' },
  { value: 'voirie',    label: 'Voirie' },
  { value: 'eclairage', label: 'Éclairage public' },
  { value: 'armoire',   label: 'Armoires électriques' },
  { value: 'mobilier',  label: 'Mobilier urbain' },
];

const THEME_COLORS = {
  batiment:  '#3B82F6',
  voirie:    '#10B981',
  eclairage: '#F59E0B',
  armoire:   '#8B5CF6',
  mobilier:  '#EF4444',
};

const THEME_LABELS = {
  batiment:  'Bâtiment',
  voirie:    'Voirie',
  eclairage: 'Éclairage',
  armoire:   'Armoire',
  mobilier:  'Mobilier',
};

function fmt€(v) {
  if (!v && v !== 0) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v);
}

function fmtH(v) {
  if (!v && v !== 0) return '—';
  return `${Number(v).toFixed(1)} h`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function startOfYear() {
  return `${new Date().getFullYear()}-01-01`;
}

// ── Tooltip personnalisé Recharts ─────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-lg p-3 text-xs">
      <div className="font-semibold text-text-main mb-1 max-w-[200px] truncate">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.fill }} />
          <span className="text-text-muted">{p.name} :</span>
          <span className="font-medium">{fmt€(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function BilanInterventionsPage() {
  const toast = useToast();

  const [dateDebut, setDateDebut] = useState(startOfYear());
  const [dateFin,   setDateFin]   = useState(today());
  const [theme,     setTheme]     = useState('');

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);

  // Tri du tableau
  const [sortKey, setSortKey]   = useState('total');
  const [sortDir, setSortDir]   = useState('desc');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateDebut) params.set('date_debut', dateDebut);
      if (dateFin)   params.set('date_fin',   dateFin);
      if (theme)     params.set('theme',      theme);
      const result = await api.get(`/patrimoine/bilan-interventions?${params}`);
      setData(result);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [dateDebut, dateFin, theme]);

  // Charger automatiquement au montage
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tri ──────────────────────────────────────────────────────────────────────
  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = data ? [...data.sites].sort((a, b) => {
    const va = a[sortKey] ?? 0;
    const vb = b[sortKey] ?? 0;
    if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortDir === 'asc' ? va - vb : vb - va;
  }) : [];

  // ── CSV Export ───────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!data?.sites?.length) return;
    const header = ['Thème', 'Site', 'Nb interventions', 'Coût prestataires (€)', "Achats régie (€)", 'Heures régie', 'Total (€)'];
    const rows = sorted.map(s => [
      THEME_LABELS[s.theme] || s.theme,
      `"${(s.label || '').replace(/"/g, '""')}"`,
      s.nb,
      s.montant_prestataire.toFixed(2),
      s.montant_achat.toFixed(2),
      s.heures_regie.toFixed(1),
      s.total.toFixed(2),
    ]);
    const csv = [header, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bilan-interventions_${dateDebut}_${dateFin}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Données graphique (top 15 par coût total) ─────────────────────────────
  const chartData = data
    ? [...data.sites]
        .filter(s => s.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 15)
        .map(s => ({
          name: s.label?.length > 22 ? s.label.slice(0, 22) + '…' : s.label,
          'Prestataires': Math.round(s.montant_prestataire * 100) / 100,
          'Achats régie':  Math.round(s.montant_achat * 100) / 100,
          theme: s.theme,
        }))
    : [];

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <span className="ml-0.5 text-text-muted/30">↕</span>;
    return <span className="ml-0.5 text-secondary">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const Th = ({ col, label, right }) => (
    <th
      onClick={() => handleSort(col)}
      className={`px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide cursor-pointer hover:text-text-main select-none ${right ? 'text-right' : 'text-left'}`}
    >
      {label}<SortIcon col={col} />
    </th>
  );

  return (
    <AppLayout>
    <div className="p-6 max-w-6xl mx-auto flex flex-col gap-5">

      {/* En-tête ─────────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="font-heading font-bold text-2xl text-text-main flex items-center gap-2">
          <BarChart3 size={22} className="text-secondary" />
          Bilan des interventions par site
        </h1>
        <p className="text-text-muted text-sm mt-1">
          Coûts et nombre d'interventions par site sur une période définie.
        </p>
      </div>

      {/* Filtres ──────────────────────────────────────────────────────────────── */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Date de début</label>
            <input
              type="date"
              className="form-input text-sm py-1.5 px-3"
              value={dateDebut}
              onChange={e => setDateDebut(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Date de fin</label>
            <input
              type="date"
              className="form-input text-sm py-1.5 px-3"
              value={dateFin}
              onChange={e => setDateFin(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Thème</label>
            <select
              className="form-select text-sm py-1.5 px-3"
              value={theme}
              onChange={e => setTheme(e.target.value)}
            >
              {THEMES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="btn-primary flex items-center gap-1.5 text-sm py-1.5 px-4"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Chargement…' : 'Actualiser'}
          </button>
          {data && data.sites.length > 0 && (
            <button
              onClick={handleExport}
              className="btn-secondary flex items-center gap-1.5 text-sm py-1.5 px-4"
            >
              <Download size={14} /> Exporter CSV
            </button>
          )}
        </div>
      </div>

      {/* KPIs ─────────────────────────────────────────────────────────────────── */}
      {data && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="card p-4">
            <div className="text-xs text-text-muted mb-1">Interventions</div>
            <div className="font-mono font-bold text-2xl text-primary">{data.kpis.nb_total}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-text-muted mb-1">Coût prestataires</div>
            <div className="font-mono font-bold text-xl text-blue-600">{fmt€(data.kpis.montant_prestataire_total)}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-text-muted mb-1">Achats régie</div>
            <div className="font-mono font-bold text-xl text-amber-600">{fmt€(data.kpis.montant_achat_total)}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-text-muted mb-1">Heures régie</div>
            <div className="font-mono font-bold text-2xl text-green-600">{fmtH(data.kpis.heures_regie_total)}</div>
          </div>
        </div>
      )}

      {/* Graphique ───────────────────────────────────────────────────────────── */}
      {data && chartData.length > 0 && (
        <div className="card p-4">
          <div className="text-sm font-semibold text-text-main mb-3 flex items-center gap-2">
            <BarChart3 size={16} className="text-secondary" />
            Top {chartData.length} sites par coût (€ HT)
          </div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 10, bottom: 60, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  angle={-40}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k€` : `${v}€`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="Prestataires" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Achats régie" stackId="a" fill="#F59E0B" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tableau ─────────────────────────────────────────────────────────────── */}
      {data && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="text-sm font-semibold text-text-main">
              Détail par site — {sorted.length} site{sorted.length !== 1 ? 's' : ''}
            </div>
          </div>
          {sorted.length === 0 ? (
            <div className="py-12 text-center text-text-muted text-sm">
              Aucune intervention trouvée sur cette période.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bg-card border-b border-border">
                  <tr>
                    <Th col="theme"               label="Thème" />
                    <Th col="label"               label="Site" />
                    <Th col="nb"                  label="Nb interv." right />
                    <Th col="montant_prestataire" label="Prestataires" right />
                    <Th col="montant_achat"       label="Achats régie" right />
                    <Th col="heures_regie"        label="Heures régie" right />
                    <Th col="total"               label="Total" right />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sorted.map((s, i) => (
                    <tr key={`${s.theme}__${s.element_id}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: (THEME_COLORS[s.theme] || '#6B7280') + '20',
                            color: THEME_COLORS[s.theme] || '#6B7280',
                          }}
                        >
                          {THEME_LABELS[s.theme] || s.theme}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-text-main max-w-[220px] truncate" title={s.label}>
                        {s.label}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-text-muted">
                        {s.nb}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-blue-700">
                        {s.montant_prestataire > 0 ? fmt€(s.montant_prestataire) : <span className="text-text-muted/40">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-amber-700">
                        {s.montant_achat > 0 ? fmt€(s.montant_achat) : <span className="text-text-muted/40">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-green-700">
                        {s.heures_regie > 0 ? fmtH(s.heures_regie) : <span className="text-text-muted/40">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-text-main">
                        {s.total > 0 ? fmt€(s.total) : <span className="text-text-muted">0 €</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-border">
                  <tr>
                    <td colSpan={2} className="px-4 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wide">
                      Total
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-text-main">
                      {data.kpis.nb_total}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-blue-700">
                      {fmt€(data.kpis.montant_prestataire_total)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-amber-700">
                      {fmt€(data.kpis.montant_achat_total)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-green-700">
                      {fmtH(data.kpis.heures_regie_total)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-text-main">
                      {fmt€(data.kpis.montant_prestataire_total + data.kpis.montant_achat_total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
    </AppLayout>
  );
}
