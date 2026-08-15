<template>
  <!-- No chrome: an invoice printed with a nav bar on it looks amateur. Paper is
       always white, so this layout deliberately opts out of the dark palette —
       and because it mounts no AppHeader, nothing here calls useTheme(), so
       `html.dark` is never bootstrapped on these routes. Pages using this layout
       must not carry `dark:` variants: they could only ever misfire. -->
  <div class="min-h-screen bg-white text-slate-900">
    <main id="main" class="mx-auto w-full max-w-3xl px-6 py-10 print:max-w-none print:px-0 print:py-0">
      <slot />
    </main>
  </div>
</template>

<style>
@page {
  margin: 16mm;
}
</style>
