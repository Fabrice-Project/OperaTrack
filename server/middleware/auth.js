const { supabaseAdmin } = require('../utils/supabase');
const { error } = require('../utils/response');

// ── Helpers rôles — compatibilité anciens et nouveaux noms ───────────────────
const isAdmin         = r => r === 'admin'        || r === 'administrateur';
const isChargeOp      = r => r === 'write'        || r === 'charge_operation';
const isGestPatrim    = r => r === 'gestionnaire_patrimonial';
const isDirecteur     = r => r === 'read'         || r === 'directeur';
const isAdministratif = r => r === 'compta'       || r === 'administratif';
const isExploitant    = r => r === 'exploitant';

// ── Middleware principal — authentification ───────────────────────────────────
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'Token d\'authentification manquant', 401);
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return error(res, 'Token invalide ou expiré', 401);
  }

  req.user     = user;
  req.userRole = user.user_metadata?.role || 'directeur';
  req.role     = req.userRole; // alias utilisé dans les contrôleurs
  req.habilitationPatrimoniale = user.user_metadata?.habilitation_patrimoniale === true;
  next();
};

// ── requireRole — vérification stricte du rôle ───────────────────────────────
// Accepte 'admin' et 'administrateur' comme équivalents
const requireRole = (...roles) => (req, res, next) => {
  const effectiveRoles = roles.flatMap(r =>
    (r === 'admin' || r === 'administrateur') ? ['admin', 'administrateur'] : [r]
  );
  if (!effectiveRoles.includes(req.userRole)) {
    return error(res, 'Accès non autorisé pour ce rôle', 403);
  }
  next();
};

// ── requireWriteAccess — bloque les profils strictement lecture-seule ─────────
// Bloque : directeur
// Passe : admin, charge_operation, gestionnaire_patrimonial, administratif
const requireWriteAccess = (req, res, next) => {
  if (isDirecteur(req.role)) {
    return error(res, 'Accès en lecture seule — écriture non autorisée', 403);
  }
  next();
};

// ── requireStrategicWrite — engagements de mandat et leviers résilience ───────
// Profils autorisés : admin, directeur
// Bloqués : charge_operation, gestionnaire_patrimonial, administratif
const requireStrategicWrite = (req, res, next) => {
  const r = req.role;
  if (isAdmin(r) || isDirecteur(r)) return next();
  return error(res, 'Accès réservé aux administrateurs et à la direction', 403);
};

// ── requireModuleAWrite — écriture sur les opérations de construction ─────────
// Profils autorisés : admin, charge_operation
// Bloqués : directeur, gestionnaire_patrimonial, administratif
const requireModuleAWrite = (req, res, next) => {
  const r = req.role;
  if (isAdmin(r) || isChargeOp(r)) return next();
  return error(res, 'Accès en écriture Module A non autorisé pour ce profil', 403);
};

// ── requirePatrimoineReferentielWrite — fiches techniques patrimoine ──────────
// Profils autorisés : admin, gestionnaire_patrimonial,
//                     charge_operation avec habilitation patrimoniale
// Bloqués : directeur, administratif, charge_operation sans habilitation
const requirePatrimoineReferentielWrite = (req, res, next) => {
  const r = req.role;
  if (isAdmin(r) || isGestPatrim(r) || (isChargeOp(r) && req.habilitationPatrimoniale)) {
    return next();
  }
  return error(res, 'Accès non autorisé — habilitation patrimoniale (référentiel technique) requise', 403);
};

// ── requirePatrimoineCoutsWrite — coûts, factures, relevés patrimoine ─────────
// Profils autorisés : admin, gestionnaire_patrimonial,
//                     charge_operation avec habilitation, administratif
// Bloqués : directeur, charge_operation sans habilitation
const requirePatrimoineCoutsWrite = (req, res, next) => {
  const r = req.role;
  if (isAdmin(r) || isGestPatrim(r) || (isChargeOp(r) && req.habilitationPatrimoniale) || isAdministratif(r)) {
    return next();
  }
  return error(res, 'Accès non autorisé — profil insuffisant pour les données financières patrimoine', 403);
};

// ── blockCompta — compatibilité routes jalons / documents ────────────────────
// Bloque administratif (anciennement compta) sur les routes non financières
const blockCompta = (req, res, next) => {
  if (isAdministratif(req.role)) {
    return error(res, 'Accès non autorisé pour ce profil', 403);
  }
  next();
};

module.exports = {
  authenticate,
  requireRole,
  requireWriteAccess,
  requireStrategicWrite,
  requireModuleAWrite,
  requirePatrimoineReferentielWrite,
  requirePatrimoineCoutsWrite,
  blockCompta,
  // Helpers exportés pour les contrôleurs (ex. filtrage opérations)
  isAdmin,
  isChargeOp,
  isGestPatrim,
  isDirecteur,
  isAdministratif,
  isExploitant,
};
