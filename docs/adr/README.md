# Architecture decision records

Short notes on the decisions that were not obvious, written when they were made.

Each one says what was decided, what it cost, and what would make us revisit it. A decision without a
stated cost is usually a preference wearing a decision's clothes.

| # | Decision | Status |
|---|---|---|
| [001](./001-two-storage-drivers.md) | Two storage drivers behind one interface | Accepted |
| [002](./002-stateless-sessions.md) | Stateless signed-cookie sessions | Accepted |
| [003](./003-money-in-minor-units.md) | Money in minor units, integers only | Accepted |
| [004](./004-tailwind-via-postcss.md) | Tailwind through PostCSS, not the Nuxt module | Accepted |
| [005](./005-hand-rolled-charts.md) | Hand-rolled SVG charts, no chart library | Accepted |
| [006](./006-schema-as-server-asset.md) | Schema SQL loaded as a Nitro server asset | Accepted |
| [007](./007-filters-in-the-url.md) | List filters live in the URL | Accepted |
| [008](./008-no-database-in-ci.md) | CI runs against the memory driver | Accepted |
