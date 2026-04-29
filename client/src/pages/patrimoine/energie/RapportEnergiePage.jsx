import { useState, useEffect, useCallback, useRef } from 'react';
import { Printer, RefreshCw, Zap, TrendingDown, TrendingUp, Building2,
         Flame, Droplets, BarChart2, ChevronDown, CheckCircle, AlertTriangle } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { AppLayout } from '../../../components/layout/AppLayout';
import { api } from '../../../utils/api';
import { useToast } from '../../../contexts/ToastContext';

// ── Constantes ────────────────────────────────────────────────────────────────
const FLUIDES_CFG = {
  electricite:    { label: 'Électricité', color: '#F59E0B', icon: '⚡' },
  gaz:            { label: 'Gaz',         color: '#3B82F6', icon: '🔥' },
  eau:            { label: 'Eau',          color: '#06B6D4', icon: '💧' },
  fioul:          { label: 'Fioul',        color: '#8B5CF6', icon: '🛢️' },
  chaleur_urbain: { label: 'Chaleur urb.', color: '#EF4444', icon: '🌡️' },
};

const ANNEE_COLORS = ['#1A3A5C', '#2563EB', '#059669', '#D97706', '#7C3AED', '#DB2777'];

const MOIS_LABELS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const MOIS_KEYS   = ['01','02','03','04','05','06','07','08','09','10','11','12'];

function fmtNum(v, unit = '') {
  if (v == null || isNaN(v) || v === 0) return '—';
  return `${Number(v).toLocaleString('fr-FR')}${unit ? ' ' + unit : ''}`;
}
function fmtEur(v) {
  if (!v) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}
function pctEvol(a, b) {
  if (!b || b === 0) return null;
  return Math.round(((a - b) / b) * 100);
}

// ── Helpers visuels ───────────────────────────────────────────────────────────
function EvolBadge({ pct }) {
  if (pct == null) return <span className="text-text-muted text-xs">—</span>;
  const baisse = pct < 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${baisse ? 'text-green-600' : 'text-red-500'}`}>
      {baisse ? <TrendingDown size={12}/> : <TrendingUp size={12}/>}
      {baisse ? '' : '+'}{pct} %
    </span>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="flex items-center gap-2 mb-4 print:mb-3">
      <div className="w-1 h-5 rounded bg-primary print:bg-blue-900" />
      <h2 className="text-base font-heading font-semibold text-text-main">{children}</h2>
    </div>
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white border border-border rounded-xl p-5 print:border-gray-300 print:rounded-none print:shadow-none ${className}`}>
      {children}
    </div>
  );
}

// Tooltip Recharts personnalisé
function CustomTooltip({ active, payload, label, unit = 'kWhef' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
      <div className="font-semibold text-text-main mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
          <span className="text-text-muted">{p.name}</span>
          <span className="font-semibold text-text-main ml-auto pl-4">
            {Number(p.value).toLocaleString('fr-FR')} {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function RapportEnergiePage() {
  const toast  = useToast();
  const printRef = useRef();

  const anneeMax = new Date().getFullYear() - 1;
  const [anneeDebut, setAnneeDebut] = useState(anneeMax - 2);
  const [anneeFin,   setAnneeFin]   = useState(anneeMax);
  const [batFiltres, setBatFiltres] = useState([]); // [] = tous
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get(`/patrimoine/energie/rapport?annee_debut=${anneeDebut}&annee_fin=${anneeFin}`);
      setData(d);
      setBatFiltres([]); // reset sélection à chaque rechargement
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [anneeDebut, anneeFin]);

  useEffect(() => { load(); }, [load]);

  const handlePrint = () => {
    window.print();
  };

  if (loading || !data) {
    return (
      <AppLayout breadcrumbs={[{ label: 'Énergie', to: '/patrimoine/energie' }, { label: 'Rapport' }]}>
        <div className="flex items-center justify-center py-24 text-text-muted text-sm gap-2">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
          Génération du rapport…
        </div>
      </AppLayout>
    );
  }

  const { annees, global, batiments: allBatiments, mensuelGlobal } = data;
  // Bâtiments filtrés
  const batiments = batFiltres.length > 0
    ? allBatiments.filter(b => batFiltres.includes(b.id))
    : allBatiments;

  const dernAnnee = annees[annees.length - 1];
  const avantDern = annees[annees.length - 2];

  // ── Données graphiques ────────────────────────────────────────────────────

  // 1. Tendance globale (LineChart) — kWhef par année
  const tendanceData = annees.map(a => ({
    annee: String(a),
    kWhef: global[a]?.kwef ?? 0,
    montant: global[a]?.montant ?? 0,
  }));

  // 2. Profil mensuel (BarChart) — kWhef par mois (dernière année, bâtiments filtrés)
  const profilMensuelData = MOIS_KEYS.map((m, i) => {
    if (batFiltres.length === 0) {
      // Global
      return { mois: MOIS_LABELS[i], kWhef: Math.round(mensuelGlobal[m]?.kwef ?? 0) };
    }
    // Somme des bâtiments filtrés
    const kwef = batiments.reduce((s, b) => s + (b.mensuel?.[m]?.kwef ?? 0), 0);
    return { mois: MOIS_LABELS[i], kWhef: Math.round(kwef) };
  });

  // 3. Comparaison par bâtiment — intensite kWhef/m² par année
  const comparaissonBat = batiments
    .filter(b => b.surface > 0)
    .map(b => {
      const row = { intitule: b.intitule.length > 22 ? b.intitule.substring(0, 20) + '…' : b.intitule };
      annees.forEach(a => { row[String(a)] = b.annuel?.[a]?.intensite ?? 0; });
      return row;
    })
    .sort((a, b) => (b[String(dernAnnee)] || 0) - (a[String(dernAnnee)] || 0));

  // 4. Répartition par fluide — kWhef par fluide par année (stacked)
  const fluidesPresents = [...new Set(
    annees.flatMap(a => Object.keys(global[a]?.fluides || {}))
  )];
  const repartitionFluidesData = annees.map(a => {
    const row = { annee: String(a) };
    fluidesPresents.forEach(fl => {
      const conso = global[a]?.fluides?.[fl] ?? 0;
      // Convertir en kWhef pour comparaison homogène (eau → conso brute)
      row[fl] = Math.round(conso);
    });
    return row;
  });

  // 5. Trajectoire Décret Tertiaire — bâtiments soumis (dernière année)
  const batimentsDT = allBatiments.filter(b => b.decret?.soumis_decret && b.decret?.conso_ref_kwh);
  const trajectoireData = batimentsDT.map(b => {
    const ref  = b.decret.conso_ref_kwh;
    const actuel = b.annuel?.[dernAnnee]?.kwef ?? 0;
    const obj2030 = ref * 0.60; // -40%
    return {
      intitule: b.intitule.length > 22 ? b.intitule.substring(0, 20) + '…' : b.intitule,
      reference: Math.round(ref),
      actuel: Math.round(actuel),
      objectif2030: Math.round(obj2030),
      enTrajectoire: actuel <= obj2030 + (ref - obj2030) * ((new Date().getFullYear() - (b.decret.annee_reference || 2020)) / (2030 - (b.decret.annee_reference || 2020))),
    };
  });

  // KPIs globaux
  const kwefN   = global[dernAnnee]?.kwef   ?? 0;
  const kwefN1  = global[avantDern]?.kwef   ?? 0;
  const montN   = global[dernAnnee]?.montant ?? 0;
  const montN1  = global[avantDern]?.montant ?? 0;
  const evolKwef = pctEvol(kwefN, kwefN1);
  const evolMont = pctEvol(montN, montN1);

  return (
    <AppLayout breadcrumbs={[{ label: 'Énergie', to: '/patrimoine/energie' }, { label: 'Rapport de tendances' }]}>
      {/* ── Style impression ─────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4 landscape; }
          body { font-size: 11px; }
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          .print-avoid { page-break-inside: avoid; }
        }
      `}</style>

      <div ref={printRef} className="p-6 max-w-6xl mx-auto print:p-0 print:max-w-none">

        {/* ── En-tête ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-6 print:mb-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-text-main flex items-center gap-2 print:text-xl">
              <BarChart2 size={24} className="text-primary print:hidden" />
              Rapport de consommations énergétiques
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              Tendances {anneeDebut} – {anneeFin} · Patrimoine bâti
            </p>
          </div>

          {/* Contrôles — masqués à l'impression */}
          <div className="flex items-center gap-3 no-print">
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <span>De</span>
              <select value={anneeDebut} onChange={e => setAnneeDebut(parseInt(e.target.value))} className="input py-1.5 px-2 text-sm">
                {Array.from({ length: 8 }, (_, i) => anneeMax - 7 + i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <span>à</span>
              <select value={anneeFin} onChange={e => setAnneeFin(parseInt(e.target.value))} className="input py-1.5 px-2 text-sm">
                {Array.from({ length: 8 }, (_, i) => anneeMax - 7 + i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button onClick={load} disabled={loading} className="btn-secondary text-sm flex items-center gap-1.5">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
            </button>
            <button onClick={handlePrint} className="btn-primary text-sm flex items-center gap-1.5">
              <Printer size={14} /> Imprimer / PDF
            </button>
          </div>

          {/* Mention date pour l'impression */}
          <div className="hidden print:block text-xs text-gray-500">
            Édité le {new Date().toLocaleDateString('fr-FR')}
          </div>
        </div>

        {/* ── Filtre bâtiments ──────────────────────────────────────────────── */}
        <div className="no-print mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-muted font-medium">Filtrer par bâtiment :</span>
            <button
              onClick={() => setBatFiltres([])}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${batFiltres.length === 0 ? 'bg-primary text-white border-primary' : 'border-border text-text-muted hover:bg-gray-50'}`}>
              Tous ({allBatiments.length})
            </button>
            {allBatiments.map(b => (
              <button key={b.id}
                onClick={() => setBatFiltres(prev =>
                  prev.includes(b.id) ? prev.filter(x => x !== b.id) : [...prev, b.id]
                )}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${batFiltres.includes(b.id) ? 'bg-primary text-white border-primary' : 'border-border text-text-muted hover:bg-gray-50'}`}>
                {b.intitule}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6 print:gap-4">

          {/* ── Bloc 1 — KPIs ──────────────────────────────────────────────── */}
          <div className="print-avoid">
            <SectionTitle>Vue d'ensemble {dernAnnee}</SectionTitle>
            <div className="grid grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
              {[
                { label: `Total kWhef ${dernAnnee}`, value: fmtNum(kwefN, 'kWhef'), evol: evolKwef, sub: `vs ${avantDern}`, color: '#1A3A5C' },
                { label: `Facture ${dernAnnee}`, value: fmtEur(montN), evol: evolMont, sub: `vs ${avantDern}`, color: '#F59E0B' },
                { label: 'Bâtiments suivis', value: allBatiments.length, sub: 'avec relevés', color: '#059669' },
                { label: 'Bâtiments décret', value: batimentsDT.length, sub: 'soumis au tertiaire', color: '#7C3AED' },
              ].map((k, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-4 flex flex-col gap-1 print:bg-gray-100 print:rounded">
                  <div className="text-xs font-semibold text-text-muted uppercase tracking-wide">{k.label}</div>
                  <div className="text-2xl font-bold text-text-main print:text-xl">{k.value}</div>
                  <div className="flex items-center gap-2">
                    {k.evol != null && <EvolBadge pct={k.evol} />}
                    <span className="text-xs text-text-muted">{k.sub}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Bloc 2 — Tendance globale ─────────────────────────────────── */}
          <Card className="print-avoid">
            <SectionTitle>Évolution des consommations globales (kWhef)</SectionTitle>
            {tendanceData.every(d => d.kWhef === 0) ? (
              <div className="text-center py-8 text-text-muted text-sm">Aucune donnée</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={tendanceData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="annee" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v === 0 ? '0' : `${Math.round(v / 1000)}k`} />
                  <Tooltip content={<CustomTooltip unit="kWhef" />} />
                  <Bar dataKey="kWhef" name="kWhef totaux" fill="#1A3A5C" radius={[4,4,0,0]} maxBarSize={60}>
                    {tendanceData.map((_, i) => (
                      <Cell key={i} fill={i === tendanceData.length - 1 ? '#1A3A5C' : '#93C5FD'} />
                    ))}
                  </Bar>
                  <Line dataKey="kWhef" name="" stroke="#1A3A5C" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="0" hide />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* ── Bloc 3 — Profil mensuel ───────────────────────────────────── */}
          <Card className="print-avoid">
            <SectionTitle>Profil mensuel {anneeFin} — kWhef</SectionTitle>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={profilMensuelData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v === 0 ? '0' : `${Math.round(v / 1000)}k`} />
                <Tooltip content={<CustomTooltip unit="kWhef" />} />
                <Bar dataKey="kWhef" name={`kWhef ${anneeFin}`} radius={[3,3,0,0]} maxBarSize={40}>
                  {profilMensuelData.map((d, i) => (
                    <Cell key={i} fill={d.kWhef === Math.max(...profilMensuelData.map(x => x.kWhef)) ? '#F59E0B' : '#BFDBFE'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-text-muted mt-2">
              Le mois le plus consommateur est mis en évidence en orange.
            </p>
          </Card>

          {/* ── Bloc 4 — Comparaison par bâtiment ─────────────────────────── */}
          {comparaissonBat.length > 0 && (
            <Card className="print-avoid">
              <SectionTitle>Intensité énergétique par bâtiment (kWhef/m²/an)</SectionTitle>
              <ResponsiveContainer width="100%" height={Math.max(200, comparaissonBat.length * 45)}>
                <BarChart data={comparaissonBat} layout="vertical"
                  margin={{ top: 0, right: 40, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} unit=" kWhef/m²" />
                  <YAxis dataKey="intitule" type="category" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip unit="kWhef/m²" />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {/* Seuils de référence */}
                  <ReferenceLine x={120} stroke="#22C55E" strokeDasharray="4 2"
                    label={{ value: 'Performant', position: 'top', fontSize: 9, fill: '#22C55E' }} />
                  <ReferenceLine x={250} stroke="#EF4444" strokeDasharray="4 2"
                    label={{ value: 'Énergivore', position: 'top', fontSize: 9, fill: '#EF4444' }} />
                  {annees.map((a, i) => (
                    <Bar key={a} dataKey={String(a)} name={String(a)}
                      fill={ANNEE_COLORS[i % ANNEE_COLORS.length]} radius={[0,3,3,0]} maxBarSize={18} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2">
                {[
                  { color: '#22C55E', label: '< 120 — Performant' },
                  { color: '#F59E0B', label: '120–250 — Moyen' },
                  { color: '#EF4444', label: '> 250 — Énergivore' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-text-muted">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── Bloc 5 — Répartition par fluide ──────────────────────────── */}
          {fluidesPresents.length > 1 && (
            <Card className="print-avoid print-break">
              <SectionTitle>Consommation par fluide (unités natives)</SectionTitle>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={repartitionFluidesData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="annee" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {fluidesPresents.map(fl => (
                    <Bar key={fl} dataKey={fl} name={FLUIDES_CFG[fl]?.label || fl}
                      fill={FLUIDES_CFG[fl]?.color || '#9CA3AF'} stackId="a" />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-text-muted mt-2">
                Consommations en unités natives (kWh élec, m³ gaz/eau, litres fioul).
              </p>
            </Card>
          )}

          {/* ── Bloc 6 — Décret Tertiaire ─────────────────────────────────── */}
          {trajectoireData.length > 0 && (
            <Card className="print-avoid">
              <SectionTitle>Décret Tertiaire — Trajectoire {anneeFin} vs Objectif 2030 (−40%)</SectionTitle>
              <ResponsiveContainer width="100%" height={Math.max(180, trajectoireData.length * 50)}>
                <BarChart data={trajectoireData} layout="vertical"
                  margin={{ top: 0, right: 40, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} unit=" kWhef" />
                  <YAxis dataKey="intitule" type="category" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="reference" name="Référence" fill="#E2E8F0" maxBarSize={14} radius={[0,3,3,0]} />
                  <Bar dataKey="actuel" name={`Consommation ${anneeFin}`} maxBarSize={14} radius={[0,3,3,0]}>
                    {trajectoireData.map((d, i) => (
                      <Cell key={i} fill={d.enTrajectoire ? '#22C55E' : '#EF4444'} />
                    ))}
                  </Bar>
                  <Bar dataKey="objectif2030" name="Objectif 2030" fill="#94A3B8" maxBarSize={14}
                    strokeDasharray="4 2" radius={[0,3,3,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-6 mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  Barre verte = en trajectoire
                </div>
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  Barre rouge = hors trajectoire (effort supplémentaire requis)
                </div>
              </div>
            </Card>
          )}

          {/* ── Bloc 7 — Tableau récapitulatif ──────────────────────────────── */}
          <Card>
            <SectionTitle>Tableau récapitulatif par bâtiment</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-gray-50">
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Bâtiment</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide text-right">Surface</th>
                    {annees.map(a => (
                      <th key={a} className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide text-right">{a} kWhef</th>
                    ))}
                    {annees.map(a => (
                      <th key={`i${a}`} className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide text-right">{a} kWhef/m²</th>
                    ))}
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide text-right">Évol. {avantDern}→{dernAnnee}</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">DT</th>
                  </tr>
                </thead>
                <tbody>
                  {batiments.map((b, i) => {
                    const kwefN  = b.annuel?.[dernAnnee]?.kwef  ?? 0;
                    const kwefN1 = b.annuel?.[avantDern]?.kwef ?? 0;
                    const evol   = pctEvol(kwefN, kwefN1);
                    return (
                      <tr key={b.id} className={`border-b border-border ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                        <td className="py-2 px-3 font-medium text-text-main">{b.intitule}</td>
                        <td className="py-2 px-3 text-right text-text-muted font-mono text-xs">
                          {b.surface > 0 ? `${b.surface.toLocaleString('fr-FR')} m²` : '—'}
                        </td>
                        {annees.map(a => (
                          <td key={a} className="py-2 px-3 text-right font-mono text-xs text-text-main">
                            {fmtNum(b.annuel?.[a]?.kwef)}
                          </td>
                        ))}
                        {annees.map(a => (
                          <td key={`i${a}`} className="py-2 px-3 text-right font-mono text-xs text-text-muted">
                            {fmtNum(b.annuel?.[a]?.intensite)}
                          </td>
                        ))}
                        <td className="py-2 px-3 text-right">
                          <EvolBadge pct={evol} />
                        </td>
                        <td className="py-2 px-3">
                          {b.decret?.soumis_decret
                            ? <CheckCircle size={14} className="text-green-500" />
                            : <span className="text-text-muted text-xs">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Total */}
                  <tr className="border-t-2 border-border bg-gray-100 font-semibold">
                    <td className="py-2 px-3 text-text-main">TOTAL</td>
                    <td className="py-2 px-3" />
                    {annees.map(a => (
                      <td key={a} className="py-2 px-3 text-right font-mono text-xs text-text-main">
                        {fmtNum(global[a]?.kwef)}
                      </td>
                    ))}
                    {annees.map(a => <td key={`i${a}`} className="py-2 px-3" />)}
                    <td className="py-2 px-3 text-right">
                      <EvolBadge pct={pctEvol(global[dernAnnee]?.kwef, global[avantDern]?.kwef)} />
                    </td>
                    <td className="py-2 px-3" />
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pied de page impression */}
          <div className="hidden print:block text-xs text-gray-400 text-center pt-4 border-t border-gray-200">
            Rapport généré automatiquement par OpéraTrack — Patrimoine & Énergie
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
