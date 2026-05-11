import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Clock, CheckCircle, XCircle, PlayCircle, Calendar, ChevronDown, ChevronUp, Save, X, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

  const urgCfg = URGENCES[demande.urgence] || URGENCES.normale;

  return (
    <div className={`border-l-4 ${demande.urgence === 'critique' ? 'border-red-400' : demande.urgence === 'urgente' ? 'border-amber-400' : 'border-transparent'}`}>
      {/* En-tête ligne */}
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

      {/* Détail expandé */}
      {open && (
        <div className="px-4 pb-4 bg-gray-50/60 flex flex-col gap-3">
          {demande.description && (
            <div>
              <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Description</div>
              <p className="text-sm text-text-main whitespace-pre-line">{demande.description}</p>
            </div>
          )}

          {/* Lien vers la fiche bâtiment */}
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
                {/* Changer le statut */}
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

                {/* Commentaire */}
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
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                >
                  <X size={12} /> Fermer
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
                >
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

          {/* Photos jointes */}
          <PhotosDemande demandeId={demande.id} />

          {/* Historique des échanges */}
          <div className="border-t border-gray-100 pt-3 mt-1">
            <HistoriqueDemande demandeId={demande.id} onMessageSent={onUpdated} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export function TabDemandes() {
  const toast = useToast();
  const { canEditPatrimoineReferentiel } = useAuth();
  const canEdit = canEditPatrimoineReferentiel;

  const [demandes, setDemandes]       = useState([]);
  const [loading, setLoading]         = useState(true);
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

  // KPIs
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

      {/* Filtres */}
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

      {/* Liste */}
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
    </div>
  );
}
