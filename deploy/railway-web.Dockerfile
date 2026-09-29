FROM ghcr.io/phase-rs/phase-web:v0.96.0

ENV NGINX_ENVSUBST_FILTER=^PHASE_MULTIPLAYER_SERVER_URL$

COPY deploy/railway-web.conf.template /etc/nginx/templates/default.conf.template
