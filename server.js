const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();

// Default port
let port = 3023;

// Parse command-line arguments
process.argv.forEach((arg, index) => {
  if (arg === '-port' && process.argv[index + 1]) {
    const portArg = parseInt(process.argv[index + 1], 10);
    if (!isNaN(portArg)) {
      port = portArg;
    } else {
      console.error('Invalid port number, using default port 3023.');
    }
  }
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// SQLite setup
const db = new sqlite3.Database('chat.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database.');
    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nick TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Function to broadcast message to all connected WebSocket clients
function broadcastMessage(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Endpoint to handle message submissions
app.post('/send-message', (req, res) => {
  const { nick, message } = req.body;

  db.run(`INSERT INTO messages (nick, message) VALUES (?, ?)`, [nick, message], function (err) {
    if (err) {
      console.error('Error saving message:', err);
      return res.status(500).send('Error saving message');
    }

    // Log message for the server console
    const logMessage = `${new Date().toLocaleString()} | ${nick}: ${message}`;
    console.log('[msg]', logMessage);

    // Message to broadcast to WebSocket clients
    const clientMessage = `<tr><td class='👤'>${nick}</td><td class='✉️'>${message}</td><td class='📅'>${new Date().toLocaleString()}</td></tr>\n`;
    broadcastMessage(clientMessage); // Send formatted message to WebSocket clients

    res.send('Message received');
  });
});



// Endpoint to fetch all previous messages
app.get('/messages', (req, res) => {
  db.all(`SELECT nick, message, timestamp FROM messages ORDER BY timestamp ASC`, (err, rows) => {
    if (err) {
      console.error('Error reading messages:', err);
      return res.status(500).send('Error reading messages');
    }

    // Construct HTML rows for each message
    const messages = rows.map(
      row => `<tr><td class='👤'>${row.nick}</td><td class='✉️'>${row.message}</td><td class='📅'>${new Date(row.timestamp).toLocaleString()}</td></tr>`
    ).join('\n');

    res.send(messages);
  });
});

// Start the server
server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
