import PocketBase from "pocketbase";

/**
 * Singleton PocketBase client instance.
 *
 * In production behind Caddy, the API is available on the same origin (relative paths).
 * In development, VITE_PB_URL can point to the local PocketBase port or defaults to window.location.origin.
 */
const pbUrl =
  import.meta.env.VITE_PB_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:8090");

export const pb = new PocketBase(pbUrl);

export default pb;
