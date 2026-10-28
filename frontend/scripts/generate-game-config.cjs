const fs = require('node:fs');
const path = require('node:path');
const source = path.resolve(__dirname, '../../backend/app/core/game_beta_rules.json');
const rules = JSON.parse(fs.readFileSync(source, 'utf8'));
const { version, modes, timing, scoring, difficulty } = rules;
// Deliberate whitelist. No environment, credentials or private server settings.
// This stage can only produce a PRACTICE config, even if server flags change.
const { completion, classicBonus, streakBonus, dailyRewardedGames } = rules.economy;
const output = { version, modes, timing, scoring, difficulty,
  economy: { enabled: false, completion, classicBonus, streakBonus, dailyRewardedGames } };
const destination = path.resolve(__dirname, '../public/data/game-beta-rules.json');
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, JSON.stringify(output, null, 2) + '\n');
console.log('Configuración pública de práctica generada desde backend/core/game_beta_rules.json');
