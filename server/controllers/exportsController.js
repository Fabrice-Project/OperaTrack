const ExcelJS = require('exceljs');
const { supabaseAdmin } = require('../utils/supabase');
const { error } = require('../utils/response');

const PRIMARY = '1A3A5C';
const ALT_ROW = 'F5F9FC';
const BORDER_COLOR = 'DDE3EA';

function addStyledHeader(sheet, columns) {
  sheet.columns = columns;
  const headerRow = sheet.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PRIMARY } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFDDE3EA' } } };
  });
  sheet.getRow(1).height = 30;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

function styleDataRows(sheet, startRow, endRow, moneyColumns = []) {
  for (let i = startRow; i <= endRow; i++) {
    const row = sheet.getRow(i);
    const isAlt = (i - startRow) % 2 === 1;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (isAlt) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F9FC' } };
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFDDE3EA' } }
      };
      if (moneyColumns.includes(col)) {
        cell.numFmt = '# ##0.00 €';
        cell.alignment = { horizontal: 'right' };
      }
    });
  }
}

async function getAllOperations(operationId = null) {
  let query = supabaseAdmin.from('operations').select('*').order('intitule');
  if (operationId) query = query.eq('id', operationId);
  const { data } = await query;
  return data || [];
}

const exportFinancesGlobal = async (req, res) => {
  await exportFinances(req, res, null);
};

const exportFinancesOperation = async (req, res) => {
  await exportFinances(req, res, req.params.id);
};

const exportMarchesGlobal = async (req, res) => {
  await exportMarches(req, res, null);
};

const exportMarchesOperation = async (req, res) => {
  await exportMarches(req, res, req.params.id);
};

async function exportFinances(req, res, operationId) {
  try {
    const operations = await getAllOperations(operationId);
    const { data: mouvements } = await supabaseAdmin.from('mouvements_financiers').select('*').order('date_mouvement');
    let cpQuery = supabaseAdmin.from('credits_paiement').select('*').order('annee');
    if (operationId) cpQuery = cpQuery.eq('operation_id', operationId);
    const { data: credits } = await cpQuery;
    let finQuery = supabaseAdmin.from('financements').select('*').order('financeur');
    if (operationId) finQuery = finQuery.eq('operation_id', operationId);
    const { data: financements } = await finQuery;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'OpéraTrack — Ville de Denain';

    // Feuille 1 — Synthèse
    const ws1 = wb.addWorksheet('Synthèse');
    addStyledHeader(ws1, [
      { header: 'Opération', key: 'intitule', width: 40 },
      { header: 'Type', key: 'type', width: 22 },
      { header: 'Enveloppe HT (€)', key: 'enveloppe_ht', width: 18 },
      { header: 'Engagé HT (€)', key: 'montant_engage', width: 16 },
      { header: 'Mandaté HT (€)', key: 'montant_mandate', width: 16 },
      { header: 'RAD (€)', key: 'rad', width: 16 },
      { header: 'Taux eng. (%)', key: 'taux', width: 14 },
      { header: 'Statut budget', key: 'statut_budget', width: 16 }
    ]);

    const TYPE_LABELS = { construction_neuve: 'Construction neuve', rehabilitation: 'Réhabilitation', amenagement_vrd: 'Aménagement VRD' };

    operations.forEach(op => {
      const engage = parseFloat(op.montant_engage || 0);
      const mandate = parseFloat(op.montant_mandate || 0);
      const enveloppe = parseFloat(op.enveloppe_ht || 0);
      const rad = enveloppe - engage;
      const taux = enveloppe > 0 ? Math.round((engage / enveloppe) * 1000) / 10 : 0;
      const row = ws1.addRow({
        intitule: op.intitule,
        type: TYPE_LABELS[op.type] || op.type,
        enveloppe_ht: enveloppe,
        montant_engage: engage,
        montant_mandate: mandate,
        rad,
        taux: taux / 100,
        statut_budget: engage > enveloppe * 1.05 ? '⚠ Dépassement' : engage > enveloppe * 0.9 ? '🟡 Vigilance' : '✅ OK'
      });
      if (engage > enveloppe * 1.05) {
        row.getCell('statut_budget').font = { color: { argb: 'FFC0392B' }, bold: true };
      }
    });

    // Ligne total
    const totalRow = ws1.addRow({
      intitule: 'TOTAL',
      enveloppe_ht: operations.reduce((s, op) => s + parseFloat(op.enveloppe_ht || 0), 0),
      montant_engage: operations.reduce((s, op) => s + parseFloat(op.montant_engage || 0), 0),
      montant_mandate: operations.reduce((s, op) => s + parseFloat(op.montant_mandate || 0), 0),
    });
    totalRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDE3EA' } };
      cell.font = { bold: true };
    });

    styleDataRows(ws1, 2, ws1.rowCount - 1, [3, 4, 5, 6]);
    ws1.getColumn('taux').numFmt = '0.0%';

    // Feuille 2 — Mouvements
    const ws2 = wb.addWorksheet('Détail mouvements');
    addStyledHeader(ws2, [
      { header: 'Opération', key: 'operation', width: 40 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Type', key: 'type', width: 14 },
      { header: 'Libellé', key: 'libelle', width: 40 },
      { header: 'Référence', key: 'reference', width: 18 },
      { header: 'Montant (€)', key: 'montant', width: 16 }
    ]);

    const opMap = {};
    operations.forEach(op => { opMap[op.id] = op.intitule; });

    const filteredMvt = operationId ? mouvements.filter(m => m.operation_id === operationId) : mouvements;
    filteredMvt.forEach(m => {
      ws2.addRow({
        operation: opMap[m.operation_id] || m.operation_id,
        date: m.date_mouvement ? new Date(m.date_mouvement).toLocaleDateString('fr-FR') : '',
        type: m.type === 'engagement' ? 'Engagement' : 'Mandatement',
        libelle: m.libelle,
        reference: m.reference || '',
        montant: parseFloat(m.montant || 0)
      });
    });
    styleDataRows(ws2, 2, ws2.rowCount, [6]);

    // Feuille 3 — Crédits de paiement AP/CP
    if (credits && credits.length > 0) {
      const ws3 = wb.addWorksheet('Crédits de paiement');
      addStyledHeader(ws3, [
        { header: 'Opération', key: 'operation', width: 40 },
        { header: 'Année', key: 'annee', width: 10 },
        { header: 'CP prévu (€)', key: 'montant_prevu', width: 16 },
        { header: 'CP mandaté (€)', key: 'montant_mandate', width: 16 },
        { header: 'Écart (€)', key: 'ecart', width: 14 },
        { header: 'Statut', key: 'statut', width: 12 }
      ]);

      credits.forEach(cp => {
        const prevu = parseFloat(cp.montant_prevu || 0);
        const mandate = parseFloat(cp.montant_mandate || 0);
        const ecart = mandate - prevu;
        const row = ws3.addRow({
          operation: opMap[cp.operation_id] || cp.operation_id,
          annee: cp.annee,
          montant_prevu: prevu,
          montant_mandate: mandate,
          ecart,
          statut: mandate >= prevu ? '✅ Soldé' : mandate > 0 ? '🟡 Partiel' : '⬜ Non mandaté'
        });
        if (ecart < 0) row.getCell('ecart').font = { color: { argb: 'FFC0392B' }, bold: true };
        else if (ecart > 0) row.getCell('ecart').font = { color: { argb: 'FF1E7E45' } };
      });

      // Ligne total CP
      const totalCp = ws3.addRow({
        operation: 'TOTAL',
        montant_prevu: credits.reduce((s, c) => s + parseFloat(c.montant_prevu || 0), 0),
        montant_mandate: credits.reduce((s, c) => s + parseFloat(c.montant_mandate || 0), 0),
        ecart: credits.reduce((s, c) => s + parseFloat(c.montant_mandate || 0) - parseFloat(c.montant_prevu || 0), 0),
      });
      totalCp.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDE3EA' } };
        cell.font = { bold: true };
      });

      styleDataRows(ws3, 2, ws3.rowCount - 1, [3, 4, 5]);
    }

    // Feuille 4 — Financements
    if (financements && financements.length > 0) {
      const FINANCEUR_LABELS = { anru: 'ANRU', etat: 'État', dpv: 'DPV', region: 'Région Hauts-de-France', agglo: 'CA Valenciennes Métropole', commune: 'Commune', autre: 'Autre' };
      const ws4 = wb.addWorksheet('Financements');
      addStyledHeader(ws4, [
        { header: 'Opération', key: 'operation', width: 40 },
        { header: 'Financeur', key: 'financeur', width: 28 },
        { header: 'N° convention', key: 'numero', width: 18 },
        { header: 'Date convention', key: 'date', width: 16 },
        { header: 'Montant attribué (€)', key: 'montant_attribue', width: 20 },
        { header: 'Montant versé (€)', key: 'montant_verse', width: 18 },
        { header: 'Écart (€)', key: 'ecart', width: 14 },
        { header: 'Observations', key: 'observations', width: 35 },
      ]);
      financements.forEach(f => {
        const attribue = parseFloat(f.montant_attribue || 0);
        const verse = parseFloat(f.montant_verse || 0);
        const ecart = verse - attribue;
        const row = ws4.addRow({
          operation: opMap[f.operation_id] || f.operation_id,
          financeur: f.libelle || FINANCEUR_LABELS[f.financeur] || f.financeur,
          numero: f.numero_convention || '',
          date: f.date_convention ? new Date(f.date_convention).toLocaleDateString('fr-FR') : '',
          montant_attribue: attribue,
          montant_verse: verse,
          ecart,
          observations: f.observations || '',
        });
        if (ecart < 0) row.getCell('ecart').font = { color: { argb: 'FFC0392B' }, bold: true };
      });
      const totalFin = ws4.addRow({
        operation: 'TOTAL',
        montant_attribue: financements.reduce((s, f) => s + parseFloat(f.montant_attribue || 0), 0),
        montant_verse: financements.reduce((s, f) => s + parseFloat(f.montant_verse || 0), 0),
      });
      totalFin.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDE3EA' } }; cell.font = { bold: true }; });
      styleDataRows(ws4, 2, ws4.rowCount - 1, [5, 6, 7]);
    }

    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="suivi-financier-${date}.xlsx"`);
    await wb.xlsx.write(res);
  } catch (err) {
    error(res, err.message);
  }
}

async function exportMarches(req, res, operationId) {
  try {
    const operations = await getAllOperations(operationId);
    let marchesQuery = supabaseAdmin.from('marches').select('*, avenants(*), operations(intitule)').order('numero');
    if (operationId) marchesQuery = marchesQuery.eq('operation_id', operationId);
    const { data: marches } = await marchesQuery;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'OpéraTrack — Ville de Denain';

    const ws = wb.addWorksheet('Suivi marchés');
    addStyledHeader(ws, [
      { header: 'Opération', key: 'operation', width: 35 },
      { header: 'N° marché', key: 'numero', width: 14 },
      { header: 'Intitulé', key: 'intitule', width: 40 },
      { header: 'Type', key: 'type', width: 16 },
      { header: 'Titulaire', key: 'titulaire', width: 30 },
      { header: 'Montant initial HT', key: 'montant_initial', width: 20 },
      { header: 'Avenants HT', key: 'avenants_total', width: 16 },
      { header: 'Montant actuel HT', key: 'montant_actuel', width: 20 },
      { header: 'Notification', key: 'date_notification', width: 14 },
      { header: 'Fin prévue', key: 'date_fin', width: 14 },
      { header: 'Statut', key: 'statut', width: 14 }
    ]);

    const today = new Date();
    const TYPE_LABELS = { travaux: 'Travaux', maitrise_oeuvre: 'Maîtrise d\'œuvre', controle: 'Contrôle', autre: 'Autre' };

    (marches || []).forEach(m => {
      const totalAv = (m.avenants || []).reduce((s, a) => s + parseFloat(a.montant_ht || 0), 0);
      const montantActuel = parseFloat(m.montant_initial_ht || 0) + totalAv;
      const finPrev = m.date_fin_prev ? new Date(m.date_fin_prev) : null;
      const daysToEnd = finPrev ? Math.ceil((finPrev - today) / (1000 * 60 * 60 * 24)) : null;

      const row = ws.addRow({
        operation: m.operations?.intitule || '',
        numero: m.numero,
        intitule: m.intitule,
        type: TYPE_LABELS[m.type] || m.type,
        titulaire: m.titulaire_nom || '',
        montant_initial: parseFloat(m.montant_initial_ht || 0),
        avenants_total: totalAv,
        montant_actuel: montantActuel,
        date_notification: m.date_notification ? new Date(m.date_notification).toLocaleDateString('fr-FR') : '',
        date_fin: m.date_fin_prev ? new Date(m.date_fin_prev).toLocaleDateString('fr-FR') : '',
        statut: m.statut
      });

      if (daysToEnd !== null && daysToEnd >= 0 && daysToEnd <= 30) {
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        });
        row.getCell('date_fin').font = { color: { argb: 'FFB45309' }, bold: true };
      }

      // Sous-lignes avenants en italique
      (m.avenants || []).forEach(av => {
        const avRow = ws.addRow({
          operation: '',
          numero: `  ↳ Avenant n°${av.numero}`,
          intitule: av.objet,
          montant_initial: '',
          avenants_total: parseFloat(av.montant_ht || 0),
          date_notification: av.date_avenant ? new Date(av.date_avenant).toLocaleDateString('fr-FR') : ''
        });
        avRow.eachCell(cell => {
          cell.font = { italic: true, color: { argb: 'FF6B7A8D' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        });
      });
    });

    styleDataRows(ws, 2, ws.rowCount, [6, 7, 8]);

    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="suivi-marches-${date}.xlsx"`);
    await wb.xlsx.write(res);
  } catch (err) {
    error(res, err.message);
  }
}

const STATUT_LABELS = {
  realise: 'Réalisé', a_venir: 'À venir', en_retard: 'En retard', non_planifie: 'Non planifié',
};

function enrichJalon(jalon) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const prev = jalon.date_prevue ? new Date(jalon.date_prevue) : null;
  const reel = jalon.date_reelle ? new Date(jalon.date_reelle) : null;
  let statut, ecart_jours = 0;
  if (reel) { statut = 'realise'; ecart_jours = prev ? Math.round((reel - prev) / 86400000) : 0; }
  else if (!prev) { statut = 'non_planifie'; }
  else if (prev >= today) { statut = 'a_venir'; }
  else { statut = 'en_retard'; ecart_jours = Math.round((today - prev) / 86400000); }
  return { ...jalon, statut, ecart_jours };
}

const exportPlanningOperation = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: op } = await supabaseAdmin.from('operations').select('intitule').eq('id', id).single();
    if (!op) return error(res, 'Opération introuvable', 404);

    const { data: jalonRows } = await supabaseAdmin.from('jalons').select('*').eq('operation_id', id).order('ordre');
    const jalons = (jalonRows || []).map(enrichJalon);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'OpéraTrack';
    wb.created = new Date();

    const ws = wb.addWorksheet('Planning', { pageSetup: { fitToPage: true, fitToWidth: 1 } });
    addStyledHeader(ws, [
      { header: 'N°',            key: 'ordre',       width: 6 },
      { header: 'Jalon',         key: 'intitule',    width: 38 },
      { header: 'Date prévue',   key: 'date_prevue', width: 16 },
      { header: 'Date réelle',   key: 'date_reelle', width: 16 },
      { header: 'Statut',        key: 'statut',      width: 16 },
      { header: 'Écart (j)',     key: 'ecart',       width: 12 },
      { header: 'Commentaire',   key: 'commentaire', width: 40 },
    ]);

    const fmt = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR') : '';
    jalons.forEach((j, i) => {
      const row = ws.addRow({
        ordre: j.ordre,
        intitule: j.intitule,
        date_prevue: fmt(j.date_prevue),
        date_reelle: fmt(j.date_reelle),
        statut: STATUT_LABELS[j.statut] || j.statut,
        ecart: j.ecart_jours !== 0 ? j.ecart_jours : '',
        commentaire: j.commentaire || '',
      });
      const isAlt = i % 2 === 1;
      row.eachCell({ includeEmpty: true }, cell => {
        if (isAlt) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F9FC' } };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFDDE3EA' } } };
      });
      // Color statut cell
      const statutCell = row.getCell('statut');
      if (j.statut === 'realise') { statutCell.font = { color: { argb: 'FF1E7E45' }, bold: true }; }
      else if (j.statut === 'en_retard') { statutCell.font = { color: { argb: 'FFC0392B' }, bold: true }; }
      const ecartCell = row.getCell('ecart');
      if (j.ecart_jours > 0) ecartCell.font = { color: { argb: 'FFC0392B' } };
      else if (j.ecart_jours < 0) ecartCell.font = { color: { argb: 'FF1E7E45' } };
    });

    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="planning-${date}.xlsx"`);
    await wb.xlsx.write(res);
  } catch (err) {
    error(res, err.message);
  }
};

module.exports = { exportFinancesGlobal, exportFinancesOperation, exportMarchesGlobal, exportMarchesOperation, exportPlanningOperation };
