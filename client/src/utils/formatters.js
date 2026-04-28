export const formatEur = (val) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val ?? 0);

export const formatPct = (val) =>
  new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 }).format((val ?? 0) / 100);

export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const TYPE_CONFIG = {
  construction_neuve: { label: 'Construction neuve', bg: '#DBEAFE', text: '#1E40AF' },
  rehabilitation:     { label: 'Réhabilitation',     bg: '#FEF3C7', text: '#92400E' },
  amenagement_vrd:    { label: 'Aménagement VRD',    bg: '#D1FAE5', text: '#065F46' }
};

export const STATUT_CONFIG = {
  etudes:       { label: 'Études',       bg: '#F3F4F6', text: '#374151' },
  consultation: { label: 'Consultation', bg: '#DBEAFE', text: '#1D4ED8' },
  travaux:      { label: 'Travaux',      bg: '#FEF3C7', text: '#B45309' },
  reception:    { label: 'Réception',    bg: '#D1FAE5', text: '#065F46' },
  soldee:       { label: 'Soldée',       bg: '#EDE9FE', text: '#5B21B6' }
};

export const MARKER_COLORS = {
  construction_neuve: '#2E75B6',
  rehabilitation:     '#E8920A',
  amenagement_vrd:    '#1E7E45'
};
