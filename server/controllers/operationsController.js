const { validationResult } = require('express-validator');
const { supabaseAdmin } = require('../utils/supabase');
const { success, error } = require('../utils/response');

const ALERT_BUDGET_RATIO = 1.05;
const ALERT_GPA_DAYS = 60;

function computeAlerts(op) {
  const alerts = [];
  const today = new Date();

  if (op.montant_engage > op.enveloppe_ht * ALERT_BUDGET_RATIO) {
    alerts.push({ type: 'rouge', message: 'Dépassement budgétaire' });
  }

  if (op.date_fin_gpa) {
    const finGpa = new Date(op.date_fin_gpa);
    const diffDays = Math.ceil((finGpa - today) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= ALERT_GPA_DAYS) {
      alerts.push({ type: 'orange', message: `GPA expirant dans ${diffDays} jour(s)` });
    }
  }

  return alerts;
}

const getAll = async (req, res) => {
  const { role } = req;
  const userId = req.user.id;

  let query = supabaseAdmin
    .from('operations')
    .select('*')
    .order('created_at', { ascending: false });

  // Le chargé ne voit que ses opérations (via operation_charges)
  if (role === 'write' || role === 'charge_operation') {
    const { data: myCharges } = await supabaseAdmin
      .from('operation_charges').select('operation_id').eq('user_id', userId);
    const ids = (myCharges || []).map(c => c.operation_id);
    if (!ids.length) return success(res, []);
    query = query.in('id', ids);
  }

  const { data, error: dbError } = await query;
  if (dbError) return error(res, dbError.message);

  const enriched = await enrichWithUsers(data);
  const withAlerts = enriched.map(op => ({ ...op, alerts: computeAlerts(op) }));
  success(res, withAlerts);
};

const getById = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { role } = req;

  const { data, error: dbError } = await supabaseAdmin
    .from('operations').select('*').eq('id', id).single();
  if (dbError) return error(res, 'Opération non trouvée', 404);

  if (role === 'write' || role === 'charge_operation') {
    const { data: charge } = await supabaseAdmin
      .from('operation_charges').select('id')
      .eq('operation_id', id).eq('user_id', userId).maybeSingle();
    if (!charge) return error(res, 'Accès non autorisé à cette opération', 403);
  }

  const [enriched] = await enrichWithUsers([data]);
  success(res, { ...enriched, alerts: computeAlerts(enriched) });
};

const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, errors.array().map(e => e.msg).join(', '), 400);
  }

  const payload = buildPayload(req.body, req.user.id, req.role);

  const { data, error: dbError } = await supabaseAdmin
    .from('operations')
    .insert(payload)
    .select()
    .single();

  if (dbError) return error(res, dbError.message);

  const [enriched] = await enrichWithUsers([data]);
  success(res, { ...enriched, alerts: computeAlerts(enriched) }, 201);
};

const update = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, errors.array().map(e => e.msg).join(', '), 400);
  }

  const { id } = req.params;
  const userId = req.user.id;
  const { role } = req;

  const { data: existing } = await supabaseAdmin
    .from('operations').select('id').eq('id', id).single();
  if (!existing) return error(res, 'Opération non trouvée', 404);

  if (role === 'write' || role === 'charge_operation') {
    const { data: charge } = await supabaseAdmin
      .from('operation_charges').select('id')
      .eq('operation_id', id).eq('user_id', userId).maybeSingle();
    if (!charge) return error(res, 'Modification non autorisée', 403);
  }

  const payload = buildPayload(req.body, userId, role);
  delete payload.charged_id;

  const { data, error: dbError } = await supabaseAdmin
    .from('operations')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (dbError) return error(res, dbError.message);

  const [enriched] = await enrichWithUsers([data]);
  success(res, { ...enriched, alerts: computeAlerts(enriched) });
};

const remove = async (req, res) => {
  const { id } = req.params;

  const { error: dbError } = await supabaseAdmin
    .from('operations')
    .delete()
    .eq('id', id);

  if (dbError) return error(res, dbError.message);
  success(res, { id });
};

const getKPIs = async (req, res) => {
  const userId = req.user.id;
  const { role } = req;

  let query = supabaseAdmin.from('operations').select('*');
  if (role === 'write' || role === 'charge_operation') {
    const { data: myCharges } = await supabaseAdmin
      .from('operation_charges').select('operation_id').eq('user_id', userId);
    const ids = (myCharges || []).map(c => c.operation_id);
    if (!ids.length) return success(res, { operations_en_cours: 0, montant_total_programme: 0, taux_engagement_global: 0, alertes_actives: 0, alertes: [] });
    query = query.in('id', ids);
  }

  const { data, error: dbError } = await query;
  if (dbError) return error(res, dbError.message);

  const enCours = data.filter(op => op.statut !== 'soldee').length;
  const totalEnveloppe = data.reduce((sum, op) => sum + parseFloat(op.enveloppe_ht || 0), 0);
  const totalEngage = data.reduce((sum, op) => sum + parseFloat(op.montant_engage || 0), 0);
  const tauxEngagement = totalEnveloppe > 0 ? (totalEngage / totalEnveloppe) * 100 : 0;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const { data: jalonsData } = await supabaseAdmin
    .from('jalons')
    .select('operation_id, intitule, date_prevue')
    .is('date_reelle', null)
    .not('date_prevue', 'is', null)
    .lt('date_prevue', today.toISOString().split('T')[0]);

  const retardByOp = {};
  (jalonsData || []).forEach(j => {
    const ecart = Math.round((today - new Date(j.date_prevue)) / 86400000);
    if (!retardByOp[j.operation_id]) retardByOp[j.operation_id] = [];
    retardByOp[j.operation_id].push({ intitule: j.intitule, ecart_jours: ecart });
  });

  const opsById = Object.fromEntries(data.map(op => [op.id, op]));

  const alertesFinancieres = data.filter(op => computeAlerts(op).length > 0);
  const alertesPlanning = Object.entries(retardByOp)
    .filter(([opId]) => opsById[opId])
    .map(([opId, jalons]) => ({
      ...opsById[opId],
      alerts: jalons.map(j => ({
        type: j.ecart_jours > 30 ? 'rouge' : 'orange',
        message: `Jalon en retard : ${j.intitule} (+${j.ecart_jours}j)`,
      })),
    }));

  const allAlertedOpIds = new Set([
    ...alertesFinancieres.map(op => op.id),
    ...alertesPlanning.map(op => op.id),
  ]);
  const mergedAlertes = [...allAlertedOpIds].map(opId => {
    const fin = alertesFinancieres.find(op => op.id === opId);
    const plan = alertesPlanning.find(op => op.id === opId);
    const alerts = [...(fin ? computeAlerts(fin) : []), ...(plan ? plan.alerts : [])];
    return { ...(opsById[opId]), alerts };
  });

  success(res, {
    operations_en_cours: enCours,
    montant_total_programme: totalEnveloppe,
    taux_engagement_global: Math.round(tauxEngagement * 10) / 10,
    alertes_actives: mergedAlertes.length,
    alertes: mergedAlertes,
  });
};

const uploadImage = async (req, res) => {
  if (!req.file) return error(res, 'Aucun fichier fourni', 400);

  const { id } = req.params;
  const ext = req.file.mimetype === 'image/png' ? 'png' : 'jpg';
  const path = `operations/${id}/cover.${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('operation-images')
    .upload(path, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: true
    });

  if (uploadError) return error(res, uploadError.message);

  const { data: urlData } = supabaseAdmin.storage
    .from('operation-images')
    .getPublicUrl(path);

  const imageUrl = urlData.publicUrl;

  await supabaseAdmin
    .from('operations')
    .update({ image_url: imageUrl })
    .eq('id', id);

  success(res, { image_url: imageUrl });
};

// --- Helpers ---

function buildPayload(body, userId, role) {
  return {
    intitule: body.intitule,
    type: body.type,
    statut: body.statut,
    adresse: body.adresse,
    description: body.description,
    charged_id: role === 'admin' ? (body.charged_id || userId) : userId,
    maitre_oeuvre: body.maitre_oeuvre,
    enveloppe_ht: parseFloat(body.enveloppe_ht),
    mode_financier: body.mode_financier,
    montant_engage: parseFloat(body.montant_engage || 0),
    montant_mandate: parseFloat(body.montant_mandate || 0),
    date_debut: body.date_debut || null,
    date_livraison_prev: body.date_livraison_prev || null,
    date_reception: body.date_reception || null,
    latitude: body.latitude ? parseFloat(body.latitude) : null,
    longitude: body.longitude ? parseFloat(body.longitude) : null,
    image_url: body.image_url || null
  };
}

async function enrichWithUsers(operations) {
  if (!operations.length) return [];

  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  const userMap = {};
  (users?.users || []).forEach(u => { userMap[u.id] = u; });

  const opIds = operations.map(op => op.id);
  const { data: charges } = await supabaseAdmin
    .from('operation_charges')
    .select('operation_id, user_id, label, ordre')
    .in('operation_id', opIds)
    .order('ordre');

  const chargesMap = {};
  (charges || []).forEach(c => {
    if (!chargesMap[c.operation_id]) chargesMap[c.operation_id] = [];
    chargesMap[c.operation_id].push({
      user_id: c.user_id,
      label:   c.label || null,
      ordre:   c.ordre,
      full_name: userMap[c.user_id]?.user_metadata?.full_name || userMap[c.user_id]?.email || c.user_id,
      email:   userMap[c.user_id]?.email,
    });
  });

  return operations.map(op => ({
    ...op,
    charges: chargesMap[op.id] || [],
    // Rétro-compat : charged = premier chargé
    charged: (chargesMap[op.id]?.[0]) ? {
      id:        chargesMap[op.id][0].user_id,
      full_name: chargesMap[op.id][0].full_name,
      email:     chargesMap[op.id][0].email,
    } : (op.charged_id ? {
      id:        op.charged_id,
      full_name: userMap[op.charged_id]?.user_metadata?.full_name || userMap[op.charged_id]?.email,
      email:     userMap[op.charged_id]?.email,
    } : null),
  }));
}

// ── Gestion des chargés d'opération ──────────────────────────

const getCharges = async (req, res) => {
  const { id } = req.params;
  const { data, error: err } = await supabaseAdmin
    .from('operation_charges')
    .select('user_id, label, ordre')
    .eq('operation_id', id)
    .order('ordre');
  if (err) return error(res, err.message);
  success(res, data || []);
};

const updateCharges = async (req, res) => {
  // charges = [{ user_id, label, ordre }]
  const { id } = req.params;
  const { charges = [] } = req.body;

  await supabaseAdmin.from('operation_charges').delete().eq('operation_id', id);

  if (charges.length > 0) {
    const rows = charges.map((c, i) => ({
      operation_id: id,
      user_id: c.user_id,
      label:   c.label || null,
      ordre:   c.ordre ?? i + 1,
    }));
    const { error: err } = await supabaseAdmin.from('operation_charges').insert(rows);
    if (err) return error(res, err.message);
  }

  // Mettre à jour charged_id = premier chargé (rétro-compat)
  const firstUserId = charges[0]?.user_id || null;
  await supabaseAdmin.from('operations').update({ charged_id: firstUserId }).eq('id', id);

  success(res, { updated: true });
};

module.exports = { getAll, getById, create, update, remove, getKPIs, uploadImage, getCharges, updateCharges };
