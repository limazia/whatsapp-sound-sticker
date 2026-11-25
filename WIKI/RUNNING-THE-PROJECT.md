# Como executar

## Instalação

Use Node.js 26 e Yarn Classic 1.22.22. Se precisar instalar o Yarn, rode `npm install --global yarn@1.22.22`.

Na raiz do projeto, copie a configuração de exemplo, defina as chaves e rode o setup para instalar as dependências, baixar o FFmpeg e compilar o projeto.

```sh
cp .env.example .env
yarn setup
yarn start
```

Por padrão, a API escuta em `127.0.0.1:3000`. Para configurar o servidor, copie `.env.example` para `.env` e use `HOST` sem porta ou protocolo. A porta e o nível dos logs ficam em `PORT` e `LOG_LEVEL`. Use a porta escolhida nos exemplos abaixo.

Abra a [interface](http://127.0.0.1:3000/) para preparar e enviar figurinhas. O [painel do WhatsApp](http://127.0.0.1:3000/admin) mostra o QR, gera códigos de pareamento, acompanha eventos e desconecta a conta.

Defina `ADMIN_PASSWORD` como sua senha. Ao abrir `/admin`, a caixa de autenticação do navegador pede o usuário `admin` e essa senha.

A interface pede a `API_KEY` uma vez por aba e a envia no header `X-API-Key` nas chamadas ao Fastify. A página inicial e o healthcheck são públicos. Depois de informar a chave da API, seus amigos digitam o `FRIEND_KEY` para entrar. A sessão de amigo permite preparar figurinhas e enviá-las diretamente a qualquer número com DDI pela conta conectada. Somente o administrador pode ver os dados e operar a sessão do WhatsApp.

Em outro terminal, confira se a API está respondendo. A resposta inclui `ffmpeg.available`.

```sh
curl http://127.0.0.1:3000/api/health
```

Abra a [referência Scalar](http://127.0.0.1:3000/api/docs). Em `development`, a página abre sem login e preenche a chave da API no Scalar. Use esse modo em ambiente local. Em `qa` e `production`, entre com `DOCS_USER` e `DOCS_PASSWORD` e informe a `API_KEY` no Scalar para executar as chamadas. Os arquivos [JSON](http://127.0.0.1:3000/api/docs/openapi.json) e [YAML](http://127.0.0.1:3000/api/docs/openapi.yaml) seguem a mesma autenticação da página.

```sh
curl -H "X-API-Key: $API_KEY" http://127.0.0.1:3000/api/session
```

## CORS

As rotas que operam a sessão ou as figurinhas aceitam chamadas do navegador na mesma origem da interface. O CORS geral é configurado em `src/config/cors.config.ts`.

## Fluxo de uso

1. Chame `POST /api/connect` e acompanhe o QR pelo SSE em `GET /api/events`, ou peça um código em `POST /api/pair` com `phone` e DDI.
2. Envie `media` e, opcionalmente, `audio` em `POST /api/prepare` como `multipart/form-data`. O limite é de 80 MB por arquivo. Guarde o `id` retornado.
3. Com a sessão conectada, chame `POST /api/send` com esse `id` e o número de destino em `to`. Para o administrador, um destino vazio envia à própria conta.
4. Chame `POST /api/disconnect` para encerrar a sessão e apagar a autenticação local.

## Desenvolvimento

Use `yarn dev` para recarregar o backend e `yarn dev:web` em outro terminal para trabalhar no React. O Vite encaminha `/api/*` ao Fastify. Use `yarn lint`, `yarn typecheck` e `yarn test` para validar as alterações. `yarn build` compila o backend em `dist/` e o código-fonte React de `web/` em `public/`, que o Fastify serve na mesma origem.

## Publicar no Railway

1. Conecte o repositório a um serviço no Railway. O `Dockerfile` compila o React e o Fastify e instala o FFmpeg. O healthcheck usa `/api/health`.
2. Em **Variables**, configure `API_KEY`, `ADMIN_PASSWORD` e `FRIEND_KEY` com valores distintos. Use pelo menos 24 caracteres para a senha do administrador e o código de amigo. Configure também `DOCS_USER` e `DOCS_PASSWORD` para o Scalar. Para gerar uma senha, execute o comando abaixo.

   ```sh
   node -e 'console.log(require("node:crypto").randomBytes(24).toString("hex"))'
   ```

3. Monte um volume em `/app/auth`. O volume guarda as credenciais da sessão entre redeploys. Mantenha uma instância para a conta conectada.
4. Em **Public Networking**, gere o domínio HTTPS. Abra `/admin` com o usuário `admin` e sua senha para conectar o WhatsApp. Compartilhe o domínio, a chave da API e o código de amigo. O servidor usa a porta `PORT` fornecida pelo Railway.

Os logins do painel e as figurinhas preparadas ficam na instância atual. Após um reinício, entre novamente. O WhatsApp tenta restaurar a sessão salva. A atividade do painel mostra os 30 eventos mais recentes recebidos desde que a página foi aberta. O servidor também escreve as mensagens de atividade no log de execução, conforme `LOG_LEVEL`; o app não mantém histórico de eventos em disco. As figurinhas temporárias expiram em 30 minutos.

Para testar o container localmente, configure os códigos no `.env` e rode `yarn compose`. O Compose publica a porta 3000 em loopback e guarda a sessão em um volume local.

## Para que serve `scripts/`

| Arquivo | Comando | O que faz |
| --- | --- | --- |
| `fetch-ffmpeg.ts` | `yarn fetch-ffmpeg` | Baixa o executável do FFmpeg para o sistema e a arquitetura atuais. O setup já executa essa etapa. |
| `offline-test.ts` | `yarn offline-test /caminho/video.mp4` | Converte uma mídia local e verifica a mensagem da figurinha, incluindo o áudio quando presente, sem abrir sessão no WhatsApp. |
| `package-windows.ts` | `yarn build && node scripts/package-windows.ts` | Empacota o backend compilado, as dependências, Node e FFmpeg em um ZIP portátil. Exige `WIN_NODE_DIR` e `WIN_FFMPEG_EXE`. |
| `container-start.ts` | Entrypoint Docker | Prepara as permissões do volume de autenticação e inicia o servidor como o usuário `node`. |
