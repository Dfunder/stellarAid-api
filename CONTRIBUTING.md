# Contributing to the Backend

First off, thanks for taking the time to contribute! :tada::+1:

The following is a set of guidelines for contributing to this project. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## Local Setup

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-repo/stellarAid-api.git
    cd stellarAid-api
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up your environment variables:**

    Create a `.env` file in the root of the project and add the required environment variables. You can use the `.env.example` file as a template.

    ```bash
    cp .env.example .env
    ```

4.  **Run the development server:**

    ```bash
    npm run start:dev
    ```

## Required Environment Variables

Make sure to set the following environment variables in your `.env` file:

```
DATABASE_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
REDIS_URL=
STELLAR_NETWORK=
PLATFORM_WALLET_SECRET=
SENDGRID_API_KEY=
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
WALLET_ENCRYPTION_KEY=
```

## How to Run Migrations

To run database migrations, use the following command:

```bash
npm run prisma:migrate
```

## How to Seed the Database

To seed the database, use the following command:

```bash
npm run prisma:seed
```

## API Versioning

This API uses URI versioning to manage changes and maintain backward compatibility. All endpoints are prefixed with `/v1/`.

### Current Version

- **Version 1 (v1)**: All existing endpoints are accessible under the `/v1/` prefix
- Example: `POST /v1/auth/register`, `GET /v1/health`

### Adding Versioned Routes

When creating new controllers or routes, always specify the version:

```typescript
@Controller({ version: '1', path: 'your-resource' })
export class YourController {
  // Routes will be accessible at /v1/your-resource
}
```

### Versioning Strategy

- **URI Versioning**: The version is part of the URL path
- **Default Version**: Version 1 is the default and currently active version
- **Future Versions**: When breaking changes are needed, create a new version (e.g., v2) while maintaining v1 for backward compatibility

### Migration Path

When introducing breaking changes:
1. Create new endpoints in the next version (e.g., v2)
2. Maintain existing v1 endpoints for a deprecation period
3. Communicate deprecation timeline to API consumers
4. Eventually remove deprecated v1 endpoints

### Testing Versioned Endpoints

When testing API endpoints, always include the version prefix:

```bash
# Correct
curl http://localhost:3000/v1/health

# Incorrect (will not work)
curl http://localhost:3000/health
```

## Branch Naming

All branches should be named using the following convention:

- `feat/`: For new features (e.g., `feat/add-user-authentication`)
- `fix/`: For bug fixes (e.g., `fix/resolve-login-issue`)
- `chore/`: For routine tasks and maintenance (e.g., `chore/update-dependencies`)

## Pull Request Checklist

Before submitting a pull request, please ensure the following:

- [ ] Tests pass
- [ ] No lint errors
- [ ] Swagger docs updated

## Additional Documentation

For more in-depth guides, please consult:

- [Deployment Guide](docs/deployment.md) — Production deployment, Docker, database migrations, and rollback procedures.
- [Troubleshooting Guide](docs/troubleshooting.md) — Common startup errors, database, Redis, and Stellar network debugging.

## Good First Issues

If you're new to the project and looking for a place to start, check out the issues tagged with `good first issue`.
