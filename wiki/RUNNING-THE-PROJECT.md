# Como executar

## Instalação

Use Node.js 26 e Yarn Classic 1.22.22. Se precisar instalar o Yarn, rode `npm install --global yarn@1.22.22`.

Na raiz do projeto, copie a configuração de exemplo, defina as chaves e rode o setup para instalar as dependências, baixar o FFmpeg e compilar o projeto.

```sh
cp .env.example .env
yarn setup
yarn start
```

Para rodar localmente, defina `PORT=3000` e `HOST="localhost:${PORT}"` no `.env`. Também é possível usar um endereço IPv4 ou IPv6 no `HOST`. A porta em `HOST`, quando presente, deve ser igual a `PORT`. Configure o nível dos logs em `LOG_LEVEL`.

Abra a [interface](http://127.0.0.1:3000/) para preparar e enviar figurinhas. O [painel do WhatsApp](http://127.0.0.1:3000/admin) mostra o QR, gera códigos de pareamento, acompanha eventos e desconecta a conta.

Defina `ADMIN_PASSWORD` como sua senha. Ao abrir `/admin`, a caixa de autenticação do navegador pede o usuário `admin` e essa senha.

Qualquer visitante pode preparar e enviar figurinhas pela conta conectada. O Vite lê a variável pública `API_KEY` da raiz ao compilar o frontend. O navegador envia esse valor em `X-API-Key` e o Fastify compara com a `API_KEY` do servidor. Ao trocar a chave, recompile o frontend. No Docker, forneça o mesmo valor como argumento de build e variável de execução.

Em outro terminal, confira se a API está respondendo. A resposta inclui `ffmpeg.available`.

```sh
curl http://127.0.0.1:3000/api/health
```

Abra a [referência Scalar](http://127.0.0.1:3000/api/docs). Em `development`, a página abre sem login e preenche a chave da API no Scalar. Use esse modo em ambiente local. Em `test` e `production`, entre com `DOCS_USERNAME` e `DOCS_PASSWORD` e informe a `API_KEY` no Scalar para executar as chamadas. Os arquivos [JSON](http://127.0.0.1:3000/api/docs/openapi.json) e [YAML](http://127.0.0.1:3000/api/docs/openapi.yaml) seguem a mesma autenticação da página.

```sh
curl -H "X-API-Key: $API_KEY" http://127.0.0.1:3000/api/session
```

## CORS

As rotas que operam a sessão ou as figurinhas aceitam chamadas do navegador na mesma origem da interface. O CORS geral é configurado em `src/config/cors.config.ts`.

## Fluxo de uso

1. Chame `POST /api/connect` e acompanhe o QR pelo SSE em `GET /api/events`, ou peça um código em `POST /api/pair` com `phone` e DDI.
2. Envie `media` e, opcionalmente, `audio` em `POST /api/prepare` como `multipart/form-data`. O limite é de 80 MB por arquivo. Guarde o `id` retornado.
3. Com a sessão conectada, chame `POST /api/send` com esse `id` e o número de destino em `to`. O destino é obrigatório para todos. Na interface, o prefixo +55 já vem preenchido.
4. Chame `POST /api/disconnect` para encerrar a sessão e apagar a autenticação local.

## Desenvolvimento

Use `yarn dev` para recarregar o backend e `yarn dev:web` em outro terminal para trabalhar no React. O Vite encaminha `/api/*` ao Fastify. Use `yarn lint`, `yarn typecheck` e `yarn test` para validar as alterações. `yarn build` compila o backend em `dist/` e o código-fonte React de `web/` em `public/`, que o Fastify serve na mesma origem.

## Publicar no Railway

1. Conecte o repositório a um serviço no Railway. O `Dockerfile` compila o React e o Fastify e instala o FFmpeg. O healthcheck usa `/api/health`.
2. Em **Variables**, configure `API_KEY` e `ADMIN_PASSWORD` com valores distintos. Use pelo menos 24 caracteres para a senha do administrador. Configure também `DOCS_USERNAME` e `DOCS_PASSWORD` para o Scalar. Para gerar uma senha, execute o comando abaixo.

   ```sh
   node -e 'console.log(require("node:crypto").randomBytes(24).toString("hex"))'
   ```

3. Monte um volume em `/app/auth`. O volume guarda as credenciais da sessão entre redeploys. Mantenha uma instância para a conta conectada.
4. Em **Public Networking**, gere o domínio HTTPS. Abra `/admin` com o usuário `admin` e sua senha para conectar o WhatsApp. Compartilhe o domínio. O servidor usa a porta `PORT` fornecida pelo Railway.

Os logins do painel e as figurinhas preparadas ficam na instância atual. Após um reinício, entre novamente. O WhatsApp tenta restaurar a sessão salva. O painel guarda os últimos 30 eventos em `auth/activity/events.sqlite`. Eles continuam disponíveis após reiniciar o servidor quando a pasta `auth` está em um volume persistente. As figurinhas temporárias expiram em 30 minutos.

O projeto usa o cliente não oficial `plogme`, um fork do Baileys. Os dados de autenticação ficam em `auth/` até a desconexão da conta.

## Para que serve `scripts/`

| Arquivo | Comando | O que faz |
| --- | --- | --- |
| `fetch-ffmpeg.ts` | `yarn fetch-ffmpeg` | Baixa o executável do FFmpeg para o sistema e a arquitetura atuais. O setup já executa essa etapa. |
| `offline-test.ts` | `yarn offline-test /caminho/video.mp4` | Converte uma mídia local e verifica a mensagem da figurinha, incluindo o áudio quando presente, sem abrir sessão no WhatsApp. |
| `package-windows.ts` | `yarn build && node scripts/package-windows.ts` | Empacota o backend compilado, as dependências, Node e FFmpeg em um ZIP portátil. Exige `WIN_NODE_DIR` e `WIN_FFMPEG_EXE`. |
| `container-start.ts` | Entrypoint Docker | Prepara as permissões do volume de autenticação e inicia o servidor como o usuário `node`. |
