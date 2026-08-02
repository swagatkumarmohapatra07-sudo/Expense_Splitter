require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const store = require('./data/store');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const CATEGORIES = ['javascript', 'nodejs', 'css', 'html', 'sql', 'study'];

function validateSnippet(body, partial = false) {
  const errors = [];
  const required = partial ? ['title', 'category', 'code'] : ['title', 'category', 'code'];
  for (const field of required) {
    if (body[field] === undefined || String(body[field]).trim() === '') {
      errors.push(`Field '${field}' is required.`);
    }
  }
  if (body.category && !CATEGORIES.includes(body.category)) {
    errors.push(
      `Category must be one of: ${CATEGORIES.join(', ')}.`
    );
  }
  return errors;
}

function normalize(body) {
  return {
    title: typeof body.title === 'string' ? body.title.trim() : undefined,
    category: typeof body.category === 'string' ? body.category.trim().toLowerCase() : undefined,
    tags: Array.isArray(body.tags)
      ? body.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
      : [],
    description: typeof body.description === 'string' ? body.description.trim() : '',
    code: typeof body.code === 'string' ? body.code : undefined
  };
}

app.get('/api/snippets', (req, res) => {
  const { q = '', category = '' } = req.query;
  const needle = q.trim().toLowerCase();

  let snippets = store.readAll();

  if (needle) {
    snippets = snippets.filter((s) => {
      const haystack = [
        s.title,
        s.description,
        s.code,
        s.category,
        ...s.tags
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }

  if (category) {
    snippets = snippets.filter((s) => s.category === category);
  }

  res.status(200).json(snippets);
});

app.get('/api/snippets/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid snippet id.' });
  }
  const snippet = store.findById(id);
  if (!snippet) {
    return res.status(404).json({ error: `Snippet ${id} not found.` });
  }
  res.status(200).json(snippet);
});

app.post('/api/snippets', (req, res) => {
  const errors = validateSnippet(req.body);
  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed.', details: errors });
  }
  const snippet = store.create(normalize(req.body));
  res.status(201).json(snippet);
});

app.put('/api/snippets/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid snippet id.' });
  }
  const existing = store.findById(id);
  if (!existing) {
    return res.status(404).json({ error: `Snippet ${id} not found.` });
  }
  const errors = validateSnippet(req.body, true);
  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed.', details: errors });
  }
  const snippet = store.update(id, normalize(req.body));
  res.status(200).json(snippet);
});

app.delete('/api/snippets/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid snippet id.' });
  }
  if (!store.remove(id)) {
    return res.status(404).json({ error: `Snippet ${id} not found.` });
  }
  res.status(204).end();
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`DevVault running at http://localhost:${PORT}`);
});
