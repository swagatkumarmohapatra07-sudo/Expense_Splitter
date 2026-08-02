'use strict';

const API = '/api/snippets';

const state = {
  snippets: [],
  query: '',
  category: ''
};

const els = {
  grid: document.getElementById('grid'),
  searchInput: document.getElementById('searchInput'),
  filterBar: document.getElementById('filterBar'),
  emptyState: document.getElementById('emptyState'),
  totalCount: document.getElementById('totalCount'),
  addBtn: document.getElementById('addBtn'),
  modal: document.getElementById('modal'),
  form: document.getElementById('snippetForm'),
  modalTitle: document.getElementById('modalTitle'),
  snippetId: document.getElementById('snippetId'),
  titleInput: document.getElementById('titleInput'),
  categorySelect: document.getElementById('categorySelect'),
  tagsInput: document.getElementById('tagsInput'),
  descriptionInput: document.getElementById('descriptionInput'),
  codeInput: document.getElementById('codeInput'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  cardTemplate: document.getElementById('cardTemplate')
};

const CATEGORY_LABELS = {
  javascript: 'JavaScript',
  nodejs: 'Node.js',
  css: 'CSS',
  html: 'HTML',
  sql: 'SQL',
  study: 'Study'
};

const DEFAULT_CATEGORIES = ['javascript', 'nodejs', 'css', 'html', 'sql', 'study'];

function debounce(fn, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body.details ? body.details.join(' ') : body.error;
    throw new Error(message || `Request failed (${res.status})`);
  }
  return body;
}

async function fetchSnippets() {
  const params = new URLSearchParams();
  if (state.query) params.set('q', state.query);
  if (state.category) params.set('category', state.category);
  const qs = params.toString();
  state.snippets = await request(qs ? `${API}?${qs}` : API);
  renderGrid();
}

function renderFilterBar() {
  const categories = [...new Set([...DEFAULT_CATEGORIES, ...state.snippets.map((s) => s.category)])];
  const fragment = document.createDocumentFragment();

  const allPill = buildPill('', 'All', !state.category);
  fragment.appendChild(allPill);

  categories.forEach((cat) => {
    fragment.appendChild(buildPill(cat, CATEGORY_LABELS[cat] || cat, state.category === cat));
  });

  els.filterBar.replaceChildren(fragment);
}

function buildPill(category, label, active) {
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'filter-pill' + (active ? ' active' : '');
  pill.dataset.category = category;
  pill.textContent = label;
  return pill;
}

function renderGrid() {
  const fragment = document.createDocumentFragment();

  state.snippets.forEach((snippet) => {
    fragment.appendChild(buildCard(snippet));
  });

  els.grid.replaceChildren(fragment);
  els.emptyState.classList.toggle('hidden', state.snippets.length > 0);
  els.totalCount.textContent = `${state.snippets.length} snippet${state.snippets.length === 1 ? '' : 's'}`;
}

function buildCard(snippet) {
  const node = els.cardTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.id = snippet.id;

  const badge = node.querySelector('.category-badge');
  badge.textContent = CATEGORY_LABELS[snippet.category] || snippet.category;
  badge.classList.add(snippet.category);

  node.querySelector('.card-date').textContent = formatDate(snippet.updatedAt || snippet.createdAt);
  node.querySelector('.card-title').textContent = snippet.title;
  node.querySelector('.card-desc').textContent = snippet.description || 'No description provided.';
  node.querySelector('.code-text').textContent = snippet.code;

  const tagsBox = node.querySelector('.card-tags');
  snippet.tags.forEach((tag) => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = `#${tag}`;
    tagsBox.appendChild(span);
  });

  return node;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function openModal(snippet = null) {
  els.modalTitle.textContent = snippet ? 'Edit Snippet' : 'New Snippet';
  els.form.reset();
  els.snippetId.value = snippet ? snippet.id : '';

  if (snippet) {
    els.titleInput.value = snippet.title;
    els.categorySelect.value = snippet.category;
    els.tagsInput.value = snippet.tags.join(', ');
    els.descriptionInput.value = snippet.description;
    els.codeInput.value = snippet.code;
  }

  els.modal.showModal();
}

function closeModal() {
  els.modal.close();
}

async function handleSubmit(event) {
  event.preventDefault();

  const payload = {
    title: els.titleInput.value.trim(),
    category: els.categorySelect.value,
    tags: els.tagsInput.value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    description: els.descriptionInput.value.trim(),
    code: els.codeInput.value
  };

  const id = els.snippetId.value;
  const url = id ? `${API}/${id}` : API;
  const method = id ? 'PUT' : 'POST';

  try {
    setSaving(true);
    await request(url, { method, body: JSON.stringify(payload) });
    closeModal();
    await fetchSnippets();
    renderFilterBar();
    showToast(id ? 'Snippet updated.' : 'Snippet created.');
  } catch (err) {
    alert(err.message);
  } finally {
    setSaving(false);
  }
}

function setSaving(saving) {
  els.saveBtn.disabled = saving;
  els.saveBtn.textContent = saving ? 'Saving\u2026' : 'Save Snippet';
}

async function handleDelete(id) {
  const snippet = state.snippets.find((s) => s.id === Number(id));
  const label = snippet ? `"${snippet.title}"` : 'this snippet';
  if (!confirm(`Delete ${label}? This cannot be undone.`)) return;

  try {
    await request(`${API}/${id}`, { method: 'DELETE' });
    await fetchSnippets();
    renderFilterBar();
    showToast('Snippet deleted.');
  } catch (err) {
    alert(err.message);
  }
}

async function handleCopy(id, button) {
  const snippet = state.snippets.find((s) => s.id === Number(id));
  if (!snippet) return;

  try {
    await navigator.clipboard.writeText(snippet.code);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = snippet.code;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  button.textContent = 'Copied!';
  button.classList.add('copied');
  setTimeout(() => {
    button.textContent = 'Copy';
    button.classList.remove('copied');
  }, 1500);
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}

els.grid.addEventListener('click', (event) => {
  const card = event.target.closest('.card');
  if (!card) return;

  const id = card.dataset.id;
  const copyBtn = event.target.closest('.copy-btn');
  const editBtn = event.target.closest('.edit-btn');
  const deleteBtn = event.target.closest('.delete-btn');

  if (copyBtn) handleCopy(id, copyBtn);
  else if (editBtn) {
    const snippet = state.snippets.find((s) => s.id === Number(id));
    if (snippet) openModal(snippet);
  } else if (deleteBtn) handleDelete(id);
});

els.searchInput.addEventListener(
  'input',
  debounce((event) => {
    state.query = event.target.value.trim();
    fetchSnippets();
  }, 250)
);

els.filterBar.addEventListener('click', (event) => {
  const pill = event.target.closest('.filter-pill');
  if (!pill) return;

  state.category = pill.dataset.category;
  els.filterBar.querySelectorAll('.filter-pill').forEach((p) => p.classList.toggle('active', p === pill));
  fetchSnippets();
});

els.addBtn.addEventListener('click', () => openModal());
els.closeModalBtn.addEventListener('click', closeModal);
els.cancelBtn.addEventListener('click', closeModal);
els.form.addEventListener('submit', handleSubmit);

els.modal.addEventListener('click', (event) => {
  if (event.target === els.modal) closeModal();
});

async function init() {
  await fetchSnippets();
  renderFilterBar();
}

init();
