const { error: errorResponse } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  console.error('[Erreur]', err.message, err.stack);

  if (err.type === 'entity.parse.failed') {
    return errorResponse(res, 'Corps de requête JSON invalide', 400);
  }

  errorResponse(res, err.message || 'Erreur interne du serveur', err.status || 500);
};

const notFound = (req, res) => {
  errorResponse(res, `Route non trouvée : ${req.method} ${req.path}`, 404);
};

module.exports = { errorHandler, notFound };
