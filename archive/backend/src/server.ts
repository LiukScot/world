import app from "./app.ts";
import { env } from "./env.ts";

const server = Bun.serve({
  hostname: env.HOST,
  port: env.PORT,
  fetch: app.fetch
});

console.log(`World backend listening on http://${env.HOST}:${server.port}`);
