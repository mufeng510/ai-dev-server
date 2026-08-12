# Security

## Docker Socket Risk

The service mounts `/var/run/docker.sock` read-write. Docker Socket access is effectively root access to the host. A compromised AI tool, dependency, shell command, or untrusted repository can ask Docker to start privileged containers, mount host paths, or modify other workloads.

Running the default workload as `dev`, omitting Compose `privileged`, and granting no unrelated capabilities reduce accidental container-local damage. They do not sandbox Docker Socket access. Deploy only on a trusted single-user host and review repositories before opening them in AI tools.

## Secrets

The public image contains no user credentials. Authentication is manual and persists in the selected `/config` generation per the [Tool State Contract](tool-state-contract.md). Sensitive state includes:

- Claude and Codex authentication files
- SSH private keys and Git credential configuration
- OMC/OMX user configuration
- cc-switch provider keys, OAuth refresh tokens, WebDAV credentials, database files, and backups
- code-server password (`CODE_SERVER_PASSWORD`) and IDE session state under the active generation

Never commit secrets, add them to Compose, pass them as Docker build arguments, or include raw configuration in an issue. Do not include the cc-switch subtree in a support bundle. Review `/logs` before sharing it even though structured events redact known secret patterns.

## Browser IDE (code-server)

code-server listens on `0.0.0.0:8080` with password authentication. `CODE_SERVER_PASSWORD` must be supplied by the operator through the host environment or a gitignored `.env`; it is never baked into the image and must not be committed. Password auth on a published port is weaker than loopback-only access: treat the Docker host as single-user trusted, use a strong password, and prefer TLS termination on a reverse proxy for any remote exposure. The password is passed to code-server only through the process environment, not argv or logs.

## Operational Controls

- Use immutable version tags or digests for production-like deployments.
- Back up all six volumes before an image, configuration, or identity migration.
- Keep the service stopped during migration, rollback, restore, and identity changes.
- Protect access to the Docker host and the Docker volume store.
- Use scoped Docker Hub credentials in CI. The workflow expects `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`.
- Do not enable cc-switch providers, proxy, synchronization, or updater unless you understand their credential and network behavior.

## Recovery Interface

Normal work must use `scripts/shell` or `scripts/exec`, which force the `dev` identity and resolve the active generation. `docker compose exec ai-dev sh` inherits the image's root user and exists only for recovery. Commands run there have both container root and Docker Socket access.

## Reporting A Vulnerability

Do not open a public issue containing credentials, private keys, tokens, sensitive logs, or exploitable details. Report privately to the repository owner through the security contact configured on the hosting platform. Include the affected image tag or digest and a minimal redacted reproduction.
