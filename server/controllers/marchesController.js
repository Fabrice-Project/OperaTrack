const { validationResult } = require('express-validator');
const { supabaseAdmin } = require('../utils/supabase');
const { success, error } = require('../utils/response');
const { recalculerTotaux } = require('./financesController');

const getByOperation = async (req, res) => {
  const { id: operationId } = req.params;
  const { data, error: dbErr } = await supabaseAdmin
    .from('marches')
    .select('*, avenants(*), ordres_de_service(*)')
    .eq('operation_id', operationId)
    .order('date_notification', { ascending: true });

  if (dbErr) return error(res, dbErr.message);

  const today = new Date();
  const enriched = (data || []).map(m => {
    const totalAvenants = (m.avenants || []).reduce((s, a) => s + parseFloat(a.montant_ht || 0), 0);
    const montantActuel = parseFloat(m.montant_initial_ht || 0) + totalAvenants;
    const finPrev = m.date_fin_prev ? new Date(m.date_fin_prev) : null;
    const daysToEnd = finPrev ? Math.ceil((finPrev - today) / (1000 * 60 * 60 * 24)) : null;
    return {
      ...m,
      montant_actuel_ht: montantActuel,
      total_avenants: totalAvenants,
      alerte_echeance: daysToEnd !== null && daysToEnd >= 0 && daysToEnd <= 30,
      jours_avant_echeance: daysToEnd
    };
  });

  success(res, enriched);
};

const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, errors.array().map(e => e.msg).join(', '), 400);

  const { id: operationId } = req.params;
  const payload = buildPayload(req.body, operationId);

  const { data, error: dbErr } = await supabaseAdmin
    .from('marches').insert(payload).select().single();

  if (dbErr) return error(res, dbErr.message);

  // Ajouter un engagement automatique
  if (req.body.create_engagement !== false) {
    await supabaseAdmin.from('mouvements_financiers').insert({
      operation_id: operationId,
      type: 'engagement',
      libelle: `Engagement marché ${payload.numero} — ${payload.titulaire_nom || payload.intitule}`,
      montant: payload.montant_initial_ht,
      date_mouvement: payload.date_notification || new Date().toISOString().split('T')[0],
      reference: `ENG-${payload.numero}`
    });
    await recalculerTotaux(operationId);
  }

  success(res, data, 201);
};

const update = async (req, res) => {
  const { id } = req.params;
  const { data: existing } = await supabaseAdmin.from('marches').select('operation_id').eq('id', id).single();
  if (!existing) return error(res, 'Marché non trouvé', 404);

  const payload = buildPayload(req.body, existing.operation_id);
  const { data, error: dbErr } = await supabaseAdmin.from('marches').update(payload).eq('id', id).select().single();
  if (dbErr) return error(res, dbErr.message);

  success(res, data);
};

const remove = async (req, res) => {
  const { id } = req.params;
  const { data: marche } = await supabaseAdmin.from('marches').select('operation_id').eq('id', id).single();
  const { error: dbErr } = await supabaseAdmin.from('marches').delete().eq('id', id);
  if (dbErr) return error(res, dbErr.message);
  if (marche?.operation_id) await recalculerTotaux(marche.operation_id);
  success(res, { id });
};

const getAvenants = async (req, res) => {
  const { id: marcheId } = req.params;
  const { data, error: dbErr } = await supabaseAdmin
    .from('avenants').select('*').eq('marche_id', marcheId).order('numero', { ascending: true });
  if (dbErr) return error(res, dbErr.message);
  success(res, data);
};

const createAvenant = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, errors.array().map(e => e.msg).join(', '), 400);

  const { id: marcheId } = req.params;
  const { data: marche } = await supabaseAdmin.from('marches').select('operation_id, montant_initial_ht').eq('id', marcheId).single();
  if (!marche) return error(res, 'Marché non trouvé', 404);

  // Numéro auto-incrémenté
  const { data: last } = await supabaseAdmin.from('avenants').select('numero').eq('marche_id', marcheId).order('numero', { ascending: false }).limit(1).single();
  const numero = (last?.numero || 0) + 1;

  const { data, error: dbErr } = await supabaseAdmin.from('avenants').insert({
    marche_id: marcheId,
    numero,
    objet: req.body.objet,
    montant_ht: parseFloat(req.body.montant_ht),
    date_avenant: req.body.date_avenant,
    commentaire: req.body.commentaire || null
  }).select().single();

  if (dbErr) return error(res, dbErr.message);

  // Recalculer montant_actuel_ht du marché
  const { data: avenants } = await supabaseAdmin.from('avenants').select('montant_ht').eq('marche_id', marcheId);
  const totalAv = (avenants || []).reduce((s, a) => s + parseFloat(a.montant_ht), 0);
  await supabaseAdmin.from('marches').update({ montant_actuel_ht: parseFloat(marche.montant_initial_ht) + totalAv }).eq('id', marcheId);

  // Ajouter un engagement pour l'avenant
  await supabaseAdmin.from('mouvements_financiers').insert({
    operation_id: marche.operation_id,
    type: 'engagement',
    libelle: `Avenant n°${numero} — ${req.body.objet}`,
    montant: Math.abs(parseFloat(req.body.montant_ht)),
    date_mouvement: req.body.date_avenant,
    reference: `AV-${numero}`
  });
  await recalculerTotaux(marche.operation_id);

  success(res, data, 201);
};

const getOS = async (req, res) => {
  const { id: marcheId } = req.params;
  const { data, error: dbErr } = await supabaseAdmin
    .from('ordres_de_service').select('*').eq('marche_id', marcheId).order('date_os', { ascending: true });
  if (dbErr) return error(res, dbErr.message);
  success(res, data);
};

const createOS = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, errors.array().map(e => e.msg).join(', '), 400);

  const { id: marcheId } = req.params;
  const { data: last } = await supabaseAdmin.from('ordres_de_service').select('numero').eq('marche_id', marcheId).order('numero', { ascending: false }).limit(1).single();
  const numero = (last?.numero || 0) + 1;

  const { data, error: dbErr } = await supabaseAdmin.from('ordres_de_service').insert({
    marche_id: marcheId, numero,
    type: req.body.type,
    date_os: req.body.date_os,
    objet: req.body.objet || null
  }).select().single();

  if (dbErr) return error(res, dbErr.message);
  success(res, data, 201);
};

const deleteAvenant = async (req, res) => {
  const { id } = req.params;
  const { error: dbErr } = await supabaseAdmin.from('avenants').delete().eq('id', id);
  if (dbErr) return error(res, dbErr.message);
  success(res, { id });
};

const deleteOS = async (req, res) => {
  const { id } = req.params;
  const { error: dbErr } = await supabaseAdmin.from('ordres_de_service').delete().eq('id', id);
  if (dbErr) return error(res, dbErr.message);
  success(res, { id });
};

function buildPayload(body, operationId) {
  const dateNotif = body.date_notification || null;
  const delai = body.delai_execution ? parseInt(body.delai_execution) : null;
  let dateFinPrev = null;
  if (dateNotif && delai) {
    const d = new Date(dateNotif);
    d.setDate(d.getDate() + delai);
    dateFinPrev = d.toISOString().split('T')[0];
  }
  return {
    operation_id: operationId,
    numero: body.numero,
    intitule: body.intitule,
    type: body.type,
    procedure: body.procedure || null,
    titulaire_nom: body.titulaire_nom || null,
    titulaire_siret: body.titulaire_siret || null,
    montant_initial_ht: parseFloat(body.montant_initial_ht),
    montant_actuel_ht: parseFloat(body.montant_initial_ht),
    date_notification: dateNotif,
    delai_execution: delai,
    date_fin_prev: dateFinPrev,
    date_fin_reelle: body.date_fin_reelle || null,
    statut: body.statut || 'en_cours'
  };
}

module.exports = { getByOperation, create, update, remove, getAvenants, createAvenant, getOS, createOS, deleteAvenant, deleteOS };
