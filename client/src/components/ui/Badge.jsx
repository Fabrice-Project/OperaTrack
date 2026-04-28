import { TYPE_CONFIG, STATUT_CONFIG } from '../../utils/formatters';

export function TypeBadge({ type }) {
  const cfg = TYPE_CONFIG[type] || { label: type, bg: '#F3F4F6', text: '#374151' };
  return (
    <span className="badge" style={{ backgroundColor: cfg.bg, color: cfg.text }}>
      {cfg.label}
    </span>
  );
}

export function StatutBadge({ statut }) {
  const cfg = STATUT_CONFIG[statut] || { label: statut, bg: '#F3F4F6', text: '#374151' };
  return (
    <span className="badge" style={{ backgroundColor: cfg.bg, color: cfg.text }}>
      {cfg.label}
    </span>
  );
}

export function AlertBadge({ type }) {
  if (type === 'rouge') return (
    <span className="badge animate-pulse-red" style={{ backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }}>
      ⚠ Alerte critique
    </span>
  );
  return (
    <span className="badge" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
      ⚡ Vigilance
    </span>
  );
}
