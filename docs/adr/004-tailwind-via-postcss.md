# 004 — Tailwind through PostCSS, not the Nuxt module

**Status:** Accepted · Aug 2026

## Context

`@nuxtjs/tailwindcss` is the default answer for Tailwind in Nuxt. On this project it broke the build on
Node v20.17.0.

## Decision

Configure Tailwind as a plain PostCSS plugin in `nuxt.config.ts` and import `assets/css/tailwind.css`.
That is four lines of config and no module in the dependency graph.

The module's features are auto-importing the config, a viewer at `/_tailwind`, and config merging from
other modules. This project uses none of the three.

## Cost

No `/_tailwind` viewer. `tailwind.config.ts` has to list its own `content` globs rather than inheriting
Nuxt's directory knowledge — which means adding a new source directory requires remembering to add it
there, or classes silently get purged. Noted in the config.

## Revisit when

A Nuxt module ships Tailwind config that needs merging with ours. That is the one thing the plain setup
cannot do.
