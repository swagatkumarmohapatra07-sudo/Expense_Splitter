const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'snippets.json');

let nextId = 1;

function readAll() {
  if (!fs.existsSync(DATA_FILE)) {
    writeAll([]);
    return [];
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const snippets = raw.trim() ? JSON.parse(raw) : [];
  nextId = snippets.reduce((max, s) => Math.max(max, s.id + 1), 1);
  return snippets;
}

function writeAll(snippets) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(snippets, null, 2), 'utf8');
  nextId = snippets.reduce((max, s) => Math.max(max, s.id + 1), 1);
}

function findById(id) {
  return readAll().find((s) => s.id === id) || null;
}

function create(snippet) {
  const snippets = readAll();
  const now = new Date().toISOString();
  const record = {
    id: nextId++,
    title: snippet.title,
    category: snippet.category,
    tags: snippet.tags || [],
    description: snippet.description || '',
    code: snippet.code,
    createdAt: now,
    updatedAt: now
  };
  snippets.push(record);
  writeAll(snippets);
  return record;
}

function update(id, patch) {
  const snippets = readAll();
  const index = snippets.findIndex((s) => s.id === id);
  if (index === -1) return null;
  const updated = {
    ...snippets[index],
    ...patch,
    id,
    updatedAt: new Date().toISOString()
  };
  snippets[index] = updated;
  writeAll(snippets);
  return updated;
}

function remove(id) {
  const snippets = readAll();
  const index = snippets.findIndex((s) => s.id === id);
  if (index === -1) return false;
  snippets.splice(index, 1);
  writeAll(snippets);
  return true;
}

module.exports = { readAll, findById, create, update, remove };
