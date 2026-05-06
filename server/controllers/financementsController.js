const { supabaseAdmin } = require('../utils/supabase');
const { success, error } = require('../utils/response');

const FINANCEUR_LABELS = {
  etat:        'État',
  region:      'Région',
  departement: 'Département',
  caph:        'CAPH',
  agglo:       'Agglomération',
  commune:     'Commune',
  anru:        'ANRU',
  dpv:         'DPV',
  autre:       'Autre',
};

const getFinancements = async (req, res) => {
  try {
    const { data, error: err } = await supabaseAdmin
      .from('financements')
      .select('*')
      .eq('operation_id', req.params.id)
      .order('financeur');
    if (err) throw err;
    success(res, data || []);
  } catch (err) { error(res, err.message); }
};

const createFinancement = async (req, res) => {
  try {
    const { financeur, libelle, montant_attribue, montant_verse, date_convention, numero_convention, observations } = req.body;
    if (!financeur || !montant_attribue) return error(res, 'Financeur et montant obligatoires', 400);

    const { data, error: err } = await supabaseAdmin
      .from('financements')
      .insert([{
        operation_id: req.params.id,
        financeur,
        libelle: financeur === 'autre' ? libelle : FINANCEUR_LABELS[financeur],
        montant_attribue: parseFloat(montant_attribue),
        montant_verse: parseFloat(montant_verse || 0),
        date_convention: date_convention || null,
        numero_convention: numero_convention || null,
        observations: observations || null
      }])
      .select()
      .single();
    if (err) throw err;
    success(res, data, 201);
  } catch (err) { error(res, err.message); }
};

const updateFinancement = async (req, res) => {
  try {
    const { montant_attribue, montant_verse, date_convention, numero_convention, observations, libelle } = req.body;
    const { data, error: err } = await supabaseAdmin
      .from('financements')
      .update({
        montant_attribue: parseFloat(montant_attribue),
        montant_verse: parseFloat(montant_verse || 0),
        date_convention: date_convention || null,
        numero_convention: numero_convention || null,
        observations: observations || null,
        libelle: libelle || null
      })
      .eq('id', req.params.financementId)
      .eq('operation_id', req.params.id)
      .select()
      .single();
    if (err) throw err;
    success(res, data);
  } catch (err) { error(res, err.message); }
};

const deleteFinancement = async (req, res) => {
  try {
    const { error: err } = await supabaseAdmin
      .from('financements')
      .delete()
      .eq('id', req.params.financementId)
      .eq('operation_id', req.params.id);
    if (err) throw err;
    success(res, { deleted: true });
  } catch (err) { error(res, err.message); }
};

module.exports = { getFinancements, createFinancement, updateFinancement, deleteFinancement };
