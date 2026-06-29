// bot/api.js
// Point d'entrée API — assemble les routers
// 1651 lignes → découpées en routes/ + middleware/

const express = require('express');
const router  = express.Router();

const guildRouter      = require('./routes/guild');
const moderationRouter = require('./routes/moderation');
const communityRouter  = require('./routes/community');
const onboardingRouter = require('./routes/onboarding');

router.use('/', guildRouter);
router.use('/', moderationRouter);
router.use('/', communityRouter);
router.use('/', onboardingRouter);

module.exports = router;