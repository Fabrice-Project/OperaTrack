import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Trash2, Edit, Eye } from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { TypeBadge, StatutBadge } from '../../components/ui/Badge';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useOperations } from '../../hooks/useOperations';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../utils/api';
import { formatEur, formatDate, TYPE_CONFIG, STATUT_CONFIG } from '../../utils/formatters';

const PAGE_SIZE = 15;

export default function OperationsListPage() {
  const { operations, loading, refresh } = useOperations();
  const { isAdmin, isReadOnly } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const filtered = useMemo(() => {
    let list = operations;
    if (search) list = list.filter(op => op.intitule.toLowerCase().includes(search.toLowerCase()) || op.adresse?.toLowerCase().includes(search.toLowerCase()));
    if (filterType) list = list.filter(op => op.type === filterType);
    if (filterStatut) list = list.filter(op => op.statut === filterStatut);
    list = [...list].sort((a, b) => {
      let va = a[sortKey] ?? '', vb = b[sortKey] ?? '';
      if (typeof va === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb), 'fr') : String(vb).localeCompare(String(va), 'fr');
    });
    return list;
  }, [operations, search, filterType, filterStatut, sortKey, sortDir]);

  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/operations/${deleteTarget.id}`);
      toast.success('Opération supprimée avec succès');
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <AppLayout breadcrumbs={[{ label: 'Opérations', to: '/operations' }]}>
      {/* En-tête */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-heading font-bold text-text-main" style={{ fontSize: 26 }}>
            Opérations
          </h1>
          <p className="text-text-muted text-sm mt-0.5">
            {filtered.length} opération(s) — {operations.filter(op => op.statut !== 'soldee').length} en cours
          </p>
        </div>
        {!isReadOnly && (
          <Link to="/operations/new" className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            Nouvelle opération
          </Link>
        )}
      </div>

      {/* Filtres */}
      <div className="card p-4 mb-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-48 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            className="form-input pl-8"
            placeholder="Rechercher une opération…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="form-select min-w-44"
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setPage(1); }}
        >
          <option value="">Tous les types</option>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          className="form-select min-w-44"
          value={filterStatut}
          onChange={e => { setFilterStatut(e.target.value); setPage(1); }}
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUT_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Tableau */}
      <div className="card overflow-hidden">
        {loading ? (
          <TableSkeleton rows={8} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <SortTh label="Intitulé" sk="intitule" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Type" sk="type" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Statut" sk="statut" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Chargé" sk="charged_id" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Enveloppe HT" sk="enveloppe_ht" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Engagé" sk="montant_engage" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <th className="table-header text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-text-muted">
                        Aucune opération trouvée.
                      </td>
                    </tr>
                  ) : paginated.map((op, i) => (
                    <tr
                      key={op.id}
                      className={`table-row-hover ${i % 2 === 0 ? 'table-row-even' : 'table-row-odd'}`}
                      onClick={() => navigate(`/operations/${op.id}`)}
                    >
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          {op.image_url && (
                            <img src={op.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                          )}
                          <div>
                            <div className="font-semibold text-text-main">{op.intitule}</div>
                            {op.alerts?.length > 0 && (
                              <span className="text-xs text-danger">⚠ {op.alerts[0].message}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="table-cell"><TypeBadge type={op.type} /></td>
                      <td className="table-cell"><StatutBadge statut={op.statut} /></td>
                      <td className="table-cell text-text-muted">{op.charged?.full_name || '—'}</td>
                      <td className="table-cell font-mono text-xs">{formatEur(op.enveloppe_ht)}</td>
                      <td className="table-cell">
                        <div className="font-mono text-xs">{formatEur(op.montant_engage)}</div>
                        <div className="w-full bg-gray-100 rounded-full h-1 mt-1">
                          <div
                            className="h-1 rounded-full"
                            style={{
                              width: `${Math.min(100, (op.montant_engage / op.enveloppe_ht) * 100)}%`,
                              backgroundColor: op.montant_engage > op.enveloppe_ht * 1.05 ? '#C0392B' : '#1E7E45'
                            }}
                          />
                        </div>
                      </td>
                      <td className="table-cell text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/operations/${op.id}`}
                            className="p-1.5 rounded hover:bg-blue-50 text-text-muted hover:text-secondary transition-colors"
                            title="Voir"
                          >
                            <Eye size={14} />
                          </Link>
                          {!isReadOnly && (
                            <Link
                              to={`/operations/${op.id}/edit`}
                              className="p-1.5 rounded hover:bg-blue-50 text-text-muted hover:text-secondary transition-colors"
                              title="Modifier"
                            >
                              <Edit size={14} />
                            </Link>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => setDeleteTarget(op)}
                              className="p-1.5 rounded hover:bg-red-50 text-text-muted hover:text-danger transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-xs text-text-muted">
                  Page {page} sur {pages} — {filtered.length} opération(s)
                </span>
                <div className="flex gap-1">
                  {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                        p === page ? 'bg-primary text-white' : 'hover:bg-gray-100 text-text-muted'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Supprimer l'opération"
        message={`Êtes-vous sûr de vouloir supprimer "${deleteTarget?.intitule}" ? Cette action est irréversible.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AppLayout>
  );
}

function SortTh({ label, sk, current, dir, onSort }) {
  const active = current === sk;
  return (
    <th className="table-header" onClick={() => onSort(sk)}>
      <span className="flex items-center gap-1">
        {label}
        <span className="opacity-60 text-xs">{active ? (dir === 'asc' ? '↑' : '↓') : '↕'}</span>
      </span>
    </th>
  );
}
