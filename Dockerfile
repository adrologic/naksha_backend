# syntax=docker/dockerfile:1

########## Build stage ##########
FROM node:22-slim AS build
WORKDIR /app

# Prisma's query engine needs OpenSSL present at generate/build time.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install ALL deps (postinstall runs `prisma generate`). Copy the schema first so
# the generate step during `npm ci` has it available.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Compile TypeScript -> dist  (the `build` script also re-runs `prisma generate`).
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

########## Runtime stage ##########
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Production deps only. `prisma` + `@prisma/client` are runtime deps, so
# `prisma migrate deploy` works at boot. The postinstall regenerates the client.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev

# Compiled JS from the build stage.
COPY --from=build /app/dist ./dist

EXPOSE 4000
# `start` = `prisma migrate deploy && node dist/index.js`
CMD ["npm", "start"]
