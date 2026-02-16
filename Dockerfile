# ─── Stage 1: Build Next.js frontend ────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /frontend
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY web/ .
RUN pnpm run build

# ─── Stage 2: Combined runtime ───────────────────────────────────────────────
FROM python:3.13-slim

# Install Node.js 20, nginx, supervisor
RUN apt-get update && apt-get install -y curl gnupg nginx supervisor \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Backend source
COPY main.py expense_classifier.py ./
COPY models/ ./models/

# Next.js standalone build
COPY --from=frontend-builder /frontend/.next/standalone /app/web/
COPY --from=frontend-builder /frontend/.next/static /app/web/.next/static
COPY --from=frontend-builder /frontend/public /app/web/public

# nginx & supervisor config
COPY docker/nginx.conf /etc/nginx/sites-available/default
COPY docker/supervisord.conf /etc/supervisor/conf.d/expenses.conf

RUN rm -f /etc/nginx/sites-enabled/default \
    && ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

EXPOSE 80

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
