# Docker image publishing and deployment

The [Docker workflow](../../../.github/workflows/docker.yml) builds the existing
[Dockerfile](../../../Dockerfile) and publishes a Linux AMD64 image to
`ghcr.io/<owner>/<repository>` (currently `ghcr.io/pboos/wardly`). Its OCI source
label links the package to the GitHub repository. ARM64 images are not built.

## Publishing

- Pushes to `main` publish `latest`, `main`, and `sha-<short-commit>` tags.
- Pushing a `v*` Git tag publishes that exact tag (for example `v1.2.3`) and a
  commit tag. Version tags do not move `latest`.
- Pull requests targeting `main` build without logging in or publishing.
- **Actions → Docker image → Run workflow** publishes the selected branch/tag;
  only the default branch updates `latest`.
- Build layers use the GitHub Actions cache. Actions are pinned to commit SHAs.

Authentication uses the automatic `GITHUB_TOKEN` with `packages: write`; no
custom registry secret is required. Repository/organization settings must allow
GitHub Actions and these actions. After the first successful publish, the image
appears under the repository's **Packages** section. New packages are private by
default; change visibility in package settings if anonymous pulls are desired.
An existing package may need this repository granted access in its package
settings under **Manage Actions access**.

## Running the published image

For a private package, log in on the server with a classic personal access token
that has `read:packages` and access to the package (authorize organization SSO
if required). Public images can be pulled without login.

```bash
# Private packages only; Docker prompts for the token as the password.
docker login ghcr.io -u YOUR_GITHUB_USERNAME
docker pull ghcr.io/pboos/wardly:latest
docker run -d --name wardly --restart unless-stopped \
  -p 3000:3000 --env-file .env \
  -e DATABASE_URL=file:/data/wardly.db \
  -v wardly-data:/data ghcr.io/pboos/wardly:latest
```

Prepare the server's `.env` from [`.env.example`](../../../.env.example), including
the JWT secret and email configuration. Secrets and local SQLite databases are
excluded from the build context by [`.dockerignore`](../../../.dockerignore).
Keep `LOCAL_AUTH_BYPASS` disabled in production. The `/data` volume persists the
SQLite database; back it up before upgrading. The
[entrypoint](../../../entrypoint.sh) applies committed migrations before starting
Next.js. See [database setup](../../DATABASE.md) for database rules.

Pulling a newer image does not replace a running container: recreate it with the
same environment and volume. Use a version or commit tag for a fixed deployment.
The existing [Compose file](../../../docker-compose.yml) builds locally; it does
not pull from GHCR.
