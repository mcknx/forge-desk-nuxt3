# 007 — List filters live in the URL

**Status:** Accepted · Aug 2026

## Context

Search text, status filter, sort key, direction and page number all have to live somewhere. Component
state is the default and it quietly breaks three things: the back button does nothing useful, a filtered
view cannot be shared or bookmarked, and the server cannot render the filtered list because it does not
know what the filter is.

## Decision

`useListQuery()` mirrors filter state into the query string. The URL is the state; the component reads it.

Consequences that follow for free:

- `useFetch` can run on the server, because the filters arrive in the request.
- A filtered list is a link someone can paste into a chat.
- Back and forward behave the way the browser promises.

Two details that are easy to get wrong:

- Writes use `router.replace`, not `push`. Typing eight characters into a search box should not put eight
  entries in the history stack.
- The text filter is debounced 300ms before it touches the URL, so a keystroke is not a navigation.

## Cost

Filter state is stringly typed and has to be parsed and validated on the way in — which is why the same
zod query schemas guard both the API and the page.

## Revisit when

A filter becomes too large to sit in a URL — a multi-select of hundreds of ids, say. Then it belongs in a
saved-view record with the id in the URL, which keeps the shareability without the length.
