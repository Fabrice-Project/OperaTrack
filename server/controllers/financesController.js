const { validationResult } = require('express-validator');
const { supabaseAdmin } = require('../utils/supabase');
const { success, error } = require('../utils/response');

const getSynthese = async (req, res) => {
  const { id: operationId } = req.params;

  const [{ data: op }, { data: mouvements }, { data: marches }] = await Promise.all([
    supabaseAdmin.from('operations').select('*').eq('id', operationId).single(),
    supabaseAdmin.from('mouvements_financiers').select('*').eq('operation_id', operationId).order('date_mouvement', { ascending: false }),
    supabaseAdmin.from('marches').select('*, avenants(*)').eq('operation_id', operationId)
  ]);

  if (!op) return error(res, 'Opération non trouvée', 404);

  const montantEngage = parseFloat(op.montant_engage || 0);
  const montantMandate = parseFloat(op.montant_mandate || 0);
  const enveloppe = parseFloat(op.enveloppe_ht || 0);

  const montantMarches = (marches || []).reduce((sum, m) => sum + parseFloat(m.montant_initial_ht || 0), 0);
  const montantAvenants = (marches || []).reduce((sum, m) =>
    sum + (m.avenants || []).reduce((s, a) => s + parseFloat(a.montant_ht || 0), 0), 0);

  success(res, {
    enveloppe_ht: enveloppe,
    montant_engage: montantEngage,
    montant_mandate: montantMandate,
    montant_marches: montantMarches,
    montant_avenants: montantAvenants,
    reste_a_depenser: enveloppe - montantEngage,
    reste_a_mandater: montantEngage - montantMandate,
    solde_disponible: enveloppe - montantMandate,
    taux_engagement: enveloppe > 0 ? Math.round((montantEngage / enveloppe) * 1000) / 10 : 0,
    taux_mandatement: montantEngage > 0 ? Math.round((montantMandate / montantEngage) * 1000) / 10 : 0,
    alerte_depassement: montantEngage > enveloppe * 1.05,
    nb_marches: (marches || []).length,
    mode_financier: op.mode_financier
  });
};

const getCreditsPaiement = async (req, res) => {
  const { id: operationId } = req.params;
  const { data, error: dbErr } = await supabaseAdmin
    .from('credits_paiement')
    .select('*')
    .eq('operation_id', operationId)
    .order('annee', { ascending: true });

  if (dbErr) return error(res, dbErr.message);
  success(res, data);
};

const upsertCreditPaiement = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, errors.array().map(e => e.msg).join(', '), 400);

  const { id: operationId } = req.params;
  const { annee, montant_prevu, montant_mandate } = req.body;

  const { data, error: dbErr } = await supabaseAdmin
    .from('credits_paiement')
    .upsert({ operation_id: operationId, annee: parseInt(annee), montant_prevu: parseFloat(montant_prevu), montant_mandate: parseFloat(montant_mandate || 0) }, { onConflict: 'operation_id,annee' })
    .select()
    .single();

  if (dbErr) return error(res, dbErr.message);
  success(res, data);
};

const deleteCreditPaiement = async (req, res) => {
  const { cpId } = req.params;
  const { error: dbErr } = await supabaseAdmin.from('credits_paiement').delete().eq('id', cpId);
  if (dbErr) return error(res, dbErr.message);
  success(res, { id: cpId });
};

const getMouvements = async (req, res) => {
  const { id: operationId } = req.params;
  const { data, error: dbErr } = await supabaseAdmin
    .from('mouvements_financiers')
    .select('*, marches(id, numero, intitule, titulaire_nom)')
    .eq('operation_id', operationId)
    .order('date_mouvement', { ascending: false });

  if (dbErr) return error(res, dbErr.message);
  success(res, data);
};

const createMouvement = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, errors.array().map(e => e.msg).join(', '), 400);

  const { id: operationId } = req.params;
  const { type, libelle, montant, date_mouvement, reference, commentaire, marche_id } = req.body;

  const { data, error: dbErr } = await supabaseAdmin
    .from('mouvements_financiers')
    .insert({ operation_id: operationId, marche_id: marche_id || null, type, libelle, montant: parseFloat(montant), date_mouvement, reference, commentaire })
    .select('*, marches(id, numero, intitule, titulaire_nom)')
    .single();

  if (dbErr) return error(res, dbErr.message);

  // Recalculer les totaux sur l'opération
  await recalculerTotaux(operationId);

  success(res, data, 201);
};

const deleteMouvement = async (req, res) => {
  const { mvtId } = req.params;

  const { data: mvt } = await supabaseAdmin.from('mouvements_financiers').select('operation_id').eq('id', mvtId).single();
  const { error: dbErr } = await supabaseAdmin.from('mouvements_financiers').delete().eq('id', mvtId);
  if (dbErr) return error(res, dbErr.message);

  if (mvt?.operation_id) await recalculerTotaux(mvt.operation_id);

  success(res, { id: mvtId });
};

async function recalculerTotaux(operationId) {
  const { data: mouvements } = await supabaseAdmin
    .from('mouvements_financiers')
    .select('type, montant, date_mouvement')
    .eq('operation_id', operationId);

  if (!mouvements) return;

  const engage  = mouvements.filter(m => m.type === 'engagement').reduce((s, m) => s + parseFloat(m.montant), 0);
  const mandate = mouvements.filter(m => m.type === 'mandatement').reduce((s, m) => s + parseFloat(m.montant), 0);

  // Mettre à jour les totaux globaux de l'opération
  await supabaseAdmin.from('operations').update({ montant_engage: engage, montant_mandate: mandate }).eq('id', operationId);

  // Recalculer le montant mandaté par année dans les crédits de paiement
  // Regrouper les mandatements par année
  const mandatementsParAnnee = {};
  mouvements.filter(m => m.type === 'mandatement').forEach(m => {
    const annee = new Date(m.date_mouvement).getFullYear();
    mandatementsParAnnee[annee] = (mandatementsParAnnee[annee] || 0) + parseFloat(m.montant);
  });

  // Récupérer les crédits de paiement existants pour cette opération
  const { data: credits } = await supabaseAdmin
    .from('credits_paiement')
    .select('id, annee')
    .eq('operation_id', operationId);

  if (credits && credits.length > 0) {
    // Mettre à jour chaque ligne CP avec le total mandaté de l'année correspondante
    await Promise.all(credits.map(cp => {
      const mandateAnnee = mandatementsParAnnee[cp.annee] || 0;
      return supabaseAdmin
        .from('credits_paiement')
        .update({ montant_mandate: mandateAnnee })
        .eq('id', cp.id);
    }));
  }
}

module.exports = { getSynthese, getCreditsPaiement, upsertCreditPaiement, deleteCreditPaiement, getMouvements, createMouvement, deleteMouvement, recalculerTotaux };
