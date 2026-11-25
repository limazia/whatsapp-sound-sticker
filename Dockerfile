FROM node:26-bookworm-slim AS build
WORKDIR /app

RUN npm install --global yarn@1.22.22
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-scripts --non-interactive

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY web ./web
ARG API_KEY
RUN yarn build \
    && yarn install --production --frozen-lockfile --ignore-scripts --non-interactive

FROM node:26-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates ffmpeg gosu \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir bin \
    && ln -s /usr/bin/ffmpeg bin/ffmpeg
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY scripts/container-start.ts ./container-start.ts
EXPOSE 3000
ENTRYPOINT ["node", "/app/container-start.ts"]
CMD ["node", "--enable-source-maps", "dist/server.js"]
