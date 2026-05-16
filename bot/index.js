require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs      = require('fs');
const path    = require('path');
const express = require('express');
const https   = require('https');
const apiRouter = require('./api');

// EXPRESS
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.get('/', (req, res) => res.status(200).send('WARSTACK OK'));
app.use('/api', apiRouter);
app.listen(process.env.PORT || 3000, () => console.log('✅ API WARSTACK démarrée'));

// KEEP-ALIVE
setInterval(() => {
  https.get('https://warstack-bot.onrender.com', () => {}).on('error', () => {});
}, 4 * 60 * 1000);

// CLIENT DISCORD
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

client.commands = new Collection();

// COMMANDES
const commandsPath = path.join(__dirname, 'commands');
fs.readdirSync(commandsPath).filter(f => f.endsWith('.js')).forEach(file => {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log(`✅ Commande chargée : /${command.data.name}`);
  }
});

// EVENTS
const eventsPath = path.join(__dirname, 'events');
fs.readdirSync(eventsPath).filter(f => f.endsWith('.js')).forEach(file => {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
});

client.login(process.env.DISCORD_TOKEN);