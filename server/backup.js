import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(rootDir, 'data', 'agenda.db');
const backupDir = path.join(rootDir, 'data', 'backups');

if (!fs.existsSync(dbPath)) {
  console.error('Banco não encontrado em data/agenda.db');
  process.exit(1);
}

fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dest = path.join(backupDir, `agenda-${stamp}.db`);
fs.copyFileSync(dbPath, dest);
console.log('Backup salvo em', dest);
