# Railway deployment

Use two services in one Railway environment. Keep the web and server images on
the same Phase release tag so their multiplayer protocols stay compatible.

| Service | Source | Settings |
| --- | --- | --- |
| `phase-server` | `ghcr.io/phase-rs/phase-server:v0.96.0` | One replica; `PORT=9374`; health check `/health` with a 600 second startup timeout; persistent volume mounted at `/var/lib/phase-server` |
| `phase-web` | This repository, built from `deploy/railway-web.Dockerfile` with the repository root as build context | `PORT=8080`; public domain routed to port 8080; health check `/` |

Set these service variables after Railway assigns public domains:

| Service | Variable | Value |
| --- | --- | --- |
| `phase-server` | `PUBLIC_URL` | `https://<server-domain>` |
| `phase-server` | `PHASE_CORS_ORIGIN` | `https://<web-domain>` |
| `phase-server` | `PHASE_LOG_JSON` | `true` |
| `phase-web` | `PHASE_MULTIPLAYER_SERVER_URL` | `wss://<server-domain>/ws` |

The server image downloads card data into the volume on first boot. Its SQLite
game database also lives there. The web image serves the published Phase client;
the Nginx template supplies `/config.js` at runtime so the site connects to this
Railway server. Cloud sync credentials are optional and are not needed for play.

When upgrading, change the tag in `deploy/railway-web.Dockerfile` and the server
service image together. The web service builds a wrapper around a published
client image, so a commit to this repository does not rebuild the game client.
Verify `/`, `/config.js`, and the server's `/health` endpoint after each upgrade.
