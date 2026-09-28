// Change this to YOUR_API_URL_HERE when deploying to AWS
const API_BASE = "http://localhost:3000";

// Grab our DOM elements
const form = document.getElementById('guestbookForm');
const statusEl = document.getElementById('status');
const entriesEl = document.getElementById('entries');
const submitBtn = document.getElementById('submitBtn');
const messageEl = document.getElementById('message');
const counterEl = document.getElementById('counter');
const nameEl = document.getElementById('name');

// Character counter for the message field
messageEl.addEventListener('input', () => {
  counterEl.textContent = `${messageEl.value.length}/500`;
});

// Update the status message with styling
function setStatus(text, className) {
  statusEl.textContent = text;
  statusEl.className = className || '';
}

// Build a single entry element
function createEntryElement(entry) {
  const entryDiv = document.createElement('div');
  entryDiv.className = 'entry';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'who';
  nameSpan.textContent = entry.name;

  const timeSpan = document.createElement('span');
  timeSpan.className = 'when';
  timeSpan.textContent = new Date(entry.timestamp).toLocaleString();

  const messageP = document.createElement('p');
  messageP.className = 'msg';
  messageP.textContent = entry.message;

  entryDiv.append(nameSpan, timeSpan, messageP);
  return entryDiv;
}

// Show all entries or empty state
function displayEntries(entries) {
  entriesEl.replaceChildren();

  if (!entries || entries.length === 0) {
    entriesEl.innerHTML = '<p class="empty">No entries yet — be the first to sign!</p>';
    return;
  }

  entries.forEach(entry => {
    entriesEl.appendChild(createEntryElement(entry));
  });
}

// Fetch entries from the API
async function loadEntries() {
  try {
    const response = await fetch(`${API_BASE}/entries`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    displayEntries(data.entries || []);
  } catch (error) {
    console.error('Error loading entries:', error);
    entriesEl.innerHTML = '<p class="empty err">Could not load entries.</p>';
  }
}

// Submit a new entry
async function submitEntry(name, message) {
  const response = await fetch(`${API_BASE}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name, message })
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Submission failed');
  }

  return data;
}

// Handle form submission
async function handleFormSubmit(event) {
  event.preventDefault();
  
  submitBtn.disabled = true;
  setStatus('Submitting…');

  try {
    const name = nameEl.value.trim();
    const message = messageEl.value.trim();

    await submitEntry(name, message);

    setStatus('Thanks! Your message was saved.', 'ok');
    form.reset();
    counterEl.textContent = '0/500';
    await loadEntries();
  } catch (error) {
    console.error('Error submitting entry:', error);
    setStatus(error.message || 'Network error — check the browser console.', 'err');
  } finally {
    submitBtn.disabled = false;
  }
}

// Set up event listeners and load initial data
form.addEventListener('submit', handleFormSubmit);
document.addEventListener('DOMContentLoaded', loadEntries);
