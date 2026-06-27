@AGENTS.md

# CLAUDE.md — Central de Contratos e Mentorados

Contexto do projeto para o Claude Code. Leia antes de qualquer tarefa.

## O que é
Sistema jurídico e de controle de mentorados de uma empresa de educação. O comercial abre uma **solicitação** por formulário; o jurídico **confecciona** o contrato a partir de um modelo; após **aprovação**, sobe para a **ClickSign**; o sistema acompanha **assinaturas** e **vencimentos** e **espelha tudo numa planilha do Google Sheets**.

## Stack
- Next.js (App Router, TypeScript) na Vercel
- Supabase/Postgres = fonte da verdade (schema em `supabase-schema.sql`)
- ClickSign API v3 = assinatura
- Google Sheets API (Service Account) = espelho compartilhado (escrita app → planilha)

## Princípios de arquitetura (não violar)
1. **Três dimensões de estado separadas:** status da *solicitação* (interno), status de *assinatura* (ClickSign/webhook), status de *vigência* (calculado por datas). Não misturar numa coluna só.
2. **Planilha é espelho, não banco.** Supabase é a fonte da verdade; a planilha recebe append/update.
3. **Tipo de contrato é config, não código.** Club/Tração/PJ/Fornecedor são registros em `tipos_contrato` com `schema_campos`. Nunca hardcodar lógica por tipo no front; ler do schema.
4. **Webhooks idempotentes.** Processar por `clicksign_event_id`; ignorar duplicados.
5. **Sandbox primeiro.** Toda integração ClickSign testada no sandbox antes da produção.

## Ciclo de vida
Solicitação: `nova → em_confeccao → aguardando_aprovacao → aprovada → enviada_assinatura` (ou `cancelada`).
Assinatura: `aguardando_assinatura → assinado | recusado | expirado`.
Regra: só envia à ClickSign se `aprovada` + modelo + signatário definidos. Cada documento precisa de ≥ 2 requisitos (autenticação + assinatura).

## Menu (arquitetura de informação)
Dashboard · Solicitações · Confecção · Assinaturas · Contratos · Mentorados · Modelos · Configurações.

## Tipos e campos (MVP: Club e Tração)
- **Club:** nome, cpf, email, whatsapp, plano, valor, forma_pagamento, inicio, duracao, vendedor.
- **Tração:** nome, cpf, email, whatsapp, turma, valor_total, parcelas, forma_pagamento, inicio, vendedor.
- (Fase 2: PJ e Fornecedor.) Os nomes das chaves devem bater com as variáveis do Modelo ClickSign.

## ClickSign v3 — fluxo
Base `https://app.clicksign.com/api/v3` (sandbox: `https://sandbox.clicksign.com/api/v3`).
Headers: `Authorization: {token}` + `Content-Type: application/vnd.api+json`.
1. POST `/envelopes` → guarda `id`
2. POST `/envelopes/{id}/documents` (por Modelo: `template.key` + `template.data` com as variáveis)
3. POST `/envelopes/{id}/signers`
4. POST `/envelopes/{id}/requirements` (autenticação + assinatura)
5. PATCH `/envelopes/{id}` → `{ status: "running" }`
Webhook em `/api/webhooks/clicksign`: validar HMAC, atualizar `status_assinatura`, gravar em `eventos_assinatura`.
Payloads exatos de signer/requirements: consultar `https://developers.clicksign.com/llms.txt`.

## Variáveis de ambiente (.env.local + Vercel)
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

## Ordem de construção (fatias verticais — uma de cada vez)
1. **Setup:** Next.js + cliente Supabase + auth básica + layout do menu.
2. **Fatia 1 — Solicitações:** formulário externo (Club/Tração) → `/api/solicitacoes` grava no Supabase → lista em Solicitações. *Fim a fim antes de seguir.*
3. **Fatia 2 — Confecção + ClickSign (sandbox):** preencher variáveis do modelo, aprovar, criar envelope e ativar; salvar `envelope_id` no contrato.
4. **Fatia 3 — Webhook + Assinaturas:** receber eventos, atualizar status, tela de acompanhamento.
5. **Fatia 4 — Espelho Sheets:** append/update na planilha a cada criação/mudança de status.
6. **Fatia 5 — Contratos & Mentorados:** repositório, vencimentos, visão por contraparte.

## Convenções
- Commits pequenos por fatia. Não avançar de fatia sem a anterior rodando.
- Segredos só em env; nunca no client. Chamadas ClickSign/Sheets sempre server-side (rotas de API).
- Falha ao escrever na planilha não trava o contrato (re-tentativa assíncrona).

## Definition of Done (MVP)
Comercial cria solicitação Club/Tração → jurídico confecciona e aprova → envelope criado na ClickSign → ao assinar, status atualiza no sistema e na planilha.
