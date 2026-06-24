# --- Build stage: compile the Vite app to static files ---
FROM node:20-alpine AS build
WORKDIR /app

# Install deps first (cached unless the lockfile changes)
COPY package.json package-lock.json ./
RUN npm ci

# VITE_API_BASE_URL is inlined at build time by Vite — pass it as a build arg.
# Host only, no /api (the app already prefixes every call with /api).
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY . .
RUN npm run build

# --- Runtime stage: serve the static build with nginx ---
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
