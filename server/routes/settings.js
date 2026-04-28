const express = require('express');
const { supabaseAdmin } = require('../utils/supabase');
const { success, error } = require('../utils/response');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

/* ── GET /settings/users — liste tous les profils ── */
router.get('/users', async (req, res) => {
  try {
    const { data, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) return error(res, authError.message);

    const users = data.users.map(u => ({
      id: u.id,
      email: u.email,
      full_name: u.user_metadata?.full_name || null,
      role: u.user_metadata?.role || 'read',
      active: !u.banned_until || new Date(u.banned_until) < new Date(),
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }));

    success(res, users);
  } catch (err) {
    error(res, err.message);
  }
});

/* ── POST /settings/users/invite — créer un utilisateur ── */
router.post('/users/invite', requireRole('admin'), async (req, res) => {
  const { email, full_name = '', password, role = 'read' } = req.body;
  if (!email)    return error(res, 'Email requis', 400);
  if (!password) return error(res, 'Mot de passe requis', 400);
  if (password.length < 6) return error(res, 'Mot de passe trop court (6 caractères minimum)', 400);

  const validRoles = ['admin', 'write', 'read', 'compta'];
  if (!validRoles.includes(role)) return error(res, 'Rôle invalide', 400);

  try {
    const { data, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,          // pas besoin de vérification email
      user_metadata: { role, full_name: full_name || email },
    });
    if (authError) return error(res, authError.message);
    success(res, { id: data.user?.id, email }, 201);
  } catch (err) {
    error(res, err.message);
  }
});

/* ── PUT /settings/users/:userId — modifier rôle, nom ou statut ── */
router.put('/users/:userId', requireRole('admin'), async (req, res) => {
  const { userId } = req.params;
  const { role, full_name, password, active } = req.body;

  try {
    const updatePayload = {};

    if (role !== undefined || full_name !== undefined) {
      // Lire les métadonnées existantes pour ne pas les écraser
      const { data: existing } = await supabaseAdmin.auth.admin.getUserById(userId);
      const existingMeta = existing?.user?.user_metadata || {};

      if (role !== undefined) {
        const validRoles = ['admin', 'write', 'read', 'compta'];
        if (!validRoles.includes(role)) return error(res, 'Rôle invalide', 400);
      }

      updatePayload.user_metadata = {
        ...existingMeta,
        ...(role      !== undefined ? { role }      : {}),
        ...(full_name !== undefined ? { full_name } : {}),
      };
    }

    if (password !== undefined) {
      if (password.length < 6) return error(res, 'Mot de passe trop court (6 caractères minimum)', 400);
      updatePayload.password = password;
    }

    if (active !== undefined) {
      updatePayload.ban_duration = active ? '0s' : '876600h';
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, updatePayload);
    if (authError) return error(res, authError.message);

    success(res, { id: userId });
  } catch (err) {
    error(res, err.message);
  }
});

/* ── GET /settings/config — lire la configuration de l'application ── */
router.get('/config', async (req, res) => {
  try {
    const { data } = await supabaseAdmin.from('app_settings').select('key, value');
    const map = {};
    (data || []).forEach(r => { map[r.key] = r.value; });
    success(res, {
      collectivite:    map.collectivite    || 'Ville de Denain',
      libelle_mandat:  map.libelle_mandat  || 'Mandat 2020-2026',
    });
  } catch (err) {
    error(res, err.message);
  }
});

/* ── PUT /settings/config — modifier la configuration (admin) ── */
router.put('/config', requireRole('admin'), async (req, res) => {
  const { collectivite, libelle_mandat } = req.body;
  try {
    const upserts = [];
    if (collectivite   !== undefined) upserts.push({ key: 'collectivite',   value: collectivite });
    if (libelle_mandat !== undefined) upserts.push({ key: 'libelle_mandat', value: libelle_mandat });

    if (upserts.length > 0) {
      const { error: dbErr } = await supabaseAdmin
        .from('app_settings')
        .upsert(upserts, { onConflict: 'key' });
      if (dbErr) return error(res, dbErr.message);
    }
    success(res, { updated: true });
  } catch (err) {
    error(res, err.message);
  }
});

module.exports = router;
