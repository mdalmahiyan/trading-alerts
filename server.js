// server.js (replace entire file with this)
import express from "express";
import cors from "cors";
import path from "path";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// Serve static frontend from the frontend folder at repo root
// Use process.cwd() to avoid dirname confusion in Render
const frontendDir = path.join(process.cwd(), "frontend");
app.use(express.static(frontendDir));

// Root -> send index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

// Alert endpoint for TradingView / test button
app.post("/alert", (req, res) => {
  console.log("🚨 Alert received:", req.body);
  // TODO: add notification sending here (email/telegram/discord)
  res.status(200).json({ success: true, message: "Alert received successfully!" });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log("=> Your service is live at", process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`);
});
