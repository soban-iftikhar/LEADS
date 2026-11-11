# One-shot database migration job. Build context: leads-app
FROM node:22-alpine

WORKDIR /app
RUN npm init -y >/dev/null \
    && npm install --no-audit --no-fund prisma@7.8.0 dotenv@16 \
    && npm cache clean --force

COPY prisma ./prisma
COPY prisma.config.ts ./

# Applies every pending migration, then exits. Other services wait for it to succeed.
CMD ["npx", "prisma", "migrate", "deploy"]
