# WhatsApp Sound Sticker

Turn an image or video into a WhatsApp sticker with sound. Add a separate audio file if you like, preview the sticker, then send it to a phone number.

## Before connecting WhatsApp

Use a dedicated test account and keep your main account separate. If you choose a temporary or virtual number, make sure you control it and can verify it again. Scanning the QR code links your account to an unofficial client. Automating messages this way can result in an account ban. [WhatsApp guidance](https://faq.whatsapp.com/361005896189245/)

## Run locally

Use Node.js 26 and Yarn Classic. Copy `.env.example` to `.env`, set the credentials, then run `yarn setup` and `yarn start`. Open `/admin` to connect WhatsApp. Visitors to `/` can send stickers through that account.

For deployment and configuration, see the [project guide in Portuguese](wiki/RUNNING-THE-PROJECT.md). [Português](README.md)
