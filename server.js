import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 10000;

// Enable JSON and CORS
app.use(cors());
app.use(express.json());

// Path setup (for serving frontend)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static frontend files
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Endpoint for TradingView alerts
app.post("/alert", (req, res) => {
  console.log("🚨 Alert received:", req.body);
  res.status(200).json({ success: true, message: "Alert received successfully!" });
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
