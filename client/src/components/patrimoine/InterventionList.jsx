import { useState } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { api } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

// ── Constantes statut (exportées pour les pages qui en ont besoin) ────────────
export const STATUT_COLORS = {
  signalee:   { bg: '#FEE2E2', color: '#991B1B', label: 'Signalée' },
  programmee: { bg: '#DBEAFE', color: '#1D4ED8', label: 'Programmée' },
  en_cours:   { bg: '#FEF3C7', color: '#92400E', label: 'En cours' },
  realisee:   { bg: '#D1FAE5', color: '#065F46', label: 'Réalisée' },
  cloturee:   { bg: '#F3F4F6', color: '#374151', label: 'Clôturée' },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

// ── Sélecteur de statut inline ────────────────────────────────────────────────
function StatusSelect({ interventionId, statut, onChanged }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const cfg = STATUT_COLORS[statut] || STATUT_COLORS.signalee;

  const handleChange = async (e) => {
    const newStatut = e.target.value;
    setSaving(true);
    try {
      await api.put(`/patrimoine/interventions/${interventionId}`, { statut: newStatut });
      onChanged(interventionId, newStatut);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <select
        value={statut}
        onChange={handleChange}
        disabled={saving}
        title="Changer le statut"
        className="text-xs font-medium pl-2 pr-6 py-0.5 rounded-full border-0 cursor-pointer
                   outline-none focus:ring-1 focus:ring-inset appearance-none
                   disabled:opacity-60 disabled:cursor-wait transition-colors"
        style={{ backgroundColor: cfg.bg, color: cfg.color }}
      >
        {Object.entries(STATUT_COLORS).map(([k, v]) => (
          <option key={k} value={k}>{v.label}</option>
        ))}
      </select>
      {/* Chevron */}
      <svg
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2"
        width="10" height="10" viewBox="0 0 24 24" fill="none"
        style={{ color: cfg.color }}
      >
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
/**
 * InterventionList — tableau d'interventions commun à toutes les pages patrimoine.
 *
 * Props :
 *   interventions  {array}    liste d'interventions
 *   onRefresh      {function} rappelé après une suppression (pour recharger)
 *   onEdit         {function} rappelé avec l'intervention à éditer
 */
export function InterventionList({ interventions, onRefresh, onEdit }) {
  const toast = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === 'read';
  const isAdmin    = user?.role === 'admin';

  // Surcharges locales de statut (évite un reload complet après chaque changement)
  const [statutOverrides, setStatutOverrides] = useState({});

  const handleStatusChanged = (ivId, newStatut) => {
    setStatutOverrides(prev => ({ ...prev, [ivId]: newStatut }));
  };

  const handleDelete = async (iv) => {
    const label = iv.nature || iv.categorie || 'cette intervention';
    if (!window.confirm(`Supprimer « ${label} » ?\nCette action est irréversible.`)) return;
    try {
      await api.delete(`/patrimoine/interventions/${iv.id}`);
      toast.success('Intervention supprimée');
      onRefresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (!interventions || interventions.length === 0) {
    return (
      <div className="p-8 text-center text-text-muted text-sm">
        Aucune intervention enregistrée.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border bg-gray-50">
            <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Date</th>
            <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Catégorie</th>
            <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Nature</th>
            <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Intervenant</th>
            <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Statut</th>
            {!isReadOnly && <th className="py-2 px-2 w-20" />}
          </tr>
        </thead>
        <tbody>
          {interventions.map((iv, i) => {
            const currentStatut = statutOverrides[iv.id] ?? iv.statut;
            const cfgReadOnly   = STATUT_COLORS[currentStatut] || STATUT_COLORS.signalee;

            return (
              <tr
                key={iv.id}
                className={`border-b border-border hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}
              >
                <td className="py-2.5 px-3 text-xs font-mono text-text-muted whitespace-nowrap">
                  {fmtDate(iv.date_signalement)}
                </td>
                <td className="py-2.5 px-3 text-sm text-text-muted">{iv.categorie || '—'}</td>
                <td className="py-2.5 px-3 text-sm text-text-main max-w-xs truncate" title={iv.nature}>
                  {iv.nature || '—'}
                </td>
                <td className="py-2.5 px-3 text-sm text-text-muted">
                  {iv.type_intervenant === 'prestataire'
                    ? (iv.prestataire_nom || 'Prestataire')
                    : (iv.agent_nom || 'Agent interne')}
                </td>
                <td className="py-2.5 px-3">
                  {isReadOnly ? (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: cfgReadOnly.bg, color: cfgReadOnly.color }}
                    >
                      {cfgReadOnly.label}
                    </span>
                  ) : (
                    <StatusSelect
                      interventionId={iv.id}
                      statut={currentStatut}
                      onChanged={handleStatusChanged}
                    />
                  )}
                </td>

                {!isReadOnly && (
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => onEdit(iv)}
                        className="p-1.5 rounded hover:bg-blue-50 text-blue-400 transition-colors"
                        title="Modifier"
                      >
                        <Edit2 size={13} />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(iv)}
                          className="p-1.5 rounded hover:bg-red-50 text-red-400 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
