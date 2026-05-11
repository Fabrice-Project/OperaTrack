import { useEffect, useState } from 'react';
import { X, Printer } from 'lucide-react';
import { api } from '../../utils/api';

// ── Constantes ────────────────────────────────────────────────────────────────
const THEME_LABELS = {
  batiment:  'Bâtiment',
  voirie:    'Voirie / Tronçon',
  eclairage: 'Point lumineux',
  armoire:   'Armoire électrique',
  mobilier:  'Mobilier urbain',
};

const STATUT_LABELS = {
  signalee:   'Signalée',
  programmee: 'Programmée',
  en_cours:   'En cours',
  realisee:   'Réalisée',
  cloturee:   'Clôturée',
};

const MAINTENANCE_LABELS = {
  corrective:  'Corrective',
  preventive:  'Préventive',
  ameliorative: 'Améliorative',
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

function fmtEur(n) {
  if (!n) return '—';
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' € HT';
}

function shortId(id) {
  return id ? id.slice(0, 8).toUpperCase() : '—';
}

// ── Génération du HTML imprimable ─────────────────────────────────────────────
function buildPrintHTML(iv, siteLabel, collectivite) {
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Bon d'intervention — ${shortId(iv.id)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 20px; }
    h1 { font-size: 18px; font-weight: bold; }
    h2 { font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: .05em; color: #1D4ED8; border-bottom: 1.5px solid #1D4ED8; padding-bottom: 3px; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    td { padding: 4px 6px; vertical-align: top; }
    td.label { font-weight: bold; white-space: nowrap; width: 140px; color: #374151; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; border-bottom: 2px solid #111; padding-bottom: 12px; }
    .header-left h1 { font-size: 16px; }
    .header-left .subtitle { font-size: 10px; color: #6B7280; margin-top: 2px; }
    .header-right { text-align: right; }
    .header-right .bon-title { font-size: 18px; font-weight: bold; color: #1D4ED8; }
    .header-right .bon-num { font-size: 11px; color: #6B7280; }
    .section { margin-bottom: 16px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: bold; }
    .badge-statut { background: #D1FAE5; color: #065F46; }
    .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 8px; }
    .signature-box { border: 1px solid #ccc; border-radius: 4px; padding: 8px; min-height: 80px; }
    .signature-box .sig-label { font-weight: bold; font-size: 10px; margin-bottom: 4px; color: #374151; }
    .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 9px; color: #9CA3AF; text-align: center; }
    @media print {
      body { padding: 10px; }
      @page { margin: 15mm; }
    }
  </style>
</head>
<body>

  <!-- En-tête -->
  <div class="header">
    <div class="header-left">
      <h1>${collectivite || 'Ville de Denain'}</h1>
      <div class="subtitle">Gestion du Patrimoine — Direction des Services Techniques</div>
    </div>
    <div class="header-right">
      <div class="bon-title">BON D'INTERVENTION</div>
      <div class="bon-num">N° ${shortId(iv.id)} &nbsp;|&nbsp; Émis le ${today}</div>
      <div style="margin-top:4px">
        <span class="badge badge-statut">${STATUT_LABELS[iv.statut] || iv.statut || '—'}</span>
      </div>
    </div>
  </div>

  <!-- Site -->
  <div class="section">
    <h2>Site d'intervention</h2>
    <table>
      <tr>
        <td class="label">Type de patrimoine</td>
        <td>${THEME_LABELS[iv.theme] || iv.theme || '—'}</td>
      </tr>
      <tr>
        <td class="label">Site / Équipement</td>
        <td><strong>${siteLabel || '—'}</strong></td>
      </tr>
    </table>
  </div>

  <!-- Description -->
  <div class="section">
    <h2>Description de l'intervention</h2>
    <table>
      <tr>
        <td class="label">Catégorie</td>
        <td>${iv.categorie || '—'}</td>
        <td class="label">Type de maintenance</td>
        <td>${MAINTENANCE_LABELS[iv.type_maintenance] || iv.type_maintenance || '—'}</td>
      </tr>
      <tr>
        <td class="label">Nature des travaux</td>
        <td colspan="3">${iv.nature || '—'}</td>
      </tr>
      <tr>
        <td class="label">Date de signalement</td>
        <td>${fmtDate(iv.date_signalement)}</td>
        <td class="label">Date prévue</td>
        <td>${fmtDate(iv.date_prevue)}</td>
      </tr>
      ${iv.commentaire ? `
      <tr>
        <td class="label">Instructions / Observations</td>
        <td colspan="3" style="white-space:pre-line">${iv.commentaire}</td>
      </tr>` : ''}
    </table>
  </div>

  <!-- Équipe -->
  <div class="section">
    <h2>Équipe intervenante (Régie)</h2>
    <table>
      <tr>
        <td class="label">Agent responsable</td>
        <td>${iv.agent_nom || '—'}</td>
        <td class="label">Heures prévues</td>
        <td>${iv.nombre_heures ? iv.nombre_heures + ' h' : '—'}</td>
      </tr>
      <tr>
        <td class="label">Budget achats matériaux</td>
        <td colspan="3">${fmtEur(iv.montant_achat)}</td>
      </tr>
    </table>
  </div>

  <!-- Suivi réalisation -->
  <div class="section">
    <h2>Suivi de réalisation (à compléter par l'équipe)</h2>
    <table>
      <tr>
        <td class="label">Date de réalisation</td>
        <td style="border-bottom:1px solid #ccc; min-width:120px">${iv.date_realisee ? fmtDate(iv.date_realisee) : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</td>
        <td class="label">Heures réalisées</td>
        <td style="border-bottom:1px solid #ccc; min-width:80px">&nbsp;</td>
      </tr>
      <tr>
        <td class="label" style="padding-top:8px">Observations terrain</td>
        <td colspan="3" style="border-bottom:1px solid #ccc; padding-top:8px">&nbsp;<br/>&nbsp;<br/>&nbsp;</td>
      </tr>
    </table>
  </div>

  <!-- Signatures -->
  <div class="section">
    <h2>Visa et signatures</h2>
    <div class="signature-grid">
      <div class="signature-box">
        <div class="sig-label">L'agent intervenant</div>
        <div style="font-size:10px; color:#6B7280">${iv.agent_nom || ''}</div>
        <div style="margin-top:4px; font-size:10px; color:#9CA3AF">Signature :</div>
      </div>
      <div class="signature-box">
        <div class="sig-label">Le responsable technique</div>
        <div style="font-size:10px; color:#9CA3AF">Signature :</div>
      </div>
    </div>
  </div>

  <div class="footer">
    OpéraTrack — ${collectivite || 'Ville de Denain'} &nbsp;·&nbsp; Document généré le ${today}
  </div>

</body>
</html>`;
}

// ── Composant modal ───────────────────────────────────────────────────────────
export function BonInterventionModal({ intervention: iv, siteLabel, onClose }) {
  const [collectivite, setCollectivite] = useState('Ville de Denain');

  useEffect(() => {
    api.get('/settings/config')
      .then(d => { if (d?.collectivite) setCollectivite(d.collectivite); })
      .catch(() => {});
  }, []);

  const handlePrint = () => {
    const html = buildPrintHTML(iv, siteLabel, collectivite);
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <div className="font-heading font-bold text-text-main">Bon d'intervention</div>
            <div className="text-xs text-text-muted mt-0.5">N° {shortId(iv.id)} — Régie interne</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="btn-primary flex items-center gap-2 text-sm px-4 py-2"
            >
              <Printer size={15} />
              Imprimer / PDF
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-text-muted">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Prévisualisation */}
        <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
          <div className="bg-white rounded-lg shadow-sm border border-border p-6 font-sans text-sm text-text-main space-y-5">

            {/* En-tête doc */}
            <div className="flex justify-between items-start pb-4 border-b-2 border-gray-900">
              <div>
                <div className="font-bold text-base">{collectivite}</div>
                <div className="text-xs text-text-muted">Gestion du Patrimoine — Direction des Services Techniques</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg text-blue-700">BON D'INTERVENTION</div>
                <div className="text-xs text-text-muted">N° {shortId(iv.id)}</div>
                <span className="inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                  {STATUT_LABELS[iv.statut] || iv.statut}
                </span>
              </div>
            </div>

            {/* Site */}
            <Section title="Site d'intervention">
              <Row label="Type" value={THEME_LABELS[iv.theme] || iv.theme} />
              <Row label="Site / Équipement" value={<strong>{siteLabel || '—'}</strong>} />
            </Section>

            {/* Description */}
            <Section title="Description">
              <div className="grid grid-cols-2 gap-x-4">
                <Row label="Catégorie" value={iv.categorie} />
                <Row label="Type maintenance" value={MAINTENANCE_LABELS[iv.type_maintenance] || iv.type_maintenance} />
                <Row label="Nature des travaux" value={iv.nature} span />
                <Row label="Date signalement" value={fmtDate(iv.date_signalement)} />
                <Row label="Date prévue" value={fmtDate(iv.date_prevue)} />
              </div>
              {iv.commentaire && (
                <div className="mt-2">
                  <div className="text-xs font-semibold text-text-muted mb-1">Instructions / Observations</div>
                  <div className="bg-gray-50 rounded p-2 text-xs whitespace-pre-line">{iv.commentaire}</div>
                </div>
              )}
            </Section>

            {/* Équipe */}
            <Section title="Équipe intervenante (Régie)">
              <div className="grid grid-cols-2 gap-x-4">
                <Row label="Agent responsable" value={iv.agent_nom || <em className="text-text-muted">Non renseigné</em>} />
                <Row label="Heures prévues" value={iv.nombre_heures ? `${iv.nombre_heures} h` : '—'} />
                <Row label="Budget achats" value={fmtEur(iv.montant_achat)} />
              </div>
            </Section>

            {/* Signatures */}
            <Section title="Visa et signatures">
              <div className="grid grid-cols-2 gap-4 mt-2">
                {['L\'agent intervenant', 'Le responsable technique'].map(s => (
                  <div key={s} className="border border-gray-200 rounded-lg p-3 min-h-[64px]">
                    <div className="text-xs font-semibold text-text-muted">{s}</div>
                    {s.includes('agent') && iv.agent_nom && (
                      <div className="text-xs text-text-muted mt-0.5">{iv.agent_nom}</div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sous-composants de mise en page ───────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wide text-blue-700 border-b border-blue-200 pb-1 mb-3">
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, span }) {
  return (
    <div className={`flex gap-2 mb-1.5 text-xs ${span ? 'col-span-2' : ''}`}>
      <span className="font-semibold text-text-muted shrink-0 w-32">{label}</span>
      <span className="text-text-main">{value || '—'}</span>
    </div>
  );
}
