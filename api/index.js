/**
 * Point d'entrée Vercel Serverless Function
 *
 * Vercel route toutes les requêtes /api/* vers ce fichier.
 * L'application Express reçoit la requête avec le chemin original
 * (ex : /api/v1/operations) et traite le routage en interne.
 */
module.exports = require('../server/app');
