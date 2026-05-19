// Custom Next.js server with WebSocket support for SSH terminal.
// Run via package.json scripts which pass --experimental-strip-types so
// Node 22.6+ can import the .ts bridge directly. NODE_ENV defaults to
// "development" when not set externally.
import { createServer } from "http";
import { parse } from "url";

import next from "next";
import { WebSocketServer } from "ws";

import { validateSessionFromCookies, attachSshSession } from "./src/lib/server/ssh-bridge.ts";

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development";
}

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "localhost";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const wss = new WebSocketServer({ noServer: true });

const httpServer = createServer((req, res) => {
  const parsedUrl = parse(req.url ?? "/", true);
  handle(req, res, parsedUrl);
});

httpServer.on("upgrade", async (req, socket, head) => {
  const url = req.url ?? "";

  if (!url.startsWith("/api/ssh/ws")) {
    socket.destroy();
    return;
  }

  const session = await validateSessionFromCookies(req.headers.cookie).catch(() => null);

  if (!session) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    attachSshSession(ws, session.user.id, session.supabase);
  });
});

httpServer.listen(port, hostname, () => {
  console.log(`> Ready on http://${hostname}:${port} [${process.env.NODE_ENV}]`);
});
