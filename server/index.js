require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Sécurité & parsing ────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// ── Routes ───────────────────────────────────────────────────
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/operations', require('./routes/operations'));
app.use('/api/v1/operations/:id', require('./routes/finances'));
app.use('/api/v1/operations/:id/marches', require('./routes/marches'));
app.use('/api/v1/operations/:id', require('./routes/operationExports'));
app.use('/api/v1/operations/:id', require('./routes/financements'));
app.use('/api/v1/operations/:id', require('./routes/jalons'));
app.use('/api/v1/operations/:id', require('./routes/documents'));
app.use('/api/v1/operations/:id', require('./routes/reception'));
app.use('/api/v1/operations/:id', require('./routes/resilience'));
app.use('/api/v1/mandat', require('./routes/mandat'));
app.use('/api/v1', require('./routes/resilience'));
app.use('/api/v1/marches', require('./routes/marchesActions'));
app.use('/api/v1/avenants', require('./routes/avenantActions'));
app.use('/api/v1/os', require('./routes/osActions'));
app.use('/api/v1/exports', require('./routes/exports'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/settings', require('./routes/settings'));
app.use('/api/v1/patrimoine', require('./routes/patrimoine'));

// ── Health check ─────────────────────────────────────────────
app.get('/api/v1/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', version: '1.0.0' }, error: null });
});

// ── Gestion des erreurs ───────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`✅ OpéraTrack API démarrée sur http://localhost:${PORT}`);
  console.log(`   Environnement : ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
