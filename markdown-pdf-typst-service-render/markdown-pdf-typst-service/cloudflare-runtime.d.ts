/** Minimal runtime bindings used by this Site's checked-in worker and D1 helper. */
interface D1Database {
  prepare(query: string): unknown;
}

declare module "cloudflare:workers" {
  export const env: {
    DB?: D1Database;
  };
}
