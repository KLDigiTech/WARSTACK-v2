// dashboard/js/services/botService.js
// Raccourcis vers callBotAPI — conservé pour compatibilité rétro
// Pour les nouveaux appels, utiliser callBotAPI directement depuis api.js

import { callBotAPI } from '../api.js';

export const getBotStatus    = ()  => callBotAPI('status');
export const postLeaderboard = ()  => callBotAPI('leaderboard', 'POST');
export const postMVP         = ()  => callBotAPI('mvp', 'POST');