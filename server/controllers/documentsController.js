const { supabaseAdmin } = require('../utils/supabase');
const { success, error } = require('../utils/response');
const archiver = require('archiver');

const BUCKET = 'Documents';

function slugify(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

const getCategories = async (req, res) => {
  try {
    const { data, error: err } = await supabaseAdmin.from('categories_documents').select('*').order('ordre');
    if (err) throw err;
    success(res, data || []);
  } catch (err) { error(res, err.message); }
};

const getDocuments = async (req, res) => {
  try {
    const { categorie_id, q } = req.query;
    let query = supabaseAdmin.from('documents')
      .select('*, categories_documents(libelle, icone, ordre)')
      .eq('operation_id', req.params.id)
      .order('created_at', { ascending: false });
    if (categorie_id) query = query.eq('categorie_id', categorie_id);
    if (q) query = query.ilike('nom_affichage', `%${q}%`);
    const { data, error: err } = await query;
    if (err) throw err;
    success(res, data || []);
  } catch (err) { error(res, err.message); }
};

const uploadDocument = async (req, res) => {
  try {
    if (!req.file) return error(res, 'Fichier manquant', 400);
    const { nom_affichage, categorie_id, description, fichier_parent_id } = req.body;
    const operationId = req.params.id;

    let version = 1;
    if (fichier_parent_id) {
      const { data: parent } = await supabaseAdmin.from('documents').select('version').eq('id', fichier_parent_id).single();
      version = (parent?.version || 0) + 1;
    }

    const ts = Date.now();
    const safeName = slugify(req.file.originalname);
    const storagePath = `${operationId}/${ts}_${safeName}`;

    const { error: uploadErr } = await supabaseAdmin.storage.from(BUCKET)
      .upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (uploadErr) throw uploadErr;

    const { data, error: dbErr } = await supabaseAdmin.from('documents').insert([{
      operation_id:     operationId,
      categorie_id:     categorie_id || null,
      nom_fichier:      req.file.originalname,
      nom_affichage:    nom_affichage || req.file.originalname,
      description:      description || null,
      version,
      fichier_parent_id: fichier_parent_id || null,
      taille_octets:    req.file.size,
      type_mime:        req.file.mimetype,
      storage_path:     storagePath,
      uploaded_by:      req.user?.id || null
    }]).select('*, categories_documents(libelle, icone, ordre)').single();
    if (dbErr) throw dbErr;
    success(res, data, 201);
  } catch (err) { error(res, err.message); }
};

const downloadDocument = async (req, res) => {
  try {
    const { data: doc } = await supabaseAdmin.from('documents').select('*').eq('id', req.params.docId).single();
    if (!doc) return error(res, 'Document introuvable', 404);

    const { data: fileData, error: dlErr } = await supabaseAdmin.storage.from(BUCKET).download(doc.storage_path);
    if (dlErr) throw dlErr;

    const buffer = Buffer.from(await fileData.arrayBuffer());
    res.setHeader('Content-Type', doc.type_mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.nom_affichage)}"`);
    res.send(buffer);
  } catch (err) { error(res, err.message); }
};

const deleteDocument = async (req, res) => {
  try {
    const { data: doc } = await supabaseAdmin.from('documents').select('*').eq('id', req.params.docId).single();
    if (!doc) return error(res, 'Document introuvable', 404);
    await supabaseAdmin.storage.from(BUCKET).remove([doc.storage_path]);
    await supabaseAdmin.from('documents').delete().eq('id', req.params.docId);
    success(res, { deleted: true });
  } catch (err) { error(res, err.message); }
};

const getVersions = async (req, res) => {
  try {
    const { data: doc } = await supabaseAdmin.from('documents').select('id, fichier_parent_id').eq('id', req.params.docId).single();
    if (!doc) return error(res, 'Document introuvable', 404);
    const rootId = doc.fichier_parent_id || doc.id;
    const { data } = await supabaseAdmin.from('documents').select('id, version, nom_affichage, created_at, taille_octets')
      .or(`id.eq.${rootId},fichier_parent_id.eq.${rootId}`).order('version');
    success(res, data || []);
  } catch (err) { error(res, err.message); }
};

const downloadZip = async (req, res) => {
  try {
    const { data: docs } = await supabaseAdmin.from('documents')
      .select('*, categories_documents(libelle, ordre)').eq('operation_id', req.params.id);
    if (!docs?.length) return error(res, 'Aucun document', 404);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="documents-${req.params.id}.zip"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);

    for (const doc of docs) {
      const { data: fileData, error: dlErr } = await supabaseAdmin.storage.from(BUCKET).download(doc.storage_path);
      if (dlErr) continue;
      const buf = Buffer.from(await fileData.arrayBuffer());
      const folder = doc.categories_documents
        ? `${String(doc.categories_documents.ordre).padStart(2, '0')}_${slugify(doc.categories_documents.libelle)}`
        : '09_Autres';
      const filename = `${doc.nom_affichage}${doc.version > 1 ? `_v${doc.version}` : ''}`;
      archive.append(buf, { name: `${folder}/${filename}` });
    }
    await archive.finalize();
  } catch (err) { error(res, err.message); }
};

module.exports = { getCategories, getDocuments, uploadDocument, downloadDocument, deleteDocument, getVersions, downloadZip };
