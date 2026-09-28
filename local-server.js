const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'local-data.json');
const FRONTEND_DIR = path.join(__dirname, 'frontend');

// Security settings
const MAX_NAME = 50;
const MAX_MESSAGE = 500;
const MAX_ENTRIES = 50;

const NAME_PATTERN = /^[a-zA-Z\s\-\'\.]+$/;
const MESSAGE_PATTERN = /^[\w\s\.\,\!\?\-\@\:]+$/;

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.static(FRONTEND_DIR));

// Add some security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Simple input sanitization
function sanitizeInput(input) {
  let sanitized = input.replace(/<script.*?>.*?<\/script>/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  return sanitized.trim();
}

// Validate name input
function validateName(name) {
  if (!name || !name.trim()) {
    return { isValid: false, error: 'Name is required' };
  }
  
  name = name.trim();
  
  if (name.length > MAX_NAME) {
    return { isValid: false, error: `Name must be ${MAX_NAME} characters or less` };
  }
  
  if (!NAME_PATTERN.test(name)) {
    return { isValid: false, error: 'Name contains invalid characters' };
  }
  
  return { isValid: true, error: null };
}

// Validate message input
function validateMessage(message) {
  if (!message || !message.trim()) {
    return { isValid: false, error: 'Message is required' };
  }
  
  message = message.trim();
  
  if (message.length > MAX_MESSAGE) {
    return { isValid: false, error: `Message must be ${MAX_MESSAGE} characters or less` };
  }
  
  if (!MESSAGE_PATTERN.test(message)) {
    return { isValid: false, error: 'Message contains invalid characters' };
  }
  
  return { isValid: true, error: null };
}

// Create data file if it doesn't exist
async function initDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    const initialData = { 
      entries: [],
      metadata: {
        created: new Date().toISOString(),
        environment: 'dev'
      }
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
    console.log('Created new data file:', DATA_FILE);
  }
}

// Read entries from file
async function readEntries() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data file:', error);
    throw new Error('Failed to read entries');
  }
}

// Write entries to file
async function writeEntries(data) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing data file:', error);
    throw new Error('Failed to save entries');
  }
}

// GET /entries - fetch all entries
app.get('/entries', async (req, res) => {
  try {
    const data = await readEntries();
    let entries = data.entries || [];
    
    // Sort newest first and limit results
    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    entries = entries.slice(0, MAX_ENTRIES);
    
    console.log(`Retrieved ${entries.length} entries`);
    res.json({ entries });
  } catch (error) {
    console.error('Error retrieving entries:', error);
    res.status(500).json({ error: 'Failed to load entries' });
  }
});

// POST /submit - add new entry
app.post('/submit', async (req, res) => {
  try {
    const { name, message } = req.body;

    // Validate inputs
    const nameValidation = validateName(name);
    if (!nameValidation.isValid) {
      console.warn(`Name validation failed: ${nameValidation.error}`);
      return res.status(400).json({ error: nameValidation.error });
    }

    const messageValidation = validateMessage(message);
    if (!messageValidation.isValid) {
      console.warn(`Message validation failed: ${messageValidation.error}`);
      return res.status(400).json({ error: messageValidation.error });
    }

    // Sanitize and save
    const sanitizedName = sanitizeInput(name);
    const sanitizedMessage = sanitizeInput(message);

    const data = await readEntries();

    const newEntry = {
      entryId: Date.now().toString(),
      name: sanitizedName,
      message: sanitizedMessage,
      timestamp: new Date().toISOString(),
      environment: 'dev'
    };

    data.entries.unshift(newEntry);
    await writeEntries(data);

    console.log(`Entry saved: ${newEntry.entryId} by ${sanitizedName}`);
    
    res.json({ 
      success: true,
      entry: {
        entryId: newEntry.entryId,
        name: sanitizedName,
        timestamp: newEntry.timestamp
      }
    });
  } catch (error) {
    console.error('Error saving entry:', error);
    res.status(500).json({ error: 'Failed to save entry' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    environment: 'dev',
    timestamp: new Date().toISOString()
  });
});

// Start the server
async function startServer() {
  try {
    await initDataFile();

    app.listen(PORT, () => {
      console.log('\n🚀 Local server running successfully!');
      console.log(`📍 Server URL: http://localhost:${PORT}`);
      console.log(`📁 Frontend directory: ${FRONTEND_DIR}`);
      console.log(`💾 Data file: ${DATA_FILE}`);
      console.log(`🔒 Security: Input validation and sanitization enabled`);
      console.log(`\n📝 Open http://localhost:${PORT} in your browser\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
