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
Assinatura: `aguardando_assinatura -> assinado | recusado | expirado | distratado`.
Regra: so vai a ClickSign se `aprovada` + modelo + signatario. Cada documento >= 2 requisitos (autenticacao + assinatura).

## Contratos — campos avancados
- **natureza_documento** (`principal` | `aditivo`): default `principal`. Aditivos nao somam no dashboard, ficam vinculados ao contrato pai via `contrato_pai_id`.
- **contrato_pai_id** (uuid nullable): FK para `contratos.id`. Usado quando `natureza_documento = 'aditivo'`.
- **conta_no_dashboard** (boolean, default true): flag manual. Se false, contrato e excluido dos KPIs financeiros.
- **data_distrato** (date) + **valor_distrato** (numeric): preenchidos quando admin registra distrato. `status_assinatura` muda para `distratado`.
- **excluido_em** (timestamptz) + **excluido_por** (uuid FK profiles): soft delete. Contrato some das listagens e calculos, mas permanece no banco.
- **modelo_id** (uuid FK modelos): salvo no contrato no momento da geracao. Usado para obter `natureza_financeira` (receita/despesa/neutro) no dashboard.

## Dashboard financeiro — regra de inclusao
Soma APENAS contratos que atendam TODAS as condicoes:
1. `status_assinatura = 'assinado'`
2. `natureza_documento = 'principal'`
3. `conta_no_dashboard = true`
4. `excluido_em IS NULL`

Metricas:
- **Receita bruta** = soma dos contratos cuja `natureza_financeira` do modelo e `receita`, assinados no mes.
- **Churn** = soma de `valor_distrato` dos contratos `distratado` no mes (por `data_distrato`).
- **Receita liquida** = receita bruta - churn.
- **Despesas** = soma dos contratos cuja `natureza_financeira` e `despesa`, assinados no mes.
- Tudo segmentado por empresa (nome_fantasia, fallback razao social) e total consolidado.

## Acoes administrativas (admin Etax)
Restrictas a `papel_etax = 'admin'` via `PATCH /api/contratos/[id]`:
- **toggle_dashboard**: alterna `conta_no_dashboard`.
- **marcar_aditivo**: seta `natureza_documento='aditivo'`, vincula `contrato_pai_id`, desliga dashboard.
- **registrar_distrato**: exige `data_distrato` + `valor_distrato`, muda status para `distratado`.
- **excluir**: soft delete (`excluido_em` + `excluido_por`).
- **restaurar**: desfaz soft delete.

## Menu
**Console Etax:** Dashboard, Empresas (workspaces), Solicitacoes, Confeccao, Assinaturas, Contratos, Modelos, Configuracoes.
**Cliente:** Solicitacoes (nova + lista), Contratos (os seus).

## Tipos e campos (MVP: Club e Tracao)
- **Club:** nome, cpf, email, whatsapp, plano, valor, forma_pagamento, inicio, duracao, vendedor.
- **Tracao:** nome, cpf, email, whatsapp, turma, valor_total, parcelas, forma_pagamento, inicio, vendedor.
- (Fase 2: PJ e Fornecedor.) Nomes das chaves devem bater com as variaveis do Modelo ClickSign.

## Configuracao de assinatura por empresa
Tabela `workspace_clicksign_config` (1:1 com `workspaces`):
- **clicksign_token**: token da API ClickSign da empresa (cada empresa pode ter o seu).
- **contratada_nome/email**: quem assina como CONTRATADA (representante da empresa).
- **contratada_auto** (boolean): se true, usa `auth: "auto_signature"` na ClickSign (requer Termo de Assinatura Automatica previo).
- **testemunha1_nome/email, testemunha2_nome/email**: testemunhas fixas da empresa.

A ETAX nao assina — e gestora. Quem assina sao contratante, contratada e testemunhas.

Tela de config: `/configuracoes` (admin Etax). Seleciona empresa, edita token + contratada + testemunhas.

## ClickSign v3 - fluxo
Base `https://app.clicksign.com/api/v3` (sandbox: `https://sandbox.clicksign.com/api/v3`).
Headers: `Authorization: {token da empresa}` + `Content-Type: application/vnd.api+json`.
Token vem de `workspace_clicksign_config.clicksign_token` (fallback: env `CLICKSIGN_TOKEN`).

1. POST `/envelopes` -> guarda `id`
2. POST `/envelopes/{id}/documents` (por Modelo: `template.key` + `template.data`)
3. POST `/envelopes/{id}/signers` — 4 signatarios:
   - **Contratante** (dados da solicitacao): auth email, role `contractor`
   - **Contratada** (config da empresa): auth email OU `auto_signature`, role `contractee`
   - **Testemunha 1** (config da empresa): auth email, role `witness`
   - **Testemunha 2** (config da empresa): auth email, role `witness`
4. POST `/envelopes/{id}/requirements` (autenticacao + qualificacao para cada signatario)
5. PATCH `/envelopes/{id}` -> `{ status: "running" }`
Webhook `/api/webhooks/clicksign`: validar HMAC, atualizar `status_assinatura`, gravar em `eventos_assinatura`.
Payloads exatos: `https://developers.clicksign.com/llms.txt`.

## Producao
- **Dominio:** `https://app.e-taxconsultoria.com.br` (Vercel)
- **Supabase Auth — Site URL:** `https://app.e-taxconsultoria.com.br`
- **Supabase Auth — Redirect URLs:** `https://app.e-taxconsultoria.com.br/**`
- **Webhook ClickSign:** `https://app.e-taxconsultoria.com.br/api/webhooks/clicksign`

## Variaveis de ambiente
```
NEXT_PUBLIC_APP_URL=https://app.e-taxconsultoria.com.br
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
