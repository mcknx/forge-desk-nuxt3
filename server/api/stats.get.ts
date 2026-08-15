import { useRepo } from "../utils/repo";

export default defineEventHandler(async (event) => {
  // The dashboard is happy with numbers up to half a minute old, and letting
  // the CDN absorb the repeat hits keeps the database out of the hot path.
  setResponseHeader(
    event,
    "Cache-Control",
    "public, max-age=0, s-maxage=30, stale-while-revalidate=60"
  );
  const repo = await useRepo();
  return repo.stats();
});
