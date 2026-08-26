# Utility Functions Library

This document describes the shared utility functions library available in `src/common/utils/` within the **Lumora API** (stellarAid-api). The utility library provides centralized, reusable, and thoroughly tested helpers designed to reduce code duplication across services, controllers, and repositories.

---

## Table of Contents

1. [Module Architecture](#1-module-architecture)
2. [Importing Utilities](#2-importing-utilities)
3. [Stellar Blockchain Utilities (`stellar.util.ts`)](#3-stellar-blockchain-utilities)
4. [Currency & Financial Utilities (`currency.util.ts`)](#4-currency--financial-utilities)
5. [String & Sanitization Utilities (`string.util.ts`)](#5-string--sanitization-utilities)
6. [Date & Time Utilities (`date.util.ts`)](#6-date--time-utilities)
7. [Object & Collection Utilities (`object.util.ts`)](#7-object--collection-utilities)
8. [Pagination Utilities (`pagination.util.ts`)](#8-pagination-utilities)
9. [Asynchronous & Resilience Utilities (`async.util.ts`)](#9-asynchronous--resilience-utilities)
10. [Unit Testing](#10-unit-testing)

---

## 1. Module Architecture

The utility suite is organized into domain-specific modules with a central barrel export:

```
src/common/utils/
├── async.util.ts             # Sleep, retry with exponential backoff, timeout wrapper
├── async.util.spec.ts        # Unit tests for async utilities
├── currency.util.ts          # USDC formatting, platform fee calculations, Stroop conversion
├── currency.util.spec.ts     # Unit tests for currency utilities
├── date.util.ts              # ISO formatting, date arithmetic, UTC boundaries
├── date.util.spec.ts         # Unit tests for date utilities
├── index.ts                  # Central barrel re-exporting all utilities
├── object.util.ts            # Pick, omit, cleanUndefined, groupBy, chunk, deepClone
├── object.util.spec.ts       # Unit tests for object utilities
├── pagination.util.ts        # Offset-based pagination helper with metadata
├── pagination.util.spec.ts   # Unit tests for pagination utility
├── stellar.util.ts           # Public/secret key validation, address formatting, masking
├── stellar.util.spec.ts      # Unit tests for stellar utilities
├── string.util.ts            # Slugify, truncate, maskEmail, OTP generation, HTML escape
└── string.util.spec.ts       # Unit tests for string utilities
```

---

## 2. Importing Utilities

All utilities can be imported directly from the `src/common/utils` barrel:

```typescript
import {
  isValidStellarPublicKey,
  calculatePlatformFee,
  generateOtp,
  paginate,
  formatUsdc,
  pick,
} from '../common/utils';
```

---

## 3. Stellar Blockchain Utilities

**File:** `src/common/utils/stellar.util.ts`

### `isValidStellarPublicKey(publicKey: string): boolean`
Validates whether a string is a valid ed25519 public key (Stellar `G...` address).
```typescript
isValidStellarPublicKey('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7'); // true
isValidStellarPublicKey('invalid_key'); // false
```

### `isValidStellarSecretKey(secretKey: string): boolean`
Validates whether a string is a valid Stellar secret seed (`S...` address).
```typescript
isValidStellarSecretKey('SDAXWYSWVQ3HNLNPJ2G5ZRF2TY43QL2R45HUP26PYF4B5LNLZ7K7BJJT'); // true
```

### `isValidTxHash(txHash: string): boolean`
Validates if a string is a 64-character hexadecimal transaction hash.
```typescript
isValidTxHash('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'); // true
```

### `formatStellarAddress(address: string, chars = 4): string`
Abbreviates an address for UI display (e.g. `"GAAZ...CWN7"`).
```typescript
formatStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7', 4);
// Returns "GAAZ...CWN7"
```

### `maskWalletAddress(address: string): string`
Alias for `formatStellarAddress` with 4 characters, used for privacy in logs and notifications.

---

## 4. Currency & Financial Utilities

**File:** `src/common/utils/currency.util.ts`

### `calculatePlatformFee(amount: number | string, feeRate = 0.02): number`
Calculates platform fee (default: 2%) rounded to 7 decimal places for Stellar precision.
```typescript
calculatePlatformFee(100); // 2
calculatePlatformFee(250, 0.025); // 6.25
```

### `formatUsdc(amount: number | string, decimals = 2): string`
Formats monetary amounts with thousands separators and 2 decimal places.
```typescript
formatUsdc(1234.5); // "1,234.50"
```

### `stroopsToLumens(stroops: number | string | bigint): number`
Converts integer Stroops (1 XLM = 10,000,000 Stroops) to decimal Lumens.
```typescript
stroopsToLumens(10_000_000); // 1.0
```

### `lumensToStroops(lumens: number | string): number`
Converts decimal token amounts to integer Stroops.
```typescript
lumensToStroops(2.5); // 25000000
```

### `isValidAmount(amount: unknown): boolean`
Validates that an amount is a positive, finite numeric value.
```typescript
isValidAmount(50.25); // true
isValidAmount(-10); // false
isValidAmount('abc'); // false
```

### `roundToDecimals(value: number | string, decimals = 7): number`
Rounds numeric amounts avoiding floating-point drift.

---

## 5. String & Sanitization Utilities

**File:** `src/common/utils/string.util.ts`

### `slugify(text: string): string`
Transforms arbitrary strings into clean URL slugs.
```typescript
slugify('Digital Illustration & Concept Art!');
// Returns "digital-illustration-concept-art"
```

### `truncate(text: string, maxLength: number, suffix = '...'): string`
Truncates long strings at character boundary.
```typescript
truncate('This is a very long service description', 15);
// Returns "This is a ve..."
```

### `maskEmail(email: string): string`
Masks email addresses for secure logging and display.
```typescript
maskEmail('artist@stellaraid.com');
// Returns "a****t@stellaraid.com"
```

### `capitalize(text: string): string`
Capitalizes the first character of a string.
```typescript
capitalize('illustration'); // "Illustration"
```

### `generateOtp(length = 6): string`
Generates a cryptographically random numeric OTP code.
```typescript
generateOtp(6); // e.g. "849201"
```

### `generateRandomString(length = 32): string`
Generates a cryptographically random alphanumeric string.
```typescript
generateRandomString(16); // e.g. "9a2f7c01b4e85d3f"
```

### `sanitizeHtml(str: string): string`
Escapes `<`, `>`, `&`, `"`, `'` characters to prevent basic script injection.

---

## 6. Date & Time Utilities

**File:** `src/common/utils/date.util.ts`

### `formatIsoDate(date?: Date | string | number): string`
Formats dates consistently to UTC ISO 8601 strings (`2026-08-26T00:00:00.000Z`).

### `daysBetween(startDate: Date | string, endDate: Date | string): number`
Calculates whole calendar days between two dates.

### `addDays(date: Date | string, days: number): Date`
Adds (or subtracts with negative numbers) calendar days from a date.

### `isPastDate(date: Date | string): boolean` / `isFutureDate(date: Date | string): boolean`
Evaluates temporal relationship against current clock.

### `startOfDayUtc(date?: Date | string): Date` / `endOfDayUtc(date?: Date | string): Date`
Sets time to UTC midnight (`00:00:00.000`) or end of day (`23:59:59.999`).

---

## 7. Object & Collection Utilities

**File:** `src/common/utils/object.util.ts`

### `pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>`
Extracts a subset of properties from an object into a new object.
```typescript
const user = { id: '1', email: 'test@example.com', passwordHash: 'hash', role: 'ADMIN' };
pick(user, ['id', 'email']); // { id: '1', email: 'test@example.com' }
```

### `omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K>`
Returns an object clone without specified sensitive keys.
```typescript
omit(user, ['passwordHash']); // { id: '1', email: 'test@example.com', role: 'ADMIN' }
```

### `cleanUndefined<T>(obj: T): Partial<T>`
Removes keys whose values are `undefined`.

### `groupBy<T, K>(array: T[], keyFn: (item: T) => K): Record<K, T[]>`
Groups an array into key-indexed buckets.

### `chunk<T>(array: T[], size: number): T[][]`
Partitions an array into fixed-size chunks for batch processing.

### `deepClone<T>(obj: T): T`
Deep clones nested serializable objects and Date instances.

---

## 8. Pagination Utilities

**File:** `src/common/utils/pagination.util.ts`

### `paginate<T>(query: PaginateQuery<T>)`
Executes an offset-based pagination query with automatic bounds checking and metadata generation.

```typescript
const result = await paginate({
  page: dto.page,
  limit: dto.limit,
  fetch: ({ skip, take }) =>
    this.prisma.service.findMany({ skip, take, where: { isActive: true } }),
  count: () => this.prisma.service.count({ where: { isActive: true } }),
});

// Returns:
// {
//   data: [...],
//   meta: { total: 45, page: 1, limit: 20, totalPages: 3 }
// }
```

---

## 9. Asynchronous & Resilience Utilities

**File:** `src/common/utils/async.util.ts`

### `sleep(ms: number): Promise<void>`
Non-blocking delay for asynchronous workflows.
```typescript
await sleep(1000); // Sleep for 1 second
```

### `retryWithBackoff<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>`
Executes an async task with automatic retry on failure using exponential backoff.
```typescript
const result = await retryWithBackoff(
  () => fetchExternalStellarRpc(),
  { maxRetries: 3, initialDelayMs: 200, backoffFactor: 2 },
);
```

### `withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage?: string): Promise<T>`
Applies a strict timeout deadline to an async promise.
```typescript
const tx = await withTimeout(
  stellarHorizonSubmit(),
  10000,
  'Stellar transaction timed out',
);
```

---

## 10. Unit Testing

All utility functions have dedicated unit test suites under `src/common/utils/*.spec.ts`. Run the tests via Jest:

```bash
npm test -- src/common/utils
```
