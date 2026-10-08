import './loadEnv.js';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';
import { getAdminCredentials } from './secrets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', 'data');

export function syncAdminFromEnv({ required = false } = {}) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  let credentials;
  try {
    credentials = getAdminCredentials();
  } catch (err) {
    if (required) throw err;
    console.warn('Admin não sincronizado:', err.message);
    return false;
  }

  const db = getDb();
  const { username, password } = credentials;
  const hash = bcrypt.hashSync(password, 12);

  const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(username);
  if (existing) {
    db.prepare('UPDATE admin_users SET password_hash = ? WHERE username = ?').run(hash, username);
    console.log(`Admin "${username}" atualizado.`);
  } else {
    db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(username, hash);
    console.log(`Admin "${username}" criado.`);
  }

  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (notifyEmail) {
    db.prepare('UPDATE settings SET notify_email = ? WHERE id = 1').run(notifyEmail);
  }

  console.log('Banco de dados pronto em data/agenda.db');
  return true;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isCli) {
  try {
    syncAdminFromEnv({ required: true });
    console.log('Execute: npm start');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
