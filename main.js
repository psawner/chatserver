/*import express from "express";
import cors from "cors";
import dotenv from "dotenv";  // ✅ Import dotenv
import { GoogleGenAI } from "@google/genai";

dotenv.config();  // ✅ Load .env variables

const app = express();
app.get('/', (req, res) => {
  res.send('✅ Backend is up and running on Render!');
});

app.use(express.json());
app.use(cors()); // Allow frontend access


const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: question,
    });
    res.json({ answer: response.text });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Something went wrong!" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
*/

// ✅ Import modules
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

// ✅ Load environment variables
dotenv.config();

// ✅ Setup path helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ✅ Create Express app
const app = express();
const PORT = process.env.PORT || 5000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// ✅ Middleware
app.use(express.json());
app.use(cors());

// ✅ Connect to MySQL
let db;
try {
  db = await mysql.createConnection({ 
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  
  console.log("✅ Connected to MySQL");
} catch (error) {
  console.error("❌ Failed to connect to MySQL:", error.message);
  process.exit(1); // Exit the app if DB fails
}

// ✅ Setup AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ✅ Admin authentication middleware
function authenticateAdmin(req, res, next) {
  const token = req.headers.authorization;
  if (token === `Bearer ${ADMIN_TOKEN}`) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized access" });
  }
}

// ✅ Health check route
app.get("/", (req, res) => {
  res.send("✅ Backend is up and running on Render!");
});

// ✅ AI Chat Endpoint
app.post("/ask", async (req, res) => {
  const { question } = req.body;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: question,
    });

    const botReply = response.text;

    // ✅ Save to MySQL
    await db.execute(
      "INSERT INTO chat_logs (user_message, bot_reply) VALUES (?, ?)",
      [question, botReply]
    );

    res.json({ answer: botReply });
  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({ error: "Something went wrong!" });
  }
});

// ✅ Admin: Get Logs
app.get("/admin/logs", authenticateAdmin, async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT user_message, bot_reply, created_at FROM chat_logs ORDER BY created_at DESC LIMIT 100"
    );

    const formattedLogs = rows.map(log => {
      return `[${log.created_at.toISOString()}] User: ${log.user_message}\n[${log.created_at.toISOString()}] Bot: ${log.bot_reply}`;
    });

    res.json({ logs: formattedLogs });
  } catch (err) {
    console.error("DB Fetch Error:", err);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

// ✅ Admin Login
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;

  const validUsername = process.env.ADMIN_USERNAME;
  const validPassword = process.env.ADMIN_PASSWORD;

  if (username === validUsername && password === validPassword) {
    return res.json({ token: process.env.ADMIN_TOKEN });
  }

  res.status(401).json({ error: "Invalid credentials" });
});

// ✅ Serve admin dashboard HTML
app.use("/dashboard", express.static(path.join(__dirname, "../dashboard")));

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "../dashboard/admin.html"));
});

// ✅ Start the server
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
