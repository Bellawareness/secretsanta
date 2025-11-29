// Secret Santa backend using Express and SQLite
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// Initialize SQLite DB
const db = new sqlite3.Database('./secretsanta.db', (err) => {
  if (err) throw err;
  db.run(`CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    santa TEXT NOT NULL,
    recipient TEXT NOT NULL,
    picked INTEGER DEFAULT 0,
    UNIQUE(santa)
  )`);
});

const PARTICIPANTS = [
  'Belinda', 'Bella', 'Bonita', 'Crystal', 'Christine', 'Ken', 'Michael', 'Travis'
];

// Shuffle helper
function shuffle(array) {
  let arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// API to assign Secret Santas (admin only, resets assignments)
app.post('/api/assign', (req, res) => {
  db.run('DELETE FROM assignments', [], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    let santas = PARTICIPANTS.slice();
    let recipients = shuffle(PARTICIPANTS);
    // Ensure no one gets themselves
    for (let i = 0; i < santas.length; i++) {
      if (santas[i] === recipients[i]) {
        recipients = shuffle(PARTICIPANTS);
        i = -1;
      }
    }
    const stmt = db.prepare('INSERT INTO assignments (santa, recipient, picked) VALUES (?, ?, 0)');
    for (let i = 0; i < santas.length; i++) {
      stmt.run(santas[i], recipients[i]);
    }
    stmt.finalize();
    res.json({ success: true });
  });
});

// API to get recipient for a given santa and mark as picked
app.post('/api/reveal', (req, res) => {
  const { name } = req.body;
  if (!PARTICIPANTS.includes(name)) {
    return res.status(400).json({ error: 'Invalid name' });
  }
  db.get('SELECT recipient, picked FROM assignments WHERE santa = ?', [name], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'No assignment found. Admin must assign first.' });
    if (row.picked) return res.status(403).json({ error: 'You already picked!' });
    db.run('UPDATE assignments SET picked = 1 WHERE santa = ?', [name], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ recipient: row.recipient });
    });
  });
});

// API to get progress (how many have picked)
app.get('/api/progress', (req, res) => {
  db.get('SELECT COUNT(*) as picked FROM assignments WHERE picked = 1', (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ picked: row.picked, total: PARTICIPANTS.length });
  });
});

app.listen(PORT, () => {
  console.log(`Secret Santa backend running on http://localhost:${PORT}`);
});
