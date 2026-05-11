const { supabaseAdmin } = require('../utils/supabase');
const { success, error } = require('../utils/response');

const NIVEAU_SCORE = { non_renseigne: -1, non_concerne: 0, partiel: 1, significatif: 2, structurant: 3 };

const getLeviers = async (req, res) => {
  try {
    let query = supabaseAdmin.from('leviers_resilience').select('*').order('volet').order('ordre');
    if (req.query.all !== 'true') query = query.eq('actif', true);
    const { data, error: err } = await query;
    if (err) throw err;
    success(res, data || []);
  } catch (err) { error(res, err.message); }
};

const updateLevier = async (req, res) => {
  try {
    const { libelle, actif, description, ordre } = req.body;
    const updates = {};
    if (libelle !== undefined)     updates.libelle     = libelle;
    if (actif !== undefined)       updates.actif       = actif;
    if (description !== undefined) updates.description = description;
    if (ordre !== undefined)       updates.ordre       = ordre;
    const { data, error: err } = await supabaseAdmin.from('leviers_resilience')
      .update(updates).eq('id', req.params.levierId).select().single();
    if (err) throw err;
    success(res, data);
  } catch (err) { error(res, err.message); }
};

const createLevier = async (req, res) => {
  try {
    const { volet, libelle, description, ordre } = req.body;
    if (!volet || !libelle) return error(res, 'Volet et libellé obligatoires', 400);
    const { data, error: err } = await supabaseAdmin.from('leviers_resilience')
      .insert([{ volet, libelle, description: description || null, ordre: ordre || 99 }])
      .select().single();
    if (err) throw err;
    success(res, data, 201);
  } catch (err) { error(res, err.message); }
};

const getResilience = async (req, res) => {
  try {
    const { data: op, error: opErr } = await supabaseAdmin.from('operations')
      .select('id, resilience_v1, resilience_v2, resilience_v3, resilience_v4, resilience_commentaire, financements_resilience')
      .eq('id', req.params.id).single();
    if (opErr) throw opErr;

    const { data: opLeviers } = await supabaseAdmin.from('operation_leviers')
      .select('levier_id').eq('operation_id', req.params.id);

    const { data: leviers } = await supabaseAdmin.from('leviers_resilience')
      .select('*').eq('actif', true).order('ordre');

    success(res, {
      ...op,
      leviers_actifs: (opLeviers || []).map(l => l.levier_id),
      leviers,
    });
  } catch (err) { error(res, err.message); }
};

const updateResilience = async (req, res) => {
  try {
    const { resilience_v1, resilience_v2, resilience_v3, resilience_v4,
            resilience_commentaire, financements_resilience, leviers_actifs } = req.body;

    const updates = {};
    if (resilience_v1 !== undefined) updates.resilience_v1 = resilience_v1;
    if (resilience_v2 !== undefined) updates.resilience_v2 = resilience_v2;
    if (resilience_v3 !== undefined) updates.resilience_v3 = resilience_v3;
    if (resilience_v4 !== undefined) updates.resilience_v4 = resilience_v4;
    if (resilience_commentaire !== undefined) updates.resilience_commentaire = resilience_commentaire || null;
    if (financements_resilience !== undefined) updates.financements_resilience = financements_resilience || null;

    const { error: opErr } = await supabaseAdmin.from('operations')
      .update(updates).eq('id', req.params.id);
    if (opErr) throw opErr;

    // Synchroniser les leviers
    if (Array.isArray(leviers_actifs)) {
      await supabaseAdmin.from('operation_leviers').delete().eq('operation_id', req.params.id);
      if (leviers_actifs.length > 0) {
        const rows = leviers_actifs.map(levier_id => ({ operation_id: req.params.id, levier_id }));
        await supabaseAdmin.from('operation_leviers').insert(rows);
      }
    }

    const updated = await getResilienceData(req.params.id);
    success(res, updated);
  } catch (err) { error(res, err.message); }
};

async function getResilienceData(operationId) {
  const { data: op } = await supabaseAdmin.from('operations')
    .select('id, resilience_v1, resilience_v2, resilience_v3, resilience_v4, resilience_commentaire, financements_resilience')
    .eq('id', operationId).single();
  const { data: opLeviers } = await supabaseAdmin.from('operation_leviers')
    .select('levier_id').eq('operation_id', operationId);
  const { data: leviers } = await supabaseAdmin.from('leviers_resilience')
    .select('*').eq('actif', true).order('ordre');
  return { ...op, leviers_actifs: (opLeviers || []).map(l => l.levier_id), leviers };
}

// ── DASHBOARD MANDAT ─────────────────────────────────────────

const getMandatDashboard = async (req, res) => {
  try {
    const { data: operations } = await supabaseAdmin.from('operations').select('*');
    const ops = operations || [];

    // Métriques globales
    const total = ops.length;
    const lancees = ops.filter(op => !['etudes'].includes(op.statut)).length;
    const livrees = ops.filter(op => ['reception', 'soldee'].includes(op.statut)).length;
    const volumeTotal = ops.reduce((s, op) => s + parseFloat(op.enveloppe_ht || 0), 0);
    const mandate = ops.reduce((s, op) => s + parseFloat(op.montant_mandate || 0), 0);
    const tauxExecution = volumeTotal > 0 ? Math.round((mandate / volumeTotal) * 100) : 0;

    // Répartition par type
    const parType = {
      construction_neuve: ops.filter(op => op.type === 'construction_neuve').length,
      rehabilitation: ops.filter(op => op.type === 'rehabilitation').length,
      amenagement_vrd: ops.filter(op => op.type === 'amenagement_vrd').length,
    };

    // Répartition par statut
    const statuts = ['etudes', 'consultation', 'travaux', 'reception', 'soldee'];
    const parStatut = Object.fromEntries(statuts.map(s => [s, ops.filter(op => op.statut === s).length]));

    // Concordance résilience
    const niveaux = ['non_renseigne', 'non_concerne', 'partiel', 'significatif', 'structurant'];
    const scoreMap = { non_renseigne: 0, non_concerne: 0, partiel: 1, significatif: 2, structurant: 3 };
    const resilience = [1, 2, 3, 4].map(v => {
      const key = `resilience_v${v}`;
      const scores = ops.map(op => scoreMap[op[key]] || 0);
      return { volet: v, score: scores.reduce((a, b) => a + b, 0) / Math.max(scores.length, 1) };
    });

    // Concordance par opération
    const concordanceOps = ops.map(op => {
      const score = [1, 2, 3, 4].filter(v => {
        const niveau = op[`resilience_v${v}`];
        return niveau && niveau !== 'non_renseigne' && niveau !== 'non_concerne';
      }).length;
      return {
        id: op.id, intitule: op.intitule,
        v1: op.resilience_v1, v2: op.resilience_v2,
        v3: op.resilience_v3, v4: op.resilience_v4,
        score,
      };
    });

    const pleinementResilientes = concordanceOps.filter(op => op.score === 4).length;
    const nonRenseignees = ops.filter(op =>
      ['resilience_v1','resilience_v2','resilience_v3','resilience_v4'].every(k => op[k] === 'non_renseigne')
    ).length;

    // Engagements
    const { data: engagements } = await supabaseAdmin.from('engagements_mandat')
      .select('*, operation_engagements(operation_id, contribution)').order('ordre');

    const engagementsAvecProgres = (engagements || []).map(eng => {
      const totalContrib = (eng.operation_engagements || []).reduce((s, oe) => s + parseFloat(oe.contribution || 0), 0);
      const pct = eng.cible > 0 ? Math.round((totalContrib / eng.cible) * 100) : 0;
      return { ...eng, realise: totalContrib, pct };
    });

    success(res, {
      metriques: { total, lancees, livrees, volumeTotal, mandate, tauxExecution },
      parType,
      parStatut,
      resilience,
      concordanceOps,
      pleinementResilientes,
      nonRenseignees,
      engagements: engagementsAvecProgres,
    });
  } catch (err) { error(res, err.message); }
};

// ── ENGAGEMENTS ───────────────────────────────────────────────

const getEngagements = async (req, res) => {
  try {
    const { data, error: err } = await supabaseAdmin.from('engagements_mandat')
      .select('*, operation_engagements(operation_id, contribution, operations(intitule))')
      .order('ordre');
    if (err) throw err;
    success(res, data || []);
  } catch (err) { error(res, err.message); }
};

const createEngagement = async (req, res) => {
  try {
    const { intitule, description, cible, unite, date_echeance, ordre } = req.body;
    if (!intitule) return error(res, 'Intitulé obligatoire', 400);
    const { data, error: err } = await supabaseAdmin.from('engagements_mandat')
      .insert([{ intitule, description: description || null, cible: cible ? parseFloat(cible) : null,
                 unite: unite || null, date_echeance: date_echeance || null, ordre: ordre || 99 }])
      .select().single();
    if (err) throw err;
    success(res, data, 201);
  } catch (err) { error(res, err.message); }
};

const updateEngagement = async (req, res) => {
  try {
    const { intitule, description, cible, unite, date_echeance, ordre } = req.body;
    const { data, error: err } = await supabaseAdmin.from('engagements_mandat')
      .update({ intitule, description: description || null, cible: cible ? parseFloat(cible) : null,
                unite: unite || null, date_echeance: date_echeance || null, ordre: ordre || 99 })
      .eq('id', req.params.engagementId).select().single();
    if (err) throw err;
    success(res, data);
  } catch (err) { error(res, err.message); }
};

const deleteEngagement = async (req, res) => {
  try {
    const { error: err } = await supabaseAdmin.from('engagements_mandat').delete().eq('id', req.params.engagementId);
    if (err) throw err;
    success(res, { deleted: true });
  } catch (err) { error(res, err.message); }
};

const getOperationEngagements = async (req, res) => {
  try {
    const { data: all, error: err } = await supabaseAdmin
      .from('engagements_mandat')
      .select('id, intitule, description, cible, unite, date_echeance, ordre')
      .order('ordre');
    if (err) throw err;

    const { data: links } = await supabaseAdmin
      .from('operation_engagements')
      .select('engagement_id, contribution')
      .eq('operation_id', req.params.id);

    const linkMap = Object.fromEntries((links || []).map(l => [l.engagement_id, l.contribution]));
    const result = (all || []).map(eng => ({
      ...eng,
      linked: eng.id in linkMap,
      contribution: linkMap[eng.id] ?? null,
    }));

    success(res, result);
  } catch (err) { error(res, err.message); }
};

const updateOperationEngagements = async (req, res) => {
  try {
    const { engagements } = req.body; // [{ engagement_id, contribution }]
    await supabaseAdmin.from('operation_engagements').delete().eq('operation_id', req.params.id);
    if (engagements?.length > 0) {
      const rows = engagements.map(e => ({
        operation_id: req.params.id,
        engagement_id: e.engagement_id,
        contribution: parseFloat(e.contribution || 1),
      }));
      await supabaseAdmin.from('operation_engagements').insert(rows);
    }
    success(res, { updated: true });
  } catch (err) { error(res, err.message); }
};

module.exports = {
  getLeviers, updateLevier, createLevier,
  getResilience, updateResilience,
  getMandatDashboard,
  getEngagements, createEngagement, updateEngagement, deleteEngagement,
  getOperationEngagements, updateOperationEngagements,
};
