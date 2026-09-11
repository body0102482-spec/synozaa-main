FROM node:20-slim

# Install OpenSSL (required by Prisma) and FFmpeg for audio processing
RUN apt-get update -y && apt-get install -y openssl ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (fresh Linux build)
RUN npm install

# Copy source code
COPY tsconfig.json ./
COPY src ./src/
COPY scripts ./scripts/

# Generate Prisma Client & compile TypeScript
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
ENV PORT=5000
ENV JWT_SECRET="synoza-jwt-default-secret-key-super-secure-2026"
ENV AI_PROVIDER="openrouter"
ENV OPENROUTER_API_KEY="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
OPENROUTER_FALLBACK_MODEL=qwen/qwen3.7-flash"
ENV OPENROUTER_FALLBACK_MODEL="qwen/qwen3.7-flash"
ENV OPENAI_MODEL="google/gemini-2.5-flash-lite"
ENV OPENAI_PATIENT_MODEL="google/gemini-2.5-flash-lite"
EXPOSE 5000

CMD ["npm", "start"]
