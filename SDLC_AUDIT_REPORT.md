# Relatório de auditoria SDLC — Renata Batista

| Campo | Valor |
|---|---|
| Projeto | `renata-batista-site` |
| Data | 2026-10-07 |
| Branch | `atualizacoes-de-imagens` (`cbfe092`) |
| Ambiente auditado | Local Windows, Node `v24.18.0`, npm `11.16.0` |
| Escopo | Repositório aberto; verificações não destrutivas |
| Parecer | **NO-GO** |
| Código alterado nesta auditoria | Nenhum (somente este relatório) |

Este parecer técnico **não autoriza deploy**.

---

## A. Resumo executivo

O produto local está **funcionalmente avançado**: site institucional, agendamento em 5 passos, painel admin com JWT, motor de slots com índice único anti double-booking e confirmação por e-mail. Isso **não** equivale a prontidão de produção.

Foram confirmados bloqueadores de segurança e operação:

1. O servidor publica o diretório raiz via `express.static`. `GET /data/agenda.db` retornou **200** (114 688 bytes) — o banco com dados de pacientes é baixável.
2. `GET /server/index.js` e `GET /server/db.js` também retornaram **200** — código-fonte do backend exposto.
3. Não há CI/CD, testes, health check, backup, rollback nem plataforma de hospedagem declarada.
4. O `.env` local ainda usa `JWT_SECRET` igual ao placeholder de `.env.example` e senha admin igual ao fallback de `setup.js`. `NODE_ENV=development`.
5. `npm audit` reportou **5 vulnerabilidades** (1 crítica, 1 alta, 3 moderadas), inclusive `nodemailer` e `proxy-addr`.

**Pontos positivos:** Helmet com CSP/HSTS/nosniff; cookies `httpOnly` + `SameSite=strict`; queries parametrizadas; rate limit no agendamento público; admin HTML com `noindex`; validação de e-mail/telefone no booking; transação SQLite + índice único de slot ativo.

**Limitações desta auditoria:** LCP/INP/CLS, contraste WCAG e jornadas E2E autenticadas **não foram medidas/executadas**. Não houve teste de brute-force em massa no login (código inspecionado; 1 tentativa inválida = 401). Nenhum dado de paciente foi extraído ou exibido. Deploy não foi executado.

---

## B. Scorecard SDLC

Escala: **0** = ausência ou falha grave com evidência; **5** = prática madura com evidência. **N/A** = não houve como avaliar. Ausência de testes/CI foi pontuada 0 porque a inexistência **foi verificada**, não inferida por falta de acesso.

| Dimensão | Nota | Evidência | Status |
|---|---|---|---|
| Requisitos | 3 | Jornadas de site, agendar, admin e lista de espera implementadas. Formulário de contato simula sucesso sem enviar. Sem documento formal de aceite. | Parcial |
| Arquitetura | 2 | Módulos server/routes/services coesos; static na raiz quebra o desenho (expõe `data/` e `server/`). SQLite local, processo único. | Bloqueado |
| Qualidade de código | 3 | 18 arquivos `.js` com `node --check` PASS. Sem ESLint/Prettier/TypeScript. `innerHTML` no booking sem escape em nomes de serviço. | Aceitável com dívida |
| Segurança | 1 | Banco e fonte públicos (HTTP 200). Segredos placeholder. Login sem rate limit. `npm audit` crítica/alta. | Bloqueado |
| Testes | 0 | Nenhum `*.test.*`, Jest, Vitest, Playwright ou script `test` no `package.json`. | Ausente |
| UX e acessibilidade | 3 | Menu com `aria-expanded`; labels no contato; `lang=pt-BR`. Favicon fora de `<head>`; sem skip-link; contato com falso positivo. WCAG 2.2 AA não medido. | Parcial |
| Performance | 2 | `hero-renata.png` ~2,4 MB; `renata.perfil2.png` ~2,6 MB. Core Web Vitals não medidos. | Risco |
| CI/CD | 0 | Sem `.github/workflows`, Dockerfile, Procfile, Railway/Render/Vercel. `main` atrasada em relação à branch atual. | Ausente |
| Observabilidade | 1 | `console.log`/`console.error` no processo. Sem health, métricas, tracing ou alertas. | Insuficiente |
| Prontidão para produção | 1 | Bloqueadores P0 confirmados; sem backup, Node engines, volume persistente ou checklist de release. | **NO-GO** |

---

## C. Matriz de riscos

| ID | Fase | Sev. | Descrição | Local | Evidência | Impacto | Correção | Esforço | Teste de verificação | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| F-01 | Seg. / LGPD | **P0** | `express.static` serve a raiz do projeto. O SQLite com PII é baixável. | `server/index.js:60-66` | `GET /data/agenda.db` → **200**, 114 688 bytes, `application/octet-stream` (app em `127.0.0.1:39992`) | Vazamento de nomes, e-mails, telefones, IPs e agenda (LGPD) | Servir somente `index.html`, `css/`, `js/`, `imagens/`, `admin/{css,js}`. Bloquear `/data`, `/server`, `package.json` | Baixo | `GET /data/agenda.db` deve ser 404 | Aberto |
| F-02 | Seg. | **P0** | Código-fonte do backend e metadados npm acessíveis. | `server/index.js:60-66` | `GET /server/index.js` 200 (3076 B); `GET /server/db.js` 200; `GET /package.json` 200 | Facilita exploração e mapeamento de auth/DB | Mesma allowlist de F-01 | Baixo | `GET /server/index.js` 404 | Aberto |
| F-03 | Seg. / Release | **P0** | `JWT_SECRET` local é o placeholder de `.env.example` (len 44, `same_as_example=true`). Fallback em código: `dev-secret-change-in-production`. | `server/auth.js:4`, `.env.example:6` | Script de flags no `.env` (valores não reproduzidos) | Tokens admin forjáveis se esse padrão for a produção | Secret ≥32 chars aleatório por ambiente; recusar start se placeholder | Baixo | App recusa boot com secret fraco | Aberto |
| F-04 | Seg. | **P0** | Senha admin local coincide com o fallback hardcoded. `setup.js` grava esse hash se `ADMIN_PASSWORD` faltar. | `server/setup.js:17-18` | Flag `admin_pwd_is_documented_default=true` (valor não reproduzido) | Conta admin trivial se o fallback for a produção | Remover fallback; exigir env; rate limit + lockout | Baixo | Login com fallback documentado deve falhar em prod | Aberto |
| F-05 | Infra | **P0** | Sem hospedagem, volume, backup, health, rollback ou pipeline. SQLite em `data/` (gitignored) some em filesystem efêmero. | Repo: ausência de `Dockerfile`/`Procfile`/`railway.json`/`.github/workflows`; `db.js:6-8` | Glob + `git ls-files` (39 arquivos versionados) | Perda da agenda; downtime; deploy manual sem gates | Escolher VPS/PaaS com disco persistente, backup e Node 22+ | Alto | Restore testado + health 200 | Aberto |
| F-06 | Seg. | **P1** | `/api/admin/login` sem rate limit. Agendamento público tem limiter (10/15 min); login não. | `server/routes/admin.js:46-60` vs `public.js:14-18` | 1 POST inválido → 401 `"Credenciais inválidas"`; nenhum 429 no código do login | Brute force da conta única | Rate limit + backoff + log de falhas | Baixo | 20 logins inválidos → 429 | Aberto |
| F-07 | Seg. | **P1** | Dependências vulneráveis: `proxy-addr` crítica; `nodemailer` alta (várias GHSA); `qs` moderada via Express 4. | `package-lock.json`; `npm audit` | 5 vulns (1 critical, 1 high, 3 moderate). Fix do nodemailer é breaking (`@10`) | Risco de SMTP/DoS/IP spoof conforme advisory | Atualizar com critério; retestar e-mail | Médio | `npm audit` sem critical/high aplicáveis | Aberto |
| F-08 | Requisitos | **P1** | Formulário `#contato` não envia mensagem. Exibe sucesso localmente. | `js/main.js:31-47` | Código: `preventDefault` + texto de sucesso; nenhum `fetch` | Paciente acredita que a clínica recebeu contato | POST real (API/e-mail) ou remover o formulário | Médio | Envio gera e-mail/registro | Aberto |
| F-09 | DevOps | **P1** | Sem `engines.node`; runtime usa `node:sqlite` (Node 22.5+). PaaS costuma default 18/20. | `package.json`; `server/db.js:1` | Local: `node:sqlite=available` no v24.18.0 | Boot crash em produção | `"engines": {"node": ">=22.5"}` + pin na plataforma | Baixo | Build na versão pinada | Aberto |
| F-10 | Testes | **P1** | Zero testes automatizados para slot engine, auth, LGPD ou booking. | `package.json` scripts | Grep sem jest/vitest/playwright; nenhum script `test` | Regressão invisível (double-booking, auth) | Testes unitários do `slotEngine` + API de auth | Médio | `npm test` no CI | Aberto |
| F-11 | Produto | **P1** | WhatsApp/SMS e `ONLINE_MEETING_LINK` não configurados. SMTP local OK. | `.env` flags; log do servidor | Log: `WhatsApp: NAO CONFIGURADO`; `ONLINE_MEETING_LINK set=false` | Consultas online sem link; confirmação só e-mail | Definir link/webhook ou esconder canal online | Baixo | Confirmação online contém URL | Aberto |
| F-12 | Seg. | **P2** | CSP permite `'unsafe-inline'` em script e style (necessário ao login inline). | `server/index.js:20-31` | Header CSP observado no GET `/` | XSS mais fácil se houver injection | Mover scripts inline para arquivos + nonces | Médio | CSP sem unsafe-inline | Aberto |
| F-13 | Seg. | **P2** | Nomes de serviço (admin-controlados) interpolados em `innerHTML` sem `escapeHtml`. Erro de API também. | `js/booking.js:172`, `:270`, `:280` | Inspecção; admin.js **escapa** nomes, booking.js não | XSS armazenado se o admin gravar HTML no serviço | Usar `escapeHtml` já existente | Baixo | Payload `<img>` não executa | Aberto |
| F-14 | UX / a11y | **P2** | `<link rel="icon">` antes de `<head>`. Sem skip-link. Contraste/teclado não medidos. | `index.html:2-4` | HTML servido começa com icon fora do head | HTML inválido; leitores de tela prejudicados | Mover icon para `<head>`; skip-link | Baixo | HTML válido + teclado | Aberto |
| F-15 | Perf. | **P2** | Imagens hero/perfil muito grandes. | `imagens/` | `hero-renata.png` 2 375 KB; `renata.perfil2.png` 2 583 KB | LCP alto em 4G | Comprimir/WebP/`srcset`; lazy no below-fold | Médio | LCP &lt; 2,5s medido | Aberto |
| F-16 | Seg. / LGPD | **P2** | Lista de espera: sem validação forte de telefone/e-mail; sem DELETE; `booking_ip` e PII sem retenção documentada. | `server/routes/public.js:160-189` | Código; sem rota de exclusão de waiting-list | Spam na lista; gap de direitos LGPD | Validar como o booking; política de retenção + exclusão admin | Médio | Registro inválido 400; exclusão admin | Aberto |
| F-17 | Seg. | **P2** | IP do agendamento lido de `X-Forwarded-For` sem `trust proxy`. Rate limit do Express usa IP do socket se proxy não for confiável. | `server/routes/public.js:20-26`; ausência de `app.set('trust proxy')` | Grep `trust proxy` = 0 ocorrências | IP forjado no banco; limiter ineficaz atrás de proxy | `trust proxy` só com hop conhecido; ignorar header se direto | Baixo | Header falso não altera `booking_ip` | Aberto |
| F-18 | Produto | **P2** | Horários e e-mails divergem entre site e confirmações. | `index.html` contato vs `server/config/practice.js` | Site: Seg–Sex 8h–20h / Sáb 9h–14h e `contato@renatapsicoarte.com.br`. `PRACTICE`: “Segunda a sábado, 8h às 20h” e Gmail | Informação inconsistente ao paciente | Uma fonte de verdade | Baixo | Textos iguais | Aberto |
| F-19 | Release | **P2** | Trabalho atual não está em `main`. Push direto à `main` já foi evitado de propósito. | git | `HEAD cbfe092` vs `main 6683954`; 13 files no diff `main...HEAD` | Produção (se apontar `main`) ficaria desatualizada ou receberia merge sem gate | PR + checklist F-01–F-07 | Baixo | `main` só após P0 | Aberto |
| F-20 | Qualidade | **P3** | Sem lint/format; `admin/js/admin.js` e `admin.js` de rotas são módulos grandes. `.gitignore` local tem `+.cursor` não commitado. | repo | Sem eslint; `git diff .gitignore` | Manutenção | Lint mínimo | Baixo | `npm run lint` | Aberto |

---

## D. Evidências de execução

Ambiente comum: `C:\Users\Carol & Hilo\renata-batista-site`, branch `atualizacoes-de-imagens`, **sem** escrita no banco de agendamentos (POSTs só com body vazio / credenciais inválidas). Servidor temporário `PORT=39992` encerrado após as sondagens.

| Verificação | Comando / método | Ambiente | Resultado | Resumo | Evidência |
|---|---|---|---|---|---|
| Versão Node/npm | `node --version`; `npm --version` | Local | **PASS** | v24.18.0 / 11.16.0 | stdout |
| Sintaxe JS | `node --check` em 18 arquivos fora de `node_modules` | Local | **PASS** | Todos PASS | stdout |
| `node:sqlite` | `import { DatabaseSync } from 'node:sqlite'` | Local | **PASS** | `node:sqlite=available` | stdout |
| Flags de `.env` (sem valores) | Script que imprime só set/len/same_as_example | Local | **PASS** (coleta) | JWT placeholder; senha = fallback; SMTP set; WhatsApp/link online unset; `NODE_ENV=development` | stdout booleano |
| Static isolado | Mini-app com o mesmo `express.static(rootDir)` | Local | **FAIL** (segurança) | `/.env` 404 (dotfiles ignore); `/data/agenda.db` 200; `/server/*.js` 200 | JSON do probe |
| App real — home | `GET /` :39992 | Local | **PASS** | 200 HTML 34473 B; Helmet CSP/HSTS/nosniff | JSON do probe |
| App real — PII | `GET /data/agenda.db` | Local | **FAIL** | **200** 114688 B | JSON do probe |
| App real — fonte | `GET /server/index.js` | Local | **FAIL** | **200** 3076 B, body começa com `import './loadEnv.js'` | JSON do probe |
| API pública settings/services | `GET /api/public/settings`, `/services` | Local | **PASS** | 200 JSON; agenda aberta; 4 serviços | JSON (sem PII extra) |
| Validação de data | `GET /api/public/slots?date=invalid` | Local | **PASS** | 400 `Data inválida` | JSON |
| Slots futuros | `GET .../slots?date=2099-01-01` | Local | **PASS** | 200 `locked:false` + slots 08:00… | JSON |
| Auth admin | `GET /api/admin/me`, `/appointments` | Local | **PASS** | 401 `Não autorizado` | JSON |
| Login inválido | `POST /api/admin/login` user/pass `nope` | Local | **PASS** (auth) / gap F-06 | 401; sem cookie | JSON |
| Booking vazio | `POST /api/public/appointments` `{}` | Local | **PASS** | 400 `MISSING_FIELDS` | JSON |
| Waiting-list vazia | `POST /api/public/waiting-list` `{}` | Local | **PASS** | 400 nome/telefone obrigatórios | JSON |
| robots.txt | `GET /robots.txt` | Local | **PASS** | Disallow `/admin` e `/api/admin` | JSON |
| Admin HTML sem sessão | `GET /admin` | Local | **PASS** (inferência) | Cliente seguiu redirect; HTML = login (2217 B, `noindex`) | JSON + código `index.js:45-54` |
| `npm audit` | `npm audit --omit=dev` | Local + registry | **FAIL** | 5 vulns: 1 critical, 1 high, 3 moderate | stdout npm |
| Lint / types | n/a | — | **NOT RUN** | Ferramentas inexistentes | — |
| Testes unit/integ/E2E | n/a | — | **NOT RUN** | Suite inexistente | — |
| LCP/INP/CLS | n/a | — | **NOT RUN** | Sem Lighthouse/CrUX | — |
| WCAG contrast/teclado completo | n/a | — | **NOT RUN** | Só inspeção de HTML | — |
| Login autenticado / CRUD agenda | — | — | **NOT RUN** | Evitado (credencial default + não alterar dados) | — |
| Carga / SMTP real a terceiros | — | — | **NOT RUN** | Política da auditoria | — |
| Deploy | — | — | **NOT RUN** | Proibido pelo prompt | — |
| Brute-force 20x no login | — | — | **NOT RUN** | Código não tem limiter; não foi martelado | F-06 |

Tamanho de imagens (disco): `hero-renata.png` 2 375 KB; `logo-arredondada.png` 549 KB; `renata.perfil2.png` 2 583 KB; `renata.perfil3.png` 663 KB; `sobre-renata.jpeg` 112 KB.

---

## E. Plano de ação

### Bloqueios pré-produção (ordem sugerida)

1. **F-01 + F-02** — restringir arquivos estáticos. Sem isso o sistema não pode ir ao ar.
2. **F-03 + F-04** — secrets e senha de produção; remover fallbacks de `setup.js`/`auth.js` quando `NODE_ENV=production`.
3. **F-05 + F-09** — Node ≥22.5 pinado; disco persistente para `data/`; backup/restore documentado; health check.
4. **F-07** — atualizar dependências (começar por `npm audit fix` não breaking; nodemailer com teste de e-mail).
5. **F-06** — rate limit no login.

### Correções importantes (podem ir no mesmo ciclo, após P0)

6. **F-08** — formulário de contato verdadeiro ou removido.
7. **F-10** — testes do `slotEngine` e 401/400 das APIs no CI.
8. **F-11** — canal online/WhatsApp ou recorte explícito do MVP.
9. **F-15** — comprimir imagens antes do LCP de produção.
10. **F-16 + F-18** — LGPD (retenção/exclusão) e textos únicos de horário/e-mail.

### Melhorias evolutivas

11. CSP sem `unsafe-inline`; skip-link; lint; merge na `main` só com PR após P0.

**Dependência:** não fazer merge/deploy da branch `atualizacoes-de-imagens` enquanto F-01 e F-02 existirem — o vazamento já ocorre em `localhost`.

Nenhuma correção de código foi aplicada nesta auditoria (regra do prompt: aprovação humana explícita).

---

## F. Parecer de release

### **NO-GO**

Bloqueadores **confirmados** (não hipotéticos):

- Download anônimo do banco SQLite (`GET /data/agenda.db` = 200).
- Exposição do código do servidor (`GET /server/index.js` = 200).
- Ausência de CI, testes, backup e definição de hospedagem.
- Segredos/senha ainda no padrão de desenvolvimento.

Condições mínimas para reavaliar (ainda sem autorizar deploy):

1. Static allowlist verificada (`/data/*` e `/server/*` = 404).
2. Secrets de produção distintos dos placeholders; fallbacks desligados.
3. `npm audit` sem crítica/alta aplicável, ou risco aceito por escrito.
4. Node pinado + volume + backup restaurado em ensaio.
5. Rate limit no login.
6. Formulário de contato honesto.
7. Suite mínima de testes no CI.

O parecer técnico **não autoriza deploy**.
