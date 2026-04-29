import { useState, useEffect } from 'react';
import { X, Download, Printer, FileSpreadsheet } from 'lucide-react';
import { api } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';

// ── Helpers ───────────────────────────────────────────────────────────────────
const SEP = ';';
const CRLF = '\r\n';

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

function fmtPeriode(dateFrom, dateTo) {
  if (dateFrom && dateTo) return `Du ${fmtDate(dateFrom)} au ${fmtDate(dateTo)}`;
  if (dateFrom) return `À partir du ${fmtDate(dateFrom)}`;
  if (dateTo)   return `Jusqu'au ${fmtDate(dateTo)}`;
  return 'Toutes périodes confondues';
}

function buildCSVVoirie(data, sel, dateFrom, dateTo) {
  const lines = [];
  const today = new Date().toLocaleDateString('fr-FR');
  lines.push(csvRow(['RAPPORT GESTION PATRIMONIALE — VOIRIE']));
  lines.push(csvRow([`Généré le ${today}`]));
  lines.push(csvRow([`Période : ${fmtPeriode(dateFrom, dateTo)}`]));
  lines.push('');

  // ── KPIs ──
  if (sel.has('kpis')) {
    const kpis = data.voirie?.kpis || {};
    lines.push(csvRow(['SYNTHÈSE KPIs']));
    lines.push(csvRow(['Indicateur', 'Valeur']));
    lines.push(csvRow(['Tronçons totaux', kpis.total ?? 0]));
    lines.push(csvRow(['Surface totale (m²)', fmtNum(Math.round(kpis.totalSurface || 0))]));
    Object.entries(kpis.statsByEtat || {}).forEach(([e, n]) =>
      lines.push(csvRow([`État : ${ETAT_LABELS[e] || e}`, n]))
    );
    lines.push('');
  }

  // ── Tronçons ──
  if (sel.has('troncons')) {
    const troncons = data.voirie?.troncons || [];
    lines.push(csvRow(['INVENTAIRE TRONÇONS']));
    lines.push(csvRow(['Intitulé', 'Catégorie', 'Longueur (ml)', 'Largeur (m)', 'Surface (m²)', 'Revêtement', 'Dernière réfection', 'État général', 'Commentaire']));
    if (troncons.length === 0) {
      lines.push(csvRow(['Aucune donnée']));
    } else {
      troncons.forEach(t => {
        const surf = ((parseFloat(t.longueur_ml) || 0) * (parseFloat(t.largeur_m) || 0)).toFixed(0);
        lines.push(csvRow([t.intitule, t.categorie || '', t.longueur_ml || '', t.largeur_m || '', surf, t.revetement || '', t.annee_derniere_refection || '', ETAT_LABELS[t.etat_general] || t.etat_general || '', t.commentaire || '']));
      });
    }
    lines.push('');
  }

  // ── Mobilier ──
  if (sel.has('mobilier')) {
    const ivs = data.ivMobilier?.interventions || [];
    lines.push(csvRow(['MOBILIER URBAIN (éléments avec interventions)']));
    lines.push(csvRow(['Élément', 'Nb interventions']));
    if (ivs.length === 0) {
      lines.push(csvRow(['Aucune donnée']));
    } else {
      const mobMap = {};
      ivs.forEach(iv => { mobMap[iv.element_intitule] = (mobMap[iv.element_intitule] || 0) + 1; });
      Object.entries(mobMap).forEach(([el, n]) => lines.push(csvRow([el, n])));
    }
    lines.push('');
  }

  // ── Marchés voirie / mobilier ──
  ['marches_v', 'marches_mob'].forEach((sid, i) => {
    if (!sel.has(sid)) return;
    const domLabel = i === 0 ? 'MARCHÉS VOIRIE' : 'MARCHÉS MOBILIER';
    const domaine  = i === 0 ? 'voirie' : 'mobilier';
    const list = (data.marches || []).filter(m => m.domaine === domaine);
    lines.push(csvRow([domLabel]));
    lines.push(csvRow(['Intitulé', 'N° marché', 'Prestataire', 'Type travaux', 'Montant HT', 'Statut', 'Engagé total', 'Consommé total']));
    if (list.length === 0) {
      lines.push(csvRow(['Aucune donnée']));
    } else {
      list.forEach(m => {
        lines.push(csvRow([m.intitule, m.numero_marche || '', m.prestataire || '', m.type_travaux || '', fmtEur(m.montant_ht), m.statut || '', fmtEur(m.total_engage), fmtEur(m.total_interventions)]));
        (m.engagements || []).forEach(eng =>
          lines.push(csvRow(['', `  └ Exercice ${eng.exercice}`, '', '', '', '', fmtEur(eng.montant_engage_ht), fmtEur(eng.total_interventions_ht)]))
        );
      });
    }
    lines.push('');
  });

  // ── Interventions voirie / mobilier ──
  ['iv_voirie', 'iv_mobilier'].forEach((sid, i) => {
    if (!sel.has(sid)) return;
    const label   = i === 0 ? 'INTERVENTIONS VOIRIE' : 'INTERVENTIONS MOBILIER';
    const colLbl  = i === 0 ? 'Tronçon' : 'Mobilier';
    const ivData  = i === 0 ? data.ivVoirie : data.ivMobilier;
    let ivs = (ivData?.interventions || []);
    if (dateFrom) ivs = ivs.filter(iv => iv.date_signalement >= dateFrom);
    if (dateTo)   ivs = ivs.filter(iv => iv.date_signalement <= dateTo);
    lines.push(csvRow([label]));
    lines.push(csvRow(['Date', colLbl, 'Nature', 'Type maintenance', 'Type intervenant', 'Intervenant / Prestataire', 'Montant HT', 'Statut', 'Marché']));
    if (ivs.length === 0) {
      lines.push(csvRow(['Aucune donnée']));
    } else {
      ivs.forEach(iv => {
        const interv = iv.type_intervenant === 'prestataire' ? (iv.prestataire_nom || '') : (iv.agent_nom || 'Agent interne');
        lines.push(csvRow([fmtDate(iv.date_signalement), iv.element_intitule || '', iv.nature || '', iv.type_maintenance || '', iv.type_intervenant || '', interv, fmtEur(iv.montant_ht), STATUT_IV[iv.statut] || iv.statut || '', iv.marche?.intitule || iv.reference_marche || '']));
      });
    }
    lines.push('');
  });

  return lines.join(CRLF);
}

function buildCSVEclairage(data, sel, dateFrom, dateTo) {
  const lines = [];
  const today = new Date().toLocaleDateString('fr-FR');
  lines.push(csvRow(['RAPPORT GESTION PATRIMONIALE — ÉCLAIRAGE PUBLIC']));
  lines.push(csvRow([`Généré le ${today}`]));
  lines.push(csvRow([`Période : ${fmtPeriode(dateFrom, dateTo)}`]));
  lines.push('');

  if (sel.has('kpis')) {
    const k = data.kpis || {};
    lines.push(csvRow(['SYNTHÈSE KPIs']));
    lines.push(csvRow(['Indicateur', 'Valeur']));
    lines.push(csvRow(['Points lumineux totaux', k.total ?? 0]));
    lines.push(csvRow(['Défaillants / Hors service', k.defaillants ?? 0]));
    lines.push(csvRow(['Taux LED', `${k.pctLed ?? 0}%`]));
    lines.push(csvRow(['Coût maintenance 12 mois', fmtEur(k.cout12Mois)]));
    lines.push('');
  }

  if (sel.has('points')) {
    const points = data.points || [];
    lines.push(csvRow(['INVENTAIRE POINTS LUMINEUX']));
    lines.push(csvRow(['Référence', 'Armoire', 'Localisation', 'Type support', 'Hauteur (m)', 'Type lampe', 'Puissance (W)', 'Année pose', 'État', 'Commentaire']));
    if (points.length === 0) {
      lines.push(csvRow(['Aucune donnée']));
    } else {
      points.forEach(p => {
        const arm = p.armoires_eclairage?.intitule || '';
        lines.push(csvRow([p.reference || '', arm, p.localisation || '', p.type_support || '', p.hauteur_m || '', p.type_lampe || '', p.puissance_w || '', p.annee_pose || '', ETAT_LABELS[p.etat_general] || p.etat_general || '', p.commentaire || '']));
      });
    }
    lines.push('');
  }

  if (sel.has('armoires')) {
    const armoires = data.armoires || [];
    lines.push(csvRow(['ARMOIRES ÉLECTRIQUES']));
    lines.push(csvRow(['Intitulé', 'Localisation', 'Type', 'Puissance (kVA)', 'N° série', 'Année pose', 'Nb points lumineux', 'Défaillants']));
    if (armoires.length === 0) {
      lines.push(csvRow(['Aucune donnée']));
    } else {
      armoires.forEach(a => {
        lines.push(csvRow([a.intitule || '', a.localisation || '', a.type_armoire || '', a.puissance_kva || '', a.numero_serie || '', a.annee_pose || '', a.nb_points_lumineux || 0, a.nb_defaillants || 0]));
      });
    }
    lines.push('');
  }

  if (sel.has('marches')) {
    const marches = data.marches || [];
    lines.push(csvRow(['MARCHÉS ÉCLAIRAGE']));
    lines.push(csvRow(['Intitulé', 'N° marché', 'Prestataire', 'Type travaux', 'Montant HT', 'Statut', 'Engagé total', 'Consommé total']));
    if (marches.length === 0) {
      lines.push(csvRow(['Aucune donnée']));
    } else {
      marches.forEach(m => {
        lines.push(csvRow([m.intitule, m.numero_marche || '', m.prestataire || '', m.type_travaux || '', fmtEur(m.montant_ht), m.statut || '', fmtEur(m.total_engage), fmtEur(m.total_interventions)]));
        (m.engagements || []).forEach(eng =>
          lines.push(csvRow(['', `  └ Exercice ${eng.exercice}`, '', '', '', '', fmtEur(eng.montant_engage_ht), fmtEur(eng.total_interventions_ht)]))
        );
      });
    }
    lines.push('');
  }

  ['iv_pl', 'iv_armoire'].forEach((sid, i) => {
    if (!sel.has(sid)) return;
    const label    = i === 0 ? 'INTERVENTIONS POINTS LUMINEUX' : 'INTERVENTIONS ARMOIRES';
    const colLabel = i === 0 ? 'Point lumineux' : 'Armoire';
    const ivData   = i === 0 ? data.ivPl : data.ivArmoire;
    let ivs = (ivData?.interventions || []);
    if (dateFrom) ivs = ivs.filter(iv => iv.date_signalement >= dateFrom);
    if (dateTo)   ivs = ivs.filter(iv => iv.date_signalement <= dateTo);
    lines.push(csvRow([label]));
    lines.push(csvRow(['Date', colLabel, 'Nature', 'Type maintenance', 'Type intervenant', 'Intervenant / Prestataire', 'Montant HT', 'Statut', 'Marché']));
    if (ivs.length === 0) {
      lines.push(csvRow(['Aucune donnée']));
    } else {
      ivs.forEach(iv => {
        const interv = iv.type_intervenant === 'prestataire' ? (iv.prestataire_nom || '') : (iv.agent_nom || 'Agent interne');
        lines.push(csvRow([fmtDate(iv.date_signalement), iv.element_intitule || '', iv.nature || '', iv.type_maintenance || '', iv.type_intervenant || '', interv, fmtEur(iv.montant_ht), STATUT_IV[iv.statut] || iv.statut || '', iv.marche?.intitule || iv.reference_marche || '']));
      });
    }
    lines.push('');
  });

  return lines.join(CRLF);
}

function buildCSVBatiments(data, sel, dateFrom, dateTo) {
  const lines = [];
  const today = new Date().toLocaleDateString('fr-FR');
  lines.push(csvRow(['RAPPORT GESTION PATRIMONIALE — BÂTIMENTS']));
  lines.push(csvRow([`Généré le ${today}`]));
  lines.push(csvRow([`Période : ${fmtPeriode(dateFrom, dateTo)}`]));
  lines.push('');

  if (sel.has('kpis')) {
    const bats = data.batiments || [];
    const totalSurf = bats.reduce((s, b) => s + (parseFloat(b.surface_plancher_m2) || 0), 0);
    const dpeFG = bats.filter(b => b.dpe_classe === 'F' || b.dpe_classe === 'G').length;
    lines.push(csvRow(['SYNTHÈSE KPIs']));
    lines.push(csvRow(['Indicateur', 'Valeur']));
    lines.push(csvRow(['Bâtiments totaux', bats.length]));
    lines.push(csvRow(['Surface totale (m²)', fmtNum(Math.round(totalSurf))]));
    lines.push(csvRow(['DPE F ou G', dpeFG]));
    const dpeCount = {};
    bats.forEach(b => { if (b.dpe_classe) dpeCount[b.dpe_classe] = (dpeCount[b.dpe_classe] || 0) + 1; });
    Object.entries(dpeCount).sort().forEach(([cls, n]) => lines.push(csvRow([`DPE ${cls}`, n])));
    lines.push('');
  }

  if (sel.has('inventaire')) {
    const bats = data.batiments || [];
    lines.push(csvRow(['INVENTAIRE BÂTIMENTS']));
    lines.push(csvRow(['Intitulé', 'Adresse', 'Surface plancher (m²)', 'Année construction', 'DPE', 'Nb équipements', 'Commentaire']));
    if (bats.length === 0) {
      lines.push(csvRow(['Aucune donnée']));
    } else {
      bats.forEach(b => {
        lines.push(csvRow([b.intitule, b.adresse || '', b.surface_plancher_m2 || '', b.annee_construction || '', b.dpe_classe || '', b.nb_equipements || 0, b.commentaire || '']));
      });
    }
    lines.push('');
  }

  if (sel.has('equipements')) {
    const equip = data.equipements || [];
    lines.push(csvRow(['ÉQUIPEMENTS']));
    lines.push(csvRow(['Bâtiment', 'Catégorie', 'Intitulé', 'Marque', 'Modèle', 'Date installation', 'Prochain contrôle', 'Périodicité (mois)', 'Commentaire']));
    if (equip.length === 0) {
      lines.push(csvRow(['Aucune donnée']));
    } else {
      equip.forEach(e => {
        lines.push(csvRow([e.batiment_intitule || '', e.categorie || '', e.intitule || '', e.marque || '', e.modele || '', fmtDate(e.date_installation), fmtDate(e.date_prochain_controle), e.periodicite_controle_mois || '', e.commentaire || '']));
      });
    }
    lines.push('');
  }

  if (sel.has('controles')) {
    const today_str = new Date().toISOString().split('T')[0];
    const in90 = new Date(); in90.setDate(in90.getDate() + 90);
    const in90_str = in90.toISOString().split('T')[0];
    const withCtrl = (data.equipements || [])
      .filter(e => e.date_prochain_controle)
      .sort((a, b) => a.date_prochain_controle.localeCompare(b.date_prochain_controle));
    lines.push(csvRow(['CONTRÔLES RÉGLEMENTAIRES']));
    lines.push(csvRow(['Bâtiment', 'Équipement', 'Catégorie', 'Prochain contrôle', 'Échéance', 'Périodicité (mois)']));
    if (withCtrl.length === 0) {
      lines.push(csvRow(['Aucun contrôle planifié']));
    } else {
      withCtrl.forEach(e => {
        const d = e.date_prochain_controle;
        const ech = d < today_str ? 'ÉCHU' : d <= in90_str ? 'Dans 90j' : 'OK';
        lines.push(csvRow([e.batiment_intitule || '', e.intitule || '', e.categorie || '', fmtDate(d), ech, e.periodicite_controle_mois || '']));
      });
    }
    lines.push('');
  }

  if (sel.has('marches')) {
    const marches = data.marches || [];
    lines.push(csvRow(['MARCHÉS BÂTIMENTS']));
    lines.push(csvRow(['Intitulé', 'N° marché', 'Prestataire', 'Type travaux', 'Montant HT', 'Statut', 'Engagé total', 'Consommé total']));
    if (marches.length === 0) {
      lines.push(csvRow(['Aucune donnée']));
    } else {
      marches.forEach(m => {
        lines.push(csvRow([m.intitule, m.numero_marche || '', m.prestataire || '', m.type_travaux || '', fmtEur(m.montant_ht), m.statut || '', fmtEur(m.total_engage), fmtEur(m.total_interventions)]));
        (m.engagements || []).forEach(eng =>
          lines.push(csvRow(['', `  └ Exercice ${eng.exercice}`, '', '', '', '', fmtEur(eng.montant_engage_ht), fmtEur(eng.total_interventions_ht)]))
        );
      });
    }
    lines.push('');
  }

  if (sel.has('iv_bat')) {
    let ivs = (data.ivBat?.interventions || []);
    if (dateFrom) ivs = ivs.filter(iv => iv.date_signalement >= dateFrom);
    if (dateTo)   ivs = ivs.filter(iv => iv.date_signalement <= dateTo);
    lines.push(csvRow(['INTERVENTIONS BÂTIMENTS']));
    lines.push(csvRow(['Date', 'Bâtiment', 'Nature', 'Catégorie', 'Type maintenance', 'Type intervenant', 'Intervenant / Prestataire', 'Montant HT', 'Statut', 'Marché']));
    if (ivs.length === 0) {
      lines.push(csvRow(['Aucune donnée']));
    } else {
      ivs.forEach(iv => {
        const interv = iv.type_intervenant === 'prestataire' ? (iv.prestataire_nom || '') : (iv.agent_nom || 'Agent interne');
        lines.push(csvRow([fmtDate(iv.date_signalement), iv.element_intitule || '', iv.nature || '', iv.categorie || '', iv.type_maintenance || '', iv.type_intervenant || '', interv, fmtEur(iv.montant_ht), STATUT_IV[iv.statut] || iv.statut || '', iv.marche?.intitule || iv.reference_marche || '']));
      });
    }
    lines.push('');
  }

  return lines.join(CRLF);
}

// ── Génération HTML pour impression ──────────────────────────────────────────

function buildPrintStyle() {
  return `
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 20px; }
      h1 { font-size: 16px; margin-bottom: 4px; color: #1A3A5C; }
      h2 { font-size: 13px; margin: 20px 0 6px; border-bottom: 2px solid #1A3A5C; padding-bottom: 4px; color: #1A3A5C; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th { background: #1A3A5C; color: #fff; text-align: left; padding: 5px 7px; font-size: 10px; }
      td { padding: 4px 7px; border-bottom: 1px solid #eee; vertical-align: top; }
      tr:nth-child(even) td { background: #f5f8ff; }
      .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 10px 0 20px; }
      .kpi-card { border: 1px solid #ddd; padding: 10px; border-radius: 4px; }
      .kpi-val { font-size: 20px; font-weight: bold; color: #1A3A5C; }
      .kpi-lbl { font-size: 9px; color: #666; text-transform: uppercase; margin-top: 2px; }
      .empty { color: #999; font-style: italic; }
      .sub { color: #555; }
      .badge-echu { background: #fee2e2; color: #b91c1c; padding: 1px 5px; border-radius: 3px; font-size: 9px; }
      .badge-bientot { background: #fef9c3; color: #92400e; padding: 1px 5px; border-radius: 3px; font-size: 9px; }
      .badge-ok { background: #dcfce7; color: #166534; padding: 1px 5px; border-radius: 3px; font-size: 9px; }
      @media print { @page { size: A4 landscape; margin: 12mm; } }
    </style>
  `;
}

function buildPrintHTML(domain, data, selected, dateFrom, dateTo) {
  const today = new Date().toLocaleDateString('fr-FR');
  const title = `Rapport ${DOMAIN_LABELS[domain]} — ${today}`;
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>${buildPrintStyle()}</head><body>`;
  html += `<h1>${title}</h1>`;
  html += `<p style="margin:2px 0 14px;font-size:11px;color:#555"><strong>Période :</strong> ${fmtPeriode(dateFrom, dateTo)}</p>`;

  if (domain === 'voirie') {
    // KPIs
    if (selected.has('kpis')) {
      const kpis = data.voirie?.kpis || {};
      html += `<h2>Synthèse</h2><div class="kpi-grid">`;
      html += `<div class="kpi-card"><div class="kpi-val">${kpis.total ?? 0}</div><div class="kpi-lbl">Tronçons</div></div>`;
      html += `<div class="kpi-card"><div class="kpi-val">${Math.round(kpis.totalSurface || 0).toLocaleString('fr-FR')} m²</div><div class="kpi-lbl">Surface totale</div></div>`;
      const etatBon = kpis.statsByEtat?.bon || 0;
      const etatDegrade = (kpis.statsByEtat?.degrade || 0) + (kpis.statsByEtat?.tres_degrade || 0);
      html += `<div class="kpi-card"><div class="kpi-val">${etatBon}</div><div class="kpi-lbl">En bon état</div></div>`;
      html += `<div class="kpi-card"><div class="kpi-val">${etatDegrade}</div><div class="kpi-lbl">Dégradés</div></div>`;
      html += `</div>`;
    }

    // Tronçons
    if (selected.has('troncons')) {
      const troncons = data.voirie?.troncons || [];
      html += `<h2>Inventaire tronçons (${troncons.length})</h2>`;
      if (troncons.length === 0) {
        html += `<p class="empty">Aucune donnée</p>`;
      } else {
        html += `<table><thead><tr><th>Intitulé</th><th>Catégorie</th><th>Longueur (ml)</th><th>Largeur (m)</th><th>Surface (m²)</th><th>Revêtement</th><th>Dernière réfection</th><th>État</th></tr></thead><tbody>`;
        troncons.forEach(t => {
          const surf = ((parseFloat(t.longueur_ml) || 0) * (parseFloat(t.largeur_m) || 0)).toFixed(0);
          html += `<tr><td>${t.intitule}</td><td>${t.categorie || ''}</td><td>${t.longueur_ml || ''}</td><td>${t.largeur_m || ''}</td><td>${Number(surf).toLocaleString('fr-FR')}</td><td>${t.revetement || ''}</td><td>${t.annee_derniere_refection || ''}</td><td>${ETAT_LABELS[t.etat_general] || t.etat_general || ''}</td></tr>`;
        });
        html += `</tbody></table>`;
      }
    }

    // Marchés voirie
    if (selected.has('marches_v')) {
      const list = (data.marches || []).filter(m => m.domaine === 'voirie');
      html += `<h2>Marchés voirie (${list.length})</h2>`;
      html += buildMarchesTable(list);
    }

    // Marchés mobilier
    if (selected.has('marches_mob')) {
      const list = (data.marches || []).filter(m => m.domaine === 'mobilier');
      html += `<h2>Marchés mobilier (${list.length})</h2>`;
      html += buildMarchesTable(list);
    }

    // Interventions voirie
    if (selected.has('iv_voirie')) {
      const ivs = data.ivVoirie?.interventions || [];
      html += `<h2>Interventions voirie (${ivs.length})</h2>`;
      html += buildInterventionsTable(ivs, 'Tronçon');
    }

    // Interventions mobilier
    if (selected.has('iv_mobilier')) {
      const ivs = data.ivMobilier?.interventions || [];
      html += `<h2>Interventions mobilier (${ivs.length})</h2>`;
      html += buildInterventionsTable(ivs, 'Mobilier');
    }
  }

  if (domain === 'eclairage') {
    // KPIs
    if (selected.has('kpis')) {
      const k = data.kpis || {};
      html += `<h2>Synthèse</h2><div class="kpi-grid">`;
      html += `<div class="kpi-card"><div class="kpi-val">${k.total ?? 0}</div><div class="kpi-lbl">Points lumineux</div></div>`;
      html += `<div class="kpi-card"><div class="kpi-val">${k.defaillants ?? 0}</div><div class="kpi-lbl">Défaillants</div></div>`;
      html += `<div class="kpi-card"><div class="kpi-val">${k.pctLed ?? 0}%</div><div class="kpi-lbl">Taux LED</div></div>`;
      html += `<div class="kpi-card"><div class="kpi-val">${fmtEur(k.cout12Mois)}</div><div class="kpi-lbl">Coût 12 mois</div></div>`;
      html += `</div>`;
    }

    // Points lumineux
    if (selected.has('points')) {
      const pts = data.points || [];
      html += `<h2>Points lumineux (${pts.length})</h2>`;
      if (pts.length === 0) {
        html += `<p class="empty">Aucune donnée</p>`;
      } else {
        html += `<table><thead><tr><th>Référence</th><th>Armoire</th><th>Localisation</th><th>Type support</th><th>Type lampe</th><th>Puissance (W)</th><th>Année pose</th><th>État</th></tr></thead><tbody>`;
        pts.forEach(p => {
          html += `<tr><td>${p.reference || ''}</td><td>${p.armoires_eclairage?.intitule || ''}</td><td>${p.localisation || ''}</td><td>${p.type_support || ''}</td><td>${p.type_lampe || ''}</td><td>${p.puissance_w || ''}</td><td>${p.annee_pose || ''}</td><td>${ETAT_LABELS[p.etat_general] || p.etat_general || ''}</td></tr>`;
        });
        html += `</tbody></table>`;
      }
    }

    // Armoires
    if (selected.has('armoires')) {
      const arms = data.armoires || [];
      html += `<h2>Armoires électriques (${arms.length})</h2>`;
      if (arms.length === 0) {
        html += `<p class="empty">Aucune donnée</p>`;
      } else {
        html += `<table><thead><tr><th>Intitulé</th><th>Localisation</th><th>Type</th><th>Puissance (kVA)</th><th>Année pose</th><th>Nb PL</th><th>Défaillants</th></tr></thead><tbody>`;
        arms.forEach(a => {
          html += `<tr><td>${a.intitule || ''}</td><td>${a.localisation || ''}</td><td>${a.type_armoire || ''}</td><td>${a.puissance_kva || ''}</td><td>${a.annee_pose || ''}</td><td>${a.nb_points_lumineux || 0}</td><td>${a.nb_defaillants || 0}</td></tr>`;
        });
        html += `</tbody></table>`;
      }
    }

    // Marchés
    if (selected.has('marches')) {
      html += `<h2>Marchés éclairage (${(data.marches || []).length})</h2>`;
      html += buildMarchesTable(data.marches || []);
    }

    // Interventions PL / Armoire
    ['iv_pl', 'iv_armoire'].forEach((sid, i) => {
      if (!selected.has(sid)) return;
      const label   = i === 0 ? 'Interventions points lumineux' : 'Interventions armoires';
      const colLbl  = i === 0 ? 'Point lumineux' : 'Armoire';
      const ivs = (i === 0 ? data.ivPl : data.ivArmoire)?.interventions || [];
      html += `<h2>${label} (${ivs.length})</h2>`;
      html += buildInterventionsTable(ivs, colLbl);
    });
  }

  if (domain === 'batiments') {
    // KPIs
    if (selected.has('kpis')) {
      const bats = data.batiments || [];
      const surf = bats.reduce((s, b) => s + (parseFloat(b.surface_plancher_m2) || 0), 0);
      const dpeFG = bats.filter(b => b.dpe_classe === 'F' || b.dpe_classe === 'G').length;
      html += `<h2>Synthèse</h2><div class="kpi-grid">`;
      html += `<div class="kpi-card"><div class="kpi-val">${bats.length}</div><div class="kpi-lbl">Bâtiments</div></div>`;
      html += `<div class="kpi-card"><div class="kpi-val">${Math.round(surf).toLocaleString('fr-FR')} m²</div><div class="kpi-lbl">Surface totale</div></div>`;
      html += `<div class="kpi-card"><div class="kpi-val">${dpeFG}</div><div class="kpi-lbl">DPE F ou G</div></div>`;
      const contrEchus = (data.equipements || []).filter(e => e.date_prochain_controle && e.date_prochain_controle < new Date().toISOString().split('T')[0]).length;
      html += `<div class="kpi-card"><div class="kpi-val">${contrEchus}</div><div class="kpi-lbl">Contrôles échus</div></div>`;
      html += `</div>`;
    }

    // Inventaire
    if (selected.has('inventaire')) {
      const bats = data.batiments || [];
      html += `<h2>Inventaire bâtiments (${bats.length})</h2>`;
      if (bats.length === 0) {
        html += `<p class="empty">Aucune donnée</p>`;
      } else {
        html += `<table><thead><tr><th>Intitulé</th><th>Adresse</th><th>Surface (m²)</th><th>Année constr.</th><th>DPE</th><th>Nb équipements</th></tr></thead><tbody>`;
        bats.forEach(b => {
          html += `<tr><td>${b.intitule}</td><td>${b.adresse || ''}</td><td>${b.surface_plancher_m2 || ''}</td><td>${b.annee_construction || ''}</td><td>${b.dpe_classe || ''}</td><td>${b.nb_equipements || 0}</td></tr>`;
        });
        html += `</tbody></table>`;
      }
    }

    // Équipements
    if (selected.has('equipements')) {
      const equip = data.equipements || [];
      html += `<h2>Équipements (${equip.length})</h2>`;
      if (equip.length === 0) {
        html += `<p class="empty">Aucune donnée</p>`;
      } else {
        html += `<table><thead><tr><th>Bâtiment</th><th>Catégorie</th><th>Intitulé</th><th>Marque / Modèle</th><th>Date install.</th><th>Prochain contrôle</th></tr></thead><tbody>`;
        equip.forEach(e => {
          html += `<tr><td>${e.batiment_intitule || ''}</td><td>${e.categorie || ''}</td><td>${e.intitule || ''}</td><td>${[e.marque, e.modele].filter(Boolean).join(' / ')}</td><td>${fmtDate(e.date_installation)}</td><td>${fmtDate(e.date_prochain_controle)}</td></tr>`;
        });
        html += `</tbody></table>`;
      }
    }

    // Contrôles
    if (selected.has('controles')) {
      const today_str = new Date().toISOString().split('T')[0];
      const in90 = new Date(); in90.setDate(in90.getDate() + 90);
      const in90_str = in90.toISOString().split('T')[0];
      const withCtrl = (data.equipements || [])
        .filter(e => e.date_prochain_controle)
        .sort((a, b) => a.date_prochain_controle.localeCompare(b.date_prochain_controle));
      html += `<h2>Contrôles réglementaires (${withCtrl.length})</h2>`;
      if (withCtrl.length === 0) {
        html += `<p class="empty">Aucun contrôle planifié</p>`;
      } else {
        html += `<table><thead><tr><th>Bâtiment</th><th>Équipement</th><th>Catégorie</th><th>Prochain contrôle</th><th>Échéance</th><th>Périodicité (mois)</th></tr></thead><tbody>`;
        withCtrl.forEach(e => {
          const d = e.date_prochain_controle;
          let badge = '';
          if (d < today_str) badge = `<span class="badge-echu">ÉCHU</span>`;
          else if (d <= in90_str) badge = `<span class="badge-bientot">Dans 90j</span>`;
          else badge = `<span class="badge-ok">OK</span>`;
          html += `<tr><td>${e.batiment_intitule || ''}</td><td>${e.intitule || ''}</td><td>${e.categorie || ''}</td><td>${fmtDate(d)}</td><td>${badge}</td><td>${e.periodicite_controle_mois || ''}</td></tr>`;
        });
        html += `</tbody></table>`;
      }
    }

    // Marchés
    if (selected.has('marches')) {
      html += `<h2>Marchés bâtiments (${(data.marches || []).length})</h2>`;
      html += buildMarchesTable(data.marches || []);
    }

    // Interventions
    if (selected.has('iv_bat')) {
      const ivs = data.ivBat?.interventions || [];
      html += `<h2>Interventions bâtiments (${ivs.length})</h2>`;
      html += buildInterventionsTable(ivs, 'Bâtiment');
    }
  }

  html += `<p style="font-size:9px;color:#999;margin-top:20px">Rapport généré le ${today} via Opera-Track</p>`;
  html += `</body></html>`;
  return html;
}

function buildMarchesTable(list) {
  if (list.length === 0) return `<p class="empty">Aucune donnée</p>`;
  let html = `<table><thead><tr><th>Intitulé</th><th>N° marché</th><th>Prestataire</th><th>Type travaux</th><th>Montant HT</th><th>Statut</th><th>Engagé total</th><th>Consommé</th></tr></thead><tbody>`;
  list.forEach(m => {
    html += `<tr><td><strong>${m.intitule}</strong></td><td>${m.numero_marche || ''}</td><td>${m.prestataire || ''}</td><td>${m.type_travaux || ''}</td><td>${fmtEur(m.montant_ht)}</td><td>${m.statut || ''}</td><td>${fmtEur(m.total_engage)}</td><td>${fmtEur(m.total_interventions)}</td></tr>`;
    (m.engagements || []).forEach(eng => {
      html += `<tr><td class="sub" colspan="2">&nbsp;&nbsp;└ Exercice ${eng.exercice}</td><td></td><td></td><td></td><td></td><td>${fmtEur(eng.montant_engage_ht)}</td><td>${fmtEur(eng.total_interventions_ht)}</td></tr>`;
    });
  });
  html += `</tbody></table>`;
  return html;
}

function buildInterventionsTable(ivs, colLabel) {
  if (ivs.length === 0) return `<p class="empty">Aucune donnée</p>`;
  let html = `<table><thead><tr><th>Date</th><th>${colLabel}</th><th>Nature</th><th>Type maintenance</th><th>Intervenant</th><th>Montant HT</th><th>Statut</th><th>Marché</th></tr></thead><tbody>`;
  ivs.forEach(iv => {
    const interv = iv.type_intervenant === 'prestataire' ? (iv.prestataire_nom || '') : (iv.agent_nom || 'Agent interne');
    html += `<tr><td>${fmtDate(iv.date_signalement)}</td><td>${iv.element_intitule || ''}</td><td>${iv.nature || ''}</td><td>${iv.type_maintenance || ''}</td><td>${interv}</td><td>${fmtEur(iv.montant_ht)}</td><td>${STATUT_IV[iv.statut] || iv.statut || ''}</td><td>${iv.marche?.intitule || iv.reference_marche || ''}</td></tr>`;
  });
  html += `</tbody></table>`;
  return html;
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
      console.error('Erreur génération CSV :', err);
      toast.error('Erreur génération : ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    try {
      const html = buildPrintHTML(domain, data, selected, dateFrom, dateTo);
      const win = window.open('', '_blank');
      if (!win) { toast.error('Veuillez autoriser les pop-ups pour imprimer.'); return; }
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 500);
    } catch (err) {
      console.error('Erreur impression :', err);
      toast.error('Erreur impression : ' + err.message);
    }
  };

  // Statistiques rapides pour affichage dans la modale
  const stats = (() => {
    if (!data || loading) return null;
    if (domain === 'voirie') return {
      items: data.voirie?.troncons?.length ?? '…',
      ivs: (data.ivVoirie?.interventions?.length ?? 0) + (data.ivMobilier?.interventions?.length ?? 0),
      marches: (data.marches || []).filter(m => m.domaine === 'voirie' || m.domaine === 'mobilier').length,
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
