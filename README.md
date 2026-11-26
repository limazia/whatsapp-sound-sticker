# WhatsApp Sound Sticker

Aplicação web para preparar e enviar **figurinhas com som** pelo WhatsApp. Aceita imagem ou vídeo e permite usar um arquivo de áudio separado.

Use `/admin` para conectar sua conta e compartilhe o endereço da aplicação com quem vai enviar figurinhas.

## Antes de conectar o WhatsApp

Use uma conta de teste com um número dedicado e mantenha sua conta principal fora do projeto. Se optar por um número temporário ou virtual, use um que você controle e consiga verificar novamente. O QR Code vincula a sessão a um cliente não oficial. Automatizar envios dessa forma pode levar ao banimento da conta. [Orientações do WhatsApp](https://faq.whatsapp.com/361005896189245/)

## Como rodar

Com Node.js 26 e Yarn Classic, copie `.env.example` para `.env` e configure as credenciais. Depois rode `yarn setup` e `yarn start`.

O [guia de execução e publicação](wiki/RUNNING-THE-PROJECT.md) reúne a configuração, as rotas e o deploy no Railway.

[English](README.en.md)
