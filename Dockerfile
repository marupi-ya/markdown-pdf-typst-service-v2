FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-noto-cjk \
    poppler-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev \
  && npm cache clean --force

COPY . .

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV TYPST_FONT_PATHS=/usr/share/fonts/opentype/noto

CMD ["npm", "run", "typst:service"]
