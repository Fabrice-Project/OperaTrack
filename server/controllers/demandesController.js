const { supabaseAdmin } = require('../utils/supabase');
const { success, error } = require('../utils/response');

const BUCKET_DEMANDES = 'demandes-photos';

function slugifyPhoto(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9.]/gi, '_').toLowerCase();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function auteurInfo(req) {
  return {
    auteur_id:   req.user.id,
    auteur_nom:  req.user.user_metadata?.full_name || req.user.email,
    auteur_role: req.role,
  };
}

async function insertHistorique(entries) {
  if (!entries.length) return;
  await supabaseAdmin.from('demandes_intervention_historique').insert(entries);
}

// ── GET /api/v1/demandes ──────────────────────────────────────────────────────
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

// ── POST /api/v1/demandes ─────────────────────────────────────────────────────
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

    // Historique : création
    await insertHistorique([{
      demande_id:    data.id,
      ...auteurInfo(req),
      type:          'creation',
      nouveau_statut: 'nouvelle',
      message:       titre.trim(),
    }]);

    success(res, data, 201);
  } catch (err) { error(res, err.message); }
};

// ── PUT /api/v1/demandes/:id  (gestionnaire/admin uniquement) ─────────────────
const updateDemande = async (req, res) => {
  try {
    const { id } = req.params;
    const { statut, commentaire_gestionnaire, intervention_id } = req.body;

    // Lire l'état actuel pour détecter les changements
    const { data: existing } = await supabaseAdmin
      .from('demandes_intervention')
      .select('statut, commentaire_gestionnaire')
      .eq('id', id)
      .single();

    const updates = { updated_at: new Date().toISOString() };
    if (statut                   !== undefined) updates.statut                   = statut;
    if (commentaire_gestionnaire !== undefined) updates.commentaire_gestionnaire = commentaire_gestionnaire || null;
    if (intervention_id          !== undefined) updates.intervention_id          = intervention_id || null;

    const { data, error: err } = await supabaseAdmin
      .from('demandes_intervention')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (err) throw err;

    // Historique
    const entries = [];
    const info = auteurInfo(req);

    if (statut !== undefined && existing && statut !== existing.statut) {
      entries.push({
        demande_id:    id,
        ...info,
        type:          'statut',
        ancien_statut: existing.statut,
        nouveau_statut: statut,
      });
    }
    if (commentaire_gestionnaire !== undefined && commentaire_gestionnaire?.trim()) {
      entries.push({
        demande_id: id,
        ...info,
        type:       'commentaire',
        message:    commentaire_gestionnaire.trim(),
      });
    }
    await insertHistorique(entries);

    success(res, data);
  } catch (err) { error(res, err.message); }
};

// ── GET /api/v1/demandes/:id/historique ──────────────────────────────────────
const getHistorique = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error: err } = await supabaseAdmin
      .from('demandes_intervention_historique')
      .select('*')
      .eq('demande_id', id)
      .order('created_at', { ascending: true });
    if (err) throw err;
    success(res, data || []);
  } catch (err) { error(res, err.message); }
};

// ── POST /api/v1/demandes/:id/messages  (tout utilisateur authentifié) ────────
const addMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    if (!message?.trim()) return error(res, 'Message requis', 400);

    const { data, error: err } = await supabaseAdmin
      .from('demandes_intervention_historique')
      .insert([{
        demande_id: id,
        ...auteurInfo(req),
        type:    'message',
        message: message.trim(),
      }])
      .select('*')
      .single();

    if (err) throw err;
    success(res, data, 201);
  } catch (err) { error(res, err.message); }
};

// ── GET /api/v1/demandes/:id/photos ──────────────────────────────────────────
const getPhotos = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error: err } = await supabaseAdmin
      .from('demandes_intervention_photos')
      .select('*')
      .eq('demande_id', id)
      .order('created_at');
    if (err) throw err;
    success(res, data || []);
  } catch (err) { error(res, err.message); }
};

// ── POST /api/v1/demandes/:id/photos  (multipart/form-data, champ "photo") ───
const uploadPhoto = async (req, res) => {
  try {
    if (!req.file) return error(res, 'Fichier manquant', 400);
    const { id } = req.params;
    const ts = Date.now();
    const safeName = slugifyPhoto(req.file.originalname);
    const storagePath = `demandes/${id}/${ts}_${safeName}`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(BUCKET_DEMANDES)
      .upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (uploadErr) return error(res, uploadErr.message);

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(BUCKET_DEMANDES)
      .getPublicUrl(storagePath);

    const { data, error: dbErr } = await supabaseAdmin
      .from('demandes_intervention_photos')
      .insert([{
        demande_id:   id,
        storage_path: storagePath,
        url:          publicUrl,
        nom:          req.file.originalname,
        taille:       req.file.size,
        type_mime:    req.file.mimetype,
      }])
      .select()
      .single();

    if (dbErr) {
      await supabaseAdmin.storage.from(BUCKET_DEMANDES).remove([storagePath]);
      throw dbErr;
    }
    success(res, data, 201);
  } catch (err) { error(res, err.message); }
};

// ── DELETE /api/v1/demandes/:id/photos/:photoId ───────────────────────────────
const deletePhoto = async (req, res) => {
  try {
    const { photoId } = req.params;
    const { data: photo } = await supabaseAdmin
      .from('demandes_intervention_photos')
      .select('storage_path')
      .eq('id', photoId)
      .single();
    if (!photo) return error(res, 'Photo introuvable', 404);
    await supabaseAdmin.storage.from(BUCKET_DEMANDES).remove([photo.storage_path]);
    await supabaseAdmin.from('demandes_intervention_photos').delete().eq('id', photoId);
    success(res, { deleted: true });
  } catch (err) { error(res, err.message); }
};

module.exports = { getDemandes, createDemande, updateDemande, getHistorique, addMessage, getPhotos, uploadPhoto, deletePhoto };
