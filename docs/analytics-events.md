# Analytics Event Property Schemas

All analytics events ingested through `recordAnalyticsEvents` (`src/services/analytics.service.ts`) are validated at ingestion against strict per-event-type Zod schemas defined in `src/validators/analytics.schemas.ts`.

## Supported Event Types & Property Schemas

### 1. `PAGE_VIEW`
Tracks user navigation across application routes.

| Property | Type | Required | Constraints |
| --- | --- | --- | --- |
| `path` | `string` | Yes | Must start with `/`, max 512 chars |
| `referrer` | `string` | No | Max 1024 chars |
| `durationMs` | `number` | No | Non-negative integer |
| `utmSource` | `string` | No | Non-empty string, max 120 chars |
| `utmMedium` | `string` | No | Non-empty string, max 120 chars |
| `utmCampaign` | `string` | No | Non-empty string, max 120 chars |

### 2. `ARTWORK_VIEW`
Tracks impressions on an individual artwork detail view.

| Property | Type | Required | Constraints |
| --- | --- | --- | --- |
| `artworkId` | `string` | Yes | Non-empty identifier, max 128 chars |
| `artistId` | `string` | No | Non-empty identifier, max 128 chars |
| `category` | `string` | No | Non-empty string, max 64 chars |
| `source` | `string` | No | One of `marketplace`, `search`, `profile`, `featured`, `trending`, `recommended`, `direct` |

### 3. `SAVE`
Tracks saving or unsaving an artwork.

| Property | Type | Required | Constraints |
| --- | --- | --- | --- |
| `artworkId` | `string` | Yes | Non-empty identifier, max 128 chars |
| `action` | `'save' \| 'unsave'` | No | Defaults to `'save'` |
| `collectionId` | `string` | No | Non-empty identifier, max 128 chars |

### 4. `PURCHASE_START`
Tracks checkout initiation for an artwork.

| Property | Type | Required | Constraints |
| --- | --- | --- | --- |
| `artworkId` | `string` | Yes | Non-empty identifier, max 128 chars |
| `orderId` | `string` | No | Non-empty identifier, max 128 chars |
| `amount` | `number` | Yes | Positive number (`> 0`) |
| `asset` | `'XLM' \| 'USDC' \| 'EURC'` | Yes | Supported Stellar settlement asset |

### 5. `PURCHASE_COMPLETE`
Tracks completed Stellar artwork purchases.

| Property | Type | Required | Constraints |
| --- | --- | --- | --- |
| `artworkId` | `string` | Yes | Non-empty identifier, max 128 chars |
| `orderId` | `string` | Yes | Non-empty identifier, max 128 chars |
| `amount` | `number` | Yes | Positive number (`> 0`) |
| `asset` | `'XLM' \| 'USDC' \| 'EURC'` | Yes | Supported Stellar settlement asset |
| `transactionHash` | `string` | No | Stellar transaction hash, max 128 chars |

### 6. `COMMISSION_REQUEST`
Tracks new artist commission requests.

| Property | Type | Required | Constraints |
| --- | --- | --- | --- |
| `commissionId` | `string` | Yes | Non-empty identifier, max 128 chars |
| `artistId` | `string` | Yes | Non-empty identifier, max 128 chars |
| `budget` | `number` | No | Positive number (`> 0`) |
| `asset` | `'XLM' \| 'USDC' \| 'EURC'` | No | Supported Stellar settlement asset |

## PII & Secret Protection

All event `properties` are recursively inspected before schema parsing to reject prohibited keys (`email`, `password`, `phone`, `phoneNumber`, `ssn`, `address`, `fullName`, `creditCard`, `cardNumber`, `dob`, `dateOfBirth`, `secretKey`, `privateKey`). Moreover, all schemas use `.strict()` so undeclared keys are rejected at ingestion.

## Batch Ingestion Behavior

`recordAnalyticsEvents` validates every event in a batch prior to calling `createMany`. If any event is invalid, an `AnalyticsValidationError` is thrown with structured `issues` (`eventIndex`, `eventType`, `path`, `message`) and no partial records are written.
