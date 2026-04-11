# Render Deployment

This project is set up to run on Render as a Docker web service plus Render Postgres.

## Current deployment model

- Web service: Docker-based FastAPI backend
- Database: Render Postgres
- Storage: persistent disk mounted at `/app/data`
- Health check: `/api/health/ready`
- Auth: bearer tokens via `AUTH_BEARER_TOKENS`

## Important env vars

- `ENV=prod`
- `ENABLE_CONSOLE=false`
- `ENFORCE_HTTPS_REDIRECT=true`
- `AUTH_BEARER_TOKENS=<comma-separated tokens>`
- `TRUSTED_HOSTS=<your-service.onrender.com,custom-domain>`
- `PUBLIC_BASE_URL=https://<your-service.onrender.com>`
- `MAX_UPLOAD_MB=50`
- `MAX_FILES_PER_JOB=12`

## Render blueprint

The repo includes [render.yaml](/Users/jegannathan/Documents/New project/bank-intel-platform/render.yaml) for Blueprint-based setup.

Key choices:

- `runtime: docker`
- `healthCheckPath: /api/health/ready`
- `disk:` instead of the legacy `disks:` shape
- `autoDeployTrigger: off` for controlled deploys

## Deploy steps

1. Push this project to a Git repository that Render can access.
2. In Render, create a new Blueprint or Web Service from that repository.
3. Confirm the `render.yaml` service and database plan.
4. Set secret env vars before first production traffic:
   - `AUTH_BEARER_TOKENS`
   - `TRUSTED_HOSTS`
   - `PUBLIC_BASE_URL`
5. Deploy and wait for the health check to pass.
6. Point the desktop or CLI client at the resulting URL:

```bash
export REMOTE_PARSE_BASE_URL=https://your-service.onrender.com
export REMOTE_PARSE_API_KEY=your-token
bank-intel doctor --remote
bank-intel parse statement.pdf --remote --export
```

## Notes

- Render terminates TLS at the platform edge and forwards requests to the container over HTTP.
- The container binds to `0.0.0.0:${PORT}` as recommended by Render.
- If this project lives inside a larger monorepo, move `render.yaml` to the repo root or set Blueprint `rootDir`, `dockerfilePath`, and `dockerContext` accordingly.
