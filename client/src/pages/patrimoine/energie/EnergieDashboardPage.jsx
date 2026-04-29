import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Zap, Building2, Lightbulb, TrendingDown, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, BarChart2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import { AppLayout } from '../../../components/layout/AppLayout';
import { api } from '../../../utils/api';
import { useToast } from '../../../contexts/ToastContext';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtNum(v, unit = '') {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toLocaleString('fr-FR')}${unit ? ' ' + unit : ''}`;
}
function fmtEur(v) {
  if (v == null || isNaN(v)) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

function intensiteColor(v) {
  if (v == null) return '#CBD5E1';
  if (v <= 120)  return '#22C55E';
  if (v <= 250)  return '#F59E0B';
  return '#EF4444';
}

function intensiteLabel(v) {
  if (v == null) return '';
  if (v <= 120)  return 'Performant';
  if (v <= 250)  return 'Moyen';
  return 'Énergivore';
}

// ── Tuile KPI ─────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color = '#1A3A5C', bg = 'bg-gray-50' }) {
  return (
    <div className={`${bg} rounded-xl p-4 flex flex-col gap-1`}>
      <div className="flex items-center gap-2 text-text-muted">
        <Icon size={16} style={{ color }} />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-text-main">{value}</div>
      {sub && <div className="text-xs text-text-muted">{sub}</div>}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function EnergieDashboardPage() {
  const toast    = useToast();
  const navigate = useNavigate();
  const [anneeN, setAnneeN] = useState(new Date().getFullYear() - 1);
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get(`/patrimoine/energie/dashboard?annee=${anneeN}`);
      setData(d);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [anneeN]);

  useEffect(() => { load(); }, [load]);

  const handleExportOperat = async () => {
    setExporting(true);
    try {
      const url = `/api/v1/patrimoine/exports/operat?annee=${anneeN}`;
      const token = localStorage.getItem('opera_token');
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error('Erreur export');
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `export_operat_${anneeN}.csv`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      toast.success('Export OPERAT téléchargé');
    } catch (err) { toast.error(err.message); }
    finally { setExporting(false); }
  };

  // Données graphique classement
  const classement = data?.classement || [];
  const maxKwef = Math.max(...classement.map(b => b.kwef || 0), 1);

  // Donut facture
  const donutData = data ? [
    { name: 'Bâtiments', value: data.totalMontantBat, color: '#1A3A5C' },
    { name: 'Éclairage public', value: data.totalMontantEP, color: '#F59E0B' },
  ].filter(d => d.value > 0) : [];

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto">

        {/* En-tête */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-heading font-bold text-text-main flex items-center gap-2">
              <Zap size={24} className="text-yellow-500" />
              Tableau de bord énergie
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              Suivi des consommations et trajectoire Décret Tertiaire
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select value={anneeN} onChange={e => setAnneeN(parseInt(e.target.value))}
              className="input text-sm py-1.5 px-3">
              {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button onClick={load} disabled={loading}
              className="btn-secondary text-sm flex items-center gap-1.5">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
            </button>
            <button onClick={() => navigate('/patrimoine/energie/rapport')}
              className="btn-secondary text-sm flex items-center gap-1.5">
              <BarChart2 size={14} /> Rapport de tendances
            </button>
            <button onClick={handleExportOperat} disabled={exporting}
              className="btn-primary text-sm flex items-center gap-1.5">
              <Download size={14} /> Export OPERAT {anneeN}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-text-muted text-sm gap-2">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
            Chargement du tableau de bord…
          </div>
        ) : !data ? null : (
          <div className="flex flex-col gap-6">

            {/* ── Bloc 1 — KPIs globaux ─────────────────────────────────────── */}
            <div className="grid grid-cols-4 gap-4">
              <KpiCard icon={Zap}       label="Facture globale"     value={fmtEur(data.totalMontantGlobal)} sub={`Bâtiments + Éclairage ${anneeN}`} color="#F59E0B" bg="bg-yellow-50" />
              <KpiCard icon={Building2} label="Facture bâtiments"   value={fmtEur(data.totalMontantBat)}   sub={`${classement.length} bâtiments`}  color="#1A3A5C" />
              <KpiCard icon={Lightbulb} label="Facture éclairage"   value={fmtEur(data.totalMontantEP)}    sub="Armoires EP"                        color="#F59E0B" />
              <KpiCard icon={Zap}       label="Total kWhef bâtiments" value={fmtNum(data.totalKwef, 'kWhef')} sub={`Énergie finale ${anneeN}`}       color="#8B5CF6" bg="bg-purple-50" />
            </div>

            {/* ── Bloc 2 — Répartition + Décret Tertiaire ───────────────────── */}
            <div className="grid grid-cols-3 gap-4">
              {/* Donut répartition facture */}
              <div className="bg-white border border-border rounded-xl p-4">
                <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
                  Répartition de la facture {anneeN}
                </div>
                {donutData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                        dataKey="value" nameKey="name" paddingAngle={3}>
                        {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={v => fmtEur(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-36 text-text-muted text-sm">
                    Aucune donnée
                  </div>
                )}
              </div>

              {/* Statut Décret Tertiaire */}
              <div className="col-span-2 bg-blue-900 text-white rounded-xl p-5">
                <div className="text-sm font-semibold mb-1 opacity-80 uppercase tracking-wide">
                  Décret Tertiaire — Portefeuille {anneeN}
                </div>
                <div className="text-3xl font-bold mb-3">
                  {data.decretTertiaire.nb_en_trajectoire} / {data.decretTertiaire.nb_soumis}
                  <span className="text-base font-normal opacity-70 ml-2">bâtiments en trajectoire 2030</span>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 bg-green-600/20 rounded-xl p-3 text-center">
                    <CheckCircle size={20} className="mx-auto mb-1 text-green-400"/>
                    <div className="text-2xl font-bold text-green-400">{data.decretTertiaire.nb_en_trajectoire}</div>
                    <div className="text-xs opacity-70">En trajectoire</div>
                  </div>
                  <div className="flex-1 bg-red-600/20 rounded-xl p-3 text-center">
                    <AlertTriangle size={20} className="mx-auto mb-1 text-red-400"/>
                    <div className="text-2xl font-bold text-red-400">{data.decretTertiaire.nb_hors_trajectoire}</div>
                    <div className="text-xs opacity-70">Hors trajectoire</div>
                  </div>
                  <div className="flex-1 bg-white/10 rounded-xl p-3 text-center">
                    <Building2 size={20} className="mx-auto mb-1 opacity-60"/>
                    <div className="text-2xl font-bold">{data.decretTertiaire.nb_soumis}</div>
                    <div className="text-xs opacity-70">Soumis au décret</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Bloc 3 — Classement bâtiments ────────────────────────────── */}
            <div className="bg-white border border-border rounded-xl p-5">
              <div className="text-sm font-semibold text-text-main mb-4">
                Classement énergétique des bâtiments — kWhef/m²/an ({anneeN})
              </div>

              {classement.length === 0 ? (
                <div className="text-center py-8 text-text-muted text-sm">
                  Aucune donnée de consommation disponible pour {anneeN}.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {classement.map(bat => {
                    const pct = bat.intensite != null ? Math.min((bat.intensite / Math.max(...classement.map(b => b.intensite || 0), 1)) * 100, 100) : 0;
                    const color = intensiteColor(bat.intensite);
                    return (
                      <div key={bat.id} className="flex items-center gap-3">
                        {/* Nom */}
                        <div className="w-48 shrink-0 text-sm text-text-main truncate" title={bat.intitule}>
                          {bat.intitule}
                        </div>
                        {/* Barre */}
                        <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                          <div className="h-full rounded-full flex items-center pl-2 transition-all duration-500"
                            style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}>
                          </div>
                        </div>
                        {/* Valeur + label */}
                        <div className="w-44 shrink-0 flex items-center gap-2">
                          <span className="text-sm font-semibold tabular-nums text-text-main">
                            {bat.intensite != null ? fmtNum(bat.intensite, 'kWhef/m²') : '—'}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{ backgroundColor: color + '22', color }}>
                            {intensiteLabel(bat.intensite)}
                          </span>
                        </div>
                        {/* Trajectoire DT */}
                        {bat.soumis_decret && bat.trajectoire && (
                          <div className="w-28 shrink-0">
                            {bat.trajectoire.en_trajectoire ? (
                              <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                <CheckCircle size={12}/> Trajectoire ✓
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                                <AlertTriangle size={12}/> Hors traj.
                              </span>
                            )}
                          </div>
                        )}
                        {bat.soumis_decret && !bat.trajectoire && bat.kwef === 0 && (
                          <div className="w-28 shrink-0 text-xs text-text-muted">Pas de données</div>
                        )}
                      </div>
                    );
                  })}

                  {/* Légende seuils */}
                  <div className="flex gap-4 mt-3 pt-3 border-t border-border">
                    {[
                      { color: '#22C55E', label: '< 120 kWhef/m² — Performant' },
                      { color: '#F59E0B', label: '120–250 kWhef/m² — Moyen' },
                      { color: '#EF4444', label: '> 250 kWhef/m² — Énergivore' },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-text-muted">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }}/>
                        {s.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Bloc 4 — Export OPERAT ────────────────────────────────────── */}
            <div className="bg-white border border-border rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-text-main mb-1">
                    Export OPERAT — Plateforme ADEME
                  </div>
                  <div className="text-xs text-text-muted">
                    Génère un fichier CSV au format attendu par la plateforme OPERAT pour la déclaration annuelle.
                    Seuls les bâtiments avec un identifiant OPERAT configuré sont inclus.
                  </div>
                </div>
                <button onClick={handleExportOperat} disabled={exporting}
                  className="btn-primary text-sm flex items-center gap-1.5 shrink-0 ml-4">
                  <Download size={14} />
                  {exporting ? 'Génération…' : `Générer l'export OPERAT ${anneeN}`}
                </button>
              </div>

              {/* Aperçu format */}
              <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs font-mono text-text-muted overflow-x-auto">
                identifiant_operat,annee,type_energie,consommation_kwh,unite<br/>
                OPERAT-59220-HV-001,{anneeN},ELECTRICITE,123000,kWh<br/>
                OPERAT-59220-HV-001,{anneeN},GAZ,174580,kWh
              </div>
            </div>

          </div>
        )}
      </div>
    </AppLayout>
  );
}
