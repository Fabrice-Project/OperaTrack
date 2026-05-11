import { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, Clock, CheckCircle, XCircle, PlayCircle, Calendar, ChevronDown, ChevronUp, Save, X, ExternalLink, BarChart2, List } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { api } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { HistoriqueDemande } from '../../components/patrimoine/HistoriqueDemande';
import { PhotosDemande } from '../../components/patrimoine/PhotosDemande';

// ── Constantes ────────────────────────────────────────────────────────────────
const URGENCES = {
  normale:  { label: 'Normale',  bg: '#F3F4F6', color: '#374151' },
  urgente:  { label: 'Urgente',  bg: '#FEF3C7', color: '#B45309' },
  critique: { label: 'Critique', bg: '#FEE2E2', color: '#991B1B' },
};

const STATUTS = {
  nouvelle:  { label: 'Nouvelle',   icon: Clock,        bg: '#DBEAFE', color: '#1D4ED8' },
  en_cours:  { label: 'En cours',   icon: PlayCircle,   bg: '#FEF3C7', color: '#92400E' },
  planifiee: { label: 'Planifiée',  icon: Calendar,     bg: '#EDE9FE', color: '#5B21B6' },
  realisee:  { label: 'Réalisée',   icon: CheckCircle,  bg: '#D1FAE5', color: '#065F46' },
  rejetee:   { label: 'Rejetée',    icon: XCircle,      bg: '#FEE2E2', color: '#991B1B' },
};

const STATUT_ORDER = ['nouvelle', 'en_cours', 'planifiee', 'realisee', 'rejetee'];

const STATUT_COLORS = {
  nouvelle:  '#1D4ED8',
  en_cours:  '#92400E',
  planifiee: '#5B21B6',
  realisee:  '#065F46',
  rejetee:   '#991B1B',
};

const URGENCE_COLORS = {
  normale:  '#6B7280',
  urgente:  '#B45309',
  critique: '#991B1B',
};

function StatutBadge({ statut }) {
  const cfg = STATUTS[statut] || STATUTS.nouvelle;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

function UrgenceBadge({ urgence }) {
  const cfg = URGENCES[urgence] || URGENCES.normale;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      {urgence === 'critique' && <AlertTriangle size={11} />}
      {cfg.label}
    </span>
  );
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ── Ligne de demande expansible ───────────────────────────────────────────────
function DemandeLine({ demande, onUpdated, canEdit }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen]           = useState(false);
  const [form, setForm]           = useState({
    statut:                   demande.statut,
    commentaire_gestionnaire: demande.commentaire_gestionnaire || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/demandes/${demande.id}`, form);
      toast.success('Demande mise à jour');
      onUpdated();
      setOpen(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`border-l-4 ${demande.urgence === 'critique' ? 'border-red-400' : demande.urgence === 'urgente' ? 'border-amber-400' : 'border-transparent'}`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-text-main">{demande.titre}</span>
            <UrgenceBadge urgence={demande.urgence} />
            <StatutBadge statut={demande.statut} />
          </div>
          <div className="text-xs text-text-muted mt-0.5">
            <span className="font-medium">{demande.batiment?.intitule || '—'}</span>
            {' · '}
            <span>{demande.demandeur_nom || '—'}</span>
            {' · '}
            <span>{fmtDate(demande.created_at)}</span>
          </div>
        </div>
        <div className="shrink-0 text-text-muted">
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 bg-gray-50/60 flex flex-col gap-3">
          {demande.description && (
            <div>
              <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Description</div>
              <p className="text-sm text-text-main whitespace-pre-line">{demande.description}</p>
            </div>
          )}

          {demande.batiment_id && (
            <div>
              <button
                onClick={() => navigate(`/patrimoine/batiments/${demande.batiment_id}`)}
                className="inline-flex items-center gap-1.5 text-xs text-secondary hover:underline font-medium"
              >
                <ExternalLink size={12} />
                Ouvrir la fiche bâtiment — {demande.batiment?.intitule || demande.batiment_id}
              </button>
            </div>
          )}

          {canEdit && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Statut</label>
                  <select
                    className="form-select w-full text-sm"
                    value={form.statut}
                    onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}
                  >
                    {STATUT_ORDER.map(s => (
                      <option key={s} value={s}>{STATUTS[s].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Commentaire gestionnaire</label>
                  <input
                    className="form-input w-full text-sm"
                    value={form.commentaire_gestionnaire}
                    onChange={e => setForm(f => ({ ...f, commentaire_gestionnaire: e.target.value }))}
                    placeholder="Réponse, programme, remarque…"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)}
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
                  <X size={12} /> Fermer
                </button>
                <button type="button" onClick={handleSave} disabled={saving}
                  className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                  <Save size={12} />
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </>
          )}

          {!canEdit && demande.commentaire_gestionnaire && (
            <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700">
              <span className="font-semibold">Réponse : </span>
              {demande.commentaire_gestionnaire}
            </div>
          )}

          <PhotosDemande demandeId={demande.id} />

          <div className="border-t border-gray-100 pt-3 mt-1">
            <HistoriqueDemande demandeId={demande.id} onMessageSent={onUpdated} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tooltip recharts personnalisé ─────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-md px-3 py-2 text-xs">
      <div className="font-semibold text-text-main mb-1">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.fill || p.color }}>
          {p.name} : <span className="font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Donut avec légende verticale ──────────────────────────────────────────────
function DonutCard({ title, data, total }) {
  return (
    <div className="card p-4">
      <div className="text-sm font-semibold text-text-main mb-4">{title}</div>
      <div className="flex items-center gap-4">
        {/* Donut */}
        <div className="relative shrink-0" style={{ width: 160, height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={75}
                strokeWidth={2}
                stroke="#fff"
                paddingAngle={2}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${value} (${Math.round(value / total * 100)}%)`, name]}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Total au centre */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-mono font-bold text-2xl text-text-main leading-none">{total}</span>
            <span className="text-[10px] text-text-muted mt-0.5">total</span>
          </div>
        </div>

        {/* Légende verticale */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {data.map((entry, i) => {
            const pct = total > 0 ? Math.round(entry.value / total * 100) : 0;
            return (
              <div key={i} className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                <span className="text-xs text-text-muted truncate flex-1">{entry.name}</span>
                <span className="text-xs font-mono font-semibold text-text-main shrink-0">{entry.value}</span>
                <span className="text-[10px] text-text-muted shrink-0 w-8 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Génération du rapport imprimable ─────────────────────────────────────────
function buildPrintHTML({ periodeLabel, collectivite, total, tauxRealisation, nbUrgentes, delaiMoyen, dataStatut, dataUrgence, dataBatiments, dataEvolution }) {
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const tableRows = (rows) => rows.map(r => `
    <tr>
      <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${r.fill || '#6B7280'};margin-right:6px;vertical-align:middle"></span>
        ${r.name}
      </td>
      <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${r.value}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:right;color:#6B7280">${total > 0 ? Math.round(r.value / total * 100) : 0}%</td>
    </tr>`).join('');

  const evolutionRows = dataEvolution.map(m => `
    <tr>
      <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb">${m.label}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${m.value}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb">
        <div style="background:#2563EB;height:10px;border-radius:3px;width:${Math.max(2, Math.round((m.value / Math.max(...dataEvolution.map(x => x.value), 1)) * 140))}px"></div>
      </td>
    </tr>`).join('');

  const batimentRows = dataBatiments.map(b => `
    <tr>
      <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb">${b.name}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${b.value}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb">
        <div style="background:#0D9488;height:10px;border-radius:3px;width:${Math.max(2, Math.round((b.value / Math.max(...dataBatiments.map(x => x.value), 1)) * 140))}px"></div>
      </td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Statistiques demandes d'intervention</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 24px; }
    h1 { font-size: 16px; font-weight: bold; }
    h2 { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: .05em; color: #1D4ED8; border-bottom: 1.5px solid #1D4ED8; padding-bottom: 3px; margin-bottom: 8px; margin-top: 20px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #111; padding-bottom: 12px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 4px; }
    .kpi { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; }
    .kpi-label { font-size: 9px; color: #6B7280; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
    .kpi-value { font-size: 22px; font-weight: bold; font-family: monospace; }
    .cols2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { padding: 5px 8px; background: #F9FAFB; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; color: #6B7280; border-bottom: 1px solid #e5e7eb; }
    .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #9CA3AF; text-align: center; }
    @media print { body { padding: 10px; } @page { margin: 15mm; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${collectivite || 'Ville de Denain'}</h1>
      <div style="font-size:10px;color:#6B7280;margin-top:3px">Gestion du Patrimoine — Demandes d'intervention</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:14px;font-weight:bold;color:#1D4ED8">RAPPORT STATISTIQUE</div>
      <div style="font-size:10px;color:#6B7280;margin-top:2px">Période : ${periodeLabel}</div>
      <div style="font-size:10px;color:#6B7280">Édité le ${today}</div>
    </div>
  </div>

  <h2>Indicateurs clés</h2>
  <div class="kpis">
    <div class="kpi">
      <div class="kpi-label">Total demandes</div>
      <div class="kpi-value" style="color:#111">${total}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Taux de réalisation</div>
      <div class="kpi-value" style="color:#065F46">${tauxRealisation}%</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Urgentes / Critiques</div>
      <div class="kpi-value" style="color:#B45309">${nbUrgentes}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Délai moyen traitement</div>
      <div class="kpi-value" style="color:#5B21B6">${delaiMoyen !== null ? delaiMoyen + 'j' : '—'}</div>
    </div>
  </div>

  <div class="cols2">
    <div>
      <h2>Répartition par statut</h2>
      <table>
        <thead><tr><th>Statut</th><th style="text-align:right">Nb</th><th style="text-align:right">%</th></tr></thead>
        <tbody>${tableRows(dataStatut)}</tbody>
      </table>
    </div>
    <div>
      <h2>Répartition par urgence</h2>
      <table>
        <thead><tr><th>Urgence</th><th style="text-align:right">Nb</th><th style="text-align:right">%</th></tr></thead>
        <tbody>${tableRows(dataUrgence)}</tbody>
      </table>
    </div>
  </div>

  <h2>Évolution mensuelle</h2>
  <table>
    <thead><tr><th>Mois</th><th style="text-align:right">Demandes</th><th style="width:160px">Proportion</th></tr></thead>
    <tbody>${evolutionRows}</tbody>
  </table>

  ${dataBatiments.length > 0 ? `
  <h2>Top bâtiments</h2>
  <table>
    <thead><tr><th>Bâtiment</th><th style="text-align:right">Demandes</th><th style="width:160px">Proportion</th></tr></thead>
    <tbody>${batimentRows}</tbody>
  </table>` : ''}

  <div class="footer">OpéraTrack — ${collectivite || 'Ville de Denain'} · Rapport généré le ${today}</div>
</body>
</html>`;
}

// ── Onglet Statistiques ───────────────────────────────────────────────────────
function TabStats({ demandes }) {
  const [periodeDebut, setPeriodeDebut] = useState('');
  const [periodeFin,   setPeriodeFin]   = useState('');
  const [collectivite, setCollectivite] = useState('Ville de Denain');

  useEffect(() => {
    api.get('/settings/config')
      .then(d => { if (d?.collectivite) setCollectivite(d.collectivite); })
      .catch(() => {});
  }, []);

  // Filtrage par période sur created_at
  const data = useMemo(() =>
    demandes.filter(d => {
      if (!d.created_at) return true;
      const date = d.created_at.slice(0, 10);
      if (periodeDebut && date < periodeDebut) return false;
      if (periodeFin   && date > periodeFin)   return false;
      return true;
    }),
  [demandes, periodeDebut, periodeFin]);

  const total = data.length;

  const dataStatut = useMemo(() =>
    STATUT_ORDER.map(s => ({
      name:  STATUTS[s].label,
      value: data.filter(d => d.statut === s).length,
      fill:  STATUT_COLORS[s],
    })).filter(d => d.value > 0),
  [data]);

  const dataUrgence = useMemo(() =>
    Object.entries(URGENCES).map(([k, v]) => ({
      name:  v.label,
      value: data.filter(d => d.urgence === k).length,
      fill:  URGENCE_COLORS[k],
    })).filter(d => d.value > 0),
  [data]);

  const dataBatiments = useMemo(() => {
    const counts = {};
    data.forEach(d => {
      const nom = d.batiment?.intitule || 'Non renseigné';
      counts[nom] = (counts[nom] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [data]);

  // Évolution mensuelle : plage de la période si définie, sinon 12 mois glissants
  const dataEvolution = useMemo(() => {
    const start = periodeDebut ? new Date(periodeDebut + 'T00:00:00') : (() => { const d = new Date(); d.setMonth(d.getMonth() - 11); d.setDate(1); return d; })();
    const end   = periodeFin   ? new Date(periodeFin   + 'T00:00:00') : new Date();
    const months = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      months.push({
        key:   `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`,
        label: cur.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
        value: 0,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    data.forEach(d => {
      if (!d.created_at) return;
      const key = d.created_at.slice(0, 7);
      const m = months.find(m => m.key === key);
      if (m) m.value++;
    });
    return months;
  }, [data, periodeDebut, periodeFin]);

  const delaiMoyen = useMemo(() => {
    const realisees = data.filter(d => d.statut === 'realisee' && d.created_at && d.updated_at);
    if (!realisees.length) return null;
    const totalJours = realisees.reduce((acc, d) => acc + (new Date(d.updated_at) - new Date(d.created_at)) / 86400000, 0);
    return Math.round(totalJours / realisees.length);
  }, [data]);

  const tauxRealisation  = total > 0 ? Math.round(data.filter(d => d.statut === 'realisee').length / total * 100) : 0;
  const nbUrgentes       = data.filter(d => d.urgence === 'urgente' || d.urgence === 'critique').length;

  const fmtPeriode = (s) => s ? new Date(s + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : null;
  const periodeLabel = periodeDebut || periodeFin
    ? [periodeDebut && `Du ${fmtPeriode(periodeDebut)}`, periodeFin && `au ${fmtPeriode(periodeFin)}`].filter(Boolean).join(' ')
    : 'Toutes les demandes';

  const handlePrint = () => {
    const html = buildPrintHTML({ periodeLabel, collectivite, total, tauxRealisation, nbUrgentes, delaiMoyen, dataStatut, dataUrgence, dataBatiments, dataEvolution });
    const w = window.open('', '_blank', 'width=900,height=750');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  return (
    <div className="flex flex-col gap-5">

      {/* Barre filtre période + bouton impression */}
      <div className="card p-3 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-text-muted shrink-0">Période :</span>
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <input
            type="date"
            className="form-input text-sm py-1.5 px-3 w-40"
            value={periodeDebut}
            onChange={e => setPeriodeDebut(e.target.value)}
          />
          <span className="text-xs text-text-muted">→</span>
          <input
            type="date"
            className="form-input text-sm py-1.5 px-3 w-40"
            value={periodeFin}
            onChange={e => setPeriodeFin(e.target.value)}
          />
          {(periodeDebut || periodeFin) && (
            <button
              onClick={() => { setPeriodeDebut(''); setPeriodeFin(''); }}
              className="text-xs text-text-muted hover:text-text-main flex items-center gap-1"
            >
              <X size={12} /> Réinitialiser
            </button>
          )}
          {(periodeDebut || periodeFin) && (
            <span className="text-xs text-text-muted italic">{total} demande{total !== 1 ? 's' : ''} sur la période</span>
          )}
        </div>
        <button
          onClick={handlePrint}
          className="btn-primary text-xs flex items-center gap-1.5 shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Imprimer / PDF
        </button>
      </div>

      {total === 0 ? (
        <div className="py-16 text-center text-text-muted text-sm">Aucune donnée sur cette période.</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="card p-4">
              <div className="text-xs text-text-muted mb-1">Total demandes</div>
              <div className="font-mono font-bold text-2xl text-text-main">{total}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-text-muted mb-1">Taux de réalisation</div>
              <div className="font-mono font-bold text-2xl text-green-600">{tauxRealisation} %</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-text-muted mb-1">Urgentes / Critiques</div>
              <div className="font-mono font-bold text-2xl text-amber-600">{nbUrgentes}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-text-muted mb-1">Délai moyen traitement</div>
              <div className="font-mono font-bold text-2xl text-purple-600">
                {delaiMoyen !== null ? `${delaiMoyen}j` : '—'}
              </div>
              <div className="text-[10px] text-text-muted mt-0.5">sur demandes réalisées</div>
            </div>
          </div>

          {/* Répartitions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DonutCard title="Répartition par statut"  data={dataStatut}  total={total} />
            <DonutCard title="Répartition par urgence" data={dataUrgence} total={total} />
          </div>

          {/* Évolution mensuelle */}
          <div className="card p-4">
            <div className="text-sm font-semibold text-text-main mb-4">
              Évolution mensuelle des demandes
              {!(periodeDebut || periodeFin) && <span className="font-normal text-text-muted"> (12 derniers mois)</span>}
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dataEvolution} barSize={20}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Demandes" fill="#2563EB" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top bâtiments */}
          {dataBatiments.length > 0 && (
            <div className="card p-4">
              <div className="text-sm font-semibold text-text-main mb-4">Bâtiments avec le plus de demandes</div>
              <ResponsiveContainer width="100%" height={Math.max(180, dataBatiments.length * 36)}>
                <BarChart data={dataBatiments} layout="vertical" barSize={18}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={160}
                    tick={{ fontSize: 11 }}
                    tickFormatter={v => v.length > 22 ? v.slice(0, 22) + '…' : v}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Demandes" fill="#0D9488" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export function TabDemandes() {
  const toast = useToast();
  const { canEditPatrimoineReferentiel } = useAuth();
  const canEdit = canEditPatrimoineReferentiel;

  const [demandes, setDemandes]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [view, setView]                 = useState('liste'); // 'liste' | 'stats'
  const [filtreStatut, setFiltreStatut] = useState('');
  const [filtreUrgence, setFiltreUrgence] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/demandes');
      setDemandes(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = demandes.filter(d => {
    if (filtreStatut  && d.statut  !== filtreStatut)  return false;
    if (filtreUrgence && d.urgence !== filtreUrgence) return false;
    return true;
  });

  const nbNouvelles  = demandes.filter(d => d.statut === 'nouvelle').length;
  const nbUrgentes   = demandes.filter(d => d.urgence === 'urgente' || d.urgence === 'critique').length;
  const nbPlanifiees = demandes.filter(d => d.statut === 'planifiee').length;
  const nbRealisees  = demandes.filter(d => d.statut === 'realisee').length;

  if (loading) return (
    <div className="py-10 text-center text-text-muted text-sm">Chargement des demandes…</div>
  );

  return (
    <div className="flex flex-col gap-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="text-xs text-text-muted mb-1">Nouvelles demandes</div>
          <div className="font-mono font-bold text-2xl text-blue-600">{nbNouvelles}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-text-muted mb-1">Urgentes / Critiques</div>
          <div className="font-mono font-bold text-2xl text-amber-600">{nbUrgentes}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-text-muted mb-1">Planifiées</div>
          <div className="font-mono font-bold text-2xl text-purple-600">{nbPlanifiees}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-text-muted mb-1">Réalisées</div>
          <div className="font-mono font-bold text-2xl text-green-600">{nbRealisees}</div>
        </div>
      </div>

      {/* Bascule Liste / Statistiques */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        <button
          onClick={() => setView('liste')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            view === 'liste'
              ? 'bg-white shadow-sm text-text-main'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          <List size={14} /> Liste
        </button>
        <button
          onClick={() => setView('stats')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            view === 'stats'
              ? 'bg-white shadow-sm text-text-main'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          <BarChart2 size={14} /> Statistiques
        </button>
      </div>

      {/* Vue Statistiques */}
      {view === 'stats' && <TabStats demandes={demandes} />}

      {/* Vue Liste */}
      {view === 'liste' && (
        <>
          <div className="flex gap-2 flex-wrap">
            <select
              className="form-select text-sm py-1.5 px-3"
              value={filtreStatut}
              onChange={e => setFiltreStatut(e.target.value)}
            >
              <option value="">Tous les statuts</option>
              {STATUT_ORDER.map(s => (
                <option key={s} value={s}>{STATUTS[s].label}</option>
              ))}
            </select>
            <select
              className="form-select text-sm py-1.5 px-3"
              value={filtreUrgence}
              onChange={e => setFiltreUrgence(e.target.value)}
            >
              <option value="">Toutes les urgences</option>
              {Object.entries(URGENCES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            {(filtreStatut || filtreUrgence) && (
              <button
                onClick={() => { setFiltreStatut(''); setFiltreUrgence(''); }}
                className="text-xs text-text-muted hover:text-text-main flex items-center gap-1"
              >
                <X size={12} /> Réinitialiser
              </button>
            )}
            <span className="ml-auto text-xs text-text-muted self-center">
              {filtered.length} demande{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="card overflow-hidden divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-text-muted text-sm">
                Aucune demande d'intervention enregistrée.
              </div>
            ) : (
              filtered.map(d => (
                <DemandeLine
                  key={d.id}
                  demande={d}
                  onUpdated={load}
                  canEdit={canEdit}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
