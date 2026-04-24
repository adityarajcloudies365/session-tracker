const express = require('express');
const cors    = require('cors');
const low     = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path    = require('path');

const adapter = new FileSync(path.join(__dirname, 'sessions.json'));
const db      = low(adapter);

db.defaults({ sessions: [] }).write();

const app = express();

app.use(cors({ origin: '*', methods: ['POST', 'OPTIONS'] }));
app.use(express.json());

app.post('/collect', (req, res) => {
  const {
    sessionId, userId, startedAt, endedAt,
    durationMs, activeDurMs, pageCount, pages
  } = req.body;

  if (!sessionId || !userId) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const exists = db.get('sessions').find({ sessionId }).value();
  if (!exists) {
    db.get('sessions').push({
      sessionId, userId, startedAt, endedAt,
      durationMs, activeDurMs, pageCount,
      pages: pages || [],
      createdAt: Date.now()
    }).write();
  }

  res.json({ ok: true });
});

app.get('/dashboard', (req, res) => {
  const sessions = db.get('sessions').value();

  const userMap = {};
  sessions.forEach(function(s) {
    if (!userMap[s.userId]) {
      userMap[s.userId] = {
        user_id: s.userId,
        total_sessions: 0,
        total_active_ms: 0,
        last_seen: 0
      };
    }
    var u = userMap[s.userId];
    u.total_sessions += 1;
    u.total_active_ms += (s.activeDurMs || 0);
    if ((s.endedAt || 0) > u.last_seen) u.last_seen = s.endedAt;
  });

  const result = Object.values(userMap).map(function(u) {
    return {
      user_id:          u.user_id,
      total_sessions:   u.total_sessions,
      avg_active_sec:   Math.round(u.total_active_ms / u.total_sessions / 1000),
      total_active_min: Math.round(u.total_active_ms / 60000 * 10) / 10,
      last_seen:        u.last_seen
    };
  }).sort(function(a, b) { return b.avg_active_sec - a.avg_active_sec; });

  res.json(result);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, function() {
  console.log('Session tracker running on port ' + PORT);
});