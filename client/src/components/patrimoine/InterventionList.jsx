import { useState } from 'react';
import { Edit2, Trash2, Building2, User } from 'lucide-react';
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

function fmtEur(n) {
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
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

// ── Bandeau totaux ────────────────────────────────────────────────────────────
function TotauxPrestataires({ items }) {
  const total = items.reduce((s, iv) => s + (parseFloat(iv.montant_ht) || 0), 0);
  const count  = items.length;
  if (count === 0) return null;
  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50 border-b border-blue-100 text-sm">
      <span className="text-blue-700 font-medium">
        {count} intervention{count > 1 ? 's' : ''} prestataire{count > 1 ? 's' : ''}
      </span>
      {total > 0 && (
        <span className="font-semibold text-blue-800">
          Total : {fmtEur(total)} HT
        </span>
      )}
    </div>
  );
}

function TotauxAgents({ items }) {
  const count  = items.length;
  const heures = items.reduce((s, iv) => s + (parseFloat(iv.nombre_heures) || 0), 0);
  const achats = items.reduce((s, iv) => s + (parseFloat(iv.montant_achat) || 0), 0);
  if (count === 0) return null;
  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-green-50 border-b border-green-100 text-sm">
      <span className="text-green-700 font-medium">
        {count} intervention{count > 1 ? 's' : ''} en régie
      </span>
      <div className="flex items-center gap-4">
        {heures > 0 && (
          <span className="text-green-700">
            {heures} h travaillée{heures > 1 ? 's' : ''}
          </span>
        )}
        {achats > 0 && (
          <span className="font-semibold text-green-800">
            Achats : {fmtEur(achats)} HT
          </span>
        )}
      </div>
    </div>
  );
}

// ── Tableau partagé ───────────────────────────────────────────────────────────
function InterventionTable({ rows, isPrestataire, isReadOnly, isAdmin, statutOverrides, onStatusChanged, onEdit, onDelete }) {
  if (rows.length === 0) {
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
            {isPrestataire ? (
              <>
                <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Prestataire</th>
                <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Montant HT</th>
              </>
            ) : (
              <>
                <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Agent</th>
                <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Heures / Achats</th>
              </>
            )}
            <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Statut</th>
            {!isReadOnly && <th className="py-2 px-2 w-20" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((iv, i) => {
            const currentStatut = statutOverrides[iv.id] ?? iv.statut;
            const cfgRO = STATUT_COLORS[currentStatut] || STATUT_COLORS.signalee;

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

                {isPrestataire ? (
                  <>
                    <td className="py-2.5 px-3">
                      <div className="text-sm text-text-main">
                        {iv.prestataire_nom || <span className="text-text-muted italic">Non renseigné</span>}
                      </div>
                      {iv.numero_bc && (
                        <div className="text-xs text-text-muted">BC : {iv.numero_bc}</div>
                      )}
                      {iv.reference_marche && (
                        <div className="text-xs text-text-muted truncate max-w-[160px]" title={iv.reference_marche}>
                          {iv.reference_marche}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-sm font-mono text-text-main">
                      {iv.montant_ht > 0 ? fmtEur(iv.montant_ht) : <span className="text-text-muted">—</span>}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2.5 px-3">
                      <div className="text-sm text-text-main">
                        {iv.agent_nom || <span className="text-text-muted italic">Non renseigné</span>}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      {iv.nombre_heures > 0 && (
                        <div className="text-sm text-text-main">{iv.nombre_heures} h</div>
                      )}
                      {iv.montant_achat > 0 && (
                        <div className="text-xs text-text-muted">Achat : {fmtEur(iv.montant_achat)}</div>
                      )}
                      {!iv.nombre_heures && !iv.montant_achat && (
                        <span className="text-text-muted text-sm">—</span>
                      )}
                    </td>
                  </>
                )}

                <td className="py-2.5 px-3">
                  {isReadOnly ? (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: cfgRO.bg, color: cfgRO.color }}
                    >
                      {cfgRO.label}
                    </span>
                  ) : (
                    <StatusSelect
                      interventionId={iv.id}
                      statut={currentStatut}
                      onChanged={onStatusChanged}
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
                          onClick={() => onDelete(iv)}
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

  const [volet, setVolet]               = useState('prestataires');
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

  const prestataires = (interventions || []).filter(iv => iv.type_intervenant === 'prestataire');
  const agents       = (interventions || []).filter(iv => iv.type_intervenant !== 'prestataire');

  const VOLETS = [
    {
      key: 'prestataires',
      label: 'Prestataires',
      icon: <Building2 size={13} />,
      count: prestataires.length,
      activeStyle: { backgroundColor: '#DBEAFE', color: '#1D4ED8', borderColor: '#BFDBFE' },
    },
    {
      key: 'agents',
      label: 'Agents internes',
      icon: <User size={13} />,
      count: agents.length,
      activeStyle: { backgroundColor: '#D1FAE5', color: '#065F46', borderColor: '#A7F3D0' },
    },
  ];

  if (!interventions || interventions.length === 0) {
    return (
      <div className="p-8 text-center text-text-muted text-sm">
        Aucune intervention enregistrée.
      </div>
    );
  }

  const currentRows      = volet === 'prestataires' ? prestataires : agents;
  const isPrestataire    = volet === 'prestataires';

  return (
    <div className="flex flex-col">
      {/* ── Onglets volets ─────────────────────────────────────────────────── */}
      <div className="flex border-b border-border bg-gray-50 px-3 pt-2 gap-1">
        {VOLETS.map(v => {
          const active = volet === v.key;
          return (
            <button
              key={v.key}
              onClick={() => setVolet(v.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-t-md text-sm font-medium border border-b-0 transition-colors"
              style={active
                ? { ...v.activeStyle, backgroundColor: v.activeStyle.backgroundColor }
                : { backgroundColor: 'transparent', color: '#6B7280', borderColor: 'transparent' }
              }
            >
              {v.icon}
              {v.label}
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                style={active
                  ? { backgroundColor: 'white', color: v.activeStyle.color, opacity: 0.9 }
                  : { backgroundColor: '#E5E7EB', color: '#6B7280' }
                }
              >
                {v.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Bandeau totaux ──────────────────────────────────────────────────── */}
      {isPrestataire
        ? <TotauxPrestataires items={prestataires} />
        : <TotauxAgents items={agents} />
      }

      {/* ── Tableau ─────────────────────────────────────────────────────────── */}
      <InterventionTable
        rows={currentRows}
        isPrestataire={isPrestataire}
        isReadOnly={isReadOnly}
        isAdmin={isAdmin}
        statutOverrides={statutOverrides}
        onStatusChanged={handleStatusChanged}
        onEdit={onEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}
