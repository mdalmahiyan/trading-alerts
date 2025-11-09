// server.js (ES modules - works with "type": "module" in package.json)
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL || 15) * 1000; // seconds -> ms
const FINNHUB_KEY = process.env.MARKET_API_KEY;

app.use(cors());
app.use(express.json());

// static frontend (serve frontend/index.html)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.join(process.cwd(), "frontend"); // uses repo root/frontend
app.use(express.static(frontendDir));

// Simple root page: serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

/* In-memory alerts store:
   { id, symbol, condition: 'above'|'below', price: number, createdAt }
*/
const alerts = [];

// SSE clients
const sseClients = new Set();
function sendSSE(data, event = "message") {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  for (const res of sseClients) {
    if (event && event !== "message") res.write(`event: ${event}\n`);
    res.write(`data: ${payload}\n\n`);
  }
}

// SSE endpoint for live updates
app.get("/sse", (req, res) => {
  res.writeHead(200, {
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
    "Content-Type": "text/event-stream",
  });
  res.write("\n");
  sseClients.add(res);

  // send current active alerts once
  res.write(`event: init\n`);
  res.write(`data: ${JSON.stringify({ alerts })}\n\n`);

  req.on("close", () => {
    sseClients.delete(res);
  });
});

// CRUD API for alerts
app.get("/api/alerts", (req, res) => res.json(alerts.slice().reverse()));

app.post("/api/alerts", (req, res) => {
  const { symbol, condition, price } = req.body;
  if (!symbol || !condition || price === undefined) {
    return res.status(400).json({ error: "symbol, condition, price required" });
  }
  const id = crypto.randomUUID();
  const a = { id, symbol: String(symbol).toUpperCase(), condition, price: Number(price), createdAt: Date.now() };
  alerts.push(a);
  // broadcast new alert
  sendSSE({ type: "new-alert", alert: a }, "new-alert");
  return res.json(a);
});

app.delete("/api/alerts/:id", (req, res) => {
  const id = req.params.id;
  const idx = alerts.findIndex((x) => x.id === id);
  if (idx === -1) return res.sendStatus(404);
  const removed = alerts.splice(idx, 1)[0];
  sendSSE({ type: "removed-alert", id }, "removed-alert");
  return res.sendStatus(204);
});

// Helper: fetch price for a given symbol using Finnhub or fallback to Yahoo
async function fetchPrice(symbol) {
  try {
    // If user provided MARKET_PROVIDER or specific exchange, attempt the Finnhub quote:
    if (FINNHUB_KEY) {
      // Remove any exchange prefix like "NASDAQ:" -> keep symbol after colon for Finnhub
      const sym = symbol.includes(":") ? symbol.split(":")[1] : symbol;
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${FINNHUB_KEY}`;
      const r = await fetch(url);
      if (r.ok) {
        const j = await r.json();
        if (j && j.c !== undefined && j.c !== 0) return Number(j.c);
      }
    }
    // Fallback to Yahoo unofficial endpoint for a best-effort price
    const encoded = encodeURIComponent(symbol.replace(":", "/"));
    const r2 = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encoded}`);
    if (r2.ok) {
      const j2 = await r2.json();
      const res = j2?.quoteResponse?.result?.[0]?.regularMarketPrice;
      if (res !== undefined) return Number(res);
    }
  } catch (err) {
    console.error("price fetch error for", symbol, err?.message || err);
  }
  throw new Error("Could not fetch price for " + symbol);
}

// Polling loop: group alerts by symbol, fetch price once per symbol
async function pollPrices() {
  if (alerts.length === 0) return;
  const bySymbol = {};
  for (const a of alerts) {
    bySymbol[a.symbol] = bySymbol[a.symbol] || [];
    bySymbol[a.symbol].push(a);
  }
  for (const symbol of Object.keys(bySymbol)) {
    try {
      const price = await fetchPrice(symbol);
      // send price update to clients
      sendSSE({ type: "price", symbol, price, ts: Date.now() }, "price");
      // check each alert for trigger
      const list = bySymbol[symbol].slice();
      for (const a of list) {
        let triggered = false;
        if (a.condition === "above" && price >= a.price) triggered = true;
        if (a.condition === "below" && price <= a.price) triggered = true;
        if (triggered) {
          // send trigger
          sendSSE({ type: "trigger", alert: a, price, ts: Date.now() }, "trigger");
          // remove alert
          const idx = alerts.findIndex((x) => x.id === a.id);
          if (idx >= 0) alerts.splice(idx, 1);
        }
      }
    } catch (err) {
      console.error("Polling error for", symbol, err?.message || err);
      sendSSE({ type: "error", symbol, message: err.message }, "error");
    }
  }
}

// start polling interval
setInterval(pollPrices, POLL_INTERVAL);

// small health check
app.get("/health", (req, res) => res.json({ ok: true, alerts: alerts.length }));

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log("=> SSE available at /sse");
});
