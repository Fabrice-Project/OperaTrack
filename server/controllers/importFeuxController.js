/**
 * Import Excel — Armoires feux & Feux tricolores
 *
 * GET  /api/v1/import/feux/template  → gabarit Excel
 * POST /api/v1/import/feux           → import (batch upsert)
 */

const ExcelJS = require('exceljs');
const { supabaseAdmin } = require('../utils/supabase');
const { success, error } = require('../utils/response');

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers — extraction cellule ExcelJS
// ─────────────────────────────────────────────────────────────────────────────

function cellVal(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') {
    if (Array.isArray(raw.richText)) return raw.richText.map(r => r.text || '').join('');
    if (raw.result !== undefined)    return cellVal(raw.result);
    if (raw.text != null && raw.hyperlink != null) return raw.text;
    if (raw instanceof Date)         return raw;
  }
  return raw;
}

function parseStr(raw) {
  const v = cellVal(raw);
  if (v == null || v instanceof Date) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function parseNum(raw, decimals = 6) {
  const v = cellVal(raw);
  if (v == null || v === '' || v instanceof Date) return null;
  const n = parseFloat(String(v).replace(',', '.').replace(/\s/g, ''));
  if (isNaN(n)) return null;
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

function parseYear(raw) {
  const v = cellVal(raw);
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.getFullYear();
  const n = parseInt(String(v), 10);
  return isNaN(n) ? null : n;
}

function parseIntVal(raw) {
  const v = cellVal(raw);
  if (v == null || v === '' || v instanceof Date) return null;
  const n = parseFloat(String(v).replace(',', '.').replace(/\s/g, ''));
  return isNaN(n) ? null : Math.round(n);
}

// ── Validation des enums ──────────────────────────────────────────────────────
const TYPE_FEU_VALS    = ['vehicule', 'pieton', 'velo', 'tram'];
const TECHNOLOGIE_VALS = ['led', 'incandescent', 'autre'];
const ETAT_VALS        = ['fonctionnel', 'defaillant', 'hors_service', 'en_travaux'];

function normalizeTypeFeu(raw) {
  const v = parseStr(raw);
  if (!v) return 'vehicule';
  const lower = v.toLowerCase().trim();
  if (TYPE_FEU_VALS.includes(lower)) return lower;
  // correspondances approximatives
  if (lower.includes('pieton') || lower.includes('piéton')) return 'pieton';
  if (lower.includes('velo')   || lower.includes('vélo'))   return 'velo';
  if (lower.includes('tram'))   return 'tram';
  return 'vehicule';
}

function normalizeTechnologie(raw) {
  const v = parseStr(raw);
  if (!v) return 'led';
  const lower = v.toLowerCase().trim();
  if (TECHNOLOGIE_VALS.includes(lower)) return lower;
  if (/led/.test(lower)) return 'led';
  if (/incandescent|halogene|halogène/.test(lower)) return 'incandescent';
  return 'autre';
}

function normalizeEtat(raw) {
  const v = parseStr(raw);
  if (!v) return 'fonctionnel';
  const lower = v.toLowerCase().trim();
  return ETAT_VALS.includes(lower) ? lower : 'fonctionnel';
}

// ── Batch ─────────────────────────────────────────────────────────────────────
const BATCH = 400;
function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
//  GET /template
// ─────────────────────────────────────────────────────────────────────────────
exports.downloadTemplate = async (req, res) => {
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'OpéraTrack';
    wb.created = new Date();

    // ── Armoires feux ─────────────────────────────────────────────────────────
    const wsArm = wb.addWorksheet('Armoires');
    wsArm.columns = [
      { header: 'intitule *',       key: 'intitule',        width: 28 },
      { header: 'localisation',     key: 'localisation',    width: 36 },
      { header: 'latitude',         key: 'latitude',        width: 14 },
      { header: 'longitude',        key: 'longitude',       width: 14 },
      { header: 'type_controleur',  key: 'type_controleur', width: 20 },
      { header: 'marque',           key: 'marque',          width: 18 },
      { header: 'modele',           key: 'modele',          width: 18 },
      { header: 'numero_serie',     key: 'numero_serie',    width: 20 },
      { header: 'annee_pose',       key: 'annee_pose',      width: 12 },
      { header: 'commentaire',      key: 'commentaire',     width: 36 },
    ];
    wsArm.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0392B' } };
    });
    wsArm.addRow({
      intitule: 'AF-001', localisation: 'Carrefour rue de la Paix / rue Victor Hugo',
      latitude: 50.3231, longitude: 3.3901,
      type_controleur: 'UTC', marque: 'Siemens', modele: 'Sitraffic',
      numero_serie: 'NS-2023-001', annee_pose: 2015, commentaire: '',
    });
    wsArm.getRow(2).font = { color: { argb: 'FF888888' }, italic: true };

    // ── Feux tricolores ───────────────────────────────────────────────────────
    const wsFeux = wb.addWorksheet('Feux tricolores');
    wsFeux.columns = [
      { header: 'reference *',   key: 'reference',    width: 20 },
      { header: 'armoire',       key: 'armoire',      width: 20 },
      { header: 'localisation',  key: 'localisation', width: 36 },
      { header: 'latitude',      key: 'latitude',     width: 14 },
      { header: 'longitude',     key: 'longitude',    width: 14 },
      { header: 'type_feu',      key: 'type_feu',     width: 16 },
      { header: 'nb_feux',       key: 'nb_feux',      width: 10 },
      { header: 'technologie',   key: 'technologie',  width: 16 },
      { header: 'annee_pose',    key: 'annee_pose',   width: 12 },
      { header: 'etat_general',  key: 'etat_general', width: 18 },
      { header: 'commentaire',   key: 'commentaire',  width: 36 },
    ];
    wsFeux.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };
    });
    wsFeux.addRow({
      reference: 'FX-001', armoire: 'AF-001',
      localisation: 'Carrefour rue de la Paix', latitude: 50.3234, longitude: 3.3905,
      type_feu: 'vehicule', nb_feux: 3, technologie: 'led',
      annee_pose: 2018, etat_general: 'fonctionnel', commentaire: '',
    });
    wsFeux.getRow(2).font = { color: { argb: 'FF888888' }, italic: true };

    // ── Guide ─────────────────────────────────────────────────────────────────
    const wsGuide = wb.addWorksheet('Guide');
    wsGuide.columns = [
      { header: 'Champ', key: 'champ', width: 22 },
      { header: 'Valeurs acceptées / Notes', key: 'notes', width: 70 },
    ];
    wsGuide.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
    });
    [
      ['intitule *',      'OBLIGATOIRE — identifiant unique de l\'armoire (ex : AF-001). Si existant, mis à jour.'],
      ['reference *',     'OBLIGATOIRE — identifiant unique du feu (ex : FX-001). Si existant, mis à jour.'],
      ['armoire',         'Intitulé exact de l\'armoire (colonne intitule de la feuille Armoires).'],
      ['latitude',        'Nombre décimal (ex : 50.332622). Laisser vide si inconnu.'],
      ['longitude',       'Nombre décimal (ex : 3.387064). Laisser vide si inconnu.'],
      ['type_feu',        'Valeurs acceptées : vehicule | pieton | velo | tram (défaut : vehicule)'],
      ['nb_feux',         'Nombre de feux du carrefour. Ex : 3'],
      ['technologie',     'Valeurs acceptées : led | incandescent | autre (défaut : led)'],
      ['etat_general',    'Valeurs acceptées : fonctionnel | defaillant | hors_service | en_travaux (défaut : fonctionnel)'],
      ['type_controleur', 'Type de contrôleur de l\'armoire. Ex : UTC, UTMC…'],
      ['annee_pose',      'Année sur 4 chiffres. Ex : 2015'],
      ['commentaire',     'Texte libre. Facultatif.'],
    ].forEach(r => wsGuide.addRow({ champ: r[0], notes: r[1] }));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="gabarit_feux_tricolores.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('downloadTemplate feux', err);
    error(res, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /import
// ─────────────────────────────────────────────────────────────────────────────
exports.importFeux = async (req, res) => {
  if (!req.file) return error(res, 'Aucun fichier fourni', 400);

  const clearFirst = req.query.clearFirst === 'true';
  const results = {
    purged:  false,
    armoires:{ created: 0, updated: 0, errors: [] },
    feux:    { created: 0, updated: 0, errors: [] },
  };

  try {
    // ── 1. Purge optionnelle ──────────────────────────────────────────────────
    if (clearFirst) {
      const { error: e1 } = await supabaseAdmin.from('feux_tricolores')
        .delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (e1) throw new Error(`Purge feux_tricolores : ${e1.message}`);
      const { error: e2 } = await supabaseAdmin.from('armoires_feux')
        .delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (e2) throw new Error(`Purge armoires_feux : ${e2.message}`);
      results.purged = true;
    }

    // ── 2. Lecture du fichier Excel ───────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);

    // ── 3. Parse feuille Armoires ─────────────────────────────────────────────
    const armPayloads = [];
    const wsArm = wb.getWorksheet('Armoires');
    if (wsArm) {
      wsArm.eachRow({ includeEmpty: false }, (row, rowNum) => {
        if (rowNum === 1) return;
        const c = n => row.getCell(n).value;
        const intitule = parseStr(c(1));
        if (!intitule) return;
        armPayloads.push({
          intitule,
          localisation:    parseStr(c(2)),
          latitude:        parseNum(c(3), 6),
          longitude:       parseNum(c(4), 6),
          type_controleur: parseStr(c(5)),
          marque:          parseStr(c(6)),
          modele:          parseStr(c(7)),
          numero_serie:    parseStr(c(8)),
          annee_pose:      parseYear(c(9)),
          commentaire:     parseStr(c(10)),
        });
      });
    }

    // Dédupliquer par intitule (garder la dernière occurrence)
    const armMap = new Map();
    for (const a of armPayloads) armMap.set(a.intitule, a);
    const armDeduped = [...armMap.values()];

    // ── 4. Upsert armoires ────────────────────────────────────────────────────
    if (armDeduped.length > 0) {
      const { data: existingArm } = await supabaseAdmin
        .from('armoires_feux').select('intitule');
      const existingIntitules = new Set((existingArm || []).map(a => a.intitule));

      for (const batch of chunkArray(armDeduped, BATCH)) {
        const { error: e } = await supabaseAdmin
          .from('armoires_feux')
          .upsert(batch, { onConflict: 'intitule', ignoreDuplicates: false });
        if (e) results.armoires.errors.push(e.message);
        else {
          batch.forEach(a => {
            if (existingIntitules.has(a.intitule)) results.armoires.updated++;
            else results.armoires.created++;
          });
        }
      }
    }

    // ── 5. Map intitulé → id ──────────────────────────────────────────────────
    const { data: allArmoires } = await supabaseAdmin
      .from('armoires_feux').select('id, intitule');
    const armoireMap = new Map((allArmoires || []).map(a => [a.intitule, a.id]));

    // ── 6. Parse feuille Feux tricolores ──────────────────────────────────────
    const feuxPayloads = [];
    const wsFeux = wb.getWorksheet('Feux tricolores');
    if (wsFeux) {
      wsFeux.eachRow({ includeEmpty: false }, (row, rowNum) => {
        if (rowNum === 1) return;
        const c = n => row.getCell(n).value;
        const reference = parseStr(c(1));
        if (!reference) return;
        const armoireIntitule = parseStr(c(2));
        feuxPayloads.push({
          reference,
          armoire_id:   armoireIntitule ? (armoireMap.get(armoireIntitule) || null) : null,
          localisation: parseStr(c(3)),
          latitude:     parseNum(c(4), 6),
          longitude:    parseNum(c(5), 6),
          type_feu:     normalizeTypeFeu(c(6)),
          nb_feux:      parseIntVal(c(7)) || 3,
          technologie:  normalizeTechnologie(c(8)),
          annee_pose:   parseYear(c(9)),
          etat_general: normalizeEtat(c(10)),
          commentaire:  parseStr(c(11)),
        });
      });
    }

    // Dédupliquer par reference (garder la dernière occurrence)
    const feuxMap = new Map();
    for (const f of feuxPayloads) feuxMap.set(f.reference, f);
    const feuxDeduped = [...feuxMap.values()];

    // ── 7. Upsert feux ────────────────────────────────────────────────────────
    if (feuxDeduped.length > 0) {
      const { data: existingFeux } = await supabaseAdmin
        .from('feux_tricolores').select('reference');
      const existingRefs = new Set((existingFeux || []).map(f => f.reference));

      for (const batch of chunkArray(feuxDeduped, BATCH)) {
        const { error: e } = await supabaseAdmin
          .from('feux_tricolores')
          .upsert(batch, { onConflict: 'reference', ignoreDuplicates: false });
        if (e) results.feux.errors.push(e.message);
        else {
          batch.forEach(f => {
            if (existingRefs.has(f.reference)) results.feux.updated++;
            else results.feux.created++;
          });
        }
      }
    }

    return success(res, results);
  } catch (e) {
    console.error('importFeux', e);
    return error(res, e.message || 'Erreur lors de l\'import');
  }
};
