const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

const app      = express();
const DB_FILE  = path.join(__dirname, 'sessions.json');

// Create empty database file if it doesn't exist
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ sessions: [] }));
}

function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.use(cors({ origin: '*', methods: ['POST', 'GET', 'OPTIONS'] }));
app.use(express.json());

// Receive session data from WordPress
app.post('/collect', (req, res) => {
  const {
    sessionId, userId, startedAt, endedAt,
    durationMs, activeDurMs, pageCount, pages
  } = req.body;

  if (!sessionId || !userId) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const db = readDB();
  const exists = db.sessions.find(s => s.sessionId === sessionId);

  if (!exists) {
    db.sessions.push({
      sessionId,
      userId,
      startedAt,
      endedAt,
      durationMs,
      activeDurMs,
      pageCount,
      pages: pages || [],
      createdAt: Date.now()
    });
    writeDB(db);
  }

  res.json({ ok: true });
});

// Dashboard — per user average session time
app.get('/dashboard', (req, res) => {
  const db = readDB();
  const userMap = {};

  db.sessions.forEach(s => {
    if (!userMap[s.userId]) {
      userMap[s.userId] = {
        user_id: s.userId,
        total_sessions: 0,
        total_active_ms: 0,
        last_seen: 0
      };
    }
    const u = userMap[s.userId];
    u.total_sessions += 1;
    u.total_active_ms += (s.activeDurMs || 0);
    if ((s.endedAt || 0) > u.last_seen) u.last_seen = s.endedAt;
  });

  const result = Object.values(userMap).map(u => ({
    user_id:          u.user_id,
    total_sessions:   u.total_sessions,
    avg_active_sec:   Math.round(u.total_active_ms / u.total_sessions / 1000),
    total_active_min: Math.round(u.total_active_ms / 60000 * 10) / 10,
    last_seen:        new Date(u.last_seen).toISOString()
  })).sort((a, b) => b.avg_active_sec - a.avg_active_sec);

  res.json(result);
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Session tracker is running' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('Session tracker running on port ' + PORT);
});