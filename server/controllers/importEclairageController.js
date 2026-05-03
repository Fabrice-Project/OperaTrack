/**
 * Import Excel — Armoires & Points lumineux
 *
 * GET  /api/v1/import/eclairage/template  → télécharge le gabarit Excel
 * POST /api/v1/import/eclairage           → importe un fichier Excel rempli
 */

const ExcelJS  = require('exceljs');
const { supabaseAdmin } = require('../utils/supabase');
const { success, error } = require('../utils/response');

// ── Valeurs énumérées ─────────────────────────────────────────────────────────
const TYPE_LAMPE_VALS   = ['led', 'sodium_hp', 'fluocompacte', 'mercure', 'autre'];
const ETAT_GENERAL_VALS = ['fonctionnel', 'defaillant', 'hors_service', 'en_travaux'];

// ── Helper : extrait la valeur brute d'une cellule ExcelJS ────────────────────
// ExcelJS peut retourner des objets richText, formule ou hyperlien
function cellVal(raw) {
  if (raw == null) return null;
  // Objet richText : { richText: [{text: '...'}, ...] }
  if (typeof raw === 'object' && Array.isArray(raw.richText)) {
    return raw.richText.map(r => r.text || '').join('');
  }
  // Résultat de formule : { formula: '...', result: ... }
  if (typeof raw === 'object' && raw.result !== undefined) {
    return cellVal(raw.result); // récursif pour gérer les résultats complexes
  }
  // Hyperlien : { text: '...', hyperlink: '...' }
  if (typeof raw === 'object' && raw.text != null && raw.hyperlink != null) {
    return raw.text;
  }
  // Date object — retourné tel quel pour parseYear
  if (raw instanceof Date) return raw;
  return raw;
}

// ── Helper : extrait une chaîne propre ou null ────────────────────────────────
function parseStr(raw) {
  const v = cellVal(raw);
  if (v == null) return null;
  if (v instanceof Date) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// ── Helper : parse un nombre décimal arrondi à `decimals` chiffres ────────────
function parseNum(raw, decimals = 6) {
  const v = cellVal(raw);
  if (v == null || v === '') return null;
  if (v instanceof Date) return null;
  const n = parseFloat(String(v).replace(',', '.').replace(/\s/g, ''));
  if (isNaN(n)) return null;
  // Arrondi pour éliminer les artefacts flottants IEEE 754
  return Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// ── Helper : parse un nombre ENTIER (watts, etc.) ────────────────────────────
function parseInt_(raw) {
  const v = cellVal(raw);
  if (v == null || v === '') return null;
  if (v instanceof Date) return null;
  const n = parseFloat(String(v).replace(',', '.').replace(/\s/g, ''));
  return isNaN(n) ? null : Math.round(n);
}

// ── Helper : parse une année entière ou null ──────────────────────────────────
function parseYear(raw) {
  const v = cellVal(raw);
  if (v == null || v === '') return null;
  // Excel stocke parfois les années comme des objets Date
  if (v instanceof Date) return v.getFullYear();
  const n = parseInt(String(v), 10);
  return isNaN(n) ? null : n;
}

// ── Helper : normalise une valeur enum (minuscule + trim) ─────────────────────
function normalizeEnum(raw, allowed) {
  const v = parseStr(raw);
  if (v == null) return null;
  const lower = v.toLowerCase();
  return allowed.includes(lower) ? lower : null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  GET /template
// ─────────────────────────────────────────────────────────────────────────────
exports.downloadTemplate = async (req, res) => {
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'OpéraTrack';
    wb.created = new Date();

    // ── Feuille Armoires ──────────────────────────────────────────────────────
    const wsArm = wb.addWorksheet('Armoires');
    wsArm.columns = [
      { header: 'intitule *',      key: 'intitule',      width: 28 },
      { header: 'localisation',    key: 'localisation',  width: 32 },
      { header: 'latitude',        key: 'latitude',      width: 14 },
      { header: 'longitude',       key: 'longitude',     width: 14 },
      { header: 'type_armoire',    key: 'type_armoire',  width: 20 },
      { header: 'puissance_kva',   key: 'puissance_kva', width: 14 },
      { header: 'numero_serie',    key: 'numero_serie',  width: 20 },
      { header: 'annee_pose',      key: 'annee_pose',    width: 12 },
      { header: 'commentaire',     key: 'commentaire',   width: 36 },
    ];

    // Style en-tête
    wsArm.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A5C' } };
    });

    // Ligne exemple
    wsArm.addRow({
      intitule:    'ARM-001 Rue du Général de Gaulle',
      localisation: 'Rue du Général de Gaulle, 59220 Denain',
      latitude:    50.3231,
      longitude:   3.3901,
      type_armoire: 'Coffret de rue',
      puissance_kva: 6,
      numero_serie: 'NS-2023-001',
      annee_pose:  2012,
      commentaire: 'Armoire rénovée en 2023',
    });
    wsArm.getRow(2).font = { color: { argb: 'FF888888' }, italic: true };

    // ── Feuille Points lumineux ───────────────────────────────────────────────
    const wsPL = wb.addWorksheet('Points lumineux');
    wsPL.columns = [
      { header: 'reference *',     key: 'reference',     width: 20 },
      { header: 'armoire',         key: 'armoire',       width: 32 },
      { header: 'localisation',    key: 'localisation',  width: 36 },
      { header: 'latitude',        key: 'latitude',      width: 14 },
      { header: 'longitude',       key: 'longitude',     width: 14 },
      { header: 'type_support',    key: 'type_support',  width: 20 },
      { header: 'hauteur_m',       key: 'hauteur_m',     width: 12 },
      { header: 'type_lampe',      key: 'type_lampe',    width: 18 },
      { header: 'puissance_w',     key: 'puissance_w',   width: 12 },
      { header: 'annee_pose',      key: 'annee_pose',    width: 12 },
      { header: 'etat_general',    key: 'etat_general',  width: 18 },
      { header: 'commentaire',     key: 'commentaire',   width: 36 },
    ];

    wsPL.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } };
    });

    wsPL.addRow({
      reference:    'PL-0001',
      armoire:      'ARM-001 Rue du Général de Gaulle',
      localisation: 'Rue du Général de Gaulle n°12, 59220 Denain',
      latitude:    50.3234,
      longitude:   3.3905,
      type_support: 'Mât acier',
      hauteur_m:   6,
      type_lampe:  'led',
      puissance_w:  50,
      annee_pose:   2018,
      etat_general: 'fonctionnel',
      commentaire:  '',
    });
    wsPL.getRow(2).font = { color: { argb: 'FF888888' }, italic: true };

    // ── Feuille Guide ─────────────────────────────────────────────────────────
    const wsGuide = wb.addWorksheet('Guide');
    wsGuide.columns = [{ header: 'Champ', key: 'champ', width: 22 }, { header: 'Valeurs acceptées / Notes', key: 'notes', width: 60 }];
    wsGuide.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
    });
    const guideRows = [
      ['intitule *',   'OBLIGATOIRE — identifiant unique de l\'armoire. Si une armoire avec ce nom existe déjà, elle sera mise à jour.'],
      ['reference *',  'OBLIGATOIRE — identifiant unique du point lumineux. Si une ref. existe déjà, le point sera mis à jour.'],
      ['armoire',      'Intitulé exact de l\'armoire (doit correspondre à la feuille Armoires). Laisser vide si inconnu.'],
      ['latitude',     'Nombre décimal (ex: 50.3231). Laisser vide si inconnu.'],
      ['longitude',    'Nombre décimal (ex: 3.3901). Laisser vide si inconnu.'],
      ['type_lampe',   'Valeurs acceptées : led | sodium_hp | fluocompacte | mercure | autre'],
      ['etat_general', 'Valeurs acceptées : fonctionnel | defaillant | hors_service | en_travaux'],
      ['puissance_kva','Nombre décimal (kVA). Ex : 6'],
      ['puissance_w',  'Nombre entier (watts). Ex : 50'],
      ['hauteur_m',    'Nombre décimal (mètres). Ex : 6'],
      ['annee_pose',   'Année sur 4 chiffres. Ex : 2018'],
      ['commentaire',  'Texte libre. Facultatif.'],
    ];
    guideRows.forEach(r => wsGuide.addRow({ champ: r[0], notes: r[1] }));

    // ── Envoi ─────────────────────────────────────────────────────────────────
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="gabarit_eclairage.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('downloadTemplate', err);
    error(res, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /import
// ─────────────────────────────────────────────────────────────────────────────
exports.importEclairage = async (req, res) => {
  if (!req.file) return error(res, 'Aucun fichier fourni', 400);

  const clearFirst = req.query.clearFirst === 'true' || req.body?.clearFirst === true;

  const results = {
    purged:         false,
    armoires:       { created: 0, updated: 0, errors: [] },
    pointsLumineux: { created: 0, updated: 0, errors: [] },
  };

  try {
    // ── Purge optionnelle ─────────────────────────────────────────────────────
    if (clearFirst) {
      // Points lumineux d'abord (FK → armoires_eclairage)
      const { error: e1 } = await supabaseAdmin
        .from('points_lumineux')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // supprime tout
      if (e1) throw new Error(`Purge points_lumineux : ${e1.message}`);

      const { error: e2 } = await supabaseAdmin
        .from('armoires_eclairage')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (e2) throw new Error(`Purge armoires_eclairage : ${e2.message}`);

      results.purged = true;
    }

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);

    // ── Feuille Armoires ──────────────────────────────────────────────────────
    const wsArm = wb.getWorksheet('Armoires');
    if (wsArm) {
      const armRowNums = [];
      wsArm.eachRow({ includeEmpty: false }, (_, rowNum) => {
        if (rowNum > 1) armRowNums.push(rowNum);
      });

      for (const rowNum of armRowNums) {
        const row = wsArm.getRow(rowNum);
        // Lecture cellule par cellule (plus robuste que row.values)
        const c = n => row.getCell(n).value;

        const intitule = parseStr(c(1));
        if (!intitule) continue; // ignorer lignes vides ou ligne exemple

        const payload = {
          intitule,
          localisation:  parseStr(c(2)),
          latitude:      parseNum(c(3), 6),
          longitude:     parseNum(c(4), 6),
          type_armoire:  parseStr(c(5)),
          puissance_kva: parseNum(c(6), 3),
          numero_serie:  parseStr(c(7)),
          annee_pose:    parseYear(c(8)),
          commentaire:   parseStr(c(9)),
        };

        try {
          const { data: existing } = await supabaseAdmin
            .from('armoires_eclairage')
            .select('id')
            .eq('intitule', intitule)
            .maybeSingle();

          if (existing) {
            const { error: upErr } = await supabaseAdmin
              .from('armoires_eclairage')
              .update(payload)
              .eq('id', existing.id);
            if (upErr) throw upErr;
            results.armoires.updated++;
          } else {
            const { error: insErr } = await supabaseAdmin
              .from('armoires_eclairage')
              .insert(payload);
            if (insErr) throw insErr;
            results.armoires.created++;
          }
        } catch (e) {
          results.armoires.errors.push(`Ligne ${rowNum} (${intitule}) : ${e.message || e}`);
        }
      }
    }

    // ── Construire map intitulé → id pour les armoires ────────────────────────
    const { data: allArmoires } = await supabaseAdmin
      .from('armoires_eclairage')
      .select('id, intitule');
    const armoireMap = {};
    (allArmoires || []).forEach(a => { armoireMap[a.intitule] = a.id; });

    // ── Feuille Points lumineux ───────────────────────────────────────────────
    const wsPL = wb.getWorksheet('Points lumineux');
    if (wsPL) {
      const plRowNums = [];
      wsPL.eachRow({ includeEmpty: false }, (_, rowNum) => {
        if (rowNum > 1) plRowNums.push(rowNum);
      });

      for (const rowNum of plRowNums) {
        const row = wsPL.getRow(rowNum);
        const c = n => row.getCell(n).value;

        const reference = parseStr(c(1));
        if (!reference) continue;

        const armoireIntitule = parseStr(c(2));
        const armoire_id = armoireIntitule ? (armoireMap[armoireIntitule] || null) : null;

        const etatGen = normalizeEnum(c(11), ETAT_GENERAL_VALS) || 'fonctionnel';

        const payload = {
          reference,
          armoire_id,
          localisation: parseStr(c(3)),
          latitude:     parseNum(c(4), 6),
          longitude:    parseNum(c(5), 6),
          type_support: parseStr(c(6)),
          hauteur_m:    parseNum(c(7), 2),
          type_lampe:   normalizeEnum(c(8), TYPE_LAMPE_VALS),
          puissance_w:  parseInt_(c(9)),   // entier — watts
          annee_pose:   parseYear(c(10)),
          etat_general: etatGen,
          commentaire:  parseStr(c(12)),
        };

        try {
          const { data: existing } = await supabaseAdmin
            .from('points_lumineux')
            .select('id')
            .eq('reference', reference)
            .maybeSingle();

          if (existing) {
            const { error: upErr } = await supabaseAdmin
              .from('points_lumineux')
              .update(payload)
              .eq('id', existing.id);
            if (upErr) throw upErr;
            results.pointsLumineux.updated++;
          } else {
            const { error: insErr } = await supabaseAdmin
              .from('points_lumineux')
              .insert(payload);
            if (insErr) throw insErr;
            results.pointsLumineux.created++;
          }
        } catch (e) {
          results.pointsLumineux.errors.push(`Ligne ${rowNum} (${reference}) : ${e.message || e}`);
        }
      }
    }

    return success(res, results);
  } catch (e) {
    console.error('importEclairage', e);
    return error(res, e.message || 'Erreur lors de l\'import');
  }
};
