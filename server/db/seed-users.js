/**
 * Création des comptes de démonstration via l'API Supabase Auth
 * Exécuter : node server/db/seed-users.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const users = [
  {
    email: 'admin@denain.fr',
    password: 'Demo2026!',
    user_metadata: { role: 'admin', prenom: 'Admin', nom: 'Système', full_name: 'Administrateur' }
  },
  {
    email: 'sophie.marchand@denain.fr',
    password: 'Demo2026!',
    user_metadata: { role: 'charge_operation', prenom: 'Sophie', nom: 'Marchand', full_name: 'Sophie Marchand' }
  },
  {
    email: 'thomas.duval@denain.fr',
    password: 'Demo2026!',
    user_metadata: { role: 'charge_operation', prenom: 'Thomas', nom: 'Duval', full_name: 'Thomas Duval' }
  },
  {
    email: 'direction@denain.fr',
    password: 'Demo2026!',
    user_metadata: { role: 'direction', prenom: 'Direction', nom: 'Générale', full_name: 'Direction Générale' }
  }
];

async function seedUsers() {
  console.log('Création des comptes de démonstration...\n');

  for (const user of users) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      user_metadata: user.user_metadata,
      email_confirm: true
    });

    if (error) {
      if (error.message.includes('already been registered')) {
        console.log(`⚠️  ${user.email} — existe déjà`);
      } else {
        console.error(`❌ ${user.email} — Erreur : ${error.message}`);
      }
    } else {
      console.log(`✅ ${user.email} — créé (ID: ${data.user.id})`);
    }
  }

  console.log('\nComptes créés. Exécutez maintenant seed.sql dans Supabase SQL Editor.');
}

seedUsers().catch(console.error);
