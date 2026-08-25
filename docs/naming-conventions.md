# Naming Conventions

This document is the authoritative reference for naming conventions across the Lumora NestJS API (`lumora-services`).
All conventions are enforced by ESLint rules defined in `eslint.config.mjs`.

---

## Table of Contents

1. [Files and Directories](#1-files-and-directories)
2. [Classes](#2-classes)
3. [Interfaces](#3-interfaces)
4. [Enums and Enum Members](#4-enums-and-enum-members)
5. [Variables and Parameters](#5-variables-and-parameters)
6. [Methods and Functions](#6-methods-and-functions)
7. [Constants](#7-constants)
8. [Type Aliases](#8-type-aliases)
9. [Generics](#9-generics)
10. [NestJS-Specific Conventions](#10-nestjs-specific-conventions)
11. [DTOs](#11-dtos)
12. [Decorators](#12-decorators)
13. [Database / Prisma Models](#13-database--prisma-models)
14. [Comments](#14-comments)
15. [Quick-Reference Table](#15-quick-reference-table)

---

## 1. Files and Directories

| Artefact | Convention | Example |
|---|---|---|
| Source files | `kebab-case` | `auth.service.ts` |
| Spec files | `kebab-case` + `.spec` | `auth.service.spec.ts` |
| DTO files | `kebab-case` + `.dto` | `create-service.dto.ts` |
| Enum files | `kebab-case` + `.enum` | `user-role.enum.ts` |
| Guard files | `kebab-case` + `.guard` | `jwt-auth.guard.ts` |
| Filter files | `kebab-case` + `.filter` | `http-exception.filter.ts` |
| Decorator files | `kebab-case` + `.decorator` | `current-user.decorator.ts` |
| Directories | `kebab-case`, no spaces | `dto/`, `common/filters/` |
| Index barrel files | `index.ts` (lowercase) | `src/wallet/dto/index.ts` |

**Rules:**
- All filenames must be `kebab-case`. Spaces and mixed-case names are forbidden.
- Directories must also be `kebab-case`. Never use spaces or camelCase in folder names (`dto copy/` ❌, `dto/` ✅).
- File suffixes communicate the artefact role. Always add the correct suffix.

---

## 2. Classes

**Convention:** `PascalCase`

```ts
// ✅ Correct
export class MarketplaceService { }
export class CreateServiceDto { }
export class HttpExceptionFilter { }
export class JwtAuthGuard { }

// ❌ Wrong
export class marketplaceService { }
export class createServiceDTO { }
```

**NestJS suffixes** are mandatory and part of the name:

| Role | Suffix |
|---|---|
| Injectable service | `Service` |
| Controller | `Controller` |
| Module | `Module` |
| Guard | `Guard` |
| Filter | `Filter` |
| Interceptor | `Interceptor` |
| Pipe | `Pipe` |
| DTO | `Dto` |
| Entity / Prisma model | No suffix (mirrors the schema) |

---

## 3. Interfaces

**Convention:** `PascalCase`, no `I` prefix.

```ts
// ✅ Correct
interface ArtistResult { }
interface PortfolioResult { }

// ❌ Wrong — do not use an "I" prefix
interface IArtistResult { }
```

---

## 4. Enums and Enum Members

**Enums:** `PascalCase`  
**Enum members:** `UPPER_SNAKE_CASE`

```ts
// ✅ Correct
export enum DisputeResolution {
  REFUND = 'REFUND',
  RELEASE = 'RELEASE',
  PARTIAL = 'PARTIAL',
}

export enum UserRole {
  ARTIST = 'ARTIST',
  CLIENT = 'CLIENT',
  BUSINESS = 'BUSINESS',
  ADMIN = 'ADMIN',
}

// ❌ Wrong
export enum disputeResolution { refund = 'refund' }
```

---

## 5. Variables and Parameters

**Convention:** `camelCase`

```ts
// ✅ Correct
const artistWallet = commission.artist.user?.walletAddress ?? '';
const platformFee = dto.amount * PLATFORM_FEE_RATE;
async function findOne(id: string, userId: string) { }

// ❌ Wrong
const ArtistWallet = '';
const platform_fee = 0;
```

**Private class members** use plain `camelCase` — no leading underscore required:

```ts
// ✅ Correct
private readonly logger = new Logger(PaymentsService.name);
private server: Horizon.Server;

// ❌ Avoid
private _logger = new Logger(PaymentsService.name);
```

---

## 6. Methods and Functions

**Convention:** `camelCase`, verb-led names that describe what the method does.

```ts
// ✅ Correct
async initiateEscrow(commissionId: string, dto: InitiateEscrowDto) { }
async confirmPayment(dto: ConfirmPaymentDto) { }
private buildSearchCacheKey(dto: SearchServicesDto): string { }
private async invalidateSearchCache(): Promise<void> { }

// ❌ Wrong
async InitiateEscrow() { }
async confirm_payment() { }
```

---

## 7. Constants

**Module-level / file-scope constants:** `UPPER_SNAKE_CASE`  
**Local block-scope constants:** `camelCase` (they are effectively local variables)

```ts
// ✅ Module-level constant
const PLATFORM_FEE_RATE = 0.02;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
export const SUPPORTED_ASSETS = ['XLM', 'USDC', 'NGNT', 'EURC'] as const;

// ✅ Local constant inside a function — camelCase is fine
const cacheKey = this.buildSearchCacheKey(dto);
const artistWallet = commission.artist.user?.walletAddress ?? '';
```

---

## 8. Type Aliases

**Convention:** `PascalCase`

```ts
// ✅ Correct
export type SupportedAsset = (typeof SUPPORTED_ASSETS)[number];

// ❌ Wrong
export type supportedAsset = (typeof SUPPORTED_ASSETS)[number];
```

---

## 9. Generics

**Convention:** Single uppercase letter (`T`, `K`, `V`) or descriptive `PascalCase` name for complex generics.

```ts
// ✅ Simple generic
function identity<T>(value: T): T { return value; }

// ✅ Descriptive generic
function fromPairs<TKey extends string, TValue>(pairs: [TKey, TValue][]): Record<TKey, TValue> { }
```

---

## 10. NestJS-Specific Conventions

### Modules
Each feature module groups its controller, service, DTOs, and guards under one directory named after the feature in `kebab-case`.

```
src/
  marketplace/
    dto/
      create-service.dto.ts
      update-service.dto.ts
      search-services.dto.ts
    marketplace.controller.ts
    marketplace.service.ts
    marketplace.module.ts
```

### Injection tokens
String-based injection tokens must be `UPPER_SNAKE_CASE`:

```ts
// ✅ Correct
@Inject('REDIS_CLIENT') private readonly redisClient: Redis

// ❌ Wrong
@Inject('redisClient') private readonly redisClient: Redis
```

### Metadata keys (SetMetadata)
Use `UPPER_SNAKE_CASE`:

```ts
// ✅ Correct
export const ROLES_KEY = 'roles';
export const IS_PUBLIC_KEY = 'isPublic';
```

### Guard / filter class names
Follow the `PascalCase` + role-suffix pattern:

```ts
export class JwtAuthGuard extends AuthGuard('jwt') { }
export class RolesGuard implements CanActivate { }
export class HttpExceptionFilter implements ExceptionFilter { }
```

---

## 11. DTOs

- File: `kebab-case` + `.dto.ts` — e.g., `create-service.dto.ts`
- Class: `PascalCase` + `Dto` suffix — e.g., `CreateServiceDto`
- Properties: `camelCase`, matching Prisma field names where possible
- All properties must have `class-validator` decorators
- All properties must have `@ApiProperty` or `@ApiPropertyOptional` Swagger decorators

```ts
// ✅ Correct
export class InitiateEscrowDto {
  @ApiProperty({ description: 'Amount in the chosen asset', example: 100 })
  @IsNumber()
  @IsPositive()
  amount: number;
}

// ❌ Wrong
export class initiateEscrowDto {
  amount: number;
}
```

---

## 12. Decorators

Custom decorators are `PascalCase` factory functions or `camelCase` for simple decorator constants:

```ts
// ✅ Factory decorator — PascalCase
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
export const CurrentUser = createParamDecorator(...)

// ✅ Simple boolean decorator — PascalCase
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

---

## 13. Database / Prisma Models

Prisma model names and field names are governed by the schema:

- **Models:** `PascalCase` singular noun — `User`, `Artist`, `Commission`
- **Fields:** `camelCase` — `passwordHash`, `walletAddress`, `createdAt`
- **Enums (Prisma):** `PascalCase` name, `UPPER_SNAKE_CASE` values — mirrors the TypeScript convention
- **Relations:** named after the related model in `camelCase` — `artist`, `commissions`, `auditLogs`

These conventions must not be changed without a Prisma migration.

---

## 14. Comments

### Inline comments
Inline comments should appear **above** the code they describe, not on the same line unless extremely brief. They must begin with a space after `//`.

```ts
// ✅ Correct — comment above the code block it describes
// Generate 6-digit OTP
const otp = Math.floor(100000 + Math.random() * 900000).toString();

// ❌ Wrong — comment on same line, not above
const otp = Math.floor(100000 + Math.random() * 900000).toString(); // generate otp
```

### Section separators
Use section-separator comments only for logically distinct groups inside large files. Prefer splitting large files into smaller modules instead.

```ts
// ──────────────────────────────────────────────────────────────────────────
// Escrow operations
// ──────────────────────────────────────────────────────────────────────────
```

### JSDoc
Use JSDoc (`/** */`) for exported functions, classes, and methods that form part of the public API of a module. Document `@param`, `@returns`, and `@throws` where the behaviour is non-obvious.

```ts
/**
 * Log an audit event.
 * @param userId - The ID of the user who performed the action
 * @param action - The action that was performed
 * @param metadata - Additional metadata
 * @param ip - The IP address of the requesting client
 */
async log(userId: string, action: string, metadata?: Record<string, any>, ip?: string): Promise<AuditLog>
```

---

## 15. Quick-Reference Table

| Artefact | Convention | Example |
|---|---|---|
| File | `kebab-case` | `auth.service.ts` |
| Directory | `kebab-case`, no spaces | `common/filters/` |
| Class | `PascalCase` | `MarketplaceService` |
| Interface | `PascalCase` | `ArtistResult` |
| Enum | `PascalCase` | `DisputeResolution` |
| Enum member | `UPPER_SNAKE_CASE` | `PENDING_VERIFICATION` |
| Variable / parameter | `camelCase` | `artistWallet` |
| Method / function | `camelCase` | `initiateEscrow` |
| Module-level constant | `UPPER_SNAKE_CASE` | `PLATFORM_FEE_RATE` |
| Type alias | `PascalCase` | `SupportedAsset` |
| Generic | `T` or `PascalCase` | `T`, `TKey` |
| DTO class | `PascalCase` + `Dto` | `CreateServiceDto` |
| Injection token | `UPPER_SNAKE_CASE` | `'REDIS_CLIENT'` |
| Metadata key | `UPPER_SNAKE_CASE` | `ROLES_KEY` |
| Decorator factory | `PascalCase` | `Roles`, `CurrentUser` |
| Prisma model | `PascalCase` singular | `User`, `Commission` |
| Prisma field | `camelCase` | `passwordHash` |
