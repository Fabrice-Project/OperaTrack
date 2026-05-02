import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderOpen, Euro, TrendingUp, AlertTriangle, ArrowRight, Banknote, Receipt } from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { OperationsMap } from '../../components/map/OperationsMap';
import { TypeBadge, StatutBadge } from '../../components/ui/Badge';
import { KpiSkeleton, TableSkeleton } from '../../components/ui/Skeleton';
import { useOperations, useKPIs } from '../../hooks/useOperations';
import { formatEur, formatPct, formatDate } from '../../utils/formatters';

export default function DashboardPage() {
  const { operations, loading: opsLoading } = useOperations();
  const { kpis, loading: kpiLoading } = useKPIs();
  const [selectedId, setSelectedId] = useState(null);
  const [sortKey, setSortKey] = useState('intitule');
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = [...operations].sort((a, b) => {
    let va = a[sortKey] ?? '', vb = b[sortKey] ?? '';
    if (typeof va === 'number') return sortDir === 'asc' ? va - vb : vb - va;
    return sortDir === 'asc' ? String(va).localeCompare(String(vb), 'fr') : String(vb).localeCompare(String(va), 'fr');
  });

  const alerts = kpis?.alertes || operations.filter(op => op.alerts?.length > 0);

  return (
    <AppLayout breadcrumbs={[{ label: 'Tableau de bord' }]}>
      {/* Zone 1 — KPIs ligne 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {kpiLoading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard icon={FolderOpen} iconColor="#2E75B6" value={kpis?.operations_en_cours ?? 0} label="Opérations en cours" mono={false} />
            <KpiCard icon={Euro} iconColor="#1E7E45" value={formatEur(kpis?.montant_total_programme)} label="Montant total du programme" mono={true} />
            <KpiCard icon={TrendingUp} iconColor="#E8920A" value={formatPct(kpis?.taux_engagement_global)} label="Taux d'engagement global" mono={true} />
            <KpiCard icon={AlertTriangle} iconColor={kpis?.alertes_actives > 0 ? '#C0392B' : '#6B7A8D'} value={kpis?.alertes_actives ?? 0} label="Alertes actives" mono={false} pulse={kpis?.alertes_actives > 0} />
          </>
        )}
      </div>

      {/* Zone 1 bis — KPIs finances consolidées */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {kpiLoading ? (
          Array.from({ length: 3 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard icon={Banknote} iconColor="#1A3A5C" value={formatEur(operations.reduce((s, op) => s + parseFloat(op.montant_engage || 0), 0))} label="Montant total engagé" mono={true} />
            <KpiCard icon={Receipt} iconColor="#2E75B6" value={formatEur(operations.reduce((s, op) => s + parseFloat(op.montant_mandate || 0), 0))} label="Montant total mandaté" mono={true} />
            <KpiCard icon={TrendingUp} iconColor="#1E7E45"
              value={(() => {
                const env = operations.reduce((s, op) => s + parseFloat(op.enveloppe_ht || 0), 0);
                const eng = operations.reduce((s, op) => s + parseFloat(op.montant_engage || 0), 0);
                return env > 0 ? `${Math.round((eng / env) * 1000) / 10} %` : '—';
              })()}
              label="Taux d'engagement consolidé" mono={true} />
          </>
        )}
      </div>

      {/* Zone 2 — Carte + Tableau */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        {/* Carte */}
        <div className="card p-4 xl:col-span-3">
          <h2 className="font-heading font-semibold text-text-main text-base mb-3">
            Carte des opérations
          </h2>
          {opsLoading ? (
            <div className="skeleton rounded-xl" style={{ height: 420 }} />
          ) : (
            <div style={{ height: 420 }}>
              <OperationsMap
                operations={operations}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          )}
        </div>

        {/* Tableau */}
        <div className="card xl:col-span-2 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-heading font-semibold text-text-main text-base">
              Opérations ({operations.length})
            </h2>
          </div>
          {opsLoading ? (
            <TableSkeleton rows={6} />
          ) : (
            <div className="overflow-auto" style={{ maxHeight: 460 }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr>
                    <SortTh label="Intitulé" sortKey="intitule" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Statut" sortKey="statut" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Enveloppe" sortKey="enveloppe_ht" current={sortKey} dir={sortDir} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((op, i) => {
                    const hasAlert = op.alerts?.length > 0;
                    return (
                      <tr
                        key={op.id}
                        className={`table-row-hover ${i % 2 === 0 ? 'table-row-even' : 'table-row-odd'} ${selectedId === op.id ? '!bg-blue-50' : ''}`}
                        onClick={() => setSelectedId(op.id === selectedId ? null : op.id)}
                      >
                        <td className="table-cell max-w-[160px]">
                          <Link
                            to={`/operations/${op.id}`}
                            className="font-medium text-secondary hover:underline block truncate"
                            onClick={e => e.stopPropagation()}
                          >
                            {op.intitule}
                          </Link>
                          {hasAlert && (
                            <span className="text-danger text-xs">⚠ Alerte</span>
                          )}
                        </td>
                        <td className="table-cell">
                          <StatutBadge statut={op.statut} />
                        </td>
                        <td className="table-cell font-mono text-xs">
                          {formatEur(op.enveloppe_ht)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Zone 3 — Alertes */}
      {alerts.length > 0 && (
        <div className="card p-4">
          <h2 className="font-heading font-semibold text-text-main text-base mb-3 flex items-center gap-2">
            <AlertTriangle size={18} className="text-danger animate-pulse-red" />
            Alertes actives ({alerts.length})
          </h2>
          <div className="flex flex-col gap-2">
            {alerts.map(op => (
              <AlertRow key={op.id} op={op} />
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function KpiCard({ icon: Icon, iconColor, value, label, mono, pulse }) {
  return (
    <div className="card p-5">
      <div
        className={`inline-flex p-2 rounded-lg mb-3 ${pulse ? 'animate-pulse-red' : ''}`}
        style={{ backgroundColor: iconColor + '18' }}
      >
        <Icon size={20} style={{ color: iconColor }} />
      </div>
      <div
        className={`text-2xl font-bold text-text-main leading-none mb-1 ${mono ? 'font-mono' : 'font-heading'}`}
      >
        {value}
      </div>
      <div className="text-text-muted text-xs font-medium">{label}</div>
    </div>
  );
}

function SortTh({ label, sortKey, current, dir, onSort }) {
  const active = current === sortKey;
  return (
    <th className="table-header" onClick={() => onSort(sortKey)}>
      <span className="flex items-center gap-1">
        {label}
        <span className="opacity-60">{active ? (dir === 'asc' ? '↑' : '↓') : '↕'}</span>
      </span>
    </th>
  );
}

function AlertRow({ op }) {
  const alertColors = { rouge: { bg: '#FEE2E2', text: '#991B1B' }, orange: { bg: '#FEF3C7', text: '#92400E' } };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: '#FFF9F0' }}>
      <div className="flex-1">
        <Link to={`/operations/${op.id}`} className="font-semibold text-sm text-secondary hover:underline">
          {op.intitule}
        </Link>
        <div className="flex gap-2 mt-1 flex-wrap">
          {(op.alerts || []).map((a, i) => {
            const cfg = alertColors[a.type] || alertColors.orange;
            return (
              <span key={i} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: cfg.bg, color: cfg.text }}>
                {a.message}
              </span>
            );
          })}
        </div>
      </div>
      <Link to={`/operations/${op.id}`} className="text-text-muted hover:text-secondary transition-colors shrink-0">
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}
