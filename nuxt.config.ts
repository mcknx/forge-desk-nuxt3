// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from "node:url";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@pinia/nuxt"],
  css: ["~/assets/css/tailwind.css"],

  // Tailwind runs through plain PostCSS rather than @nuxtjs/tailwindcss: the
  // module broke the build on this Node version and buys nothing we use.
  postcss: {
    plugins: { tailwindcss: {}, autoprefixer: {} }
  },

  runtimeConfig: {
    sessionSecret: "",
    demoPassword: "",
    databaseUrl: "",
    public: {
      appName: "Forge Desk",
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local"
    }
  },

  nitro: {
    // Exposes server/db/*.sql to useStorage('assets:db') so schema.sql has one
    // definition instead of a copy pasted into a TS string.
    //
    // Absolute, not './server/db': Nitro resolves this relative to its own
    // srcDir, which under Nuxt is <root>/server — so the relative form pointed
    // at <root>/server/server/db, silently bundled nothing, and the Postgres
    // driver failed on its first ever real connection with "schema.sql not
    // found in server assets". It fell back to the memory driver, so the app
    // still served; only /api/health revealed it.
    serverAssets: [
      { baseName: "db", dir: fileURLToPath(new URL("./server/db", import.meta.url)) }
    ]
  },

  hooks: {
    /**
     * Works around an upstream Nitro bug: the node-server preset's `readAsset()`
     * ships a raw `import.meta.url` while every other occurrence in the bundle
     * is rewritten to `_importMeta_.url`. It resolves to chunks/nitro/, but the
     * asset manifest stores paths relative to .output/server/, so every public
     * asset lands two directories too deep and 500s — no CSS, no client JS, no
     * favicon, no prerendered HTML. Reproduced on a pristine `nuxt build` with
     * 3.17.7 across nitropack 2.11.13, 2.12.4 and 2.12.9.
     *
     * Registered through `nitro:init` rather than as `nitro.hooks.compiled` in
     * the config, because the config form REPLACES the preset's own `compiled`
     * hook — and the vercel preset uses that hook to write
     * .vercel/output/config.json and .vc-config.json. Losing those produced a
     * build that looked successful and then failed at deploy with "Config file
     * was not found". Hooking the live instance appends to the chain instead.
     */
    // @ts-expect-error — 'nitro:init' is a real Nuxt hook but is missing from
    // the NuxtHooks type this version ships. When this directive starts
    // reporting itself as unused, upstream has fixed the type and it can go.
    "nitro:init"(nitro: {
      options: { output: { serverDir: string } };
      hooks: { hook: (n: string, f: () => Promise<void>) => void };
    }) {
      nitro.hooks.hook("compiled", async () => {
        const { readFile, writeFile } = await import("node:fs/promises");
        const { existsSync } = await import("node:fs");
        const { join } = await import("node:path");

        const bundle = join(nitro.options.output.serverDir, "chunks/nitro/nitro.mjs");
        if (!existsSync(bundle)) return;

        const source = await readFile(bundle, "utf8");
        const patched = source.replace(
          "const serverDir = dirname(fileURLToPath(import.meta.url));",
          "const serverDir = dirname(fileURLToPath(globalThis._importMeta_.url));"
        );
        if (patched !== source) {
          await writeFile(bundle, patched);
          console.log(
            "[forge-desk] patched Nitro readAsset() public-asset path resolution"
          );
        }
      });
    }
  },

  routeRules: {
    // Marketing page is pure content — prerender it and serve from the edge.
    "/": { prerender: true },
    "/style-guide": { prerender: true },
    // The desk is per-user data; render it per request, never cache it.
    "/dashboard": { ssr: true },
    "/clients/**": { ssr: true },
    "/tasks/**": { ssr: true },
    "/invoices/**": { ssr: true },
    "/time": { ssr: true },
    // The Flutter companion is a separate origin, so the API needs CORS.
    "/api/**": { cors: true }
  },

  app: {
    head: {
      htmlAttrs: { lang: "en" },
      link: [{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
      meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }]
    },
    pageTransition: { name: "page", mode: "out-in" }
  },

  typescript: { strict: true }
});
