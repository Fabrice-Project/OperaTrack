const { supabaseAdmin } = require('../utils/supabase');
const { success, error } = require('../utils/response');

const JALONS_TYPES = {
  construction_neuve: [
    'Programme validé', 'Permis de construire déposé', 'Permis de construire obtenu',
    'DCE validé', 'Marché notifié', 'OS de démarrage', 'Réception / DOE', 'Fin GPA'
  ],
  rehabilitation: [
    'Diagnostic validé', 'DCE validé', 'Marché notifié',
    'OS de démarrage', 'Réception', 'Fin GPA'
  ],
  amenagement_vrd: [
    'Études préalables validées', 'Enquête publique (si applicable)', 'Marché notifié',
    'OS de démarrage', 'Réception', 'Fin GPA'
  ]
};

function enrich(jalon) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const prev = jalon.date_prevue ? new Date(jalon.date_prevue) : null;
  const reel = jalon.date_reelle ? new Date(jalon.date_reelle) : null;
  let statut, ecart_jours = 0;

  if (reel) {
    statut = 'realise';
    ecart_jours = prev ? Math.round((reel - prev) / 86400000) : 0;
  } else if (!prev) {
    statut = 'non_planifie';
  } else if (prev >= today) {
    statut = 'a_venir';
    ecart_jours = 0;
  } else {
    statut = 'en_retard';
    ecart_jours = Math.round((today - prev) / 86400000);
  }
  return { ...jalon, statut, ecart_jours };
}

const getJalons = async (req, res) => {
  try {
    const { data, error: err } = await supabaseAdmin
      .from('jalons').select('*').eq('operation_id', req.params.id).order('ordre');
    if (err) throw err;
    success(res, (data || []).map(enrich));
  } catch (err) { error(res, err.message); }
};

const createJalon = async (req, res) => {
  try {
    const { intitule, ordre, date_prevue, date_reelle, commentaire } = req.body;
    if (!intitule) return error(res, 'Intitulé obligatoire', 400);
    const { data, error: err } = await supabaseAdmin.from('jalons')
      .insert([{ operation_id: req.params.id, intitule, ordre: ordre ?? 99, date_prevue: date_prevue || null, date_reelle: date_reelle || null, commentaire: commentaire || null }])
      .select().single();
    if (err) throw err;
    success(res, enrich(data), 201);
  } catch (err) { error(res, err.message); }
};

const updateJalon = async (req, res) => {
  try {
    const { intitule, date_prevue, date_reelle, commentaire, ordre } = req.body;
    const updates = {};
    if (intitule !== undefined)   updates.intitule    = intitule;
    if (ordre !== undefined)      updates.ordre       = ordre;
    if (date_prevue !== undefined) updates.date_prevue = date_prevue || null;
    if (date_reelle !== undefined) updates.date_reelle = date_reelle || null;
    if (commentaire !== undefined) updates.commentaire = commentaire || null;

    const { data, error: err } = await supabaseAdmin.from('jalons')
      .update(updates).eq('id', req.params.jalonId).select().single();
    if (err) throw err;
    success(res, enrich(data));
  } catch (err) { error(res, err.message); }
};

const deleteJalon = async (req, res) => {
  try {
    const { error: err } = await supabaseAdmin.from('jalons').delete().eq('id', req.params.jalonId);
    if (err) throw err;
    success(res, { deleted: true });
  } catch (err) { error(res, err.message); }
};

const reorderJalons = async (req, res) => {
  try {
    const { order } = req.body; // [{ id, ordre }, ...]
    await Promise.all(order.map(({ id, ordre }) =>
      supabaseAdmin.from('jalons').update({ ordre }).eq('id', id)
    ));
    success(res, { reordered: true });
  } catch (err) { error(res, err.message); }
};

const seedJalons = async (req, res) => {
  try {
    const { data: op } = await supabaseAdmin.from('operations').select('type').eq('id', req.params.id).single();
    if (!op) return error(res, 'Opération introuvable', 404);
    const types = JALONS_TYPES[op.type];
    if (!types) return error(res, 'Pas de jalons types pour ce type d\'opération', 400);
    await supabaseAdmin.from('jalons').delete().eq('operation_id', req.params.id);
    const rows = types.map((intitule, i) => ({ operation_id: req.params.id, intitule, ordre: i + 1 }));
    const { data, error: err } = await supabaseAdmin.from('jalons').insert(rows).select();
    if (err) throw err;
    success(res, (data || []).map(enrich), 201);
  } catch (err) { error(res, err.message); }
};

module.exports = { getJalons, createJalon, updateJalon, deleteJalon, reorderJalons, seedJalons };
