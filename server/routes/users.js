const express = require('express');
const { supabaseAdmin } = require('../utils/supabase');
const { success, error } = require('../utils/response');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Liste des chargés d'opération (pour les selects de formulaire)
router.get('/charges', async (req, res) => {
  const { data, error: authError } = await supabaseAdmin.auth.admin.listUsers();
  if (authError) return error(res, authError.message);

  const charges = data.users
    .map(u => ({
      id: u.id,
      email: u.email,
      full_name: u.user_metadata?.full_name || u.email,
      role: u.user_metadata?.role
    }))
    .filter(u => u.full_name); // exclure les comptes sans nom

  success(res, charges);
});

module.exports = router;
