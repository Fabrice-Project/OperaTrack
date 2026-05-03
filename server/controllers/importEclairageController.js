/**
 * Import Excel — Armoires & Points lumineux
 *
 * GET  /api/v1/import/eclairage/template        → gabarit Excel
 * POST /api/v1/import/eclairage                 → import (batch)
 * POST /api/v1/import/eclairage/geocode         → géocodage inversé des armoires sans adresse
 */

const https   = require('https');
const ExcelJS = require('exceljs');
const { supabaseAdmin } = require('../utils/supabase');
const { success, error } = require('../utils/response');

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers — extraction cellule ExcelJS
// ─────────────────────────────────────────────────────────────────────────────

/** Extrait la valeur brute d'une cellule ExcelJS (richText, formule, hyperlien) */
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

function parseInt_(raw) {
  const v = cellVal(raw);
  if (v == null || v === '' || v instanceof Date) return null;
  const n = parseFloat(String(v).replace(',', '.').replace(/\s/g, ''));
  return isNaN(n) ? null : Math.round(n);
}

function parseYear(raw) {
  const v = cellVal(raw);
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.getFullYear();
  const n = parseInt(String(v), 10);
  return isNaN(n) ? null : n;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers — type_lampe : mapping fuzzy depuis descriptions libres
// ─────────────────────────────────────────────────────────────────────────────
const TYPE_LAMPE_VALS   = ['led', 'sodium_hp', 'fluocompacte', 'mercure', 'autre'];
const ETAT_GENERAL_VALS = ['fonctionnel', 'defaillant', 'hors_service', 'en_travaux'];

/**
 * Détecte le type de lampe depuis une description libre.
 * Exemples : "Sodium Haute Pression Tub 150W" → sodium_hp
 *            "NAV 100 LED"                    → led
 *            "LENSOFLEX_32LED_350mA"          → led
 *            "Ballon Fluorescent 125W"        → fluocompacte
 *            "Iodure Métal Tub 70W"           → autre
 */
function detectTypeLampe(raw) {
  const v = parseStr(raw);
  if (!v) return null;
  const lower = v.toLowerCase();

  // Correspondance exacte enum
  if (TYPE_LAMPE_VALS.includes(lower)) return lower;

  // LED — détection large (contient "led", "leds", noms de modules LED connus)
  if (/led|cpot|lensoflex|fortimo|baroled|ledgine|circle led|tabled/.test(lower)) return 'led';

  // Sodium haute pression (SHP / SON / NAV / SAP)
  if (/sodium|son-|son\b|nav\b|nav\s|shp\b|sap\b|SON-T/.test(lower)) return 'sodium_hp';

  // Fluocompacte / fluorescent
  if (/fluocompact|fluorescent|fluo/.test(lower)) return 'fluocompacte';

  // Vapeur de mercure
  if (/mercure|mercury|\bhpm\b|\bhme\b/.test(lower)) return 'mercure';

  // Tout le reste (iodures métalliques, incandescent, inconnu…)
  return 'autre';
}

function normalizeEtat(raw) {
  const v = parseStr(raw);
  if (!v) return 'fonctionnel';
  const lower = v.toLowerCase();
  return ETAT_GENERAL_VALS.includes(lower) ? lower : 'fonctionnel';
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers — batch Supabase
// ─────────────────────────────────────────────────────────────────────────────
const BATCH = 400; // lignes par appel Supabase

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Géocodage inversé — Nominatim (OpenStreetMap)
// ─────────────────────────────────────────────────────────────────────────────
function httpsGetJSON(url) {
  return new Promise(resolve => {
    https.get(url, {
      headers: {
        'User-Agent':       'OperaTrack/1.0 (suivi-patrimoine@ville-denain.fr)',
        'Accept-Language':  'fr,fr-FR',
      },
    }, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
    }).on('error', () => resolve(null));
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse`
            + `?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`
            + `&format=json&addressdetails=1`;
  const data = await httpsGetJSON(url);
  if (!data?.address) return null;
  const a = data.address;
  const parts = [];
  if (a.house_number) parts.push(a.house_number);
  const voie = a.road || a.pedestrian || a.footway || a.path;
  if (voie) parts.push(voie);
  const city = a.city || a.town || a.village || a.municipality || a.hamlet;
  if (a.postcode && city) parts.push(`${a.postcode} ${city}`);
  else if (city)          parts.push(city);
  return parts.length ? parts.join(', ') : null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  GET /template
// ─────────────────────────────────────────────────────────────────────────────
exports.downloadTemplate = async (req, res) => {
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'OpéraTrack';
    wb.created = new Date();

    // ── Armoires ──────────────────────────────────────────────────────────────
    const wsArm = wb.addWorksheet('Armoires');
    wsArm.columns = [
      { header: 'intitule *',    key: 'intitule',      width: 28 },
      { header: 'localisation',  key: 'localisation',  width: 32 },
      { header: 'latitude',      key: 'latitude',      width: 14 },
      { header: 'longitude',     key: 'longitude',     width: 14 },
      { header: 'type_armoire',  key: 'type_armoire',  width: 20 },
      { header: 'puissance_kva', key: 'puissance_kva', width: 14 },
      { header: 'numero_serie',  key: 'numero_serie',  width: 20 },
      { header: 'annee_pose',    key: 'annee_pose',    width: 12 },
      { header: 'commentaire',   key: 'commentaire',   width: 36 },
    ];
    wsArm.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A5C' } };
    });
    wsArm.addRow({ intitule: 'ARM-001', localisation: '', latitude: 50.3231, longitude: 3.3901, type_armoire: 'Coffret de rue', puissance_kva: 6, numero_serie: 'NS-2023-001', annee_pose: 2012, commentaire: '' });
    wsArm.getRow(2).font = { color: { argb: 'FF888888' }, italic: true };

    // ── Points lumineux ───────────────────────────────────────────────────────
    const wsPL = wb.addWorksheet('Points lumineux');
    wsPL.columns = [
      { header: 'reference *',   key: 'reference',     width: 20 },
      { header: 'armoire',       key: 'armoire',       width: 20 },
      { header: 'localisation',  key: 'localisation',  width: 36 },
      { header: 'latitude',      key: 'latitude',      width: 14 },
      { header: 'longitude',     key: 'longitude',     width: 14 },
      { header: 'type_support',  key: 'type_support',  width: 20 },
      { header: 'hauteur_m',     key: 'hauteur_m',     width: 12 },
      { header: 'type_lampe',    key: 'type_lampe',    width: 30 },
      { header: 'puissance_w',   key: 'puissance_w',   width: 12 },
      { header: 'annee_pose',    key: 'annee_pose',    width: 12 },
      { header: 'etat_general',  key: 'etat_general',  width: 18 },
      { header: 'commentaire',   key: 'commentaire',   width: 36 },
    ];
    wsPL.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } };
    });
    wsPL.addRow({ reference: 'PL-0001', armoire: 'ARM-001', localisation: '', latitude: 50.3234, longitude: 3.3905, type_support: 'Mât acier', hauteur_m: 6, type_lampe: 'led', puissance_w: 50, annee_pose: 2018, etat_general: 'fonctionnel', commentaire: '' });
    wsPL.getRow(2).font = { color: { argb: 'FF888888' }, italic: true };

    // ── Guide ─────────────────────────────────────────────────────────────────
    const wsGuide = wb.addWorksheet('Guide');
    wsGuide.columns = [{ header: 'Champ', key: 'champ', width: 22 }, { header: 'Valeurs acceptées / Notes', key: 'notes', width: 70 }];
    wsGuide.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
    });
    [
      ['intitule *',   'OBLIGATOIRE — identifiant unique de l\'armoire (ex : DEN-008). Si existant, mis à jour.'],
      ['reference *',  'OBLIGATOIRE — identifiant unique du point lumineux (ex : DEN-007_002). Si existant, mis à jour.'],
      ['armoire',      'Intitulé exact de l\'armoire (ex : DEN-007). Doit correspondre à la feuille Armoires.'],
      ['latitude',     'Nombre décimal (ex : 50.332622). Laisser vide si inconnu.'],
      ['longitude',    'Nombre décimal (ex : 3.387064). Laisser vide si inconnu.'],
      ['type_lampe',   'Valeurs acceptées : led | sodium_hp | fluocompacte | mercure | autre\nDescriptions libres acceptées : "Sodium Haute Pression Tub 150W" → sodium_hp, "NAV 100 LED" → led, etc.'],
      ['etat_general', 'Valeurs acceptées : fonctionnel | defaillant | hors_service | en_travaux (défaut : fonctionnel)'],
      ['puissance_kva','Nombre décimal (kVA). Ex : 6.227'],
      ['puissance_w',  'Nombre entier (watts). Ex : 150'],
      ['hauteur_m',    'Nombre décimal (mètres). Ex : 6'],
      ['annee_pose',   'Année sur 4 chiffres. Ex : 2012'],
      ['commentaire',  'Texte libre (marque, modèle, notes…). Facultatif.'],
    ].forEach(r => wsGuide.addRow({ champ: r[0], notes: r[1] }));

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
//  POST /import  — batch processing, pas de géocodage (trop lent)
// ─────────────────────────────────────────────────────────────────────────────
exports.importEclairage = async (req, res) => {
  if (!req.file) return error(res, 'Aucun fichier fourni', 400);

  const clearFirst = req.query.clearFirst === 'true';
  const results = {
    purged:         false,
    armoires:       { created: 0, updated: 0, errors: [] },
    pointsLumineux: { created: 0, updated: 0, errors: [] },
  };

  try {
    // ── 1. Purge optionnelle ──────────────────────────────────────────────────
    if (clearFirst) {
      const { error: e1 } = await supabaseAdmin.from('points_lumineux')
        .delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (e1) throw new Error(`Purge points_lumineux : ${e1.message}`);
      const { error: e2 } = await supabaseAdmin.from('armoires_eclairage')
        .delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (e2) throw new Error(`Purge armoires_eclairage : ${e2.message}`);
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
          localisation:  parseStr(c(2)),
          latitude:      parseNum(c(3), 6),
          longitude:     parseNum(c(4), 6),
          type_armoire:  parseStr(c(5)),
          puissance_kva: parseNum(c(6), 3),
          numero_serie:  parseStr(c(7)),
          annee_pose:    parseYear(c(8)),
          commentaire:   parseStr(c(9)),
        });
      });
    }

    // ── 4. Upsert armoires en batch (onConflict: intitule) ───────────────────
    // Récupérer les IDs existants pour séparer créés / mis à jour
    if (armPayloads.length > 0) {
      const { data: existingArm } = await supabaseAdmin
        .from('armoires_eclairage').select('intitule');
      const existingIntitules = new Set((existingArm || []).map(a => a.intitule));

      for (const batch of chunkArray(armPayloads, BATCH)) {
        const { error: e } = await supabaseAdmin
          .from('armoires_eclairage')
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

    // ── 5. Map intitulé → id (après insertion) ────────────────────────────────
    const { data: allArmoires } = await supabaseAdmin
      .from('armoires_eclairage').select('id, intitule');
    const armoireMap = new Map((allArmoires || []).map(a => [a.intitule, a.id]));

    // ── 6. Parse feuille Points lumineux ──────────────────────────────────────
    const plPayloads = [];
    const wsPL = wb.getWorksheet('Points lumineux');
    if (wsPL) {
      wsPL.eachRow({ includeEmpty: false }, (row, rowNum) => {
        if (rowNum === 1) return;
        const c = n => row.getCell(n).value;
        const reference = parseStr(c(1));
        if (!reference) return;
        const armoireIntitule = parseStr(c(2));
        plPayloads.push({
          reference,
          armoire_id:   armoireIntitule ? (armoireMap.get(armoireIntitule) || null) : null,
          localisation: parseStr(c(3)),
          latitude:     parseNum(c(4), 6),
          longitude:    parseNum(c(5), 6),
          type_support: parseStr(c(6)),
          hauteur_m:    parseNum(c(7), 2),
          type_lampe:   detectTypeLampe(c(8)),
          puissance_w:  parseInt_(c(9)),
          annee_pose:   parseYear(c(10)),
          etat_general: normalizeEtat(c(11)),
          commentaire:  parseStr(c(12)),
        });
      });
    }

    // ── 7. Upsert points lumineux en batch (onConflict: reference) ───────────
    if (plPayloads.length > 0) {
      const { data: existingPL } = await supabaseAdmin
        .from('points_lumineux').select('reference');
      const existingRefs = new Set((existingPL || []).map(p => p.reference));

      for (const batch of chunkArray(plPayloads, BATCH)) {
        const { error: e } = await supabaseAdmin
          .from('points_lumineux')
          .upsert(batch, { onConflict: 'reference', ignoreDuplicates: false });
        if (e) results.pointsLumineux.errors.push(e.message);
        else {
          batch.forEach(p => {
            if (existingRefs.has(p.reference)) results.pointsLumineux.updated++;
            else results.pointsLumineux.created++;
          });
        }
      }
    }

    return success(res, results);
  } catch (e) {
    console.error('importEclairage', e);
    return error(res, e.message || 'Erreur lors de l\'import');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /geocode  — géocode les armoires sans adresse (max 45 par appel)
// ─────────────────────────────────────────────────────────────────────────────
exports.geocodeArmoires = async (req, res) => {
  try {
    // Armoires avec coordonnées mais sans adresse
    const { data: armoires, error: fetchErr } = await supabaseAdmin
      .from('armoires_eclairage')
      .select('id, intitule, latitude, longitude')
      .is('localisation', null)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(45); // ~51s max, dans la limite Vercel

    if (fetchErr) return error(res, fetchErr.message);
    if (!armoires || armoires.length === 0) {
      return success(res, { geocoded: 0, remaining: 0 });
    }

    let geocoded = 0;
    for (const arm of armoires) {
      const adresse = await reverseGeocode(arm.latitude, arm.longitude);
      if (adresse) {
        await supabaseAdmin
          .from('armoires_eclairage')
          .update({ localisation: adresse })
          .eq('id', arm.id);
        geocoded++;
      }
      await sleep(1150);
    }

    // Compter les restantes
    const { count: remaining } = await supabaseAdmin
      .from('armoires_eclairage')
      .select('id', { count: 'exact', head: true })
      .is('localisation', null)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    return success(res, { geocoded, remaining: remaining || 0 });
  } catch (e) {
    console.error('geocodeArmoires', e);
    return error(res, e.message || 'Erreur lors du géocodage');
  }
};
