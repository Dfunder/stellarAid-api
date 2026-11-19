# Module boundaries and lazy loading

`AppModule` should remain a composition root. Keep feature modules under
`src/modules/<feature>/`, expose only their public providers, and keep shared
cross-cutting concerns in `src/common/`. A feature module should not import
controllers or private providers from another feature module.

The current modules are intentionally eager because they are small. Do not add
lazy loading solely for consistency. For a genuinely heavy, optional feature,
Nest's `LazyModuleLoader` can defer construction until the feature is first
used:

```ts
const { HeavyModule } = await import('../modules/heavy/heavy.module');
const moduleRef = await lazyModuleLoader.load(() => HeavyModule);
```

The loader belongs in an application service, not in a controller. The loaded
module must still have a clear boundary and should not rely on request-scoped
state from the composition root. Measure startup time and first-use latency
before and after introducing this pattern; lazy loading trades initial startup
work for a later request cost.

Keep module imports explicit in `src/app.module.ts` until there is a measured
reason to defer one. This preserves predictable dependency initialization and
keeps the existing request behavior unchanged.