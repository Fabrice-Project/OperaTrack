const { supabaseAdmin } = require('../utils/supabase');
const { success, error } = require('../utils/response');

// ── Constantes métier ─────────────────────────────────────────────────────────

const FACTEURS_KWEF = {
  electricite:    1.0,
  gaz:           11.6,   // kWh/m³ PCS moyen
  fioul:         10.35,  // kWh/litre PCS
  chaleur_urbain: 0.77,  // facteur moyen France
  eau:           null,   // pas de conversion
};

const OBJECTIFS_DECRET = { 2030: 0.40, 2040: 0.50, 2050: 0.60 };

function toKWhef(consommation, fluide, unite) {
  const f = FACTEURS_KWEF[fluide];
  if (!f) return null;
  let kwh = parseFloat(consommation) || 0;
  if (unite === 'MWh') kwh *= 1000;
  return Math.round(kwh * f * 100) / 100;
}

function calculTrajectoire(conso_ref, conso_actuelle, annee_ref = 2020) {
  const annee_courante = new Date().getFullYear();
  const objectif_2030 = conso_ref * (1 - OBJECTIFS_DECRET[2030]);
  const objectif_2040 = conso_ref * (1 - OBJECTIFS_DECRET[2040]);
  const objectif_2050 = conso_ref * (1 - OBJECTIFS_DECRET[2050]);

  const annees_total    = 2030 - annee_ref;
  const annees_ecoules  = annee_courante - annee_ref;
  const reduction_lineaire_attendue = annees_ecoules > 0
    ? (OBJECTIFS_DECRET[2030] / annees_total) * annees_ecoules
    : 0;
  const reduction_actuelle = conso_ref > 0 ? (conso_ref - conso_actuelle) / conso_ref : 0;

  return {
    objectif_2030: Math.round(objectif_2030),
    objectif_2040: Math.round(objectif_2040),
    objectif_2050: Math.round(objectif_2050),
    reduction_actuelle_pct:  Math.round(reduction_actuelle * 1000) / 10,
    reduction_attendue_pct:  Math.round(reduction_lineaire_attendue * 1000) / 10,
    en_trajectoire: reduction_actuelle >= reduction_lineaire_attendue,
    ecart_objectif_2030: Math.round(conso_actuelle - objectif_2030),
  };
}

// ── COMPTEURS ─────────────────────────────────────────────────────────────────

const getCompteurs = async (req, res) => {
  const { batiment_id, armoire_id } = req.query;
  let q = supabaseAdmin.from('compteurs').select('*').order('fluide');
  if (batiment_id) q = q.eq('batiment_id', batiment_id);
  if (armoire_id)  q = q.eq('armoire_id', armoire_id);
  const { data, error: dbErr } = await q;
  if (dbErr) return error(res, dbErr.message);
  success(res, data || []);
};

const createCompteur = async (req, res) => {
  const {
    batiment_id, armoire_id, fluide, reference_compteur, fournisseur,
    unite, actif, date_pose, commentaire,
    annee_reference, conso_reference, objectif_valeur_absolue_2030,
  } = req.body;
  const { data, error: dbErr } = await supabaseAdmin
    .from('compteurs')
    .insert([{
      batiment_id: batiment_id || null,
      armoire_id:  armoire_id  || null,
      fluide, reference_compteur, fournisseur, unite,
      actif: actif !== false,
      date_pose: date_pose || null,
      commentaire: commentaire || null,
      annee_reference: annee_reference || null,
      conso_reference: conso_reference || null,
      objectif_valeur_absolue_2030: objectif_valeur_absolue_2030 || null,
    }])
    .select()
    .single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data, 201);
};

const updateCompteur = async (req, res) => {
  const { id } = req.params;
  const {
    fluide, reference_compteur, fournisseur, unite, actif,
    date_pose, commentaire, annee_reference, conso_reference, objectif_valeur_absolue_2030,
  } = req.body;
  const payload = {};
  if (fluide                        !== undefined) payload.fluide                        = fluide;
  if (reference_compteur            !== undefined) payload.reference_compteur            = reference_compteur;
  if (fournisseur                   !== undefined) payload.fournisseur                   = fournisseur;
  if (unite                         !== undefined) payload.unite                         = unite;
  if (actif                         !== undefined) payload.actif                         = actif;
  if (date_pose                     !== undefined) payload.date_pose                     = date_pose || null;
  if (commentaire                   !== undefined) payload.commentaire                   = commentaire || null;
  if (annee_reference               !== undefined) payload.annee_reference               = annee_reference || null;
  if (conso_reference               !== undefined) payload.conso_reference               = conso_reference || null;
  if (objectif_valeur_absolue_2030  !== undefined) payload.objectif_valeur_absolue_2030  = objectif_valeur_absolue_2030 || null;
  payload.updated_at = new Date().toISOString();

  const { data, error: dbErr } = await supabaseAdmin
    .from('compteurs').update(payload).eq('id', id).select().single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data);
};

const deleteCompteur = async (req, res) => {
  const { id } = req.params;
  const { error: dbErr } = await supabaseAdmin.from('compteurs').delete().eq('id', id);
  if (dbErr) return error(res, dbErr.message);
  success(res, { deleted: true });
};

// ── RELEVÉS ───────────────────────────────────────────────────────────────────

const getReleves = async (req, res) => {
  const { id: compteur_id } = req.params;
  const { annee } = req.query;
  let q = supabaseAdmin
    .from('releves_consommation')
    .select('*')
    .eq('compteur_id', compteur_id)
    .order('periode', { ascending: false });
  if (annee) {
    q = q.gte('periode', `${annee}-01-01`).lte('periode', `${annee}-12-31`);
  }
  const { data, error: dbErr } = await q;
  if (dbErr) return error(res, dbErr.message);
  success(res, data || []);
};

const createReleve = async (req, res) => {
  const { id: compteur_id } = req.params;
  const {
    periode, index_debut, index_fin, consommation,
    montant_ht, numero_facture, source,
  } = req.body;

  // Calcul auto si index fournis
  let conso = parseFloat(consommation);
  if ((!conso || isNaN(conso)) && index_fin != null && index_debut != null) {
    conso = parseFloat(index_fin) - parseFloat(index_debut);
  }
  if (!conso || isNaN(conso) || conso < 0) return error(res, 'Consommation invalide', 400);

  // Normaliser la période au 1er du mois
  const periodeDate = new Date(periode);
  periodeDate.setDate(1);
  const periodeStr = periodeDate.toISOString().split('T')[0];

  const { data, error: dbErr } = await supabaseAdmin
    .from('releves_consommation')
    .insert([{
      compteur_id,
      periode: periodeStr,
      index_debut: index_debut != null ? parseFloat(index_debut) : null,
      index_fin:   index_fin   != null ? parseFloat(index_fin)   : null,
      consommation: conso,
      montant_ht:  montant_ht  != null ? parseFloat(montant_ht)  : null,
      numero_facture: numero_facture || null,
      source: source || 'manuel',
    }])
    .select()
    .single();
  if (dbErr) {
    if (dbErr.code === '23505') return error(res, 'Un relevé existe déjà pour ce mois', 409);
    return error(res, dbErr.message);
  }
  success(res, data, 201);
};

const updateReleve = async (req, res) => {
  const { id } = req.params;
  const {
    periode, index_debut, index_fin, consommation,
    montant_ht, numero_facture,
  } = req.body;
  const payload = {};
  if (periode        !== undefined) payload.periode        = periode;
  if (index_debut    !== undefined) payload.index_debut    = index_debut    != null ? parseFloat(index_debut)    : null;
  if (index_fin      !== undefined) payload.index_fin      = index_fin      != null ? parseFloat(index_fin)      : null;
  if (consommation   !== undefined) payload.consommation   = parseFloat(consommation);
  if (montant_ht     !== undefined) payload.montant_ht     = montant_ht     != null ? parseFloat(montant_ht)     : null;
  if (numero_facture !== undefined) payload.numero_facture = numero_facture || null;
  payload.updated_at = new Date().toISOString();

  const { data, error: dbErr } = await supabaseAdmin
    .from('releves_consommation').update(payload).eq('id', id).select().single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data);
};

const deleteReleve = async (req, res) => {
  const { id } = req.params;
  const { error: dbErr } = await supabaseAdmin.from('releves_consommation').delete().eq('id', id);
  if (dbErr) return error(res, dbErr.message);
  success(res, { deleted: true });
};

// ── IMPORT CSV ────────────────────────────────────────────────────────────────

const importCSV = async (req, res) => {
  const { id: compteur_id } = req.params;
  const { rows } = req.body; // [{ periode, consommation, montant_ht?, numero_facture? }]

  if (!Array.isArray(rows) || rows.length === 0) return error(res, 'Aucune donnée à importer', 400);

  // Validation
  const erreurs = [];
  rows.forEach((row, i) => {
    if (!/^\d{4}-\d{2}$/.test(row.periode || '')) {
      erreurs.push(`Ligne ${i + 1} : période invalide (format attendu : AAAA-MM)`);
    }
    if (isNaN(parseFloat(row.consommation))) {
      erreurs.push(`Ligne ${i + 1} : consommation non numérique`);
    }
  });
  if (erreurs.length > 0) return error(res, erreurs.join(' | '), 422);

  const inserts = rows.map(row => ({
    compteur_id,
    periode:       `${row.periode}-01`,
    consommation:  parseFloat(row.consommation),
    montant_ht:    row.montant_ht    != null ? parseFloat(row.montant_ht)    : null,
    numero_facture: row.numero_facture || null,
    source: 'import_csv',
  }));

  const { data, error: dbErr } = await supabaseAdmin
    .from('releves_consommation')
    .upsert(inserts, { onConflict: 'compteur_id,periode' })
    .select();
  if (dbErr) return error(res, dbErr.message);
  success(res, { imported: data.length });
};

// ── SYNTHÈSE ÉNERGIE — BÂTIMENT ──────────────────────────────────────────────

const getSyntheseEnergieBatiment = async (req, res) => {
  const { id: batiment_id } = req.params;
  const { annee } = req.query;
  const anneeN = parseInt(annee) || new Date().getFullYear() - 1; // défaut : année précédente

  // Récupérer bâtiment + compteurs + relevés N et N-1
  const [
    { data: batiment,  error: e1 },
    { data: compteurs, error: e2 },
    { data: dt,        error: e3 },
  ] = await Promise.all([
    supabaseAdmin.from('batiments').select('*').eq('id', batiment_id).single(),
    supabaseAdmin.from('compteurs').select('*').eq('batiment_id', batiment_id).eq('actif', true),
    supabaseAdmin.from('decret_tertiaire').select('*').eq('batiment_id', batiment_id).maybeSingle(),
  ]);
  if (e1) return error(res, e1.message);
  if (e2) return error(res, e2.message);

  const compteurIds = (compteurs || []).map(c => c.id);

  // Relevés année N et N-1
  const [{ data: relevesN }, { data: relevesN1 }] = await Promise.all([
    compteurIds.length ? supabaseAdmin
      .from('releves_consommation')
      .select('*')
      .in('compteur_id', compteurIds)
      .gte('periode', `${anneeN}-01-01`)
      .lte('periode', `${anneeN}-12-31`) : { data: [] },
    compteurIds.length ? supabaseAdmin
      .from('releves_consommation')
      .select('*')
      .in('compteur_id', compteurIds)
      .gte('periode', `${anneeN - 1}-01-01`)
      .lte('periode', `${anneeN - 1}-12-31`) : { data: [] },
  ]);

  // Agréger par fluide
  const cptMap = {};
  (compteurs || []).forEach(c => { cptMap[c.id] = c; });

  const aggreg = (releves) => {
    const byFluide = {};
    (releves || []).forEach(r => {
      const cpt = cptMap[r.compteur_id];
      if (!cpt) return;
      const fl = cpt.fluide;
      if (!byFluide[fl]) byFluide[fl] = { conso: 0, montant: 0, kwef: 0, unite: cpt.unite };
      byFluide[fl].conso   += parseFloat(r.consommation) || 0;
      byFluide[fl].montant += parseFloat(r.montant_ht)   || 0;
      const kwef = toKWhef(r.consommation, fl, cpt.unite);
      if (kwef !== null) byFluide[fl].kwef += kwef;
    });
    return byFluide;
  };

  const fluideN  = aggreg(relevesN);
  const fluideN1 = aggreg(relevesN1);

  const totalKwefN  = Object.values(fluideN).reduce((s, f) => s + (f.kwef || 0), 0);
  const totalMontantN = Object.values(fluideN).reduce((s, f) => s + (f.montant || 0), 0);
  const surface = parseFloat(batiment?.surface_plancher_m2) || 0;
  const intensite = surface > 0 ? Math.round((totalKwefN / surface) * 10) / 10 : null;

  // Trajectoire Décret Tertiaire
  let trajectoire = null;
  if (dt?.soumis_decret && dt?.conso_ref_kwh) {
    trajectoire = calculTrajectoire(dt.conso_ref_kwh, totalKwefN, dt.annee_reference);
    trajectoire.conso_ref_kwh    = dt.conso_ref_kwh;
    trajectoire.annee_reference  = dt.annee_reference;
    trajectoire.identifiant_operat = dt.identifiant_operat;
    trajectoire.soumis_decret    = true;
    trajectoire.totalKwefN       = Math.round(totalKwefN);
  }

  // Graphique mensuel par fluide pour l'année N
  const mensuelN = {};
  (relevesN || []).forEach(r => {
    const cpt = cptMap[r.compteur_id];
    if (!cpt) return;
    const mois = r.periode.substring(0, 7); // YYYY-MM
    if (!mensuelN[mois]) mensuelN[mois] = {};
    mensuelN[mois][cpt.fluide] = (mensuelN[mois][cpt.fluide] || 0) + parseFloat(r.consommation);
  });

  success(res, {
    batiment,
    anneeN,
    compteurs: compteurs || [],
    fluideN,
    fluideN1,
    totalKwefN: Math.round(totalKwefN),
    totalMontantN: Math.round(totalMontantN),
    intensite,
    trajectoire,
    decret_tertiaire: dt || null,
    mensuelN,
  });
};

// ── SYNTHÈSE ÉNERGIE — ARMOIRE ────────────────────────────────────────────────

const getSyntheseEnergieArmoire = async (req, res) => {
  const { id: armoire_id } = req.params;
  const { annee } = req.query;
  const anneeN = parseInt(annee) || new Date().getFullYear() - 1;

  const [
    { data: armoire,   error: e1 },
    { data: compteurs, error: e2 },
    { data: points,    error: e3 },
  ] = await Promise.all([
    supabaseAdmin.from('armoires_eclairage').select('*').eq('id', armoire_id).single(),
    supabaseAdmin.from('compteurs').select('*').eq('armoire_id', armoire_id).eq('actif', true),
    supabaseAdmin.from('points_lumineux').select('id, type_lampe, puissance_w, annee_pose, etat_general').eq('armoire_id', armoire_id),
  ]);
  if (e1) return error(res, e1.message);

  const compteurIds = (compteurs || []).map(c => c.id);
  const [{ data: relevesN }, { data: relevesN1 }] = await Promise.all([
    compteurIds.length ? supabaseAdmin
      .from('releves_consommation').select('*')
      .in('compteur_id', compteurIds)
      .gte('periode', `${anneeN}-01-01`)
      .lte('periode', `${anneeN}-12-31`) : { data: [] },
    compteurIds.length ? supabaseAdmin
      .from('releves_consommation').select('*')
      .in('compteur_id', compteurIds)
      .gte('periode', `${anneeN - 1}-01-01`)
      .lte('periode', `${anneeN - 1}-12-31`) : { data: [] },
  ]);

  const totalConsoN  = (relevesN  || []).reduce((s, r) => s + (parseFloat(r.consommation) || 0), 0);
  const totalConsoN1 = (relevesN1 || []).reduce((s, r) => s + (parseFloat(r.consommation) || 0), 0);
  const totalMontantN = (relevesN || []).reduce((s, r) => s + (parseFloat(r.montant_ht) || 0), 0);

  const nbPL = (points || []).length;
  const ratioPL = nbPL > 0 ? Math.round(totalConsoN / nbPL) : null;

  // Mensuel pour graphique
  const mensuelN = {};
  const mensuelN1 = {};
  (relevesN  || []).forEach(r => { mensuelN[r.periode.substring(0, 7)]  = parseFloat(r.consommation); });
  (relevesN1 || []).forEach(r => { mensuelN1[r.periode.substring(0, 7)] = parseFloat(r.consommation); });

  // Analyse LED
  const ledPts  = (points || []).filter(p => p.type_lampe === 'led');
  const autresPts = (points || []).filter(p => p.type_lampe !== 'led' && p.type_lampe);
  const puissanceMoyenneLed    = ledPts.length > 0 ? ledPts.reduce((s, p) => s + (p.puissance_w || 0), 0) / ledPts.length : null;
  const puissanceMoyenneAutre  = autresPts.length > 0 ? autresPts.reduce((s, p) => s + (p.puissance_w || 0), 0) / autresPts.length : null;

  success(res, {
    armoire,
    anneeN,
    compteurs: compteurs || [],
    totalConsoN: Math.round(totalConsoN),
    totalConsoN1: Math.round(totalConsoN1),
    totalMontantN: Math.round(totalMontantN),
    nbPL,
    ratioPL,
    mensuelN,
    mensuelN1,
    points: points || [],
    analyseLED: {
      nbLED: ledPts.length,
      nbAutres: autresPts.length,
      puissanceMoyenneLed,
      puissanceMoyenneAutre,
    },
  });
};

// ── DASHBOARD ÉNERGIE GLOBAL ──────────────────────────────────────────────────

const getEnergieDashboard = async (req, res) => {
  const { annee } = req.query;
  const anneeN = parseInt(annee) || new Date().getFullYear() - 1;

  const [
    { data: batiments },
    { data: compteurs },
    { data: decrets },
    { data: relevesN },
  ] = await Promise.all([
    supabaseAdmin.from('batiments').select('id, intitule, surface_plancher_m2'),
    supabaseAdmin.from('compteurs').select('*').eq('actif', true),
    supabaseAdmin.from('decret_tertiaire').select('*'),
    supabaseAdmin.from('releves_consommation')
      .select('compteur_id, consommation, montant_ht, periode')
      .gte('periode', `${anneeN}-01-01`)
      .lte('periode', `${anneeN}-12-31`),
  ]);

  const cptMap = {};
  (compteurs || []).forEach(c => { cptMap[c.id] = c; });

  const dtMap = {};
  (decrets || []).forEach(d => { dtMap[d.batiment_id] = d; });

  // Conso par bâtiment
  const consoByBat = {};
  const montantByBat = {};
  let totalMontantEP = 0;

  (relevesN || []).forEach(r => {
    const cpt = cptMap[r.compteur_id];
    if (!cpt) return;
    const conso = parseFloat(r.consommation) || 0;
    const montant = parseFloat(r.montant_ht) || 0;

    if (cpt.batiment_id) {
      if (!consoByBat[cpt.batiment_id]) consoByBat[cpt.batiment_id] = { kwef: 0, montant: 0 };
      const kwef = toKWhef(conso, cpt.fluide, cpt.unite);
      if (kwef !== null) consoByBat[cpt.batiment_id].kwef += kwef;
      consoByBat[cpt.batiment_id].montant += montant;
    }
    if (cpt.armoire_id) {
      totalMontantEP += montant;
    }
  });

  // Classement bâtiments
  const classement = (batiments || [])
    .map(b => {
      const surface = parseFloat(b.surface_plancher_m2) || 0;
      const kwef    = consoByBat[b.id]?.kwef    || 0;
      const montant = consoByBat[b.id]?.montant  || 0;
      const intensite = surface > 0 ? Math.round(kwef / surface) : null;
      const dt = dtMap[b.id];
      let trajectoire = null;
      if (dt?.soumis_decret && dt?.conso_ref_kwh && kwef > 0) {
        const t = calculTrajectoire(dt.conso_ref_kwh, kwef, dt.annee_reference);
        trajectoire = { en_trajectoire: t.en_trajectoire, reduction_actuelle_pct: t.reduction_actuelle_pct };
      }
      return { id: b.id, intitule: b.intitule, surface, kwef: Math.round(kwef), montant: Math.round(montant), intensite, trajectoire, soumis_decret: dt?.soumis_decret || false };
    })
    .sort((a, b) => (b.intensite || 0) - (a.intensite || 0));

  const totalMontantBat = classement.reduce((s, b) => s + b.montant, 0);
  const totalKwef = classement.reduce((s, b) => s + b.kwef, 0);

  // Bilan Décret Tertiaire
  const soumis = classement.filter(b => b.soumis_decret && b.kwef > 0);
  const enTrajectoire = soumis.filter(b => b.trajectoire?.en_trajectoire).length;

  success(res, {
    anneeN,
    classement,
    totalMontantBat: Math.round(totalMontantBat),
    totalMontantEP: Math.round(totalMontantEP),
    totalMontantGlobal: Math.round(totalMontantBat + totalMontantEP),
    totalKwef: Math.round(totalKwef),
    decretTertiaire: {
      nb_soumis: soumis.length,
      nb_en_trajectoire: enTrajectoire,
      nb_hors_trajectoire: soumis.length - enTrajectoire,
    },
  });
};

// ── DÉCRET TERTIAIRE ─────────────────────────────────────────────────────────

const getDecretTertiaire = async (req, res) => {
  const { id: batiment_id } = req.params;
  const { data, error: dbErr } = await supabaseAdmin
    .from('decret_tertiaire').select('*').eq('batiment_id', batiment_id).maybeSingle();
  if (dbErr) return error(res, dbErr.message);
  success(res, data || null);
};

const upsertDecretTertiaire = async (req, res) => {
  const { id: batiment_id } = req.params;
  const {
    annee_reference, conso_ref_kwh, objectif_2030, objectif_2040, objectif_2050,
    soumis_decret, identifiant_operat,
  } = req.body;

  // Calcul automatique des objectifs si non fournis
  const ref = parseFloat(conso_ref_kwh) || 0;
  const payload = {
    batiment_id,
    annee_reference: annee_reference || 2020,
    conso_ref_kwh: ref || null,
    objectif_2030: objectif_2030 != null ? parseFloat(objectif_2030) : (ref ? Math.round(ref * (1 - OBJECTIFS_DECRET[2030])) : null),
    objectif_2040: objectif_2040 != null ? parseFloat(objectif_2040) : (ref ? Math.round(ref * (1 - OBJECTIFS_DECRET[2040])) : null),
    objectif_2050: objectif_2050 != null ? parseFloat(objectif_2050) : (ref ? Math.round(ref * (1 - OBJECTIFS_DECRET[2050])) : null),
    soumis_decret: soumis_decret !== false,
    identifiant_operat: identifiant_operat || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error: dbErr } = await supabaseAdmin
    .from('decret_tertiaire')
    .upsert(payload, { onConflict: 'batiment_id' })
    .select().single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data);
};

// ── EXPORT OPERAT ─────────────────────────────────────────────────────────────

const exportOperat = async (req, res) => {
  const { annee } = req.query;
  const anneeN = parseInt(annee) || new Date().getFullYear() - 1;

  const [{ data: decrets }, { data: compteurs }, { data: releves }] = await Promise.all([
    supabaseAdmin.from('decret_tertiaire').select('*, batiments(intitule)').eq('soumis_decret', true),
    supabaseAdmin.from('compteurs').select('*').not('batiment_id', 'is', null).eq('actif', true),
    supabaseAdmin.from('releves_consommation')
      .select('compteur_id, consommation, periode')
      .gte('periode', `${anneeN}-01-01`)
      .lte('periode', `${anneeN}-12-31`),
  ]);

  const cptMap = {};
  (compteurs || []).forEach(c => { cptMap[c.id] = c; });

  // Agréger par bâtiment + fluide
  const rows = {};
  (releves || []).forEach(r => {
    const cpt = cptMap[r.compteur_id];
    if (!cpt || !cpt.batiment_id) return;
    const key = `${cpt.batiment_id}__${cpt.fluide}`;
    if (!rows[key]) rows[key] = { batiment_id: cpt.batiment_id, fluide: cpt.fluide, unite: cpt.unite, total: 0 };
    rows[key].total += parseFloat(r.consommation) || 0;
  });

  const dtMap = {};
  (decrets || []).forEach(d => { dtMap[d.batiment_id] = d; });

  const TYPE_MAP = { electricite: 'ELECTRICITE', gaz: 'GAZ', fioul: 'FIOUL', chaleur_urbain: 'RESEAU_CHALEUR', eau: 'EAU' };

  const csvLines = ['identifiant_operat,annee,type_energie,consommation_kwh,unite'];
  Object.values(rows).forEach(row => {
    const dt = dtMap[row.batiment_id];
    if (!dt?.identifiant_operat) return;
    const kwh = row.fluide === 'eau' ? row.total : (toKWhef(row.total, row.fluide, row.unite) || row.total);
    csvLines.push(`${dt.identifiant_operat},${anneeN},${TYPE_MAP[row.fluide] || row.fluide},${Math.round(kwh)},kWh`);
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=export_operat_${anneeN}.csv`);
  res.send('﻿' + csvLines.join('\r\n'));
};

module.exports = {
  getCompteurs, createCompteur, updateCompteur, deleteCompteur,
  getReleves, createReleve, updateReleve, deleteReleve, importCSV,
  getSyntheseEnergieBatiment, getSyntheseEnergieArmoire,
  getEnergieDashboard,
  getDecretTertiaire, upsertDecretTertiaire,
  exportOperat,
};
