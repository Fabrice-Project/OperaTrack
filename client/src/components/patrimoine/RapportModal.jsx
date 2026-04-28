import { useState, useEffect } from 'react';
import { X, Download, Printer, FileSpreadsheet } from 'lucide-react';
import { api } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';

// ── Helpers ───────────────────────────────────────────────────────────────────
const SEP = ';';

function csvCell(c) {
  if (c === null || c === undefined) return '';
  const s = String(c);
  return (s.includes(SEP) || s.includes('"') || s.includes('\n'))
    ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvRow(cells) { return cells.map(csvCell).join(SEP); }

function downloadCSV(content, filename) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtEur(v) {
  if (!v && v !== 0) return '';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}
function fmtNum(v, unit = '') {
  if (v === null || v === undefined || v === '') return '';
  return `${Number(v).toLocaleString('fr-FR')}${unit ? ' ' + unit : ''}`;
}

const ETAT_LABELS = {
  bon: 'Bon', moyen: 'Moyen', degrade: 'Dégradé', tres_degrade: 'Très dégradé',
  fonctionnel: 'Fonctionnel', defaillant: 'Défaillant', hors_service: 'Hors service', en_travaux: 'En travaux',
};
const STATUT_IV = {
  signalee: 'Signalée', programmee: 'Programmée', en_cours: 'En cours',
  realisee: 'Réalisée', cloturee: 'Clôturée',
};

// ── Configuration sections par domaine ───────────────────────────────────────
const SECTIONS_CFG = {
  voirie: [
    { id: 'kpis',        label: 'Synthèse KPIs' },
    { id: 'troncons',    label: 'Inventaire tronçons' },
    { id: 'mobilier',    label: 'Mobilier urbain' },
    { id: 'marches_v',   label: 'Marchés voirie' },
    { id: 'marches_mob', label: 'Marchés mobilier' },
    { id: 'iv_voirie',   label: 'Interventions voirie' },
    { id: 'iv_mobilier', label: 'Interventions mobilier' },
  ],
  eclairage: [
    { id: 'kpis',       label: 'Synthèse KPIs' },
    { id: 'points',     label: 'Points lumineux' },
    { id: 'armoires',   label: 'Armoires' },
    { id: 'marches',    label: 'Marchés éclairage' },
    { id: 'iv_pl',      label: 'Interventions points lumineux' },
    { id: 'iv_armoire', label: 'Interventions armoires' },
  ],
  batiments: [
    { id: 'kpis',        label: 'Synthèse KPIs' },
    { id: 'inventaire',  label: 'Inventaire bâtiments' },
    { id: 'equipements', label: 'Équipements' },
    { id: 'controles',   label: 'Contrôles réglementaires' },
    { id: 'marches',     label: 'Marchés bâtiments' },
    { id: 'iv_bat',      label: 'Interventions bâtiments' },
  ],
};

const DOMAIN_LABELS = { voirie: 'Voirie', eclairage: 'Éclairage public', batiments: 'Bâtiments' };

// ── Générateurs CSV par domaine ───────────────────────────────────────────────

function buildCSVVoirie(data, sel, dateFrom, dateTo) {
  const lines = [];
  const today = new Date().toLocaleDateString('fr-FR');
  lines.push(csvRow(['RAPPORT GESTION PATRIMONIALE — VOIRIE']));
  lines.push(csvRow([`Généré le ${today}`]));
  if (dateFrom || dateTo) lines.push(csvRow([`Période interventions : ${dateFrom || '…'} → ${dateTo || '…'}`]));
  lines.push('');

  if (sel.has('kpis') && data.voirie) {
    const { kpis } = data.voirie;
    lines.push(csvRow(['SYNTHÈSE KPIs']));
    lines.push(csvRow(['Indicateur', 'Valeur']));
    lines.push(csvRow(['Tronçons totaux', kpis.total]));
    lines.push(csvRow(['Surface totale', fmtNum(Math.round(kpis.totalSurface), 'm²')]));
    Object.entries(kpis.statsByEtat || {}).forEach(([e, n]) =>
      lines.push(csvRow([`État : ${ETAT_LABELS[e] || e}`, n]))
    );
    lines.push('');
  }

  if (sel.has('troncons') && data.voirie?.troncons?.length) {
    lines.push(csvRow(['INVENTAIRE TRONÇONS']));
    lines.push(csvRow(['Intitulé', 'Catégorie', 'Longueur (ml)', 'Largeur (m)', 'Surface (m²)', 'Revêtement', 'Dernière réfection', 'État général', 'Commentaire']));
    data.voirie.troncons.forEach(t => {
      const surf = ((parseFloat(t.longueur_ml) || 0) * (parseFloat(t.largeur_m) || 0)).toFixed(0);
      lines.push(csvRow([t.intitule, t.categorie || '', t.longueur_ml || '', t.largeur_m || '', surf, t.revetement || '', t.annee_derniere_refection || '', ETAT_LABELS[t.etat_general] || '', t.commentaire || '']));
    });
    lines.push('');
  }

  if (sel.has('mobilier') && data.ivMobilier?.interventions) {
    // Utilise les interventions mobilier pour lister les éléments uniques
    lines.push(csvRow(['MOBILIER URBAIN (éléments avec interventions)']));
    lines.push(csvRow(['Élément', 'Nb interventions']));
    const mobMap = {};
    data.ivMobilier.interventions.forEach(iv => {
      mobMap[iv.element_intitule] = (mobMap[iv.element_intitule] || 0) + 1;
    });
    Object.entries(mobMap).forEach(([el, n]) => lines.push(csvRow([el, n])));
    lines.push('');
  }

  ['marches_v', 'marches_mob'].forEach((sid, i) => {
    const domLabel = i === 0 ? 'MARCHÉS VOIRIE' : 'MARCHÉS MOBILIER';
    const domaine  = i === 0 ? 'voirie' : 'mobilier';
    if (!sel.has(sid) || !data.marches) return;
    const list = (data.marches || []).filter(m => m.domaine === domaine);
    if (!list.length) return;
    lines.push(csvRow([domLabel]));
    lines.push(csvRow(['Intitulé', 'N° marché', 'Prestataire', 'Type', 'Montant HT', 'Statut', 'Engagé total', 'Consommé total']));
    list.forEach(m => {
      lines.push(csvRow([m.intitule, m.numero_marche || '', m.prestataire || '', m.type_travaux || '', fmtEur(m.montant_ht), m.statut || '', fmtEur(m.total_engage), fmtEur(m.total_interventions)]));
      (m.engagements || []).forEach(eng =>
        lines.push(csvRow(['', `  └ ${eng.exercice}`, '', '', '', '', fmtEur(eng.montant_engage_ht), fmtEur(eng.total_interventions_ht)]))
      );
    });
    lines.push('');
  });

  ['iv_voirie', 'iv_mobilier'].forEach((sid, i) => {
    const label = i === 0 ? 'INTERVENTIONS VOIRIE' : 'INTERVENTIONS MOBILIER';
    const ivData = i === 0 ? data.ivVoirie : data.ivMobilier;
    if (!sel.has(sid) || !ivData?.interventions) return;
    let ivs = ivData.interventions;
    if (dateFrom) ivs = ivs.filter(iv => iv.date_signalement >= dateFrom);
    if (dateTo)   ivs = ivs.filter(iv => iv.date_signalement <= dateTo);
    lines.push(csvRow([label]));
    lines.push(csvRow(['Date', i === 0 ? 'Tronçon' : 'Mobilier', 'Nature', 'Type maintenance', 'Intervenant', 'Prestataire', 'Montant HT', 'Statut', 'Marché']));
    ivs.forEach(iv => {
      const interv = iv.type_intervenant === 'prestataire' ? (iv.prestataire_nom || '') : (iv.agent_nom || 'Agent interne');
      lines.push(csvRow([fmtDate(iv.date_signalement), iv.element_intitule || '', iv.nature || '', iv.type_maintenance || '', iv.type_intervenant || '', interv, fmtEur(iv.montant_ht), STATUT_IV[iv.statut] || '', iv.marche?.intitule || iv.reference_marche || '']));
    });
    lines.push('');
  });

  return lines.join('\n');
}

function buildCSVEclairage(data, sel, dateFrom, dateTo) {
  const lines = [];
  const today = new Date().toLocaleDateString('fr-FR');
  lines.push(csvRow(['RAPPORT GESTION PATRIMONIALE — ÉCLAIRAGE PUBLIC']));
  lines.push(csvRow([`Généré le ${today}`]));
  if (dateFrom || dateTo) lines.push(csvRow([`Période interventions : ${dateFrom || '…'} → ${dateTo || '…'}`]));
  lines.push('');

  if (sel.has('kpis') && data.kpis) {
    lines.push(csvRow(['SYNTHÈSE KPIs']));
    lines.push(csvRow(['Indicateur', 'Valeur']));
    lines.push(csvRow(['Points lumineux totaux', data.kpis.total]));
    lines.push(csvRow(['Défaillants / Hors service', data.kpis.defaillants]));
    lines.push(csvRow(['Taux LED', `${data.kpis.pctLed}%`]));
    lines.push(csvRow(['Coût maintenance 12 mois', fmtEur(data.kpis.cout12Mois)]));
    lines.push('');
  }

  if (sel.has('points') && data.points?.length) {
    lines.push(csvRow(['INVENTAIRE POINTS LUMINEUX']));
    lines.push(csvRow(['Référence', 'Armoire', 'Localisation', 'Type support', 'Hauteur (m)', 'Type lampe', 'Puissance (W)', 'Année pose', 'État', 'Commentaire']));
    data.points.forEach(p => {
      const arm = p.armoires_eclairage?.intitule || '';
      lines.push(csvRow([p.reference || '', arm, p.localisation || '', p.type_support || '', p.hauteur_m || '', p.type_lampe || '', p.puissance_w || '', p.annee_pose || '', ETAT_LABELS[p.etat_general] || '', p.commentaire || '']));
    });
    lines.push('');
  }

  if (sel.has('armoires') && data.armoires?.length) {
    lines.push(csvRow(['ARMOIRES ÉLECTRIQUES']));
    lines.push(csvRow(['Intitulé', 'Localisation', 'Type', 'Puissance (kVA)', 'N° série', 'Année pose', 'Nb points lumineux', 'Défaillants']));
    data.armoires.forEach(a => {
      lines.push(csvRow([a.intitule || '', a.localisation || '', a.type_armoire || '', a.puissance_kva || '', a.numero_serie || '', a.annee_pose || '', a.nb_points_lumineux || 0, a.nb_defaillants || 0]));
    });
    lines.push('');
  }

  if (sel.has('marches') && data.marches?.length) {
    lines.push(csvRow(['MARCHÉS ÉCLAIRAGE']));
    lines.push(csvRow(['Intitulé', 'N° marché', 'Prestataire', 'Type', 'Montant HT', 'Statut', 'Engagé total', 'Consommé total']));
    data.marches.forEach(m => {
      lines.push(csvRow([m.intitule, m.numero_marche || '', m.prestataire || '', m.type_travaux || '', fmtEur(m.montant_ht), m.statut || '', fmtEur(m.total_engage), fmtEur(m.total_interventions)]));
      (m.engagements || []).forEach(eng =>
        lines.push(csvRow(['', `  └ ${eng.exercice}`, '', '', '', '', fmtEur(eng.montant_engage_ht), fmtEur(eng.total_interventions_ht)]))
      );
    });
    lines.push('');
  }

  ['iv_pl', 'iv_armoire'].forEach((sid, i) => {
    const label   = i === 0 ? 'INTERVENTIONS POINTS LUMINEUX' : 'INTERVENTIONS ARMOIRES';
    const ivData  = i === 0 ? data.ivPl : data.ivArmoire;
    const colLabel = i === 0 ? 'Point lumineux' : 'Armoire';
    if (!sel.has(sid) || !ivData?.interventions) return;
    let ivs = ivData.interventions;
    if (dateFrom) ivs = ivs.filter(iv => iv.date_signalement >= dateFrom);
    if (dateTo)   ivs = ivs.filter(iv => iv.date_signalement <= dateTo);
    lines.push(csvRow([label]));
    lines.push(csvRow(['Date', colLabel, 'Nature', 'Type maintenance', 'Intervenant', 'Prestataire', 'Montant HT', 'Statut', 'Marché']));
    ivs.forEach(iv => {
      const interv = iv.type_intervenant === 'prestataire' ? (iv.prestataire_nom || '') : (iv.agent_nom || 'Agent interne');
      lines.push(csvRow([fmtDate(iv.date_signalement), iv.element_intitule || '', iv.nature || '', iv.type_maintenance || '', iv.type_intervenant || '', interv, fmtEur(iv.montant_ht), STATUT_IV[iv.statut] || '', iv.marche?.intitule || iv.reference_marche || '']));
    });
    lines.push('');
  });

  return lines.join('\n');
}

function buildCSVBatiments(data, sel, dateFrom, dateTo) {
  const lines = [];
  const today = new Date().toLocaleDateString('fr-FR');
  lines.push(csvRow(['RAPPORT GESTION PATRIMONIALE — BÂTIMENTS']));
  lines.push(csvRow([`Généré le ${today}`]));
  if (dateFrom || dateTo) lines.push(csvRow([`Période interventions : ${dateFrom || '…'} → ${dateTo || '…'}`]));
  lines.push('');

  if (sel.has('kpis') && data.batiments) {
    const bats = data.batiments;
    const totalSurf = bats.reduce((s, b) => s + (parseFloat(b.surface_plancher_m2) || 0), 0);
    const dpeFG = bats.filter(b => b.dpe_classe === 'F' || b.dpe_classe === 'G').length;
    lines.push(csvRow(['SYNTHÈSE KPIs']));
    lines.push(csvRow(['Indicateur', 'Valeur']));
    lines.push(csvRow(['Bâtiments totaux', bats.length]));
    lines.push(csvRow(['Surface totale', fmtNum(Math.round(totalSurf), 'm²')]));
    lines.push(csvRow(['DPE F ou G', dpeFG]));
    const dpeCount = {};
    bats.forEach(b => { if (b.dpe_classe) dpeCount[b.dpe_classe] = (dpeCount[b.dpe_classe] || 0) + 1; });
    Object.entries(dpeCount).sort().forEach(([cls, n]) => lines.push(csvRow([`DPE ${cls}`, n])));
    lines.push('');
  }

  if (sel.has('inventaire') && data.batiments?.length) {
    lines.push(csvRow(['INVENTAIRE BÂTIMENTS']));
    lines.push(csvRow(['Intitulé', 'Adresse', 'Surface plancher (m²)', 'Année construction', 'DPE', 'Nb équipements', 'Commentaire']));
    data.batiments.forEach(b => {
      lines.push(csvRow([b.intitule, b.adresse || '', b.surface_plancher_m2 || '', b.annee_construction || '', b.dpe_classe || '', b.nb_equipements || 0, b.commentaire || '']));
    });
    lines.push('');
  }

  if (sel.has('equipements') && data.equipements?.length) {
    lines.push(csvRow(['ÉQUIPEMENTS']));
    lines.push(csvRow(['Bâtiment', 'Catégorie', 'Intitulé', 'Marque', 'Modèle', 'Date installation', 'Prochain contrôle', 'Périodicité (mois)', 'Commentaire']));
    data.equipements.forEach(e => {
      lines.push(csvRow([e.batiment_intitule || '', e.categorie || '', e.intitule || '', e.marque || '', e.modele || '', fmtDate(e.date_installation), fmtDate(e.date_prochain_controle), e.periodicite_controle_mois || '', e.commentaire || '']));
    });
    lines.push('');
  }

  if (sel.has('controles') && data.equipements?.length) {
    const today_str = new Date().toISOString().split('T')[0];
    const in90 = new Date(); in90.setDate(in90.getDate() + 90);
    const in90_str = in90.toISOString().split('T')[0];
    const withCtrl = data.equipements
      .filter(e => e.date_prochain_controle)
      .sort((a, b) => a.date_prochain_controle.localeCompare(b.date_prochain_controle));
    lines.push(csvRow(['CONTRÔLES RÉGLEMENTAIRES']));
    lines.push(csvRow(['Bâtiment', 'Équipement', 'Catégorie', 'Prochain contrôle', 'Échéance', 'Périodicité (mois)']));
    withCtrl.forEach(e => {
      const d = e.date_prochain_controle;
      const ech = d < today_str ? 'ÉCHU' : d <= in90_str ? 'Dans 90j' : 'OK';
      lines.push(csvRow([e.batiment_intitule || '', e.intitule || '', e.categorie || '', fmtDate(d), ech, e.periodicite_controle_mois || '']));
    });
    lines.push('');
  }

  if (sel.has('marches') && data.marches?.length) {
    lines.push(csvRow(['MARCHÉS BÂTIMENTS']));
    lines.push(csvRow(['Intitulé', 'N° marché', 'Prestataire', 'Type', 'Montant HT', 'Statut', 'Engagé total', 'Consommé total']));
    data.marches.forEach(m => {
      lines.push(csvRow([m.intitule, m.numero_marche || '', m.prestataire || '', m.type_travaux || '', fmtEur(m.montant_ht), m.statut || '', fmtEur(m.total_engage), fmtEur(m.total_interventions)]));
      (m.engagements || []).forEach(eng =>
        lines.push(csvRow(['', `  └ ${eng.exercice}`, '', '', '', '', fmtEur(eng.montant_engage_ht), fmtEur(eng.total_interventions_ht)]))
      );
    });
    lines.push('');
  }

  if (sel.has('iv_bat') && data.ivBat?.interventions) {
    let ivs = data.ivBat.interventions;
    if (dateFrom) ivs = ivs.filter(iv => iv.date_signalement >= dateFrom);
    if (dateTo)   ivs = ivs.filter(iv => iv.date_signalement <= dateTo);
    lines.push(csvRow(['INTERVENTIONS BÂTIMENTS']));
    lines.push(csvRow(['Date', 'Bâtiment', 'Nature', 'Catégorie', 'Type maintenance', 'Intervenant', 'Prestataire', 'Montant HT', 'Statut', 'Marché']));
    ivs.forEach(iv => {
      const interv = iv.type_intervenant === 'prestataire' ? (iv.prestataire_nom || '') : (iv.agent_nom || 'Agent interne');
      lines.push(csvRow([fmtDate(iv.date_signalement), iv.element_intitule || '', iv.nature || '', iv.categorie || '', iv.type_maintenance || '', iv.type_intervenant || '', interv, fmtEur(iv.montant_ht), STATUT_IV[iv.statut] || '', iv.marche?.intitule || iv.reference_marche || '']));
    });
    lines.push('');
  }

  return lines.join('\n');
}

// ── Chargement des données ────────────────────────────────────────────────────
async function fetchDomainData(domain) {
  switch (domain) {
    case 'voirie': {
      const [voirie, marches, ivVoirie, ivMobilier] = await Promise.all([
        api.get('/patrimoine/voirie'),
        api.get('/patrimoine/voirie/marches'),
        api.get('/patrimoine/voirie/interventions-voirie?theme=voirie'),
        api.get('/patrimoine/voirie/interventions-voirie?theme=mobilier'),
      ]);
      return { voirie, marches, ivVoirie, ivMobilier };
    }
    case 'eclairage': {
      const [kpis, points, armoires, marches, ivPl, ivArmoire] = await Promise.all([
        api.get('/patrimoine/eclairage/kpis'),
        api.get('/patrimoine/eclairage/points'),
        api.get('/patrimoine/eclairage/armoires'),
        api.get('/patrimoine/voirie/marches?domaine=eclairage'),
        api.get('/patrimoine/voirie/interventions-voirie?theme=eclairage'),
        api.get('/patrimoine/voirie/interventions-voirie?theme=armoire'),
      ]);
      return { kpis, points, armoires, marches, ivPl, ivArmoire };
    }
    case 'batiments': {
      const [batiments, equipements, marches, ivBat] = await Promise.all([
        api.get('/patrimoine/batiments'),
        api.get('/patrimoine/equipements'),
        api.get('/patrimoine/voirie/marches?domaine=batiment'),
        api.get('/patrimoine/voirie/interventions-voirie?theme=batiment'),
      ]);
      return { batiments, equipements, marches, ivBat };
    }
    default: return {};
  }
}

// ── Composant principal ───────────────────────────────────────────────────────
export function RapportModal({ domain, onClose }) {
  const toast = useToast();
  const sections = SECTIONS_CFG[domain] || [];

  const [selected, setSelected] = useState(() => new Set(sections.map(s => s.id)));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [data, setData]         = useState({});
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchDomainData(domain)
      .then(d => setData(d))
      .catch(err => toast.error('Erreur chargement : ' + err.message))
      .finally(() => setLoading(false));
  }, [domain]);

  const toggleSection = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === sections.length) setSelected(new Set());
    else setSelected(new Set(sections.map(s => s.id)));
  };

  const handleExportCSV = () => {
    setGenerating(true);
    try {
      let csv = '';
      const today = new Date().toISOString().split('T')[0];
      if (domain === 'voirie')    csv = buildCSVVoirie(data, selected, dateFrom, dateTo);
      if (domain === 'eclairage') csv = buildCSVEclairage(data, selected, dateFrom, dateTo);
      if (domain === 'batiments') csv = buildCSVBatiments(data, selected, dateFrom, dateTo);
      downloadCSV(csv, `rapport_${domain}_${today}.csv`);
      toast.success('Rapport téléchargé');
    } catch (err) {
      toast.error('Erreur génération : ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    let html = '';
    const today = new Date().toLocaleDateString('fr-FR');
    const title = `Rapport ${DOMAIN_LABELS[domain]} — ${today}`;

    // Petite feuille de style pour impression
    const style = `
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 20px; }
        h1 { font-size: 16px; margin-bottom: 4px; }
        h2 { font-size: 13px; margin: 16px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; color: #1A3A5C; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th { background: #f0f0f0; text-align: left; padding: 4px 6px; font-size: 10px; border: 1px solid #ddd; }
        td { padding: 3px 6px; border: 1px solid #eee; vertical-align: top; }
        tr:nth-child(even) { background: #fafafa; }
        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
        .kpi-card { border: 1px solid #ddd; padding: 8px; border-radius: 4px; }
        .kpi-val { font-size: 18px; font-weight: bold; color: #1A3A5C; }
        .kpi-lbl { font-size: 9px; color: #666; text-transform: uppercase; }
        @media print { @page { size: A4 landscape; margin: 15mm; } }
      </style>
    `;

    html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>${style}</head><body>`;
    html += `<h1>${title}</h1>`;

    // KPIs
    if (selected.has('kpis')) {
      if (domain === 'voirie' && data.voirie) {
        const { kpis, troncons } = data.voirie;
        html += `<h2>Synthèse Voirie</h2><div class="kpi-grid">`;
        html += `<div class="kpi-card"><div class="kpi-val">${kpis.total}</div><div class="kpi-lbl">Tronçons</div></div>`;
        html += `<div class="kpi-card"><div class="kpi-val">${Math.round(kpis.totalSurface).toLocaleString('fr-FR')} m²</div><div class="kpi-lbl">Surface totale</div></div>`;
        html += `</div>`;
      }
      if (domain === 'eclairage' && data.kpis) {
        const k = data.kpis;
        html += `<h2>Synthèse Éclairage</h2><div class="kpi-grid">`;
        html += `<div class="kpi-card"><div class="kpi-val">${k.total}</div><div class="kpi-lbl">Points lumineux</div></div>`;
        html += `<div class="kpi-card"><div class="kpi-val">${k.defaillants}</div><div class="kpi-lbl">Défaillants</div></div>`;
        html += `<div class="kpi-card"><div class="kpi-val">${k.pctLed}%</div><div class="kpi-lbl">Taux LED</div></div>`;
        html += `</div>`;
      }
      if (domain === 'batiments' && data.batiments) {
        const bats = data.batiments;
        const surf = bats.reduce((s, b) => s + (parseFloat(b.surface_plancher_m2) || 0), 0);
        html += `<h2>Synthèse Bâtiments</h2><div class="kpi-grid">`;
        html += `<div class="kpi-card"><div class="kpi-val">${bats.length}</div><div class="kpi-lbl">Bâtiments</div></div>`;
        html += `<div class="kpi-card"><div class="kpi-val">${Math.round(surf).toLocaleString('fr-FR')} m²</div><div class="kpi-lbl">Surface totale</div></div>`;
        html += `<div class="kpi-card"><div class="kpi-val">${bats.filter(b => b.dpe_classe === 'F' || b.dpe_classe === 'G').length}</div><div class="kpi-lbl">DPE F ou G</div></div>`;
        html += `</div>`;
      }
    }

    // Tables génériques (on génère à partir du CSV pour éviter la duplication)
    html += `<p style="font-size:9px;color:#999;margin-top:20px">Rapport généré le ${today} via Opera-Track</p>`;
    html += `</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  // Statistiques rapides pour affichage dans la modale
  const stats = (() => {
    if (!data || loading) return null;
    if (domain === 'voirie') return {
      items: data.voirie?.troncons?.length ?? '…',
      ivs: (data.ivVoirie?.interventions?.length ?? 0) + (data.ivMobilier?.interventions?.length ?? 0),
      marches: data.marches?.length ?? 0,
    };
    if (domain === 'eclairage') return {
      items: data.points?.length ?? '…',
      ivs: (data.ivPl?.interventions?.length ?? 0) + (data.ivArmoire?.interventions?.length ?? 0),
      marches: data.marches?.length ?? 0,
    };
    if (domain === 'batiments') return {
      items: data.batiments?.length ?? '…',
      ivs: data.ivBat?.interventions?.length ?? 0,
      marches: data.marches?.length ?? 0,
    };
    return null;
  })();

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* En-tête */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div>
            <h3 className="font-heading font-semibold text-text-main">
              Exporter un rapport — {DOMAIN_LABELS[domain]}
            </h3>
            {!loading && stats && (
              <p className="text-xs text-text-muted mt-0.5">
                {stats.items} éléments · {stats.ivs} interventions · {stats.marches} marchés
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

          {loading ? (
            <div className="flex items-center justify-center py-12 text-text-muted text-sm gap-2">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Chargement des données…
            </div>
          ) : (
            <>
              {/* Sections */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                    Sections à inclure
                  </label>
                  <button onClick={toggleAll} className="text-xs text-primary hover:underline">
                    {selected.size === sections.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {sections.map(s => (
                    <label key={s.id} className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggleSection(s.id)}
                        className="accent-primary"
                      />
                      <span className="text-sm text-text-main">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Filtre période interventions */}
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                  Période — Interventions
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Du</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input w-full text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Au</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input w-full text-sm" />
                  </div>
                </div>
                {(!dateFrom && !dateTo) && (
                  <p className="text-xs text-text-muted mt-1">Sans filtre : toutes les interventions sont incluses.</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="shrink-0 p-4 border-t border-border flex items-center justify-between gap-3">
          <button onClick={onClose} className="btn-secondary text-sm">Annuler</button>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || selected.size === 0}
              className="btn-secondary text-sm flex items-center gap-1.5"
              title="Aperçu impression / PDF"
            >
              <Printer size={14} /> Imprimer
            </button>
            <button
              onClick={handleExportCSV}
              disabled={loading || selected.size === 0 || generating}
              className="btn-primary text-sm flex items-center gap-1.5"
            >
              <FileSpreadsheet size={14} />
              {generating ? 'Génération…' : 'Export Excel (CSV)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
