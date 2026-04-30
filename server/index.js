/**
 * Point d'entrée pour le développement local uniquement.
 * En production (Vercel), c'est api/index.js qui est utilisé.
 */
const app  = require('./app');
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅ OpéraTrack API démarrée sur http://localhost:${PORT}`);
  console.log(`   Environnement : ${process.env.NODE_ENV || 'development'}`);
});
