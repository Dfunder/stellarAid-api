# SQL Injection Prevention

## Summary

All database access in this API goes through **Prisma Client**, which sends
queries as parameterized statements. User-supplied values are always passed as
bound parameters rather than being concatenated into SQL strings, so classic
SQL injection is not possible through the normal query builder.

## Practices to follow

- **Use the Prisma query builder** (`prisma.model.findUnique`, `findMany`,
  `create`, `update`, etc.). Values passed in `where`/`data` are parameterized.
- **Avoid `$queryRawUnsafe` / `$executeRawUnsafe`.** If a raw query is truly
  required, use the tagged-template `$queryRaw` / `$executeRaw` form, which
  parameterizes interpolated values:

  ```ts
  // Safe – values are bound parameters
  await prisma.$queryRaw`SELECT * FROM "User" WHERE email = ${email}`;

  // Unsafe – do NOT build SQL by string concatenation
  // await prisma.$queryRawUnsafe(`SELECT * FROM "User" WHERE email = '${email}'`);
  ```

- **Validate and constrain input** at the edge with `class-validator` DTOs so
  only well-formed values reach the data layer.

## Verification

- No `$queryRawUnsafe` / `$executeRawUnsafe` usages exist in `src/`.
- Integration tests that submit injection-style payloads (e.g.
  `' OR '1'='1`) should confirm they are treated as literal values and never
  alter query semantics.
