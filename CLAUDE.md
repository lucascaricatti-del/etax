@AGENTS.md

# CLAUDE.md — Etax · Plataforma de Contratos (multi-cliente)

Contexto do projeto para o Claude Code. Leia antes de qualquer tarefa.

## O que é
Plataforma da **Etax** (operadora) para gestão jurídica e de contratos de **múltiplos clientes** (empresas de educação/mentoria). Cada cliente é um **workspace** isolado. O cliente preenche solicitações; a Etax confecciona o contrato a partir de um modelo, aprova, sobe para a **ClickSign**, acompanha assinaturas e vencimentos, e tudo **espelha numa planilha do Google Sheets**.

## Stack
- Next.js (App Router, TypeScript, Tailwind) na Vercel
- Supabase/Postgres = fonte da verdade + Auth + RLS
- ClickSign API v3 = assinatura
- Google Sheets API (Service Account) = espelho compartilhado (escrita app -> planilha)

## Arquitetura multi-tenant (NAO violar)
1. **Etax = operadora.** Equipe Etax (`profiles.tipo_usuario = 'etax'`) enxerga e gere **todos** os workspaces.
2. **Workspace = empresa-cliente.** Cada cliente e um registro em `workspaces`. Usuarios do cliente (`tipo_usuario = 'cliente'`) pertencem a um workspace via `workspace_members` e so veem o proprio.
3. **Isolamento por `workspace_id` + RLS.** Toda tabela de negocio (solicitacoes, contratos, contrapartes, modelos) tem `workspace_id`. As policies ja garantem: cliente ve so o seu; Etax ve tudo.
4. **REGRA CRITICA:** o client `admin` (service_role) **ignora a RLS**. Portanto, em TODA rota de API server-side, filtre/insira `workspace_id` explicitamente no codigo. Nunca confie so na RLS quando usar o admin client.
5. **Modelos:** `workspace_id` nulo = template padrao Etax (vale p/ todos); preenchido = especifico do cliente. Ao escolher modelo, prefira o do workspace, senao o padrao.
6. **Tres dimensoes de estado separadas:** status da *solicitacao* (interno), status de *assinatura* (ClickSign/webhook), status de *vigencia* (datas).
7. **Tipo de contrato e config, nao codigo.** Club/Tracao/PJ/Fornecedor estao em `tipos_contrato` com `schema_campos`. Ler do schema; nao hardcodar por tipo.

## Duas areas (decididas no login pelo tipo_usuario)
- **Console Etax** (`tipo_usuario='etax'`): gerenciar workspaces (criar empresa-cliente, liberar acesso/convites), ver solicitacoes/contratos de todos, filtrar por cliente.
- **Area do Cliente** (`tipo_usuario='cliente'`): login -> cai no seu workspace -> preenche solicitacao -> acompanha o que e seu.

## Acesso do cliente (convite)
Etax cria a empresa -> cria convite (`workspace_invites`, token) -> envia link por e-mail -> cliente abre, define senha (Supabase Auth), `setSession`, vira `workspace_members` daquele workspace, e e levado a tela de solicitacoes.

## Ciclo de vida
Solicitacao: `nova -> em_confeccao -> aguardando_aprovacao -> aprovada -> enviada_assinatura` (ou `cancelada`).
Assinatura: `aguardando_assinatura -> assinado | recusado | expirado`.
Regra: so vai a ClickSign se `aprovada` + modelo + signatario. Cada documento >= 2 requisitos (autenticacao + assinatura).

## Menu
**Console Etax:** Dashboard, Empresas (workspaces), Solicitacoes, Confeccao, Assinaturas, Contratos, Modelos, Configuracoes.
**Cliente:** Solicitacoes (nova + lista), Contratos (os seus).

## Tipos e campos (MVP: Club e Tracao)
- **Club:** nome, cpf, email, whatsapp, plano, valor, forma_pagamento, inicio, duracao, vendedor.
- **Tracao:** nome, cpf, email, whatsapp, turma, valor_total, parcelas, forma_pagamento, inicio, vendedor.
- (Fase 2: PJ e Fornecedor.) Nomes das chaves devem bater com as variaveis do Modelo ClickSign.

## ClickSign v3 - fluxo
Base `https://app.clicksign.com/api/v3` (sandbox: `https://sandbox.clicksign.com/api/v3`).
Headers: `Authorization: {token}` + `Content-Type: application/vnd.api+json`.
1. POST `/envelopes` -> guarda `id`
2. POST `/envelopes/{id}/documents` (por Modelo: `template.key` + `template.data`)
3. POST `/envelopes/{id}/signers`
4. POST `/envelopes/{id}/requirements` (autenticacao + assinatura)
5. PATCH `/envelopes/{id}` -> `{ status: "running" }`
Webhook `/api/webhooks/clicksign`: validar HMAC, atualizar `status_assinatura`, gravar em `eventos_assinatura`.
Payloads exatos: `https://developers.clicksign.com/llms.txt`.

## Variaveis de ambiente
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CLICKSIGN_TOKEN=
CLICKSIGN_BASE=https://sandbox.clicksign.com/api/v3
CLICKSIGN_WEBHOOK_SECRET=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
SHEET_ID=
TEMPLATE_CLUB=
TEMPLATE_TRACAO=
```

## Ordem de construcao (fatias verticais - uma de cada vez)
0. [OK] Setup + Supabase clients
1. [OK] Fatia 1 - Solicitacoes (form + lista) - **sera adaptada para multi-tenant**
2. **Estrutura A - Auth + Workspace:** Supabase Auth (login), resolucao de workspace, protecao de rotas, redirecionamento por `tipo_usuario` (etax -> console; cliente -> solicitacoes).
3. **Estrutura B - Console Etax:** CRUD de empresas (workspaces), convites (liberar acesso), listagem/gestao.
4. **Estrutura C - Adaptar Fatia 1:** solicitacao atras de login, sempre com `workspace_id`; Etax ve todos, cliente ve o seu.
5. Fatia 2 - Confeccao + ClickSign (sandbox)
6. Fatia 3 - Webhook + Assinaturas
7. Fatia 4 - Espelho Sheets
8. Fatia 5 - Contratos & Mentorados (vencimentos, visao por contraparte)

## Convencoes
- Commits pequenos por fatia; nao avancar sem a anterior rodando.
- Segredos so em env; ClickSign/Sheets sempre server-side.
- Em rota de API com admin client, **sempre** escopar por `workspace_id`.
- Falha ao escrever na planilha nao trava o contrato (re-tentativa assincrona).
