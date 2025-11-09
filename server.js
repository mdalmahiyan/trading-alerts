// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Root route (homepage)
app.get("/", (req, res) => {
  res.send("✅ Trading Alerts Server is Running!");
});

// Example endpoint for alerts
app.post("/alert", (req, res) => {
  console.log("Received alert:", req.body);
  res.json({ success: true, message: "Alert received" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
