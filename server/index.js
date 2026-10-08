import './loadEnv.js';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import { verifyToken } from './auth.js';
import { isEmailConfigured } from './services/emailService.js';
import { isWhatsAppConfigured, isSmsConfigured } from './services/messagingService.js';
import { isProduction } from './secrets.js';
import { syncAdminFromEnv } from './setup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const adminDir = path.join(rootDir, 'admin');
const PORT = process.env.PORT || 3000;

const app = express();

if (process.env.TRUST_PROXY === '1' || (isProduction() && process.env.TRUST_PROXY !== '0')) {
  app.set('trust proxy', 1);
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://images.unsplash.com'],
      frameSrc: ["'self'", 'https://maps.google.com', 'https://www.google.com'],
      connectSrc: ["'self'"],
    },
  },
}));

app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);

app.get('/admin/login', (_req, res) => {
  res.sendFile(path.join(adminDir, 'login.html'));
});

app.get('/admin', (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.redirect('/admin/login');
  try {
    verifyToken(token);
    res.sendFile(path.join(adminDir, 'dashboard.html'));
  } catch {
    res.clearCookie('admin_token', { httpOnly: true, sameSite: 'strict', path: '/' });
    res.redirect('/admin/login');
  }
});

app.use('/admin/css', express.static(path.join(adminDir, 'css'), { dotfiles: 'deny', index: false }));
app.use('/admin/js', express.static(path.join(adminDir, 'js'), { dotfiles: 'deny', index: false }));

app.use('/css', express.static(path.join(rootDir, 'css'), { dotfiles: 'deny', index: false }));
app.use('/js', express.static(path.join(rootDir, 'js'), { dotfiles: 'deny', index: false }));
app.use('/imagens', express.static(path.join(rootDir, 'imagens'), { dotfiles: 'deny', index: false }));

app.get('/', (_req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

app.get('/index.html', (_req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send('User-agent: *\nDisallow: /admin\nDisallow: /api/admin\n');
});

app.use((req, res) => {
  const blocked = req.path === '/package.json'
    || req.path === '/package-lock.json'
    || req.path.startsWith('/data')
    || req.path.startsWith('/server')
    || req.path.startsWith('/node_modules')
    || req.path.startsWith('/.')
    || req.path.endsWith('.bat')
    || req.path.endsWith('.md');
  if (blocked) {
    return res.status(404).type('text/plain').send('Not found');
  }
  res.status(404).sendFile(path.join(rootDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  syncAdminFromEnv({ required: false });
  console.log('');
  console.log('  Site:   http://localhost:' + PORT);
  console.log('  Admin:  http://localhost:' + PORT + '/admin/login');
  console.log('');
  console.log('  Notificacoes:');
  console.log('    E-mail SMTP:  ' + (isEmailConfigured() ? 'OK' : 'NAO CONFIGURADO (SMTP_HOST/USER/PASS)'));
  console.log('    WhatsApp:     ' + (isWhatsAppConfigured() ? 'OK' : 'NAO CONFIGURADO (WHATSAPP_WEBHOOK_URL)'));
  console.log('    SMS fallback: ' + (isSmsConfigured() ? 'OK' : 'NAO CONFIGURADO'));
  console.log('');
});
