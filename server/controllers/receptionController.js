const { supabaseAdmin } = require('../utils/supabase');
const { success, error } = require('../utils/response');

// ── RÉSERVES ──────────────────────────────────────────────────

const getReserves = async (req, res) => {
  try {
    const { data, error: err } = await supabaseAdmin
      .from('reserves').select('*').eq('operation_id', req.params.id).order('numero');
    if (err) throw err;
    success(res, data || []);
  } catch (err) { error(res, err.message); }
};

const createReserve = async (req, res) => {
  try {
    const { description, lot_concerne, responsable, delai_levee, commentaire } = req.body;
    if (!description) return error(res, 'Description obligatoire', 400);

    // Numéro auto-incrémenté
    const { data: existing } = await supabaseAdmin
      .from('reserves').select('numero').eq('operation_id', req.params.id).order('numero', { ascending: false }).limit(1);
    const numero = (existing?.[0]?.numero || 0) + 1;

    const { data, error: err } = await supabaseAdmin.from('reserves').insert([{
      operation_id: req.params.id, numero, description,
      lot_concerne: lot_concerne || null, responsable: responsable || null,
      delai_levee: delai_levee || null, commentaire: commentaire || null,
      statut: 'ouverte'
    }]).select().single();
    if (err) throw err;
    success(res, data, 201);
  } catch (err) { error(res, err.message); }
};

const updateReserve = async (req, res) => {
  try {
    const { description, lot_concerne, responsable, delai_levee, statut, commentaire } = req.body;
    const updates = {};
    if (description !== undefined)  updates.description   = description;
    if (lot_concerne !== undefined)  updates.lot_concerne  = lot_concerne || null;
    if (responsable !== undefined)   updates.responsable   = responsable || null;
    if (delai_levee !== undefined)   updates.delai_levee   = delai_levee || null;
    if (statut !== undefined)        updates.statut        = statut;
    if (commentaire !== undefined)   updates.commentaire   = commentaire || null;

    const { data, error: err } = await supabaseAdmin.from('reserves')
      .update(updates).eq('id', req.params.reserveId).select().single();
    if (err) throw err;
    success(res, data);
  } catch (err) { error(res, err.message); }
};

const leverReserve = async (req, res) => {
  try {
    const { date_levee, commentaire } = req.body;
    if (!date_levee) return error(res, 'Date de levée obligatoire', 400);
    const { data, error: err } = await supabaseAdmin.from('reserves')
      .update({ statut: 'levee', date_levee, commentaire: commentaire || null })
      .eq('id', req.params.reserveId).select().single();
    if (err) throw err;
    success(res, data);
  } catch (err) { error(res, err.message); }
};

const deleteReserve = async (req, res) => {
  try {
    const { error: err } = await supabaseAdmin.from('reserves').delete().eq('id', req.params.reserveId);
    if (err) throw err;
    success(res, { deleted: true });
  } catch (err) { error(res, err.message); }
};

// ── DGD ───────────────────────────────────────────────────────

const getDGDs = async (req, res) => {
  try {
    const { data: marches } = await supabaseAdmin
      .from('marches').select('id, numero, objet, titulaire, montant_ht')
      .eq('operation_id', req.params.id).order('numero');

    const marcheIds = (marches || []).map(m => m.id);
    let dgds = [];
    if (marcheIds.length > 0) {
      const { data } = await supabaseAdmin.from('dgd').select('*').in('marche_id', marcheIds);
      dgds = data || [];
    }

    const dgdByMarche = Object.fromEntries(dgds.map(d => [d.marche_id, d]));
    const result = (marches || []).map(m => ({
      ...m,
      dgd: dgdByMarche[m.id] || null
    }));
    success(res, result);
  } catch (err) { error(res, err.message); }
};

const upsertDGD = async (req, res) => {
  try {
    const { marche_id, montant_ht, date_dgd, statut, commentaire } = req.body;
    if (!marche_id) return error(res, 'marche_id obligatoire', 400);

    const { data, error: err } = await supabaseAdmin.from('dgd')
      .upsert({
        marche_id,
        montant_ht: montant_ht ? parseFloat(montant_ht) : null,
        date_dgd: date_dgd || null,
        statut: statut || 'non_etabli',
        commentaire: commentaire || null,
      }, { onConflict: 'marche_id' })
      .select().single();
    if (err) throw err;
    success(res, data);
  } catch (err) { error(res, err.message); }
};

// ── SOLDER L'OPÉRATION ───────────────────────────────────────

const solderOperation = async (req, res) => {
  try {
    if (req.role !== 'admin') return error(res, 'Accès refusé', 403);

    const { data: op } = await supabaseAdmin.from('operations').select('id, date_reception').eq('id', req.params.id).single();
    if (!op) return error(res, 'Opération introuvable', 404);
    if (!op.date_reception) return error(res, 'Réception non enregistrée', 400);

    // Vérifier réserves
    const { data: reserves } = await supabaseAdmin.from('reserves')
      .select('statut').eq('operation_id', req.params.id).neq('statut', 'levee');
    if (reserves?.length > 0) return error(res, 'Des réserves ne sont pas encore levées', 400);

    // Vérifier DGD
    const { data: marches } = await supabaseAdmin.from('marches').select('id').eq('operation_id', req.params.id);
    if (marches?.length > 0) {
      const { data: dgds } = await supabaseAdmin.from('dgd')
        .select('statut').in('marche_id', marches.map(m => m.id)).neq('statut', 'solde');
      if (dgds?.length > 0) return error(res, 'Des DGD ne sont pas encore soldés', 400);
    }

    const { data, error: err } = await supabaseAdmin.from('operations')
      .update({ statut: 'soldee' }).eq('id', req.params.id).select().single();
    if (err) throw err;
    success(res, data);
  } catch (err) { error(res, err.message); }
};

module.exports = { getReserves, createReserve, updateReserve, leverReserve, deleteReserve, getDGDs, upsertDGD, solderOperation };
