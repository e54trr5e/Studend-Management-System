const crypto = require("crypto");

if (!global.crypto) {
  global.crypto = crypto.webcrypto;
}

const { TextDecoder, TextEncoder } = require('util');
global.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;
require('dns').setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
//app.use(express.static(path.join(__dirname, '..', 'Frontend')));

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("CRITICAL CONFIGURATION FAULT: MONGO_URI is completely missing from your .env file.");
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("Successfully established secure connection cluster channels with MongoDB Atlas database storage.");
  })
  .catch((error) => {
    console.error("Database connection initialization failure:", error.message);
    process.exit(1);
  });


app.get('/api/test', async (req, res) => {
    try {
        await mongoose.connection.db.admin().ping();
        res.send("Connection OK");
    } catch (err) {
        res.status(500).send("Connection FAILED: " + err.message);
    }
});

const studentRoutes = require('./routes/studentRoutes');

app.use('/api/students', studentRoutes);
let frontendPath;
if (process.pkg) {
  frontendPath = path.join(path.dirname(process.execPath), "..", "Frontend");
} else {
  frontendPath = path.join(__dirname, "..", "Frontend");
}
console.log("Frontend Path:", frontendPath);
app.use(express.static(frontendPath));
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`EduMetrics Analytical Portal Processing Engine active on port: ${PORT}`);
  console.log(`Open your browser window at: http://localhost:${PORT}`);
});