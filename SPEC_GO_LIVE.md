# Spec de go-live — Renata Batista

**Produto:** site institucional + agendamento + painel admin  
**Base:** auditoria SDLC 2026-10-07 (`SDLC_AUDIT_REPORT.md`, parecer NO-GO)  
**Branch de trabalho:** `atualizacoes-de-imagens`  
**Status:** spec de desenvolvimento — aguardando autorização para implementar  
**Este documento não autoriza deploy.**

> **Como ler:** `[C]` confirmado (código, auditoria ou README) · `[P]` presumido, validar · `[?]` pendente de decisão

Objetivo desta spec: **priorizar o que falta para o site ir ao ar com segurança**, sem reabrir o produto nem misturar evolução com lançamento.

---

## 1. Recorte de lançamento

**Hipótese central [P]:** a paciente consegue agendar sozinha e a psicóloga gerencia a agenda sem planilha — isso só vale se o sistema **não vazar dados** e **não mentir** (contato, horário, e-mail).

**MVP no ar (Fase 1)** é o menor conjunto que:

1. Não expõe banco nem código-fonte. `[C]` F-01, F-02  
2. Deixa o site público no ar com HTTPS. `[P]`  
3. Permite agendar consulta e receber confirmação por e-mail. `[C]` já implementado localmente  
4. Permite à Renata entrar no painel e gerir a agenda. `[C]` já implementado localmente  
5. Não promete envio de mensagem que não acontece. `[C]` F-08  

O que **já existe** e não deve ser reescrito nas fases 0–1: fluxo de 5 passos, anti double-booking, lista de espera, calendário admin, JWT, SMTP, Helmet. O trabalho é **vedar, configurar, hospedar e corrigir furos**, não criar um segundo sistema.

---

## 2. Papéis

| Papel | Quem | O que faz | Origem |
|---|---|---|---|
| Visitante / paciente | Público | Lê o site, agenda, entra na lista de espera, tenta contato | `[C]` |
| Administradora | Renata (conta única) | Login, agenda, fechar/abrir, espera, confirmações | `[C]` código + README |
| Operadora de deploy | Time técnico | Secrets, servidor, backup, release | `[P]` |

Fora de escopo: paciente com login, prontuário, pagamento, multi-profissional. `[C]` README (coleta mínima, sem clínico) · `[P]` pagamento nunca foi pedido neste repo.

---

## 3. Mapa modular

Cada módulo tem dono de código, contrato e o que **não** pode fazer. Fases abaixo só tocam os módulos listados.

```
[M5 public-site] ──┐
                   ├──► [M1 platform-static] ──► internet
[M6 booking] ──────┤
                   ├──► [M3 platform-hardening]
[M7 admin] ────────┤
                   ├──► [M2 platform-secrets]
[M8 notifications]─┤
                   └──► [M4 platform-ops] ──► disco / SMTP / domínio
[M9 persistence] ─────────────────────────────────────┘
[M10 quality] cobre M6, M7, M2 em testes (Fase 2)
```

| ID | Módulo | Arquivos | Contrato | Não fazer |
|---|---|---|---|---|
| **M1** | Platform / estáticos | `server/index.js` | Servir só `index.html`, `css/`, `js/`, `imagens/`, `admin/{css,js,*.html}`. `/data` e `/server` = 404 | `express.static(rootDir)` |
| **M2** | Platform / secrets | `auth.js`, `setup.js`, `loadEnv.js`, `.env.example` | Em `production`, recusar boot sem `JWT_SECRET` forte e `ADMIN_PASSWORD`; sem fallback | Secret/senha default no código |
| **M3** | Platform / hardening | `routes/admin.js`, `routes/public.js`, `package.json` | Rate limit no login; dependências sem crítica/alta aplicável; `trust proxy` só com hop conhecido | Confiar em `X-Forwarded-For` cru |
| **M4** | Platform / ops | `package.json`, health, deploy, backup | Node `>=22.5`, `GET /healthz`, volume em `data/`, restore documentado | GitHub Pages; disco efêmero |
| **M5** | Public site | `index.html`, `css/`, `js/main.js`, `imagens/` | Home, serviços, contato honesto, HTML válido, imagens leves | Falso “mensagem enviada” |
| **M6** | Booking | `js/booking.js`, `routes/public.js`, `slotEngine.js` | 5 passos; slots reais; validação; escape HTML | Expor PII; `innerHTML` cru |
| **M7** | Admin | `admin/*`, `routes/admin.js`, `auth.js` | Login JWT cookie; CRUD; fechar agenda; noindex | Página admin sem auth |
| **M8** | Notifications | `services/*`, `config/practice.js`, `notifications.js` | Confirmação e-mail; textos únicos de clínica | Canal WhatsApp sem webhook |
| **M9** | Persistence | `db.js`, `data/` | SQLite + índice de slot; `data/` fora do static e do git | Servir `.db` |
| **M10** | Quality | `package.json` scripts, CI | Testes de slot + auth + static 404 | Suite E2E completa no MVP |

---

## 4. Priorização funcional (o que o usuário sente)

Ordem de valor para **ir ao ar**, não ordem de “ficaria bonito”.

| Prioridade | Jornada | Estado hoje | Módulos | Achados |
|---|---|---|---|---|
| **P0 — sem isso não publica** | Dados e código inacessíveis na internet | Falha confirmada | M1, M9 | F-01, F-02 |
| **P0** | Admin não entra com senha/JWT previsíveis | Segredos de dev | M2 | F-03, F-04 |
| **P0** | Site não some / agenda não apaga no restart | Sem host + volume | M4 | F-05, F-09 |
| **P0** | Paciente vê o site (home, sobre, serviços, mapa) | Pronto local | M5 | — |
| **P0** | Paciente agenda e recebe e-mail | Pronto local; SMTP prod `[?]` | M6, M8, M4 | F-11 parcial |
| **P0** | Renata gerencia agenda no painel | Pronto local | M7 | F-06 |
| **P1 — no mesmo lançamento** | Contato não mente | Falso sucesso | M5, M8 | F-08 |
| **P1** | Login resistente a chute de senha | Sem limiter | M3 | F-06 |
| **P1** | Dependências sem falha crítica/alta | `npm audit` FAIL | M3 | F-07 |
| **P1** | Site carrega em 4G (imagens) | Hero ~2,4 MB | M5 | F-15 |
| **P1** | Horário e e-mail iguais em todo o site | Textos divergentes | M5, M8 | F-18 |
| **P1** | Consulta online com link **ou** só presencial no ar | Link vazio | M6, M8 | F-11 |
| **P2 — logo após o ar** | Lista de espera válida + exclusão | Frágil | M6, M7 | F-16 |
| **P2** | Testes + CI para não regressar P0 | Zero testes | M10 | F-10 |
| **P2** | Backup restaurável | Inexistente | M4, M9 | F-05 |
| **P3 — evolução** | CSP rígido, skip-link, lint, WhatsApp auto | Dívida | M1, M3, M5, M8 | F-12, F-14, F-20 |

**Corte explícito do primeiro ar**

| Fica de fora da Fase 1 | Motivo |
|---|---|
| WhatsApp/SMS automático | Webhook não configurado `[C]`; canal opcional `[P]` |
| Prontuário / pagamento / multi-user admin | Fora do produto atual `[C]` |
| WCAG 2.2 AA completo / Lighthouse 90 | Não medido; não bloqueia HTTPS `[C]` |
| CSP sem `unsafe-inline` | Login inline; risco P2 `[C]` |
| Merge direto na `main` antes dos P0 | Branch de trabalho de propósito `[C]` |

---

## 5. Desenvolvimento faseado

Cada fase: objetivo, módulos, itens testáveis, critério de saída. Só avançar de fase com o critério verde.

### Fase 0 — Vedação (condição de existir URL pública)

**Objetivo:** um atacante com a URL não baixa a agenda nem o código.  
**Esforço:** baixo · **Módulos:** M1, M2, M3  
**Não mistura:** layout, novas features, hospedagem ainda.

| Item | Spec | Aceite |
|---|---|---|
| M1.1 Allowlist de estáticos | Static só em pastas públicas; negar `/data`, `/server`, `package.json`, `*.bat`, `.env*` | `GET /data/agenda.db` e `GET /server/index.js` = **404**; `GET /` e `/css/styles.css` = 200 |
| M2.1 Fail-fast de secrets | Se `NODE_ENV=production`: `JWT_SECRET` ≥ 32, ≠ placeholder; `ADMIN_PASSWORD` obrigatória, sem fallback de `setup.js` | Processo **não sobe** com secret/senha default |
| M3.1 Rate limit login | Mesma família do booking (ex.: 5/15 min por IP) em `POST /api/admin/login` | 20 POSTs inválidos → **429** |
| M3.2 Audit de deps | `npm audit fix` não breaking; nodemailer só com teste de envio | Sem critical/high aplicável, ou risco escrito |

**Saída Fase 0:** reteste local dos quatro aceites. Ainda **não** é go-live.

---

### Fase 1 — Primeiro ar (MVP público)

**Objetivo:** domínio no ar, paciente agenda, Renata opera, contato honesto.  
**Módulos:** M4, M5, M6, M7, M8, M9  
**Depende de:** Fase 0 verde.

| Item | Spec | Aceite |
|---|---|---|
| M4.1 Runtime | `"engines": { "node": ">=22.5.0" }` + pin na plataforma | Boot com `node:sqlite` |
| M4.2 Persistência | Volume montado em `data/`; `.db` fora do static (Fase 0) | Restart do app **mantém** consultas |
| M4.3 Health | `GET /healthz` → `{ ok: true }` sem PII | Load balancer / probe 200 |
| M4.4 Ambiente prod | `NODE_ENV=production`, `SITE_URL` https, SMTP real, senha admin forte | Cookie `Secure`; e-mail de teste chega |
| M4.5 Release git | PR da branch atual → `main` **depois** da Fase 0 | `main` contém allowlist |
| M5.1 Contato honesto | Formulário envia e-mail à clínica **ou** some e deixa só WhatsApp | Não existe “enviada com sucesso” sem envio |
| M5.2 HTML mínimo | Favicon dentro de `<head>`; skip-link opcional nesta fase | HTML do head válido |
| M5.3 Imagens | Hero e perfil comprimidos (WebP ou JPEG &lt; ~300 KB no LCP) | Arquivos &lt; 400 KB cada no caminho hero |
| M5.4 + M8.1 Fonte única | Horário e e-mail só em `practice.js` (ou env) e o HTML lê isso / textos iguais | Site e e-mail de confirmação coincidem |
| M6.1 Escape | `escapeHtml` em nomes de serviço e erros no `booking.js` | Nome `<img src=x onerror=alert(1)>` não executa |
| M8.2 Online | `[?]` Se online no lançamento: `ONLINE_MEETING_LINK` obrigatório para slot online. Senão: esconder opção Online | Confirmação online tem URL, ou UI só presencial |
| M7.1 Smoke admin | Login, ver semana, criar/cancelar **em staging** com dados fictícios | Jornada manual 5 min |

**Hospedagem [P]:** Railway, Render ou VPS com disco. GitHub Pages **fora**. Decisão `[?]` (Q-02).

**Saída Fase 1 (go-live condicional):** URL https pública; F-01/F-02 retestados em produção (`/data/agenda.db` 404); 1 agendamento fictício + 1 login admin; contato honesto. **Ainda não** exige CI completo.

---

### Fase 2 — Operação confiável (primeira semana no ar)

**Objetivo:** não perder agenda, não regressar P0, LGPD mínima.  
**Módulos:** M3, M4, M6, M7, M9, M10

| Item | Spec | Aceite |
|---|---|---|
| M10.1 Testes | Unitário `slotEngine` (passado, overlap, locked) + API 401/400 + static 404 | `npm test` verde |
| M10.2 CI | GitHub Actions: `npm test` + probe de paths proibidos | PR bloqueia se falhar |
| M4.6 Backup | Cópia de `data/agenda.db` diária + restore ensaiado uma vez | Restore em staging reabre consultas |
| M3.3 Proxy | `trust proxy` = 1 atrás do host; senão ignorar `X-Forwarded-For` | IP no banco = socket ou hop 1 |
| M6.2 + M7.2 Espera | Validar telefone/e-mail como no booking; DELETE/cancelamento no admin | Lixo 400; exclusão possível |
| M8.3 WhatsApp | Só se Q-04 = sim | Senão permanece e-mail-only |

**Saída Fase 2:** backup restaurado 1×; CI na `main`; lista de espera sanável.

---

### Fase 3 — Evolução (não bloqueia o ar)

M5 skip-link e contraste; M1 CSP sem inline (script do login em arquivo); M10 lint; M8 lembretes; observabilidade além de `console.log`. Achados F-12, F-14, F-20.

---

## 6. Requisitos (rastreáveis)

Origem `[C-aud]` = evidência da auditoria. `[C-prod]` = já no produto. `[P]` / `[?]` = validar.

### 6.1 Funcionais

| ID | Requisito | Papel | Pri. | Fase | Módulo | Origem |
|---|---|---|---|---|---|---|
| RF-01 | Visitante navega seções do site (início, serviços, sobre, mapa, contato, agendar) | Paciente | Essencial | 1 | M5 | `[C-prod]` |
| RF-02 | Paciente agenda em 5 passos só em horário livre | Paciente | Essencial | 1 | M6 | `[C-prod]` |
| RF-03 | Sistema bloqueia double-booking | Paciente / Admin | Essencial | 0–1 | M6, M9 | `[C-prod]` |
| RF-04 | Paciente recebe confirmação por e-mail após agendar | Paciente | Essencial | 1 | M8 | `[C-prod]` SMTP local OK; prod `[?]` |
| RF-05 | Com agenda fechada, paciente entra na lista de espera | Paciente | Importante | 2 | M6 | `[C-prod]` (endurecer F-16) |
| RF-06 | Admin autentica e opera calendário/CRUD/fechar agenda | Admin | Essencial | 1 | M7 | `[C-prod]` |
| RF-07 | Contato do site entrega a mensagem **ou** não afirma que entregou | Paciente | Essencial | 1 | M5, M8 | `[C-aud]` F-08 |
| RF-08 | Visitante **não** acessa banco, código nem painel sem login | Público | Essencial | 0 | M1, M7 | `[C-aud]` F-01 F-02 |
| RF-09 | Consulta online inclui link de reunião **ou** a opção não aparece | Paciente | Importante | 1 | M6, M8 | `[C-aud]` F-11 · decisão `[?]` |
| RF-10 | Admin exclui ou encerra item da lista de espera | Admin | Importante | 2 | M7 | `[P]` LGPD |

### 6.2 Regras de negócio

| ID | Regra | Origem |
|---|---|---|
| RN-01 | Slot ativo = status `pending` ou `confirmed` no mesmo `date+start_time` | `[C-prod]` |
| RN-02 | Coleta pública: nome + contato; sem campo clínico | `[C-prod]` README |
| RN-03 | Uma conta admin | `[C-prod]` |
| RN-04 | Horário oficial único (site = e-mail = confirmação) | `[P]` F-18 — validar Q-03 |
| RN-05 | Se `schedule_locked`, só lista de espera | `[C-prod]` |

### 6.3 Não funcionais

| ID | Categoria | Requisito | Fase | Origem |
|---|---|---|---|---|
| RNF-01 | Segurança | `/data/*` e `/server/*` inacessíveis | 0 | `[C-aud]` |
| RNF-02 | Segurança | Produção recusa JWT/senha placeholder | 0 | `[C-aud]` |
| RNF-03 | Segurança | Login admin rate-limited | 0 | `[C-aud]` |
| RNF-04 | Privacidade | PII só no SQLite + e-mail SMTP; sem indexar `/admin` | 0–1 | `[C-prod]` |
| RNF-05 | Disponibilidade | Restart não apaga `agenda.db` | 1 | `[C-aud]` F-05 |
| RNF-06 | Runtime | Node ≥ 22.5 | 1 | `[C-aud]` F-09 |
| RNF-07 | Desempenho | Imagem LCP &lt; ~400 KB | 1 | `[C-aud]` F-15 |
| RNF-08 | Recuperação | Backup restaurável em staging | 2 | `[C-aud]` |
| RNF-09 | Qualidade | `npm test` no CI | 2 | `[C-aud]` F-10 |

### 6.4 Dados (mínimo para ir ao ar)

| Dado | Obrigatório | Sensível | Quem acessa | Retenção | Origem |
|---|---|---|---|---|---|
| Nome, telefone, e-mail, data/hora, tipo | Sim (e-mail no booking) | Sim | Admin + e-mail | `[?]` Q-06 | `[C-prod]` |
| `booking_ip` | Automático | Sim | Admin | `[?]` Q-06 | `[C-prod]` |
| Lista de espera | Nome + telefone | Sim | Admin | `[?]` Q-06 | `[C-prod]` |
| Clínico / prontuário | — | — | — | Não coletar | `[C-prod]` FE |

LGPD no lançamento (Fase 1): aviso já existente no agendamento `[C-prod]`. Direitos de exclusão operacional = Fase 2 (RF-10). Política formal de retenção = `[?]` Q-06.

---

## 7. Integrações

| Destino | Uso | Hoje | Fase | Origem |
|---|---|---|---|---|
| SMTP | Confirmação + contato | Configurado no `.env` local | 1 (credencial prod) | `[C-aud]` |
| WhatsApp webhook | Aviso celular | Não configurado | 2 ou nunca | `[C-aud]` Q-04 |
| Google Maps iframe | Como chegar | No ar local | 1 | `[C-prod]` |
| Meet/Zoom | Link online | Env vazio | 1 se RF-09 = online | `[?]` Q-05 |
| Plataforma Node | Host + volume | Inexistente | 1 | `[?]` Q-02 |

---

## 8. Premissas, restrições, fora de escopo

| ID | Tipo | Texto | Se for falsa | Origem |
|---|---|---|---|---|
| PRE-01 | Premissa | Um processo Node + SQLite basta para o volume atual | Precisaria Postgres | `[P]` |
| PRE-02 | Premissa | Uma admin (Renata) | Auth multi-user | `[C-prod]` |
| PRE-03 | Premissa | E-mail é o canal mínimo de confirmação | Não lançar online sem outro canal | `[P]` |
| RES-01 | Restrição | Não usar GitHub Pages | Backend obrigatório | `[C]` README |
| RES-02 | Restrição | Node ≥ 22.5 (`node:sqlite`) | Trocar para better-sqlite3 (esforço extra) | `[C-aud]` |
| RES-03 | Restrição | Sem deploy enquanto F-01/F-02 abertos | — | `[C-aud]` |
| FE-01 | Fora | Prontuário, pagamento, app nativo | — | `[P]` |
| FE-02 | Fora | WhatsApp no dia 1 | — | `[P]` Q-04 |
| FE-03 | Fora | AA completo no dia 1 | — | `[P]` |

---

## 9. Ordem de implementação (time)

Trabalho **em série** na Fase 0 (segurança). Fase 1 pode paralelizar M5 imagens/contato com M4 host.

```
Fase 0    M1 estáticos  →  M2 secrets  →  M3 login limit + audit
Fase 1    M4 host/volume/health  ∥  M5 contato+imagens+HTML  ∥  M6 escape
          M8 practice unificada + SMTP prod + decisão online
          M7 smoke admin em staging
          PR → main → DNS
Fase 2    M10 testes/CI  →  M4 backup  →  M6/M7 espera  →  M3 trust proxy
Fase 3    dívida (CSP, a11y, lint)
```

**Estimativa relativa (não é prazo de calendário):** Fase 0 curta; Fase 1 média (host + conteúdo); Fase 2 média; Fase 3 contínua.

---

## 10. Critério de release por fase

| Fase | Parecer interno | Pode ter URL pública? |
|---|---|---|
| 0 verde | Vedação OK | Não (ainda sem host/secrets prod) |
| 1 verde | **CONDITIONAL GO** | Sim, com SMTP e volume |
| 2 verde | Operação aceitável | Sim, com backup |
| 3 | Melhoria | Sim |

Go-live real = **saída da Fase 1**, desde que Fase 0 esteja verde em **produção** (não só localhost).

---

## 11. Riscos

| Risco | Impacto | O que elimina |
|---|---|---|
| Publicar a branch atual agora | Vazamento LGPD (F-01) | Fase 0 |
| PaaS sem volume | Agenda some | Q-02 + M4.2 |
| SMTP prod diferente do local | Paciente não recebe e-mail | Ensaio de envio na Fase 1 |
| Online no ar sem link | Confirmação inútil | Q-05 |
| Contato falso | Perda de confiança | M5.1 |
| `main` atrasada | Deploy da versão errada | PR só após Fase 0 |

---

## 12. Perguntas que travam o lançamento

Bloco para a Renata / responsável (uma rodada):

1. Qual **domínio** deve abrir o site (já tem, ou ainda vamos registrar)?  
2. Prefere **servidor gerenciado** (Railway/Render) ou **VPS** que vocês já tenham?  
3. Quais são o **horário** e o **e-mail oficiais** (hoje o site e os e-mails automáticos não batem)?  
4. No lançamento, confirmação só por **e-mail**, ou também **WhatsApp automático**?  
5. Vai oferecer **consulta online** no dia 1? Se sim, qual link (Meet/Zoom) entra na confirmação?  
6. O formulário “Envie uma mensagem” deve **chegar no e-mail** ou tiramos e deixamos só o WhatsApp?  
7. Por quanto tempo guardar dados de quem **cancelou** ou está na **lista de espera**?  
8. Quem, além da Renata, pode ter senha do painel? (hoje o sistema é conta única.)

| # | Por que importa | O que muda | Prioridade |
|---|---|---|---|
| 1 | DNS e `SITE_URL` | M4.4 | Trava escopo |
| 2 | Disco, custo, Node 22 | M4 | Trava escopo |
| 3 | F-18 / M8.1 | Conteúdo | Trava tela |
| 4 | M8 WhatsApp | Fase 1 vs 2 | Trava escopo |
| 5 | RF-09 | Esconder Online ou exigir env | Trava tela |
| 6 | F-08 | API de contato vs remover form | Trava tela |
| 7 | LGPD / RF-10 | Fase 2 | Detalhe operacional |
| 8 | Auth | Fora se continuar 1 admin | Trava escopo se &gt;1 |

---

## 13. Próximo passo imediato

1. Responder Q-01 a Q-06 (as que travam).  
2. Autorizar implementação da **Fase 0** (só vedação: static + secrets + rate limit + audit).  
3. Só então Fase 1 (host + conteúdo honesto + PR).

Nenhum código desta spec foi implementado ainda.
