const { supabaseAdmin } = require('../utils/supabase');
const { error } = require('../utils/response');

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

  req.user = user;
  req.userRole = user.user_metadata?.role || 'read';
  req.role     = req.userRole;   // alias utilisé dans les contrôleurs
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.userRole)) {
    return error(res, 'Accès non autorisé pour ce rôle', 403);
  }
  next();
};

const requireWriteAccess = (req, res, next) => {
  // Tous les rôles connus ont accès en écriture (admin, write, read/direction)
  // Ce middleware ne bloque plus que les requêtes non authentifiées (gérées par authenticate)
  next();
};

// Bloque le profil compta sur les routes non financières
const blockCompta = (req, res, next) => {
  if (req.role === 'compta') {
    return error(res, 'Accès non autorisé pour ce profil', 403);
  }
  next();
};

module.exports = { authenticate, requireRole, requireWriteAccess, blockCompta };
