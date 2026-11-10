# Cache Invalidation Strategies

`src/services/cache.service.ts` provides three Redis cache invalidation primitives designed for safe production use without blocking the Redis event loop.

## Key Naming Convention

Cached entries are stored under colon-delimited namespaces:

```text
<namespace>:<entity-or-query>:<identifier>
```

Examples:
- `marketplace:browse:{"category":"DIGITAL"}`
- `marketplace:artwork:42`
- `search:artwork:42:related`
- `artist:profile:99`

## Invalidation Strategies

### 1. Exact Key Invalidation (`invalidateKeys`)

Use `invalidateKeys(...keys)` when the exact cache key(s) affected by a write are known ahead of time.

```ts
await invalidateKeys('artist:profile:99', 'marketplace:artwork:42');
```

- **Complexity**: $O(K)$ where $K$ is the number of explicitly listed keys.
- **When to use**: Single-record updates with deterministic cache keys.

### 2. Single-Namespace Invalidation (`invalidateNamespace`)

Use `invalidateNamespace(namespace)` when a mutation invalidates all cached views within one domain namespace.

```ts
await invalidateNamespace('marketplace');
```

- **Implementation**: Iterates keys matching `<namespace>:*` using cursor-based `SCAN` (`COUNT 500`) and deletes matched keys in batches of `500` (`INVALIDATE_BATCH_SIZE`).
- **Why `SCAN` instead of `KEYS`**: `KEYS` scans the entire keyspace synchronously on Redis's single main thread and can stall all concurrent traffic in production. `SCAN` yields between cursor pages.

### 3. Cross-Namespace Pattern Invalidation (`invalidatePattern`)

Use `invalidatePattern(pattern, namespaces?)` when a single domain entity appears in cached keys across multiple namespaces.

```ts
// Invalidate artwork 42 across all namespaces (matches *:artwork:42* and artwork:42*)
await invalidatePattern('artwork:42*');

// Invalidate artwork 42 only in marketplace and search namespaces
await invalidatePattern('artwork:42*', ['marketplace', 'search']);
```

- **All-namespace mode** (`namespaces` omitted): Scans `*:<pattern>` (and `<pattern>` if not already wildcard-prefixed) with deduplication across cursor batches.
- **Scoped multi-namespace mode** (`namespaces` provided): Expands `<namespace>:<pattern>` for each target namespace and iterates each with cursor-based `SCAN` and batched `DEL`.
