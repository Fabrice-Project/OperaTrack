const express = require('express');
const { supabaseAdmin } = require('../utils/supabase');
const { success, error } = require('../utils/response');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Liste des chargés d'opération (pour les selects de formulaire)
// Inclut uniquement admin et charge_operation (pas gestionnaire_patrimonial ni directeur)
router.get('/charges', async (req, res) => {
  const { data, error: authError } = await supabaseAdmin.auth.admin.listUsers();
  if (authError) return error(res, authError.message);

  const ROLES_MODULE_A = ['admin', 'administrateur', 'write', 'charge_operation'];

  const charges = data.users
    .map(u => ({
      id: u.id,
      email: u.email,
      full_name: u.user_metadata?.full_name || u.email,
      role: u.user_metadata?.role
    }))
    .filter(u => u.full_name && ROLES_MODULE_A.includes(u.role));

  success(res, charges);
});

module.exports = router;
