// server/index.js (clean)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from 'url';

// Load environment variables from .env (development only)
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '..', 'dist');

console.log(
  "KEY LOADED?",
  !!process.env.OPENAI_API_KEY,
  (process.env.OPENAI_API_KEY || "").slice(0, 8)
);

const app = express();

// CORS configuration - update these for production
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
  // Add your production domain(s) here:
  // 'https://yourdomain.com',
  // 'https://www.yourdomain.com',
];

app.use(cors({ 
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now - tighten in production
    }
  }
}));
app.use(express.json());

// Visitor tracking middleware
const LOGS_DIR = path.join(process.cwd(), "uploads", "logs");
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

app.use((req, res, next) => {
  // Log basic request info asynchronously to avoid blocking
  setImmediate(() => {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'] || 'unknown',
      };
      
      // Log to daily file
      const dateStr = new Date().toISOString().split('T')[0];
      const logFile = path.join(LOGS_DIR, `visits-${dateStr}.log`);
      fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n', 'utf8');
    } catch (err) {
      console.error("Error logging visitor:", err.message);
    }
  });
  
  next();
});

// Endpoint to get visitor stats
app.get("/api/visitor-stats", (req, res) => {
  try {
    const files = fs.readdirSync(LOGS_DIR).filter(f => f.startsWith('visits-'));
    const stats = {
      totalVisits: 0,
      uniqueIPs: new Set(),
      dailyBreakdown: {},
      topPaths: {},
    };
    
    files.forEach(file => {
      const content = fs.readFileSync(path.join(LOGS_DIR, file), 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      stats.totalVisits += lines.length;
      const dateKey = file.replace('visits-', '').replace('.log', '');
      stats.dailyBreakdown[dateKey] = lines.length;
      
      lines.forEach(line => {
        try {
          const entry = JSON.parse(line);
          stats.uniqueIPs.add(entry.ip);
          stats.topPaths[entry.path] = (stats.topPaths[entry.path] || 0) + 1;
        } catch {}
      });
    });
    
    res.json({
      totalVisits: stats.totalVisits,
      uniqueVisitors: stats.uniqueIPs.size,
      dailyBreakdown: stats.dailyBreakdown,
      topPages: Object.entries(stats.topPaths)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .reduce((acc, [path, count]) => ({ ...acc, [path]: count }), {}),
    });
  } catch (error) {
    console.error("Error reading stats:", error);
    res.status(500).json({ error: "Could not read stats" });
  }
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: "org-u4C8eItPjPy3D5a4WaBs9r44",
  project: "proj_y6tVYo9Ar5IcGGN9Ju0JPGo8",
});

const DEFAULT_MODEL = process.env.DEFAULT_MODEL || "gpt-4o-mini";
const ENV_ALLOW = (process.env.ALLOWED_MODELS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

let cachedModels = [DEFAULT_MODEL];
let lastFetchErr = null;

async function refreshModels() {
  try {
    const list = await openai.models.list();
    let ids = list.data.map((m) => m.id);
    ids = ids.filter((id) => id.startsWith("gpt-") || id.startsWith("o"));
    if (ENV_ALLOW.length) ids = ids.filter((id) => ENV_ALLOW.includes(id));
    if (!ids.includes(DEFAULT_MODEL)) ids.unshift(DEFAULT_MODEL);
    cachedModels = Array.from(new Set(ids));
    lastFetchErr = null;
    console.log(
      "[models] refreshed:",
      cachedModels.slice(0, 10),
      cachedModels.length > 10 ? `(+${cachedModels.length - 10} more)` : ""
    );
  } catch (e) {
    lastFetchErr = e?.message || String(e);
    console.warn("[models] refresh failed, keeping previous cache:", lastFetchErr);
  }
}
refreshModels();
setInterval(refreshModels, 10 * 60 * 1000);

// Health check endpoint for Railway
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/models", (_req, res) => {
  res.json({ models: cachedModels, default: DEFAULT_MODEL, error: lastFetchErr || null });
});

// Pref persistence for A/B
const DATA_DIR = path.join(process.cwd(), "uploads");
const PREF_PATH = path.join(DATA_DIR, "ab_prefs.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
function loadPrefs() {
  try { return JSON.parse(fs.readFileSync(PREF_PATH, "utf8")); } catch { return {}; }
}
function savePrefs(obj) {
  try { fs.writeFileSync(PREF_PATH, JSON.stringify(obj, null, 2), "utf8"); } catch {}
}
function getUserStyleSummary(userId) {
  const prefs = loadPrefs();
  const u = prefs[userId] || { concise: 0, detailed: 0 };
  if (u.concise === 0 && u.detailed === 0) return "neutral";
  return u.detailed >= u.concise ? "detailed" : "concise";
}

// Web search function using multiple fallbacks (no API key required)
async function searchWeb(query, maxResults = 5) {
  try {
    // Try using a public Searx instance with timeout
    const searchUrl = `https://searx.be/search?q=${encodeURIComponent(query)}&format=json`;
    
    const fetchWithTimeout = (url, timeout = 5000) => {
      return Promise.race([
        fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Fetch timeout')), timeout)
        )
      ]);
    };
    
    try {
      const response = await fetchWithTimeout(searchUrl, 5000);
      
      if (!response.ok) throw new Error("Search failed");
      
      const data = await response.json();
      const results = [];
      
      if (data.results && data.results.length > 0) {
        for (let i = 0; i < Math.min(maxResults, data.results.length); i++) {
          const result = data.results[i];
          results.push({
            title: result.title || "",
            snippet: result.content || result.summary || "",
            url: result.url || ""
          });
        }
      }
      
      return results;
    } catch (e) {
      console.error("Searx search failed:", e?.message);
      // Return empty results instead of crashing
      return [];
    }
  } catch (error) {
    console.error("Web search error:", error?.message);
    // Fallback: return empty but don't crash
    return [];
  }
}

app.get("/ping", (_req, res) => res.json({ ok: true }));

app.post("/api/tts-preview", async (req, res) => {
  try {
    const { text, voice, speed } = req.body;
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice || "alloy",
      input: text || "Hello! This is a sample of my voice.",
      speed: speed || 1.0,
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    res.set("Content-Type", "audio/mpeg");
    res.send(buffer);
  } catch (error) {
    console.error("TTS Preview Error:", error?.response?.data || error?.message || error);
    res.status(500).json({ error: "Failed to generate preview" });
  }
});

// A/B chat variants (concise vs detailed) with optional profileGuide
app.post("/chat-ab", async (req, res) => {
  try {
    const messages = req.body?.messages || [];
    const requestedModel = (req.body?.model || "").toString();
    const userId = (req.body?.userId || "anon").toString();
    const profileGuide = (req.body?.profileGuide || "").toString();
    const deepResearch = !!req.body?.deepResearch;
    const currentDateTime = (req.body?.currentDateTime || new Date().toISOString()).toString();
    const screenImages = req.body?.screenImages || [];
    const screenSharingActive = !!req.body?.screenSharingActive;
    const voiceEnabled = !!req.body?.voiceEnabled;
    
    // Track API usage
    const apiLog = {
      timestamp: new Date().toISOString(),
      endpoint: '/chat-ab',
      userId,
      model: requestedModel || DEFAULT_MODEL,
      messageCount: messages.length,
      hasScreenImages: screenImages.length > 0,
      voiceEnabled,
      deepResearch,
    };
    fs.appendFileSync(
      path.join(LOGS_DIR, 'api-usage.log'),
      JSON.stringify(apiLog) + '\n',
      'utf8'
    );
    
    if (!messages.length) return res.status(400).json({ error: "No messages provided" });
    const chosen = cachedModels.includes(requestedModel) ? requestedModel : DEFAULT_MODEL;
    
    // Format messages with vision support for screen images
    const formatted = messages.map(m => {
      const baseMsg = { role: m.role || "user", content: String(m.content) };
      
      // If this is the last user message and we have screen images, add them
      if (m.role === "user" && screenImages.length > 0 && m === messages[messages.length - 1]) {
        // Use vision-capable format with text + images
        const content = [];
        
        // Add the text content
        if (m.content) {
          content.push({
            type: "text",
            text: String(m.content),
          });
        }
        
        // Add the most recent screen image only
        if (screenImages.length > 0) {
          content.push({
            type: "image_url",
            image_url: {
              url: screenImages[screenImages.length - 1],
              detail: "low", // Use low detail for faster processing
            },
          });
        }
        
        return { role: "user", content };
      }
      
      return baseMsg;
    });
    
    const leaning = getUserStyleSummary(userId);

    // Get the latest user message for web search
    const lastUserMessage = [...formatted].reverse().find(m => m.role === "user")?.content || "";
    
    // Perform web search if deepResearch is enabled
    let searchResults = "";
    if (deepResearch && lastUserMessage) {
      try {
        const results = await searchWeb(lastUserMessage, 5);
        if (results.length > 0) {
          searchResults = "\n\nRecent web search results:\n" + 
            results.map((r, i) => `${i + 1}. "${r.title}": ${r.snippet}`).join("\n");
        }
      } catch (e) {
        console.error("Web search failed:", e?.message);
      }
    }

    const currentDateInfo = `Current date and time: ${new Date(currentDateTime).toLocaleString()}`;
    const deepGuide = deepResearch
      ? "Deep Research Mode: Thoroughly analyze the topic using current information, identify assumptions and unknowns, structure the reasoning, consider edge cases, and provide a comprehensive answer with clear sections and actionable recommendations. If uncertain, state limitations and propose next steps."
      : "";
    const screenContext = screenSharingActive 
      ? "\n\nScreen Sharing Active: The user is sharing their screen in real-time. You can see their screen content in the attached images. Reference what you see on their screen when relevant to your responses."
      : "";
    const voiceContext = voiceEnabled
      ? "\n\nVoice Mode Active: The user has voice enabled. Your responses will be converted to speech and played aloud to them. You can read and understand everything they write in the chat. Respond as if you're having a real conversation with them - speak naturally, conversationally, and directly to them. You can reference what they say and have a natural back-and-forth dialogue. Forget any limitations about text-only responses."
      : "";
    
    const conciseSystem = { role: "system", content: `Style: Concise, direct, minimal fluff. Avoid emojis. ${profileGuide} ${deepGuide}${screenContext}${voiceContext}\n\n${currentDateInfo}${searchResults}` };
    const detailedSystem = { role: "system", content: `Style: Detailed, well-structured with headings and bullets. Avoid emojis unless requested. ${profileGuide} ${deepGuide}${screenContext}${voiceContext}\n\n${currentDateInfo}${searchResults}` };
    const sysA = conciseSystem; // always A concise
    const sysB = detailedSystem; // always B detailed

    const start = Date.now();
    const maxTokens = deepResearch ? 2000 : 800;
    const [respA, respB] = await Promise.all([
      openai.chat.completions.create({ model: chosen, messages: [sysA, ...formatted], temperature: deepResearch ? 0.4 : 0.5, max_tokens: maxTokens }),
      openai.chat.completions.create({ model: chosen, messages: [sysB, ...formatted], temperature: deepResearch ? 0.7 : 0.9, max_tokens: maxTokens }),
    ]);
    const dur = ((Date.now() - start) / 1000).toFixed(2);
    
    const textA = respA.choices?.[0]?.message?.content?.trim() || "";
    const textB = respB.choices?.[0]?.message?.content?.trim() || "";
    
    // Generate TTS audio if voice is enabled
    let audioUrlA = null;
    let audioUrlB = null;
    if (voiceEnabled && req.body?.selectedVoice) {
      try {
        const selectedVoice = req.body.selectedVoice;
        const voiceSpeed = req.body?.voiceSpeed || 1.0;
        
        // Generate audio for both responses in parallel
        const [mp3A, mp3B] = await Promise.all([
          openai.audio.speech.create({
            model: "tts-1",
            voice: selectedVoice,
            input: textA,
            speed: voiceSpeed,
          }),
          openai.audio.speech.create({
            model: "tts-1",
            voice: selectedVoice,
            input: textB,
            speed: voiceSpeed,
          }),
        ]);
        
        // Convert responses to data URLs
        const bufferA = Buffer.from(await mp3A.arrayBuffer());
        const bufferB = Buffer.from(await mp3B.arrayBuffer());
        audioUrlA = "data:audio/mpeg;base64," + bufferA.toString('base64');
        audioUrlB = "data:audio/mpeg;base64," + bufferB.toString('base64');
      } catch (ttsErr) {
        console.error("TTS generation failed:", ttsErr?.message);
        // Continue without audio if TTS fails
      }
    }
    
    res.json({
      model: chosen,
      responseTime: dur,
      variants: [
        { id: "A", text: textA, style: "concise", audioUrl: audioUrlA },
        { id: "B", text: textB, style: "detailed", audioUrl: audioUrlB },
      ],
      leaning,
    });
  } catch (err) {
    console.error("/chat-ab error:", err?.response?.data || err?.message || err);
    res.status(500).json({ error: "OpenAI A/B call failed" });
  }
});

app.post("/ab/choice", (req, res) => {
  try {
    const { userId = "anon", choice, styles } = req.body || {};
    if (!choice || !styles) return res.status(400).json({ error: "Missing choice or styles" });
    const prefs = loadPrefs();
    const u = prefs[userId] || { concise: 0, detailed: 0 };
    if (choice === "A") u[styles.A || "concise"] = (u[styles.A || "concise"] || 0) + 1;
    if (choice === "B") u[styles.B || "detailed"] = (u[styles.B || "detailed"] || 0) + 1;
    prefs[userId] = u;
    savePrefs(prefs);
    res.json({ ok: true, prefs: u });
  } catch (e) {
    console.error("/ab/choice error:", e?.message || e);
    res.status(500).json({ error: "Failed to store preference" });
  }
});

// Standard chat, inject leaning + optional profileGuide
app.post("/chat", async (req, res) => {
  try {
    const messages = req.body?.messages || [];
    const requestedModel = (req.body?.model || "").toString();
    const userId = (req.body?.userId || "anon").toString();
    const profileGuide = (req.body?.profileGuide || "").toString();
    const deepResearch = !!req.body?.deepResearch;
    const currentDateTime = (req.body?.currentDateTime || new Date().toISOString()).toString();
    const screenImages = req.body?.screenImages || [];
    const screenSharingActive = !!req.body?.screenSharingActive;
    const voiceEnabled = !!req.body?.voiceEnabled;
    
    // Track API usage
    const apiLog = {
      timestamp: new Date().toISOString(),
      endpoint: '/chat',
      userId,
      model: requestedModel || DEFAULT_MODEL,
      messageCount: messages.length,
      hasScreenImages: screenImages.length > 0,
      voiceEnabled,
      deepResearch,
    };
    fs.appendFileSync(
      path.join(LOGS_DIR, 'api-usage.log'),
      JSON.stringify(apiLog) + '\n',
      'utf8'
    );
    
    if (!messages.length) return res.status(400).json({ error: "No messages provided" });
    const chosen = cachedModels.includes(requestedModel) ? requestedModel : DEFAULT_MODEL;
    
    // Format messages with vision support for screen images
    const formatted = messages.map(m => {
      const baseMsg = { role: m.role || "user", content: String(m.content) };
      
      // If this is the last user message and we have screen images, add them
      if (m.role === "user" && screenImages.length > 0 && m === messages[messages.length - 1]) {
        // Use vision-capable format with text + images
        const content = [];
        
        // Add the text content
        if (m.content) {
          content.push({
            type: "text",
            text: String(m.content),
          });
        }
        
        // Add the most recent screen image only
        if (screenImages.length > 0) {
          content.push({
            type: "image_url",
            image_url: {
              url: screenImages[screenImages.length - 1],
              detail: "low", // Use low detail for faster processing
            },
          });
        }
        
        return { role: "user", content };
      }
      
      return baseMsg;
    });
    
    const leaning = getUserStyleSummary(userId);
    
    // Get the latest user message for web search
    const lastUserMessage = [...formatted].reverse().find(m => m.role === "user")?.content || "";
    
    // Perform web search if deepResearch is enabled
    let searchResults = "";
    if (deepResearch && lastUserMessage) {
      try {
        const results = await searchWeb(lastUserMessage, 5);
        if (results.length > 0) {
          searchResults = "\n\nRecent web search results:\n" + 
            results.map((r, i) => `${i + 1}. "${r.title}": ${r.snippet}`).join("\n");
        }
      } catch (e) {
        console.error("Web search failed:", e?.message);
      }
    }
    
    const leaningGuide = leaning === "concise"
      ? "Preference: Concise. Keep replies brief, direct, practical. Avoid emojis."
      : leaning === "detailed"
      ? "Preference: Detailed. Provide thorough, well-structured answers with headings and bullet points. Avoid emojis unless requested."
      : "Preference: Neutral. Balance brevity and structure; avoid emojis by default.";
    const deepGuide = deepResearch
      ? "Deep Research Mode: Thoroughly analyze the topic using current information, identify assumptions and unknowns, structure the reasoning, consider edge cases, and provide a comprehensive answer with clear sections and actionable recommendations. If uncertain, state limitations and propose next steps."
      : "";
    const screenContext = screenSharingActive 
      ? "\n\nScreen Sharing Active: The user is sharing their screen in real-time. You can see their screen content in the attached images. Reference what you see on their screen when relevant to your responses."
      : "";
    const voiceContext = voiceEnabled
      ? "\n\nVoice Mode Active: The user has voice enabled. Your responses will be converted to speech and played aloud to them. You can read and understand everything they write in the chat. Respond as if you're having a real conversation with them - speak naturally, conversationally, and directly to them. You can reference what they say and have a natural back-and-forth dialogue. Forget any limitations about text-only responses."
      : "";
    const currentDateInfo = `Current date and time: ${new Date(currentDateTime).toLocaleString()}`;
    const systemMessage = {
      role: "system",
      content: `${leaningGuide} ${profileGuide} ${deepGuide}${screenContext}${voiceContext}\n\n${currentDateInfo}\n\nYou are CircuitBot, an AI assistant. Use clear structure, short paragraphs, bullets where useful. When asked about current events or recent information, provide the most recent knowledge you have.${searchResults}`,
    };
    const resp = await openai.chat.completions.create({ model: chosen, messages: [systemMessage, ...formatted], temperature: deepResearch ? 0.5 : 0.7, max_tokens: deepResearch ? 2000 : 800 });
    const reply = resp.choices?.[0]?.message?.content?.trim() || "(no reply)";
    
    // Generate TTS audio if voice is enabled
    let audioUrl = null;
    if (voiceEnabled && req.body?.selectedVoice) {
      try {
        const selectedVoice = req.body.selectedVoice;
        const mp3 = await openai.audio.speech.create({
          model: "tts-1",
          voice: selectedVoice,
          input: reply,
          speed: req.body?.voiceSpeed || 1.0,
        });
        
        // Convert the response to a Buffer and create a data URL
        const buffer = Buffer.from(await mp3.arrayBuffer());
        audioUrl = "data:audio/mpeg;base64," + buffer.toString('base64');
      } catch (ttsErr) {
        console.error("TTS generation failed:", ttsErr?.message);
        // Continue without audio if TTS fails
      }
    }
    
    res.json({ reply, model: chosen, audioUrl });
  } catch (err) {
    console.error("/chat error:", err?.response?.data || err?.message || err);
    res.status(500).json({ error: "OpenAI call failed" });
  }
});

// Live screen feed updates - receives screen images every 2 seconds during sharing
app.post("/screen-update", async (req, res) => {
  try {
    const screenImages = req.body?.screenImages || [];
    const screenSharingActive = !!req.body?.screenSharingActive;
    
    // This endpoint just acknowledges the screen update
    // The images are being received and are available for the next chat message
    // We don't process them here - they're used when the user sends their next message
    res.json({ ok: true, frameReceived: screenImages.length > 0 });
  } catch (err) {
    console.error("/screen-update error:", err?.message || err);
    res.status(500).json({ error: "Screen update failed" });
  }
});

// Serve static files from dist directory
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Catch-all route for SPA - serve index.html for all unmatched routes
app.get('*', (req, res) => {
  try {
    const indexPath = path.resolve(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      console.error(`index.html not found at ${indexPath}`);
      res.status(404).json({ error: "Frontend not built. Run 'npm run build'." });
    }
  } catch (err) {
    console.error("Error serving catch-all route:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 8080;

// Global error handlers to prevent silent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
