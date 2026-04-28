const express = require('express');
const { body } = require('express-validator');
const { validationResult } = require('express-validator');
const { supabaseAnon, supabaseAdmin } = require('../utils/supabase');
const { success, error } = require('../utils/response');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/login',
  [
    body('email').isEmail().withMessage('Email invalide'),
    body('password').notEmpty().withMessage('Mot de passe requis')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return error(res, errors.array()[0].msg, 400);

    const { email, password } = req.body;

    const { data, error: authError } = await supabaseAnon.auth.signInWithPassword({ email, password });

    if (authError) return error(res, 'Identifiants incorrects', 401);

    const role = data.user?.user_metadata?.role || 'read';

    success(res, {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: {
        id: data.user.id,
        email: data.user.email,
        role,
        full_name: data.user.user_metadata?.full_name || data.user.email
      }
    });
  }
);

router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return error(res, 'Refresh token manquant', 400);

  const { data, error: authError } = await supabaseAnon.auth.refreshSession({ refresh_token });
  if (authError) return error(res, 'Session expirée, veuillez vous reconnecter', 401);

  success(res, {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at
  });
});

router.get('/me', authenticate, async (req, res) => {
  success(res, {
    id: req.user.id,
    email: req.user.email,
    role: req.userRole,
    full_name: req.user.user_metadata?.full_name || req.user.email
  });
});

router.post('/logout', authenticate, async (req, res) => {
  await supabaseAnon.auth.signOut();
  success(res, { message: 'Déconnexion réussie' });
});

module.exports = router;
