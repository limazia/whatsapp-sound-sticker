# WhatsApp Sound Sticker

Aplicação web para criar e enviar **figurinhas com som** no WhatsApp. Converte imagens e vídeos em WebP 512 × 512 e aproveita o áudio do vídeo ou de um arquivo separado. O áudio segue em Ogg Opus dentro da mensagem da figurinha.

O Fastify serve o React em `/`, a área de administração em `/admin` e a API em `/api/*`. Copie `.env.example` para `.env`, configure as chaves, rode `yarn setup` e inicie com `yarn start`. O código do React fica em `web/` e o build sai em `public/`.

- [Interface](http://127.0.0.1:3000/)
- [Painel do WhatsApp](http://127.0.0.1:3000/admin)
- [Guia de execução e publicação](WIKI/RUNNING-THE-PROJECT.md)
- [Referência interativa com Scalar](http://127.0.0.1:3000/api/docs)
- [OpenAPI em JSON](http://127.0.0.1:3000/api/docs/openapi.json)

## Sobre o cliente do WhatsApp

O projeto usa o cliente não oficial `plogme`, um fork do Baileys. O WhatsApp pode restringir a conta ou mudar o protocolo. Se for testar com uma conta real, use um número reserva. Os dados de autenticação ficam em `auth/` até a chamada a `POST /api/disconnect`.

Criado por [@limadeacacio](https://x.com/limadeacacio).
