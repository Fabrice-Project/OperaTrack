import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock, PlayCircle, Calendar, CheckCircle, XCircle,
  MessageSquare, Send, User, ArrowRight,
} from 'lucide-react';
import { api } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';

// ── Constantes ────────────────────────────────────────────────────────────────
const STATUTS = {
  nouvelle:  { label: 'Nouvelle',  icon: Clock,        color: '#1D4ED8' },
  en_cours:  { label: 'En cours',  icon: PlayCircle,   color: '#92400E' },
  planifiee: { label: 'Planifiée', icon: Calendar,     color: '#5B21B6' },
  realisee:  { label: 'Réalisée',  icon: CheckCircle,  color: '#065F46' },
  rejetee:   { label: 'Rejetée',   icon: XCircle,      color: '#991B1B' },
};

const ROLE_LABELS = {
  admin:                    'Administrateur',
  administrateur:           'Administrateur',
  gestionnaire_patrimonial: 'Gestionnaire',
  charge_operation:         'Chargé d\'opération',
  write:                    'Chargé d\'opération',
  directeur:                'Directeur',
  read:                     'Directeur',
  administratif:            'Administratif',
  compta:                   'Administratif',
  exploitant:               'Exploitant',
};

function fmtDateHeure(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Entrée de timeline ────────────────────────────────────────────────────────
function EntreeHistorique({ entree }) {
  const isMessage   = entree.type === 'message';
  const isCreation  = entree.type === 'creation';
  const isStatut    = entree.type === 'statut';
  const isComment   = entree.type === 'commentaire';
  const isExploitant = entree.auteur_role === 'exploitant';

  let dot = 'bg-gray-300';
  let icon = null;
  let content = null;

  if (isCreation) {
    dot = 'bg-blue-400';
    content = (
      <div className="text-xs text-text-muted">
        Demande créée par <span className="font-medium text-text-main">{entree.auteur_nom}</span>
      </div>
    );
  } else if (isStatut) {
    const avant = STATUTS[entree.ancien_statut];
    const apres = STATUTS[entree.nouveau_statut];
    dot = 'bg-purple-400';
    content = (
      <div className="text-xs flex items-center gap-1.5 flex-wrap">
        <span className="text-text-muted">Statut changé par</span>
        <span className="font-medium text-text-main">{entree.auteur_nom}</span>
        <span className="text-text-muted">:</span>
        {avant && (
          <span className="font-medium" style={{ color: avant.color }}>{avant.label}</span>
        )}
        <ArrowRight size={11} className="text-text-muted" />
        {apres && (
          <span className="font-medium" style={{ color: apres.color }}>{apres.label}</span>
        )}
      </div>
    );
  } else if (isComment) {
    dot = 'bg-amber-400';
    content = (
      <div>
        <div className="text-xs text-text-muted mb-1">
          Réponse de <span className="font-medium text-text-main">{entree.auteur_nom}</span>
          {' '}({ROLE_LABELS[entree.auteur_role] || entree.auteur_role})
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-900">
          {entree.message}
        </div>
      </div>
    );
  } else if (isMessage) {
    dot = isExploitant ? 'bg-blue-400' : 'bg-green-400';
    content = (
      <div>
        <div className="text-xs text-text-muted mb-1">
          <span className="font-medium text-text-main">{entree.auteur_nom}</span>
          {' '}({ROLE_LABELS[entree.auteur_role] || entree.auteur_role})
        </div>
        <div className={`rounded-lg px-3 py-2 text-xs ${
          isExploitant
            ? 'bg-blue-50 border border-blue-100 text-blue-900'
            : 'bg-green-50 border border-green-100 text-green-900'
        }`}>
          {entree.message}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 items-start">
      {/* Dot + ligne verticale */}
      <div className="flex flex-col items-center shrink-0 mt-0.5">
        <div className={`w-2.5 h-2.5 rounded-full ${dot} ring-2 ring-white`} />
      </div>

      {/* Contenu */}
      <div className="flex-1 pb-4 min-w-0">
        {content}
        <div className="text-[10px] text-text-muted/60 mt-1">{fmtDateHeure(entree.created_at)}</div>
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export function HistoriqueDemande({ demandeId, onMessageSent }) {
  const toast = useToast();
  const [historique, setHistorique] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [message, setMessage]       = useState('');
  const [sending, setSending]       = useState(false);
  const bottomRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get(`/demandes/${demandeId}/historique`);
      setHistorique(data || []);
    } catch (err) {
      toast.error('Erreur chargement historique : ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [demandeId]);

  useEffect(() => { load(); }, [load]);

  // Scroll en bas à chaque nouvelle entrée
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [historique.length]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      await api.post(`/demandes/${demandeId}/messages`, { message });
      setMessage('');
      await load();
      if (onMessageSent) onMessageSent();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Titre */}
      <div className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase tracking-wide">
        <MessageSquare size={12} />
        Historique des échanges
      </div>

      {/* Timeline */}
      <div className="relative pl-1 max-h-64 overflow-y-auto pr-1">
        {/* Ligne verticale */}
        {historique.length > 1 && (
          <div className="absolute left-[4px] top-3 bottom-3 w-px bg-gray-200" />
        )}

        {loading ? (
          <div className="text-xs text-text-muted py-2">Chargement…</div>
        ) : historique.length === 0 ? (
          <div className="text-xs text-text-muted py-2">Aucun historique disponible.</div>
        ) : (
          historique.map(e => <EntreeHistorique key={e.id} entree={e} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Saisie message */}
      <form onSubmit={handleSend} className="flex gap-2 items-center mt-1">
        <input
          className="form-input flex-1 text-xs py-1.5"
          placeholder="Ajouter un message…"
          value={message}
          onChange={e => setMessage(e.target.value)}
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !message.trim()}
          className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1 shrink-0"
        >
          <Send size={12} />
          {sending ? '…' : 'Envoyer'}
        </button>
      </form>
    </div>
  );
}
