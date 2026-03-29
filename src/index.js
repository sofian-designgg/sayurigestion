import 'dotenv/config';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  Client,
  GatewayIntentBits,
  Partials,
} from 'discord.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { connectDatabase } from './database/connect.js';
import { handleMessageCreate } from './handlers/messageCreate.js';
import { handleInteractionCreate } from './handlers/interactionCreate.js';
import { handleVoiceStateUpdate } from './handlers/voiceStateUpdate.js';
import {
  scheduleStatsRefresh,
  updateAllServerStatsChannels,
} from './services/serverStatsChannels.js';

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('DISCORD_TOKEN manquant.');
  process.exit(1);
}

await connectDatabase();
console.log('MongoDB connecté');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

client.once('ready', () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
  updateAllServerStatsChannels(client).catch(console.error);
  setInterval(() => updateAllServerStatsChannels(client).catch(console.error), 5 * 60 * 1000);
});

client.on('messageCreate', (msg) => handleMessageCreate(msg, client));
client.on('interactionCreate', (i) => handleInteractionCreate(i, client));
client.on('voiceStateUpdate', (o, n) => handleVoiceStateUpdate(o, n).catch(console.error));
client.on('guildMemberAdd', (m) => {
  if (m.guild) scheduleStatsRefresh(m.guild);
});
client.on('guildMemberRemove', (m) => {
  if (m.guild) scheduleStatsRefresh(m.guild);
});
client.on('presenceUpdate', (oldP, newP) => {
  const g = newP?.guild ?? oldP?.guild;
  if (g) scheduleStatsRefresh(g);
});

await client.login(token);

const port = Number(process.env.PORT) || 3000;
http
  .createServer((req, res) => {
    const url = req.url?.split('?')[0] || '/';

    if (url === '/embed-builder') {
      try {
        const htmlPath = path.join(__dirname, '..', 'public', 'embed-builder.html');
        const html = fs.readFileSync(htmlPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Fichier embed-builder introuvable.');
      }
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ok');
  })
  .listen(port, () => {
    console.log(`HTTP :${port} — health \`/\` · outil embed \`/embed-builder\` (Railway)`);
  });
