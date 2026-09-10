import http from "node:http";
import { runDailyFlow } from "./pipeline/index.js";

const port = Number(process.env.PORT || 10000);
let running = false;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/run" && req.method === "POST") {
    if (running) {
      res.writeHead(409, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "job already running" }));
      return;
    }
    running = true;
    try {
      const report = await runDailyFlow();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, report }));
    } catch (err) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    } finally {
      running = false;
    }
    return;
  }
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "808dystopia-core", running }));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`808dystopia-core listening on ${port}`);
});
