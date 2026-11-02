# Sistema Banda APK

Painel da banda e formulário de inscrição dos candidatos.

- **painel.bandaapk.com.br**: painel da banda (login com perfis Master, Vendas e Músico)
- **inscricao.bandaapk.com.br/<festival>**: formulário passo a passo para os candidatos

## Como funciona

- App em React + Vite (`src/`), publicado como Cloudflare Worker com arquivos estáticos (`wrangler.jsonc`).
- Login, banco de dados, áudios e avisos em tempo real no Supabase (projeto `banda-apk`, região São Paulo).
- `supabase/migrations/`: estrutura do banco e regras de acesso (RLS). Toda a proteção dos dados fica no banco.
- `supabase/functions/usuarios`: função que o Master usa para criar logins, trocar senhas e remover usuários.

O app usa só a chave pública (publishable) do Supabase. Nenhuma senha ou chave secreta fica neste repositório.

## Rodar no computador

```
npm install
npm run dev
```

Para abrir o formulário do candidato localmente, use `/inscricao/<slug-do-festival>`.

## Publicar

Cada push na branch `main` publica sozinho pela integração da Cloudflare (Workers Builds).
Manual: `npx wrangler login` e depois `npm run deploy`.
