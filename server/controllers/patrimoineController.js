const { supabaseAdmin } = require('../utils/supabase');
const { success, error } = require('../utils/response');

// ── Helper : récupère TOUTES les lignes d'une requête Supabase par pagination ──
// Nécessaire car PostgREST plafonne à max-rows (1000 par défaut) quoi qu'on fasse.
// queryFactory() doit retourner un nouveau query builder à chaque appel.
async function fetchAll(queryFactory, pageSize = 1000) {
  const allData = [];
  let from = 0;
  while (true) {
    const { data, error: e } = await queryFactory().range(from, from + pageSize - 1);
    if (e) return { data: null, error: e };
    if (!data || data.length === 0) break;
    allData.push(...data);
    if (data.length < pageSize) break; // dernière page
    from += pageSize;
  }
  return { data: allData, error: null };
}

// ── VOIRIE ────────────────────────────────────────────────────────────────────

const getVoirie = async (req, res) => {
  const { data: troncons, error: dbErr } = await supabaseAdmin
    .from('troncons_voirie')
    .select('*')
    .order('intitule');
  if (dbErr) return error(res, dbErr.message);

  const totalSurface = (troncons || []).reduce(
    (acc, t) => acc + ((parseFloat(t.longueur_ml) || 0) * (parseFloat(t.largeur_m) || 0)), 0
  );
  const statsByEtat = (troncons || []).reduce((acc, t) => {
    const k = t.etat_general || 'inconnu';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  success(res, { troncons: troncons || [], kpis: { totalSurface, statsByEtat, total: (troncons || []).length } });
};

const createTroncon = async (req, res) => {
  const { intitule, categorie, longueur_ml, largeur_m, revetement, annee_derniere_refection, etat_general, commentaire, geom_points } = req.body;
  let { latitude, longitude } = req.body;
  // Auto-calcul du centroïde si lat/lng absents mais geom_points fourni
  if ((!latitude || !longitude) && geom_points && geom_points.length > 0) {
    // geom_points stockés comme [[lat, lng], ...] ou [{lat, lng}, ...]
    const sum = geom_points.reduce((acc, p) => ({
      lat: acc.lat + (Array.isArray(p) ? p[0] : p.lat),
      lng: acc.lng + (Array.isArray(p) ? p[1] : p.lng),
    }), { lat: 0, lng: 0 });
    latitude  = sum.lat / geom_points.length;
    longitude = sum.lng / geom_points.length;
  }
  const { data, error: dbErr } = await supabaseAdmin
    .from('troncons_voirie')
    .insert([{ intitule, categorie, longueur_ml, largeur_m, revetement, annee_derniere_refection, etat_general: etat_general || 'moyen', latitude, longitude, commentaire, geom_points: geom_points || null }])
    .select()
    .single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data, 201);
};

const getTroncon = async (req, res) => {
  const { id } = req.params;
  const [{ data: troncon, error: e1 }, { data: interventions, error: e2 }] = await Promise.all([
    supabaseAdmin.from('troncons_voirie').select('*').eq('id', id).single(),
    supabaseAdmin.from('interventions_patrimoine')
      .select('*')
      .eq('theme', 'voirie')
      .eq('element_id', id)
      .order('date_signalement', { ascending: false }),
  ]);
  if (e1) return error(res, e1.message);
  success(res, { ...troncon, interventions: interventions || [] });
};

const updateTroncon = async (req, res) => {
  const { id } = req.params;
  const {
    intitule, categorie, longueur_ml, largeur_m, revetement,
    annee_derniere_refection, etat_general, latitude, longitude, commentaire, geom_points,
  } = req.body;
  const payload = {};
  if (intitule                 !== undefined) payload.intitule                 = intitule;
  if (categorie                !== undefined) payload.categorie                = categorie;
  if (longueur_ml              !== undefined) payload.longueur_ml              = longueur_ml;
  if (largeur_m                !== undefined) payload.largeur_m                = largeur_m;
  if (revetement               !== undefined) payload.revetement               = revetement;
  if (annee_derniere_refection !== undefined) payload.annee_derniere_refection = annee_derniere_refection;
  if (etat_general             !== undefined) payload.etat_general             = etat_general;
  if (latitude                 !== undefined) payload.latitude                 = latitude;
  if (longitude                !== undefined) payload.longitude                = longitude;
  if (commentaire              !== undefined) payload.commentaire              = commentaire;
  if (geom_points              !== undefined) payload.geom_points              = geom_points;

  const { data, error: dbErr } = await supabaseAdmin
    .from('troncons_voirie')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data);
};

const deleteTroncon = async (req, res) => {
  const { id } = req.params;
  const { error: dbErr } = await supabaseAdmin.from('troncons_voirie').delete().eq('id', id);
  if (dbErr) return error(res, dbErr.message);
  success(res, { deleted: true });
};

// ── ÉCLAIRAGE ─────────────────────────────────────────────────────────────────

const getArmoires = async (req, res) => {
  const [{ data: armoires, error: e1 }, { data: plAll, error: e2 }] = await Promise.all([
    supabaseAdmin.from('armoires_eclairage').select('*').order('intitule'),
    fetchAll(() => supabaseAdmin.from('points_lumineux').select('armoire_id, etat_general')),
  ]);
  if (e1) return error(res, e1.message);

  // Compter les PL et les défaillants par armoire
  const countMap = {};
  const defMap = {};
  (plAll || []).forEach(p => {
    const aid = p.armoire_id;
    if (!aid) return;
    countMap[aid] = (countMap[aid] || 0) + 1;
    if (p.etat_general === 'defaillant' || p.etat_general === 'hors_service') {
      defMap[aid] = (defMap[aid] || 0) + 1;
    }
  });

  const result = (armoires || []).map(a => ({
    ...a,
    nb_points_lumineux: countMap[a.id] || 0,
    nb_defaillants: defMap[a.id] || 0,
  }));
  success(res, result);
};

const createArmoire = async (req, res) => {
  const { data, error: dbErr } = await supabaseAdmin
    .from('armoires_eclairage')
    .insert([req.body])
    .select()
    .single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data, 201);
};

const getArmoire = async (req, res) => {
  const { id } = req.params;
  const [{ data: armoire, error: e1 }, { data: points, error: e2 }, { data: interventions, error: e3 }] = await Promise.all([
    supabaseAdmin.from('armoires_eclairage').select('*').eq('id', id).single(),
    supabaseAdmin.from('points_lumineux').select('*').eq('armoire_id', id).order('reference'),
    supabaseAdmin.from('interventions_patrimoine')
      .select('*')
      .eq('theme', 'armoire')
      .eq('element_id', id)
      .order('date_signalement', { ascending: false }),
  ]);
  if (e1) return error(res, e1.message);
  success(res, { ...armoire, points_lumineux: points || [], interventions: interventions || [] });
};

const updateArmoire = async (req, res) => {
  const { id } = req.params;
  const {
    intitule, localisation, latitude, longitude, commentaire,
    puissance_kva, annee_pose, type_armoire, numero_serie,
  } = req.body;
  const payload = {};
  if (intitule      !== undefined) payload.intitule      = intitule;
  if (localisation  !== undefined) payload.localisation  = localisation  || null;
  if (latitude      !== undefined) payload.latitude      = latitude      != null && latitude  !== '' ? parseFloat(latitude)  : null;
  if (longitude     !== undefined) payload.longitude     = longitude     != null && longitude !== '' ? parseFloat(longitude) : null;
  if (commentaire   !== undefined) payload.commentaire   = commentaire   || null;
  if (puissance_kva !== undefined) payload.puissance_kva = puissance_kva != null && puissance_kva !== '' ? parseFloat(puissance_kva) : null;
  if (annee_pose    !== undefined) payload.annee_pose    = annee_pose    != null && annee_pose    !== '' ? parseInt(annee_pose)      : null;
  if (type_armoire  !== undefined) payload.type_armoire  = type_armoire  || null;
  if (numero_serie  !== undefined) payload.numero_serie  = numero_serie  || null;

  const { data, error: dbErr } = await supabaseAdmin
    .from('armoires_eclairage')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data);
};

const getPointsLumineux = async (req, res) => {
  const { data, error: dbErr } = await fetchAll(() =>
    supabaseAdmin.from('points_lumineux')
      .select('*, armoires_eclairage(intitule, localisation)')
      .order('reference')
  );
  if (dbErr) return error(res, dbErr.message);
  success(res, data || []);
};

const createPointLumineux = async (req, res) => {
  const { reference, armoire_id, localisation, latitude, longitude, type_support, hauteur_m, type_lampe, puissance_w, annee_pose, etat_general } = req.body;
  const { data, error: dbErr } = await supabaseAdmin
    .from('points_lumineux')
    .insert([{ reference, armoire_id: armoire_id || null, localisation, latitude, longitude, type_support, hauteur_m, type_lampe, puissance_w, annee_pose, etat_general: etat_general || 'fonctionnel' }])
    .select()
    .single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data, 201);
};

const getPointLumineux = async (req, res) => {
  const { id } = req.params;
  const [{ data: pl, error: e1 }, { data: interventions, error: e2 }] = await Promise.all([
    supabaseAdmin.from('points_lumineux')
      .select('*, armoires_eclairage(intitule, localisation)')
      .eq('id', id)
      .single(),
    supabaseAdmin.from('interventions_patrimoine')
      .select('*')
      .eq('theme', 'eclairage')
      .eq('element_id', id)
      .order('date_signalement', { ascending: false }),
  ]);
  if (e1) return error(res, e1.message);
  success(res, { ...pl, interventions: interventions || [] });
};

const updatePointLumineux = async (req, res) => {
  const { id } = req.params;
  const {
    reference, armoire_id, localisation, latitude, longitude,
    type_support, hauteur_m, type_lampe, puissance_w, annee_pose,
    etat_general, commentaire,
  } = req.body;
  const payload = {};
  if (reference    !== undefined) payload.reference    = reference;
  if (armoire_id   !== undefined) payload.armoire_id   = armoire_id   || null;
  if (localisation !== undefined) payload.localisation = localisation || null;
  if (latitude     !== undefined) payload.latitude     = latitude     != null && latitude  !== '' ? parseFloat(latitude)  : null;
  if (longitude    !== undefined) payload.longitude    = longitude    != null && longitude !== '' ? parseFloat(longitude) : null;
  if (type_support !== undefined) payload.type_support = type_support || null;
  if (hauteur_m    !== undefined) payload.hauteur_m    = hauteur_m    != null && hauteur_m    !== '' ? parseFloat(hauteur_m)    : null;
  if (type_lampe   !== undefined) payload.type_lampe   = type_lampe   || null;
  if (puissance_w  !== undefined) payload.puissance_w  = puissance_w  != null && puissance_w  !== '' ? parseFloat(puissance_w)  : null;
  if (annee_pose   !== undefined) payload.annee_pose   = annee_pose   != null && annee_pose   !== '' ? parseInt(annee_pose)     : null;
  if (etat_general !== undefined) payload.etat_general = etat_general;
  if (commentaire  !== undefined) payload.commentaire  = commentaire  || null;

  const { data, error: dbErr } = await supabaseAdmin
    .from('points_lumineux')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data);
};

const getEclairageKpis = async (req, res) => {
  const { data: points, error: dbErr } = await fetchAll(() =>
    supabaseAdmin.from('points_lumineux').select('etat_general, type_lampe, puissance_w')
  );
  if (dbErr) return error(res, dbErr.message);

  const total = (points || []).length;
  const defaillants = (points || []).filter(p => p.etat_general === 'defaillant' || p.etat_general === 'hors_service').length;
  const led = (points || []).filter(p => p.type_lampe === 'led').length;
  const pctLed = total > 0 ? Math.round((led / total) * 100) : 0;

  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const { data: interventions } = await supabaseAdmin
    .from('interventions_patrimoine')
    .select('montant_ht')
    .eq('theme', 'eclairage')
    .eq('type_intervenant', 'prestataire')
    .gte('date_signalement', since.toISOString().split('T')[0]);

  const cout12Mois = (interventions || []).reduce((acc, i) => acc + (parseFloat(i.montant_ht) || 0), 0);

  success(res, { total, defaillants, pctLed, cout12Mois });
};

// ── BÂTIMENTS ─────────────────────────────────────────────────────────────────

const getBatiments = async (req, res) => {
  const [{ data: batiments, error: e1 }, { data: equip, error: e2 }] = await Promise.all([
    supabaseAdmin.from('batiments').select('*').order('intitule'),
    supabaseAdmin.from('equipements_batiments').select('batiment_id'),
  ]);
  if (e1) return error(res, e1.message);

  const countMap = {};
  (equip || []).forEach(e => { countMap[e.batiment_id] = (countMap[e.batiment_id] || 0) + 1; });

  const result = (batiments || []).map(b => ({ ...b, nb_equipements: countMap[b.id] || 0 }));
  success(res, result);
};

const createBatiment = async (req, res) => {
  const body = { ...req.body };
  if (!body.dpe_classe) body.dpe_classe = null;
  if (body.surface_plancher_m2 === '' || body.surface_plancher_m2 == null) body.surface_plancher_m2 = null;
  else body.surface_plancher_m2 = parseFloat(body.surface_plancher_m2);
  if (body.annee_construction === '' || body.annee_construction == null) body.annee_construction = null;
  else body.annee_construction = parseInt(body.annee_construction);

  const { data, error: dbErr } = await supabaseAdmin
    .from('batiments')
    .insert([body])
    .select()
    .single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data, 201);
};

const getBatiment = async (req, res) => {
  const { id } = req.params;
  const [{ data: batiment, error: e1 }, { data: equipements, error: e2 }, { data: interventions, error: e3 }] = await Promise.all([
    supabaseAdmin.from('batiments').select('*').eq('id', id).single(),
    supabaseAdmin.from('equipements_batiments').select('*').eq('batiment_id', id).order('categorie'),
    supabaseAdmin.from('interventions_patrimoine')
      .select('*')
      .eq('theme', 'batiment')
      .in('element_id', [id]) // interventions directes sur le bâtiment
      .order('date_signalement', { ascending: false })
      .limit(10),
  ]);
  if (e1) return error(res, e1.message);
  success(res, { ...batiment, equipements: equipements || [], interventions_recentes: interventions || [] });
};

const updateBatiment = async (req, res) => {
  const { id } = req.params;
  const {
    intitule, adresse, surface_plancher_m2, annee_construction,
    dpe_classe, latitude, longitude, commentaire,
  } = req.body;
  const payload = {};
  if (intitule            !== undefined) payload.intitule            = intitule;
  if (adresse             !== undefined) payload.adresse             = adresse             || null;
  if (surface_plancher_m2 !== undefined) payload.surface_plancher_m2 = surface_plancher_m2 != null && surface_plancher_m2 !== '' ? parseFloat(surface_plancher_m2) : null;
  if (annee_construction  !== undefined) payload.annee_construction  = annee_construction  != null && annee_construction  !== '' ? parseInt(annee_construction)    : null;
  if (dpe_classe          !== undefined) payload.dpe_classe          = dpe_classe          || null;
  if (latitude            !== undefined) payload.latitude            = latitude            != null && latitude  !== '' ? parseFloat(latitude)  : null;
  if (longitude           !== undefined) payload.longitude           = longitude           != null && longitude !== '' ? parseFloat(longitude) : null;
  if (commentaire         !== undefined) payload.commentaire         = commentaire         || null;

  const { data, error: dbErr } = await supabaseAdmin
    .from('batiments')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data);
};

const getEquipements = async (req, res) => {
  const { id } = req.params;
  const { data, error: dbErr } = await supabaseAdmin
    .from('equipements_batiments')
    .select('*')
    .eq('batiment_id', id)
    .order('categorie');
  if (dbErr) return error(res, dbErr.message);
  success(res, data || []);
};

const getAllEquipements = async (req, res) => {
  const [{ data: batiments, error: e1 }, { data: equipements, error: e2 }] = await Promise.all([
    supabaseAdmin.from('batiments').select('id, intitule'),
    supabaseAdmin.from('equipements_batiments').select('*').order('batiment_id').order('categorie'),
  ]);
  if (e1) return error(res, e1.message);
  const batMap = {};
  (batiments || []).forEach(b => { batMap[b.id] = b.intitule; });
  const result = (equipements || []).map(e => ({ ...e, batiment_intitule: batMap[e.batiment_id] || '—' }));
  success(res, result);
};

const createEquipement = async (req, res) => {
  const { id } = req.params;
  const {
    intitule, categorie, marque, modele,
    date_installation, date_prochain_controle, periodicite_controle_mois, commentaire,
  } = req.body;
  const payload = {
    batiment_id: id,
    intitule:     intitule     || '',
    categorie:    categorie    || null,
    marque:       marque       || null,
    modele:       modele       || null,
    date_installation:         date_installation         || null,
    date_prochain_controle:    date_prochain_controle    || null,
    periodicite_controle_mois: periodicite_controle_mois ? parseInt(periodicite_controle_mois) : null,
    commentaire:  commentaire  || null,
  };
  const { data, error: dbErr } = await supabaseAdmin
    .from('equipements_batiments')
    .insert([payload])
    .select()
    .single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data, 201);
};

const updateEquipement = async (req, res) => {
  const { id } = req.params;
  const {
    intitule, categorie, marque, modele,
    date_installation, date_prochain_controle, periodicite_controle_mois, commentaire,
  } = req.body;
  const payload = {};
  if (intitule                  !== undefined) payload.intitule                  = intitule;
  if (categorie                 !== undefined) payload.categorie                 = categorie    || null;
  if (marque                    !== undefined) payload.marque                    = marque       || null;
  if (modele                    !== undefined) payload.modele                    = modele       || null;
  if (date_installation         !== undefined) payload.date_installation         = date_installation         || null;
  if (date_prochain_controle    !== undefined) payload.date_prochain_controle    = date_prochain_controle    || null;
  if (periodicite_controle_mois !== undefined) payload.periodicite_controle_mois = periodicite_controle_mois ? parseInt(periodicite_controle_mois) : null;
  if (commentaire               !== undefined) payload.commentaire               = commentaire  || null;

  const { data, error: dbErr } = await supabaseAdmin
    .from('equipements_batiments')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data);
};

const deleteEquipement = async (req, res) => {
  const { id } = req.params;
  const { error: dbErr } = await supabaseAdmin.from('equipements_batiments').delete().eq('id', id);
  if (dbErr) return error(res, dbErr.message);
  success(res, { deleted: true });
};

// ── MARCHÉS VOIRIE ────────────────────────────────────────────────────────────

const getMarches = async (req, res) => {
  const { domaine } = req.query;

  let marchesQ = supabaseAdmin.from('marches_voirie').select('*').order('type_travaux').order('intitule');
  if (domaine) marchesQ = marchesQ.eq('domaine', domaine);

  // Les interventions liées à un marché ont le même domaine via leur theme
  // (voirie → theme=voirie, mobilier → theme=mobilier). On filtre selon domaine.
  let ivsQ = supabaseAdmin
    .from('interventions_patrimoine')
    .select('marche_id, montant_ht, date_signalement')
    .not('marche_id', 'is', null);
  if (domaine) ivsQ = ivsQ.eq('theme', domaine);

  const [
    { data: marches,     error: e1 },
    { data: engagements, error: e2 },
    { data: ivs,         error: e3 },
  ] = await Promise.all([marchesQ, supabaseAdmin.from('engagements_marche').select('*'), ivsQ]);
  if (e1) return error(res, e1.message);

  // Engagements par marché
  const engMap = {};
  (engagements || []).forEach(e => {
    if (!engMap[e.marche_id]) engMap[e.marche_id] = [];
    engMap[e.marche_id].push(e);
  });

  // Interventions cumulées par marché + exercice
  const ivMap = {};
  (ivs || []).forEach(iv => {
    const mid  = iv.marche_id;
    const year = iv.date_signalement
      ? new Date(iv.date_signalement).getFullYear()
      : new Date().getFullYear();
    if (!ivMap[mid]) ivMap[mid] = {};
    ivMap[mid][year] = (ivMap[mid][year] || 0) + (parseFloat(iv.montant_ht) || 0);
  });

  const result = (marches || []).map(m => {
    const ivEx = ivMap[m.id] || {};

    // Engagements enrichis avec le total des interventions de chaque exercice
    const engagements = (engMap[m.id] || [])
      .sort((a, b) => a.exercice - b.exercice)
      .map(eng => ({
        ...eng,
        total_interventions_ht: Math.round((ivEx[eng.exercice] || 0) * 100) / 100,
      }));

    // Exercices avec interventions mais sans engagement créé
    const engExercices = new Set(engagements.map(e => e.exercice));
    const orphanIv = Object.entries(ivEx)
      .filter(([yr]) => !engExercices.has(parseInt(yr)))
      .map(([yr, total_ht]) => ({ exercice: parseInt(yr), montant_engage_ht: null, total_interventions_ht: Math.round(total_ht * 100) / 100 }))
      .sort((a, b) => a.exercice - b.exercice);

    return {
      ...m,
      engagements,
      orphan_iv: orphanIv,
      total_engage:        engagements.reduce((s, e) => s + (parseFloat(e.montant_engage_ht) || 0), 0),
      total_mandate:       engagements.reduce((s, e) => s + (parseFloat(e.montant_mandate_ht) || 0), 0),
      total_interventions: Object.values(ivEx).reduce((s, v) => s + v, 0),
      interventions_par_exercice: Object.entries(ivEx)
        .map(([exercice, total_ht]) => ({ exercice: parseInt(exercice), total_ht }))
        .sort((a, b) => a.exercice - b.exercice),
    };
  });
  success(res, result);
};

const createMarche = async (req, res) => {
  const {
    intitule, numero_marche, type_travaux, prestataire,
    date_debut, date_fin, montant_ht, statut, description, domaine,
  } = req.body;
  const payload = {
    intitule, numero_marche: numero_marche || null,
    type_travaux: type_travaux || 'investissement',
    prestataire: prestataire || null,
    date_debut: date_debut || null, date_fin: date_fin || null,
    montant_ht: montant_ht != null && montant_ht !== '' ? parseFloat(montant_ht) : null,
    statut: statut || 'en_cours',
    description: description || null,
    domaine: domaine || 'voirie',
  };
  const { data, error: dbErr } = await supabaseAdmin
    .from('marches_voirie').insert([payload]).select().single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data, 201);
};

const getMarche = async (req, res) => {
  const { marcheId } = req.params;
  const [
    { data: marche,      error: e1 },
    { data: engagements, error: e2 },
    { data: ivs,         error: e3 },
  ] = await Promise.all([
    supabaseAdmin.from('marches_voirie').select('*').eq('id', marcheId).single(),
    supabaseAdmin.from('engagements_marche').select('*').eq('marche_id', marcheId).order('exercice'),
    supabaseAdmin.from('interventions_patrimoine')
      .select('montant_ht, date_signalement')
      .eq('marche_id', marcheId)
      .not('montant_ht', 'is', null),
  ]);
  if (e1) return error(res, e1.message);

  // Interventions cumulées par exercice (année du date_signalement)
  const ivByExercice = {};
  (ivs || []).forEach(iv => {
    const year = iv.date_signalement
      ? new Date(iv.date_signalement).getFullYear()
      : new Date().getFullYear();
    ivByExercice[year] = (ivByExercice[year] || 0) + (parseFloat(iv.montant_ht) || 0);
  });

  const total_engage        = (engagements || []).reduce((s, e) => s + (parseFloat(e.montant_engage_ht)  || 0), 0);
  const total_mandate       = (engagements || []).reduce((s, e) => s + (parseFloat(e.montant_mandate_ht) || 0), 0);
  const total_interventions = Object.values(ivByExercice).reduce((s, v) => s + v, 0);

  // Enrichir chaque engagement avec le total des interventions de son exercice
  const enrichedEngagements = (engagements || []).map(eng => ({
    ...eng,
    total_interventions_ht: Math.round((ivByExercice[eng.exercice] || 0) * 100) / 100,
  }));

  success(res, { ...marche, engagements: enrichedEngagements, total_engage, total_mandate, total_interventions });
};

const updateMarche = async (req, res) => {
  const { marcheId } = req.params;
  const { data, error: dbErr } = await supabaseAdmin
    .from('marches_voirie')
    .update(req.body)
    .eq('id', marcheId)
    .select()
    .single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data);
};

const deleteMarche = async (req, res) => {
  const { marcheId } = req.params;
  const { error: dbErr } = await supabaseAdmin.from('marches_voirie').delete().eq('id', marcheId);
  if (dbErr) return error(res, dbErr.message);
  success(res, { deleted: true });
};

const upsertEngagement = async (req, res) => {
  const { marcheId } = req.params;
  const { exercice, montant_engage_ht, montant_mandate_ht, create_only } = req.body;

  if (create_only) {
    // Mode "création uniquement" : ne pas écraser le montant autorisé si l'engagement existe déjà
    const { data: existing } = await supabaseAdmin
      .from('engagements_marche')
      .select('*')
      .eq('marche_id', marcheId)
      .eq('exercice', exercice)
      .single();

    if (existing) return success(res, existing); // Déjà renseigné manuellement — on ne touche pas

    const { data, error: dbErr } = await supabaseAdmin
      .from('engagements_marche')
      .insert([{
        marche_id: marcheId,
        exercice,
        montant_engage_ht: parseFloat(montant_engage_ht) || 0,
        montant_mandate_ht: 0,
      }])
      .select()
      .single();
    if (dbErr) return error(res, dbErr.message);
    return success(res, data, 201);
  }

  // Mode édition complète (EngagementModal) : upsert uniquement les champs fournis
  const record = { marche_id: marcheId, exercice };
  if (montant_engage_ht !== undefined) record.montant_engage_ht = parseFloat(montant_engage_ht) || 0;
  if (montant_mandate_ht !== undefined) record.montant_mandate_ht = parseFloat(montant_mandate_ht) || 0;

  const { data, error: dbErr } = await supabaseAdmin
    .from('engagements_marche')
    .upsert([record], { onConflict: 'marche_id,exercice' })
    .select()
    .single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data, 201);
};

const deleteEngagement = async (req, res) => {
  const { engId } = req.params;
  const { error: dbErr } = await supabaseAdmin.from('engagements_marche').delete().eq('id', engId);
  if (dbErr) return error(res, dbErr.message);
  success(res, { deleted: true });
};

const getInterventions = async (req, res) => {
  const { theme, element_id, statut } = req.query;
  let query = supabaseAdmin
    .from('interventions_patrimoine')
    .select('*')
    .order('date_signalement', { ascending: false });

  if (theme)      query = query.eq('theme', theme);
  if (element_id) query = query.eq('element_id', element_id);
  if (statut)     query = query.eq('statut', statut);

  const { data, error: dbErr } = await query;
  if (dbErr) return error(res, dbErr.message);
  success(res, data || []);
};

// ── MOBILIER URBAIN ───────────────────────────────────────────────────────────

const getMobilier = async (req, res) => {
  const { tronconId } = req.params;
  const { data, error: dbErr } = await supabaseAdmin
    .from('mobilier_urbain')
    .select('*')
    .eq('troncon_id', tronconId)
    .order('type')
    .order('created_at');
  if (dbErr) return error(res, dbErr.message);
  if (!data || data.length === 0) return success(res, []);

  // Nombre d'interventions par élément
  const ids = data.map(m => m.id);
  const { data: ivs } = await supabaseAdmin
    .from('interventions_patrimoine')
    .select('element_id')
    .eq('theme', 'mobilier')
    .in('element_id', ids);
  const ivCount = {};
  (ivs || []).forEach(iv => { ivCount[iv.element_id] = (ivCount[iv.element_id] || 0) + 1; });
  success(res, data.map(m => ({ ...m, nb_interventions: ivCount[m.id] || 0 })));
};

const createMobilier = async (req, res) => {
  const { tronconId } = req.params;
  const { type, quantite, etat_general, marque, reference_terrain, date_pose, latitude, longitude, commentaire } = req.body;
  const { data, error: dbErr } = await supabaseAdmin
    .from('mobilier_urbain')
    .insert([{
      troncon_id:        tronconId,
      type,
      quantite:          quantite          ? parseInt(quantite)         : 1,
      etat_general:      etat_general      || 'bon',
      marque:            marque            || null,
      reference_terrain: reference_terrain || null,
      date_pose:         date_pose         ? parseInt(date_pose)        : null,
      latitude:          latitude          ? parseFloat(latitude)       : null,
      longitude:         longitude         ? parseFloat(longitude)      : null,
      commentaire:       commentaire       || null,
    }])
    .select().single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data, 201);
};

const updateMobilier = async (req, res) => {
  const { id } = req.params;
  const { type, quantite, etat_general, marque, reference_terrain, date_pose, latitude, longitude, commentaire } = req.body;
  const payload = {};
  if (type              !== undefined) payload.type              = type;
  if (quantite          !== undefined) payload.quantite          = parseInt(quantite) || 1;
  if (etat_general      !== undefined) payload.etat_general      = etat_general;
  if (marque            !== undefined) payload.marque            = marque || null;
  if (reference_terrain !== undefined) payload.reference_terrain = reference_terrain || null;
  if (date_pose         !== undefined) payload.date_pose         = date_pose ? parseInt(date_pose) : null;
  if (latitude          !== undefined) payload.latitude          = latitude !== '' ? parseFloat(latitude) : null;
  if (longitude         !== undefined) payload.longitude         = longitude !== '' ? parseFloat(longitude) : null;
  if (commentaire       !== undefined) payload.commentaire       = commentaire || null;
  const { data, error: dbErr } = await supabaseAdmin
    .from('mobilier_urbain').update(payload).eq('id', id).select().single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data);
};

const deleteMobilier = async (req, res) => {
  const { id } = req.params;
  const { error: dbErr } = await supabaseAdmin.from('mobilier_urbain').delete().eq('id', id);
  if (dbErr) return error(res, dbErr.message);
  success(res, { deleted: true });
};

// ── INTERVENTIONS ─────────────────────────────────────────────────────────────

const createIntervention = async (req, res) => {
  const {
    theme, element_id, type_element, type_intervenant, prestataire_nom, numero_bc,
    reference_marche, marche_id, montant_ht, agent_nom, nombre_heures, montant_achat,
    categorie, nature, statut, type_maintenance,
    date_signalement, date_prevue, date_realisee, commentaire,
  } = req.body;
  const TYPE_ELEMENT_MAP = { voirie: 'troncon', eclairage: 'point_lumineux', batiment: 'batiment', mobilier: 'mobilier', armoire: 'armoire_eclairage' };
  const payload = {
    theme,
    element_id,
    type_element: type_element || TYPE_ELEMENT_MAP[theme] || theme,
    marche_id:    marche_id || null,
    type_intervenant: type_intervenant || 'prestataire',
    prestataire_nom:  prestataire_nom  || null,
    numero_bc:        numero_bc        || null,
    reference_marche: reference_marche || null,
    montant_ht:       montant_ht    != null && montant_ht    !== '' ? parseFloat(montant_ht)    : null,
    agent_nom:        agent_nom        || null,
    nombre_heures:    nombre_heures != null && nombre_heures !== '' ? parseFloat(nombre_heures) : null,
    montant_achat:    montant_achat != null && montant_achat !== '' ? parseFloat(montant_achat) : null,
    categorie:        categorie        || null,
    nature:           nature           || null,
    statut:           statut           || 'signalee',
    type_maintenance: type_maintenance || 'corrective',
    date_signalement: date_signalement || null,
    date_prevue:      date_prevue      || null,
    date_realisee:    date_realisee    || null,
    commentaire:      commentaire      || null,
  };
  const { data, error: dbErr } = await supabaseAdmin
    .from('interventions_patrimoine')
    .insert([payload])
    .select()
    .single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data, 201);
};

const getIntervention = async (req, res) => {
  const { id } = req.params;
  const { data, error: dbErr } = await supabaseAdmin
    .from('interventions_patrimoine')
    .select('*')
    .eq('id', id)
    .single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data);
};

const updateIntervention = async (req, res) => {
  const { id } = req.params;
  const {
    type_intervenant, prestataire_nom, numero_bc, reference_marche, marche_id,
    montant_ht, agent_nom, nombre_heures, montant_achat,
    categorie, nature, statut, type_maintenance,
    date_signalement, date_prevue, date_realisee, commentaire,
  } = req.body;
  const payload = {};
  if (marche_id        !== undefined) payload.marche_id        = marche_id || null;
  if (type_intervenant !== undefined) payload.type_intervenant = type_intervenant;
  if (prestataire_nom  !== undefined) payload.prestataire_nom  = prestataire_nom  || null;
  if (numero_bc        !== undefined) payload.numero_bc        = numero_bc        || null;
  if (reference_marche !== undefined) payload.reference_marche = reference_marche || null;
  if (montant_ht       !== undefined) payload.montant_ht       = montant_ht    !== '' && montant_ht    != null ? parseFloat(montant_ht)    : null;
  if (agent_nom        !== undefined) payload.agent_nom        = agent_nom        || null;
  if (nombre_heures    !== undefined) payload.nombre_heures    = nombre_heures !== '' && nombre_heures != null ? parseFloat(nombre_heures) : null;
  if (montant_achat    !== undefined) payload.montant_achat    = montant_achat !== '' && montant_achat != null ? parseFloat(montant_achat) : null;
  if (categorie        !== undefined) payload.categorie        = categorie        || null;
  if (nature           !== undefined) payload.nature           = nature           || null;
  if (statut           !== undefined) payload.statut           = statut;
  if (type_maintenance !== undefined) payload.type_maintenance = type_maintenance;
  if (date_signalement !== undefined) payload.date_signalement = date_signalement || null;
  if (date_prevue      !== undefined) payload.date_prevue      = date_prevue      || null;
  if (date_realisee    !== undefined) payload.date_realisee    = date_realisee    || null;
  if (commentaire      !== undefined) payload.commentaire      = commentaire      || null;

  const { data, error: dbErr } = await supabaseAdmin
    .from('interventions_patrimoine')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data);
};

const deleteIntervention = async (req, res) => {
  const { id } = req.params;
  const { error: dbErr } = await supabaseAdmin.from('interventions_patrimoine').delete().eq('id', id);
  if (dbErr) return error(res, dbErr.message);
  success(res, { deleted: true });
};

// ── INTERVENTIONS VOIRIE (vue catégorie) ──────────────────────────────────────

const getVoirieInterventions = async (req, res) => {
  const { theme = 'voirie' } = req.query;
  const isMobilier  = theme === 'mobilier';
  const isEclairage = theme === 'eclairage';
  const isArmoire   = theme === 'armoire';
  const isBatiment  = theme === 'batiment';
  // Les marchés des armoires partagent le domaine 'eclairage'
  const marcheDomaine = isArmoire ? 'eclairage' : theme;

  let elementQuery;
  if (isMobilier)       elementQuery = supabaseAdmin.from('mobilier_urbain').select('id, type, reference_terrain');
  else if (isEclairage) elementQuery = fetchAll(() => supabaseAdmin.from('points_lumineux').select('id, reference, localisation'));
  else if (isArmoire)   elementQuery = supabaseAdmin.from('armoires_eclairage').select('id, intitule, localisation');
  else if (isBatiment)  elementQuery = supabaseAdmin.from('batiments').select('id, intitule');
  else                  elementQuery = supabaseAdmin.from('troncons_voirie').select('id, intitule');

  const [{ data: interventions, error: e1 }, { data: elements }, { data: marches }] = await Promise.all([
    supabaseAdmin.from('interventions_patrimoine')
      .select('*')
      .eq('theme', theme)
      .order('date_signalement', { ascending: false }),
    elementQuery,
    supabaseAdmin.from('marches_voirie')
      .select('id, intitule, numero_marche, prestataire, type_travaux')
      .eq('domaine', marcheDomaine),
  ]);
  if (e1) return error(res, e1.message);

  const elementMap = {};
  (elements || []).forEach(e => {
    if (isMobilier)                       elementMap[e.id] = [e.type, e.reference_terrain].filter(Boolean).join(' — ');
    else if (isEclairage)                 elementMap[e.id] = [e.reference, e.localisation].filter(Boolean).join(' — ');
    else if (isArmoire)                   elementMap[e.id] = [e.intitule, e.localisation].filter(Boolean).join(' — ');
    else                                  elementMap[e.id] = e.intitule;
  });
  const marcheMap = {};
  (marches || []).forEach(m => { marcheMap[m.id] = m; });

  const result = (interventions || []).map(iv => ({
    ...iv,
    element_intitule: elementMap[iv.element_id] || '—',
    marche:           iv.marche_id ? marcheMap[iv.marche_id] || null : null,
  }));

  // Calcul des totaux par categorie + marche_id + année
  const totaux = {};
  result.forEach(iv => {
    const cat  = iv.categorie || 'autre';
    const mid  = iv.marche_id || '__sans_marche__';
    const year = iv.date_signalement ? new Date(iv.date_signalement).getFullYear() : new Date().getFullYear();
    const key  = `${cat}|${mid}|${year}`;
    if (!totaux[key]) {
      totaux[key] = {
        categorie: cat, marche_id: iv.marche_id, marche: iv.marche,
        exercice: year, total_ht: 0, count: 0,
      };
    }
    totaux[key].total_ht += parseFloat(iv.montant_ht) || 0;
    totaux[key].count    += 1;
  });

  success(res, { interventions: result, totaux: Object.values(totaux) });
};

// ── DASHBOARD ─────────────────────────────────────────────────────────────────

const getDashboard = async (req, res) => {
  const today = new Date();
  const since12m = new Date();
  since12m.setFullYear(since12m.getFullYear() - 1);
  const in90d = new Date();
  in90d.setDate(in90d.getDate() + 90);

  const [
    { data: troncons },
    { data: points },
    { data: batiments },
    { data: equipements },
    { data: interventions12m },
    { data: interventionsActives },
  ] = await Promise.all([
    supabaseAdmin.from('troncons_voirie').select('etat_general, longueur_ml, largeur_m'),
    fetchAll(() => supabaseAdmin.from('points_lumineux').select('id, etat_general, type_lampe')),
    supabaseAdmin.from('batiments').select('id, intitule, dpe_classe, surface_plancher_m2'),
    supabaseAdmin.from('equipements_batiments').select('id, batiment_id, intitule, date_prochain_controle'),
    supabaseAdmin.from('interventions_patrimoine')
      .select('theme, type_intervenant, montant_ht')
      .eq('type_intervenant', 'prestataire')
      .gte('date_signalement', since12m.toISOString().split('T')[0]),
    supabaseAdmin.from('interventions_patrimoine')
      .select('theme, element_id, statut')
      .in('statut', ['programmee', 'en_cours']),
  ]);

  // Voirie KPIs
  const totalSurface = (troncons || []).reduce(
    (acc, t) => acc + ((parseFloat(t.longueur_ml) || 0) * (parseFloat(t.largeur_m) || 0)), 0
  );
  const statsByEtatVoirie = (troncons || []).reduce((acc, t) => {
    const k = t.etat_general || 'inconnu';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const voirieCout12m = (interventions12m || []).filter(i => i.theme === 'voirie')
    .reduce((acc, i) => acc + (parseFloat(i.montant_ht) || 0), 0);

  // Éclairage KPIs
  const totalPL = (points || []).length;
  const defaillantsPL = (points || []).filter(p => p.etat_general === 'defaillant' || p.etat_general === 'hors_service').length;
  const ledPL = (points || []).filter(p => p.type_lampe === 'led').length;
  const pctLed = totalPL > 0 ? Math.round((ledPL / totalPL) * 100) : 0;
  const eclairageCout12m = (interventions12m || []).filter(i => i.theme === 'eclairage')
    .reduce((acc, i) => acc + (parseFloat(i.montant_ht) || 0), 0);

  // Bâtiments KPIs
  const totalSurfaceBat = (batiments || []).reduce((acc, b) => acc + (parseFloat(b.surface_plancher_m2) || 0), 0);
  const batDPEFG = (batiments || []).filter(b => b.dpe_classe === 'F' || b.dpe_classe === 'G');
  const batimentCout12m = (interventions12m || []).filter(i => i.theme === 'batiment')
    .reduce((acc, i) => acc + (parseFloat(i.montant_ht) || 0), 0);

  // Contrôles à venir 90j
  const today_str = today.toISOString().split('T')[0];
  const in90d_str = in90d.toISOString().split('T')[0];
  const controlesBientot = (equipements || []).filter(e =>
    e.date_prochain_controle &&
    e.date_prochain_controle >= today_str &&
    e.date_prochain_controle <= in90d_str
  );
  const controlesEchus = (equipements || []).filter(e =>
    e.date_prochain_controle && e.date_prochain_controle < today_str
  );

  // Alertes
  const alertes = [];
  const activeElementIds = new Set((interventionsActives || []).map(i => i.element_id));

  const plHorsService = (points || []).filter(p => p.etat_general === 'hors_service' && !activeElementIds.has(p.id));
  if (plHorsService.length > 0) {
    alertes.push({ type: 'eclairage', niveau: 'rouge', message: `${plHorsService.length} point(s) lumineux hors service sans intervention programmée` });
  }

  const tresDegradesIds = (troncons || []).filter(t => t.etat_general === 'tres_degrade');
  if (tresDegradesIds.length > 0) {
    alertes.push({ type: 'voirie', niveau: 'orange', message: `${tresDegradesIds.length} tronçon(s) très dégradé(s)` });
  }

  if (controlesEchus.length > 0) {
    alertes.push({ type: 'batiment', niveau: 'rouge', message: `${controlesEchus.length} contrôle(s) réglementaire(s) échu(s)` });
  }

  if (batDPEFG.length > 0) {
    alertes.push({ type: 'batiment', niveau: 'orange', message: `${batDPEFG.length} bâtiment(s) avec DPE F ou G` });
  }

  success(res, {
    voirie: {
      totalSurface,
      totalTroncons: (troncons || []).length,
      tresDegrades: tresDegradesIds.length,
      cout12m: voirieCout12m,
      statsByEtat: statsByEtatVoirie,
    },
    eclairage: { totalPL, defaillants: defaillantsPL, pctLed, cout12m: eclairageCout12m },
    batiments: {
      total: (batiments || []).length,
      totalSurface: totalSurfaceBat,
      controlesBientot: controlesBientot.length,
      controlesEchus: controlesEchus.length,
      cout12m: batimentCout12m,
    },
    alertes,
  });
};

// ── CONTRÔLES RÉGLEMENTAIRES (rattachés au bâtiment) ─────────────────────────

const getControlesBatiment = async (req, res) => {
  const { id } = req.params;
  const { data, error: dbErr } = await supabaseAdmin
    .from('controles_batiment')
    .select('*')
    .eq('batiment_id', id)
    .order('date_prochain_controle', { ascending: true, nullsFirst: false });
  if (dbErr) return error(res, dbErr.message);
  success(res, data || []);
};

const createControleBatiment = async (req, res) => {
  const { id } = req.params;
  const {
    type_controle, organisme, periodicite_mois,
    date_dernier_controle, date_prochain_controle,
    statut, commentaire,
  } = req.body;
  if (!type_controle) return error(res, 'type_controle est requis', 400);
  const payload = {
    batiment_id:            id,
    type_controle:          type_controle.trim(),
    organisme:              organisme              || null,
    periodicite_mois:       periodicite_mois       ? parseInt(periodicite_mois)  : null,
    date_dernier_controle:  date_dernier_controle  || null,
    date_prochain_controle: date_prochain_controle || null,
    statut:                 statut                 || 'a_planifier',
    commentaire:            commentaire            || null,
  };
  const { data, error: dbErr } = await supabaseAdmin
    .from('controles_batiment')
    .insert([payload])
    .select()
    .single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data, 201);
};

const updateControleBatiment = async (req, res) => {
  const { id } = req.params;
  const {
    type_controle, organisme, periodicite_mois,
    date_dernier_controle, date_prochain_controle,
    statut, commentaire,
  } = req.body;
  const payload = {};
  if (type_controle          !== undefined) payload.type_controle          = type_controle.trim();
  if (organisme              !== undefined) payload.organisme              = organisme              || null;
  if (periodicite_mois       !== undefined) payload.periodicite_mois       = periodicite_mois       ? parseInt(periodicite_mois) : null;
  if (date_dernier_controle  !== undefined) payload.date_dernier_controle  = date_dernier_controle  || null;
  if (date_prochain_controle !== undefined) payload.date_prochain_controle = date_prochain_controle || null;
  if (statut                 !== undefined) payload.statut                 = statut                 || 'a_planifier';
  if (commentaire            !== undefined) payload.commentaire            = commentaire            || null;
  const { data, error: dbErr } = await supabaseAdmin
    .from('controles_batiment')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data);
};

const deleteControleBatiment = async (req, res) => {
  const { id } = req.params;
  const { error: dbErr } = await supabaseAdmin
    .from('controles_batiment')
    .delete()
    .eq('id', id);
  if (dbErr) return error(res, dbErr.message);
  success(res, { deleted: true });
};

// ── Documents Bâtiment ────────────────────────────────────────────────────────

const BUCKET_BAT = 'Documents';

function slugifyDoc(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9.]/gi, '_').toLowerCase();
}

const getDocsBatiment = async (req, res) => {
  const { id: batimentId } = req.params;
  const { repertoire_id } = req.query;

  let foldersQ = supabaseAdmin.from('repertoires_batiment')
    .select('*').eq('batiment_id', batimentId).order('nom');
  let docsQ = supabaseAdmin.from('documents_batiment')
    .select('*').eq('batiment_id', batimentId).order('created_at', { ascending: false });

  if (repertoire_id) {
    foldersQ = foldersQ.eq('parent_id', repertoire_id);
    docsQ    = docsQ.eq('repertoire_id', repertoire_id);
  } else {
    foldersQ = foldersQ.is('parent_id', null);
    docsQ    = docsQ.is('repertoire_id', null);
  }

  const [{ data: folders, error: e1 }, { data: docs, error: e2 }] = await Promise.all([foldersQ, docsQ]);
  if (e1) return error(res, e1.message);
  if (e2) return error(res, e2.message);

  // Breadcrumb
  let breadcrumb = [];
  if (repertoire_id) {
    const { data: allReps } = await supabaseAdmin
      .from('repertoires_batiment').select('id, nom, parent_id').eq('batiment_id', batimentId);
    const folderMap = {};
    (allReps || []).forEach(f => { folderMap[f.id] = f; });
    let cur = repertoire_id;
    while (cur) {
      const f = folderMap[cur];
      if (!f) break;
      breadcrumb.unshift({ id: f.id, nom: f.nom });
      cur = f.parent_id;
    }
  }

  success(res, { folders: folders || [], documents: docs || [], breadcrumb });
};

const createRepertoireBatiment = async (req, res) => {
  const { id: batimentId } = req.params;
  const { nom, parent_id } = req.body;
  if (!nom?.trim()) return error(res, 'Nom requis', 400);
  const { data, error: dbErr } = await supabaseAdmin
    .from('repertoires_batiment')
    .insert([{ batiment_id: batimentId, nom: nom.trim(), parent_id: parent_id || null }])
    .select().single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data, 201);
};

const deleteRepertoireBatiment = async (req, res) => {
  const { repId } = req.params;
  // Récupère tous les dossiers descendants pour nettoyer le storage
  const { data: allReps } = await supabaseAdmin.from('repertoires_batiment').select('id, parent_id');
  const descendantIds = [repId];
  let changed = true;
  while (changed) {
    changed = false;
    (allReps || []).forEach(r => {
      if (r.parent_id && descendantIds.includes(r.parent_id) && !descendantIds.includes(r.id)) {
        descendantIds.push(r.id);
        changed = true;
      }
    });
  }
  const { data: docs } = await supabaseAdmin.from('documents_batiment')
    .select('storage_path').in('repertoire_id', descendantIds);
  if (docs?.length) {
    await supabaseAdmin.storage.from(BUCKET_BAT).remove(docs.map(d => d.storage_path));
    await supabaseAdmin.from('documents_batiment').delete().in('repertoire_id', descendantIds);
  }
  const { error: dbErr } = await supabaseAdmin.from('repertoires_batiment').delete().eq('id', repId);
  if (dbErr) return error(res, dbErr.message);
  success(res, { deleted: true });
};

const uploadDocBatiment = async (req, res) => {
  if (!req.file) return error(res, 'Fichier manquant', 400);
  const { id: batimentId } = req.params;
  const { nom_affichage, repertoire_id, description } = req.body;
  const ts = Date.now();
  const safeName = slugifyDoc(req.file.originalname);
  const storagePath = `batiment/${batimentId}/${ts}_${safeName}`;
  const { error: uploadErr } = await supabaseAdmin.storage.from(BUCKET_BAT)
    .upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
  if (uploadErr) return error(res, uploadErr.message);
  const { data, error: dbErr } = await supabaseAdmin.from('documents_batiment').insert([{
    batiment_id:   batimentId,
    repertoire_id: repertoire_id || null,
    nom_fichier:   req.file.originalname,
    nom_affichage: nom_affichage || req.file.originalname,
    description:   description || null,
    taille_octets: req.file.size,
    type_mime:     req.file.mimetype,
    storage_path:  storagePath,
    uploaded_by:   req.user?.id || null,
  }]).select().single();
  if (dbErr) {
    await supabaseAdmin.storage.from(BUCKET_BAT).remove([storagePath]);
    return error(res, dbErr.message);
  }
  success(res, data, 201);
};

const downloadDocBatiment = async (req, res) => {
  const { docId } = req.params;
  const { data: doc } = await supabaseAdmin.from('documents_batiment').select('*').eq('id', docId).single();
  if (!doc) return error(res, 'Document introuvable', 404);
  const { data: fileData, error: dlErr } = await supabaseAdmin.storage.from(BUCKET_BAT).download(doc.storage_path);
  if (dlErr) return error(res, dlErr.message);
  const buffer = Buffer.from(await fileData.arrayBuffer());
  res.setHeader('Content-Type', doc.type_mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.nom_affichage)}"`);
  res.send(buffer);
};

const deleteDocBatiment = async (req, res) => {
  const { docId } = req.params;
  const { data: doc } = await supabaseAdmin.from('documents_batiment').select('*').eq('id', docId).single();
  if (!doc) return error(res, 'Document introuvable', 404);
  await supabaseAdmin.storage.from(BUCKET_BAT).remove([doc.storage_path]);
  await supabaseAdmin.from('documents_batiment').delete().eq('id', docId);
  success(res, { deleted: true });
};

// ── BILAN DES INTERVENTIONS PAR SITE ─────────────────────────────────────────
const getBilanInterventions = async (req, res) => {
  try {
    const { date_debut, date_fin, theme } = req.query;

    let query = supabaseAdmin
      .from('interventions_patrimoine')
      .select('id, theme, element_id, type_intervenant, montant_ht, nombre_heures, montant_achat, date_signalement');

    if (date_debut) query = query.gte('date_signalement', date_debut);
    if (date_fin)   query = query.lte('date_signalement', date_fin + 'T23:59:59');
    if (theme)      query = query.eq('theme', theme);

    const { data: interventions, error: dbErr } = await query;
    if (dbErr) throw dbErr;

    // Regrouper par (theme, element_id)
    const grouped = {};
    for (const iv of (interventions || [])) {
      const key = `${iv.theme}__${iv.element_id}`;
      if (!grouped[key]) {
        grouped[key] = {
          theme: iv.theme,
          element_id: iv.element_id,
          label: null,
          nb: 0,
          montant_prestataire: 0,
          montant_achat: 0,
          heures_regie: 0,
        };
      }
      const g = grouped[key];
      g.nb += 1;
      if (iv.type_intervenant === 'prestataire') {
        g.montant_prestataire += parseFloat(iv.montant_ht) || 0;
      } else {
        g.heures_regie  += parseFloat(iv.nombre_heures) || 0;
        g.montant_achat += parseFloat(iv.montant_achat) || 0;
      }
    }

    // Récupérer les libellés pour chaque thème
    const byTheme = {};
    for (const g of Object.values(grouped)) {
      if (!byTheme[g.theme]) byTheme[g.theme] = [];
      byTheme[g.theme].push(g.element_id);
    }

    const nameMap = {}; // element_id → label

    const tronconMap = {}; // mobilier element_id → troncon_id

    await Promise.all(Object.entries(byTheme).map(async ([t, ids]) => {
      const uniqueIds = [...new Set(ids)];
      let table, select, labelFn;

      if      (t === 'voirie')    { table = 'troncons_voirie';     select = 'id, intitule';                          labelFn = r => r.intitule; }
      else if (t === 'eclairage') { table = 'points_lumineux';     select = 'id, reference';                         labelFn = r => r.reference; }
      else if (t === 'armoire')   { table = 'armoires_eclairage';  select = 'id, intitule';                          labelFn = r => r.intitule; }
      else if (t === 'batiment')  { table = 'batiments';           select = 'id, intitule';                          labelFn = r => r.intitule; }
      else if (t === 'mobilier')  { table = 'mobilier_urbain';     select = 'id, type, reference_terrain, troncon_id'; labelFn = r => r.reference_terrain ? `${r.type} — ${r.reference_terrain}` : r.type; }
      else return;

      const { data } = await supabaseAdmin.from(table).select(select).in('id', uniqueIds);
      (data || []).forEach(r => {
        nameMap[r.id] = labelFn(r) || r.id;
        if (t === 'mobilier' && r.troncon_id) tronconMap[r.id] = r.troncon_id;
      });
    }));

    // Construire le résultat
    const sites = Object.values(grouped).map(g => ({
      ...g,
      label: nameMap[g.element_id] || g.element_id,
      total: g.montant_prestataire + g.montant_achat,
      troncon_id: tronconMap[g.element_id] || null, // pour le mobilier
    }));
    sites.sort((a, b) => b.total - a.total || b.nb - a.nb);

    const kpis = {
      nb_total:                   sites.reduce((s, r) => s + r.nb, 0),
      montant_prestataire_total:  sites.reduce((s, r) => s + r.montant_prestataire, 0),
      montant_achat_total:        sites.reduce((s, r) => s + r.montant_achat, 0),
      heures_regie_total:         sites.reduce((s, r) => s + r.heures_regie, 0),
    };

    success(res, { kpis, sites });
  } catch (err) { error(res, err.message); }
};

// ── FEUX TRICOLORES ───────────────────────────────────────────────────────────

const getArmoiresFeux = async (req, res) => {
  const [{ data: armoires, error: e1 }, { data: feuxAll }] = await Promise.all([
    supabaseAdmin.from('armoires_feux').select('*').order('intitule'),
    fetchAll(() => supabaseAdmin.from('feux_tricolores').select('armoire_id, etat_general')),
  ]);
  if (e1) return error(res, e1.message);

  const countMap = {};
  const defMap   = {};
  (feuxAll || []).forEach(f => {
    const aid = f.armoire_id;
    if (!aid) return;
    countMap[aid] = (countMap[aid] || 0) + 1;
    if (f.etat_general === 'defaillant' || f.etat_general === 'hors_service') {
      defMap[aid] = (defMap[aid] || 0) + 1;
    }
  });

  success(res, (armoires || []).map(a => ({
    ...a,
    nb_feux:       countMap[a.id] || 0,
    nb_defaillants: defMap[a.id] || 0,
  })));
};

const createArmoireFeux = async (req, res) => {
  const { data, error: dbErr } = await supabaseAdmin
    .from('armoires_feux').insert([req.body]).select().single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data, 201);
};

const getArmoireFeux = async (req, res) => {
  const { id } = req.params;
  const [{ data: armoire, error: e1 }, { data: feux }, { data: interventions }] = await Promise.all([
    supabaseAdmin.from('armoires_feux').select('*').eq('id', id).single(),
    supabaseAdmin.from('feux_tricolores').select('*').eq('armoire_id', id).order('reference'),
    supabaseAdmin.from('interventions_patrimoine')
      .select('*').eq('theme', 'armoire_feux').eq('element_id', id)
      .order('date_signalement', { ascending: false }),
  ]);
  if (e1) return error(res, e1.message);
  success(res, { ...armoire, feux_tricolores: feux || [], interventions: interventions || [] });
};

const updateArmoireFeux = async (req, res) => {
  const { id } = req.params;
  const { intitule, localisation, latitude, longitude, type_controleur, marque, modele, numero_serie, annee_pose, commentaire } = req.body;
  const payload = {};
  if (intitule        !== undefined) payload.intitule        = intitule;
  if (localisation    !== undefined) payload.localisation    = localisation    || null;
  if (latitude        !== undefined) payload.latitude        = latitude        != null && latitude  !== '' ? parseFloat(latitude)  : null;
  if (longitude       !== undefined) payload.longitude       = longitude       != null && longitude !== '' ? parseFloat(longitude) : null;
  if (type_controleur !== undefined) payload.type_controleur = type_controleur || null;
  if (marque          !== undefined) payload.marque          = marque          || null;
  if (modele          !== undefined) payload.modele          = modele          || null;
  if (numero_serie    !== undefined) payload.numero_serie    = numero_serie    || null;
  if (annee_pose      !== undefined) payload.annee_pose      = annee_pose != null && annee_pose !== '' ? parseInt(annee_pose) : null;
  if (commentaire     !== undefined) payload.commentaire     = commentaire     || null;

  const { data, error: dbErr } = await supabaseAdmin
    .from('armoires_feux').update(payload).eq('id', id).select().single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data);
};

const getFeuxTricolores = async (req, res) => {
  const { data, error: dbErr } = await fetchAll(() =>
    supabaseAdmin.from('feux_tricolores')
      .select('*, armoires_feux(intitule, localisation)')
      .order('reference')
  );
  if (dbErr) return error(res, dbErr.message);
  success(res, data || []);
};

const createFeuTricolore = async (req, res) => {
  const { reference, armoire_id, localisation, latitude, longitude, type_feu, nb_feux, technologie, annee_pose, etat_general, commentaire } = req.body;
  const { data, error: dbErr } = await supabaseAdmin
    .from('feux_tricolores')
    .insert([{
      reference, armoire_id: armoire_id || null, localisation, latitude, longitude,
      type_feu: type_feu || 'vehicule', nb_feux: nb_feux || 3,
      technologie: technologie || 'led', annee_pose,
      etat_general: etat_general || 'fonctionnel', commentaire,
    }])
    .select().single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data, 201);
};

const getFeuTricolore = async (req, res) => {
  const { id } = req.params;
  const [{ data: feu, error: e1 }, { data: interventions }] = await Promise.all([
    supabaseAdmin.from('feux_tricolores')
      .select('*, armoires_feux(intitule, localisation)')
      .eq('id', id).single(),
    supabaseAdmin.from('interventions_patrimoine')
      .select('*').eq('theme', 'feux').eq('element_id', id)
      .order('date_signalement', { ascending: false }),
  ]);
  if (e1) return error(res, e1.message);
  success(res, { ...feu, interventions: interventions || [] });
};

const updateFeuTricolore = async (req, res) => {
  const { id } = req.params;
  const { reference, armoire_id, localisation, latitude, longitude, type_feu, nb_feux, technologie, annee_pose, etat_general, commentaire } = req.body;
  const payload = {};
  if (reference    !== undefined) payload.reference    = reference;
  if (armoire_id   !== undefined) payload.armoire_id   = armoire_id   || null;
  if (localisation !== undefined) payload.localisation = localisation || null;
  if (latitude     !== undefined) payload.latitude     = latitude     != null && latitude  !== '' ? parseFloat(latitude)  : null;
  if (longitude    !== undefined) payload.longitude    = longitude    != null && longitude !== '' ? parseFloat(longitude) : null;
  if (type_feu     !== undefined) payload.type_feu     = type_feu     || null;
  if (nb_feux      !== undefined) payload.nb_feux      = nb_feux      != null && nb_feux !== '' ? parseInt(nb_feux) : null;
  if (technologie  !== undefined) payload.technologie  = technologie  || null;
  if (annee_pose   !== undefined) payload.annee_pose   = annee_pose   != null && annee_pose !== '' ? parseInt(annee_pose) : null;
  if (etat_general !== undefined) payload.etat_general = etat_general;
  if (commentaire  !== undefined) payload.commentaire  = commentaire  || null;

  const { data, error: dbErr } = await supabaseAdmin
    .from('feux_tricolores').update(payload).eq('id', id).select().single();
  if (dbErr) return error(res, dbErr.message);
  success(res, data);
};

const getFeuxKpis = async (req, res) => {
  const { data: feux, error: dbErr } = await fetchAll(() =>
    supabaseAdmin.from('feux_tricolores').select('etat_general, technologie')
  );
  if (dbErr) return error(res, dbErr.message);

  const total       = (feux || []).length;
  const defaillants = (feux || []).filter(f => f.etat_general === 'defaillant' || f.etat_general === 'hors_service').length;
  const led         = (feux || []).filter(f => f.technologie === 'led').length;
  const pctLed      = total > 0 ? Math.round((led / total) * 100) : 0;

  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const { data: interventions } = await supabaseAdmin
    .from('interventions_patrimoine')
    .select('montant_ht')
    .eq('theme', 'feux')
    .eq('type_intervenant', 'prestataire')
    .gte('date_signalement', since.toISOString().split('T')[0]);

  const cout12Mois = (interventions || []).reduce((acc, i) => acc + (parseFloat(i.montant_ht) || 0), 0);
  success(res, { total, defaillants, pctLed, cout12Mois });
};

module.exports = {
  getVoirie, createTroncon, getTroncon, updateTroncon, deleteTroncon,
  getMarches, createMarche, getMarche, updateMarche, deleteMarche,
  getVoirieInterventions,
  upsertEngagement, deleteEngagement,
  getMobilier, createMobilier, updateMobilier, deleteMobilier,
  getArmoires, createArmoire, getArmoire, updateArmoire,
  getPointsLumineux, createPointLumineux, getPointLumineux, updatePointLumineux,
  getEclairageKpis,
  getBatiments, createBatiment, getBatiment, updateBatiment,
  getEquipements, getAllEquipements, createEquipement, updateEquipement, deleteEquipement,
  getInterventions, createIntervention, getIntervention, updateIntervention, deleteIntervention,
  getBilanInterventions,
  getControlesBatiment, createControleBatiment, updateControleBatiment, deleteControleBatiment,
  getDashboard,
  getDocsBatiment, createRepertoireBatiment, deleteRepertoireBatiment,
  uploadDocBatiment, downloadDocBatiment, deleteDocBatiment,
  getArmoiresFeux, createArmoireFeux, getArmoireFeux, updateArmoireFeux,
  getFeuxTricolores, createFeuTricolore, getFeuTricolore, updateFeuTricolore,
  getFeuxKpis,
};
