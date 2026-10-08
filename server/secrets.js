const JWT_PLACEHOLDERS = [
  'altere-este-segredo',
  'dev-secret-change-in-production',
];

export function isProduction() {
  return process.env.NODE_ENV === 'production';
}

export function getJwtSecret() {
  const secret = (process.env.JWT_SECRET || '').trim();
  if (isProduction()) {
    if (secret.length < 32 || JWT_PLACEHOLDERS.some((p) => secret.toLowerCase().includes(p))) {
      throw new Error('JWT_SECRET de produção inválido (mín. 32 caracteres, não use o placeholder).');
    }
    return secret;
  }
  return secret || 'dev-secret-change-in-production';
}

export function getAdminCredentials() {
  const username = (process.env.ADMIN_USERNAME || '').trim() || (isProduction() ? '' : 'admin');
  const password = (process.env.ADMIN_PASSWORD || '').trim();

  if (isProduction()) {
    if (!username) {
      throw new Error('ADMIN_USERNAME é obrigatório em produção.');
    }
    if (!password || password === 'sua-senha-aqui' || password === 'AltereSenhaForte123!') {
      throw new Error('ADMIN_PASSWORD é obrigatório em produção e não pode ser o valor de exemplo.');
    }
    return { username, password };
  }

  return {
    username: username || 'admin',
    password: password || 'AltereSenhaForte123!',
  };
}

export function assertProductionEnv() {
  if (!isProduction()) return;
  getJwtSecret();
}
