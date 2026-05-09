const { supabaseAdmin } = require('../utils/supabase');
const { success, error } = require('../utils/response');

// GET /api/v1/demandes
// - exploitant : ses propres demandes
// - autres     : toutes les demandes
const getDemandes = async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('demandes_intervention')
      .select('*')
      .order('created_at', { ascending: false });

    if (req.role === 'exploitant') {
      query = query.eq('demandeur_id', req.user.id);
    }

    const { data: demandes, error: err } = await query;
    if (err) throw err;

    // Join manuel — évite les problèmes de cache de schéma Supabase sur tables récentes
    const batimentIds = [...new Set((demandes || []).map(d => d.batiment_id).filter(Boolean))];
    let batimentMap = {};
    if (batimentIds.length > 0) {
      const { data: batiments } = await supabaseAdmin
        .from('batiments')
        .select('id, intitule, adresse')
        .in('id', batimentIds);
      (batiments || []).forEach(b => { batimentMap[b.id] = b; });
    }

    const result = (demandes || []).map(d => ({
      ...d,
      batiment: batimentMap[d.batiment_id] || null,
    }));

    success(res, result);
  } catch (err) { error(res, err.message); }
};

// POST /api/v1/demandes
const createDemande = async (req, res) => {
  try {
    const { batiment_id, titre, description, urgence } = req.body;
    if (!batiment_id || !titre?.trim()) {
      return error(res, 'Bâtiment et titre obligatoires', 400);
    }

    const { data, error: err } = await supabaseAdmin
      .from('demandes_intervention')
      .insert([{
        batiment_id,
        titre:         titre.trim(),
        description:   description?.trim() || null,
        urgence:       urgence || 'normale',
        statut:        'nouvelle',
        demandeur_id:  req.user.id,
        demandeur_nom: req.user.user_metadata?.full_name || req.user.email,
      }])
      .select('*')
      .single();

    if (err) throw err;
    success(res, data, 201);
  } catch (err) { error(res, err.message); }
};

// PUT /api/v1/demandes/:id  (gestionnaire/admin uniquement)
const updateDemande = async (req, res) => {
  try {
    const { id } = req.params;
    const { statut, commentaire_gestionnaire, intervention_id } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (statut !== undefined)                    updates.statut = statut;
    if (commentaire_gestionnaire !== undefined)  updates.commentaire_gestionnaire = commentaire_gestionnaire || null;
    if (intervention_id !== undefined)           updates.intervention_id = intervention_id || null;

    const { data, error: err } = await supabaseAdmin
      .from('demandes_intervention')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (err) throw err;
    success(res, data);
  } catch (err) { error(res, err.message); }
};

module.exports = { getDemandes, createDemande, updateDemande };
