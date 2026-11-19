# Container and startup performance

## Docker build

The Dockerfile uses separate dependency, build, and runtime stages. The runtime stage contains production dependencies and compiled `dist` output only, runs as an unprivileged `stellaraid` user, and uses `tini` for process reaping and signal forwarding.

Build and inspect the image locally:

```bash
docker build -t stellaraid-api:local .
docker image inspect stellaraid-api:local --format '{{.Size}}'
docker run --rm -p 3000:3000 stellaraid-api:local
```

The `.dockerignore` excludes dependencies, build output, Git metadata, environment files, Markdown, and compose files from the build context.

## Startup measurement

Normal startup is unchanged. To print an opt-in readiness duration:

```bash
STARTUP_TIMING=true npm run start:prod
```

The line is emitted after `app.listen()` succeeds and has this form:

```text
Startup ready in 123ms
```

For a shell-visible process baseline, use:

```bash
/usr/bin/time -f 'elapsed=%e s  maxrss=%M KB' env STARTUP_TIMING=true npm run start:prod
```

Stop it with `Ctrl+C`. Repeat at least three times after a warm dependency cache and record elapsed time plus image size. On this environment, a reproducible baseline can be recorded by running the build and startup commands on the same machine and Node version.

Initial implementation baseline should be captured per environment rather than treated as a universal number. Record Node.js version, CPU, OS, container mode, build duration, image size, and startup duration in release notes.
