import { callBotAPI } from '../api.js';

export async function getBotStatus()    { return await callBotAPI('status'); }
export async function postLeaderboard() { return await callBotAPI('leaderboard', 'POST'); }
export async function postMVP()         { return await callBotAPI('mvp', 'POST'); }