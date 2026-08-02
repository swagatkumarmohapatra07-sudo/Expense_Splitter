# DevVault &mdash; Smart Study &amp; Project Snippet Vault

A central dashboard for developers and students to **store, tag, copy, and search** reusable code snippets, study notes, and API endpoints.

Built with a classic **REST API** architecture: a vanilla JS frontend talks to a Node.js + Express backend, which persists data to a local JSON file.

## Features

- Grid view of saved code cards
- Real-time text search across titles, descriptions, code, categories, and tags
- Category filter pills (JavaScript, Node.js, CSS, HTML, SQL, Study)
- Modal form to create and edit snippets
- One-click **Copy Code to Clipboard** with fallback
- Responsive Flexbox/Grid layout, no frontend frameworks
- RESTful API with proper HTTP status codes and input validation

## Tech Stack

| Layer     | Technology                          |
| --------- | ----------------------------------- |
| Frontend  | HTML5, CSS3 (Flexbox/Grid), Vanilla JS (Fetch API, DOM) |
| Backend   | Node.js, Express.js                 |
| Data      | JSON file storage (`fs` module)     |

## Project Structure

```
DevVault/
├── public/              # Served statically by Express
│   ├── index.html       # Single-page UI layout
│   ├── style.css        # Custom styles (responsive, grid)
│   └── app.js           # Fetch API logic & DOM manipulation
├── data/
│   ├── snippets.json    # Persisted snippet data
│   └── store.js         # JSON file I/O data layer
├── server.js            # Express app setup & REST endpoints
├── package.json         # Node dependencies (express, cors, dotenv)
└── .env.example         # Environment variable template
```

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. (Optional) Configure the port:

   ```bash
   cp .env.example .env
   ```

   Defaults to `PORT=3000` if no `.env` file is present.

3. Start the server:

   ```bash
   npm start
   # or, for auto-restart during development:
   npm run dev
   ```

4. Open <http://localhost:3000> in your browser.

## REST API

| Method   | Endpoint              | Description                                |
| -------- | --------------------- | ------------------------------------------ |
| `GET`    | `/api/snippets`       | List all snippets (optional `?q=` and `?category=` filters) |
| `GET`    | `/api/snippets/:id`   | Fetch a single snippet                     |
| `POST`   | `/api/snippets`       | Create a snippet                           |
| `PUT`    | `/api/snippets/:id`   | Update a snippet                           |
| `DELETE` | `/api/snippets/:id`   | Delete a snippet                           |

### Snippet shape

```json
{
  "id": 1,
  "title": "Debounce Function",
  "category": "javascript",
  "tags": ["debounce", "performance", "input"],
  "description": "Limit how often a function fires.",
  "code": "function debounce(fn, delay = 300) { ... }",
  "createdAt": "2026-07-18T20:10:00.000Z",
  "updatedAt": "2026-07-18T20:10:00.000Z"
}
```

Allowed categories: `javascript`, `nodejs`, `css`, `html`, `sql`, `study`.

### Example

```bash
# Search for "fetch"
curl "http://localhost:3000/api/snippets?q=fetch"

# Create a snippet
curl -X POST http://localhost:3000/api/snippets \
  -H "Content-Type: application/json" \
  -d '{"title":"Hello","category":"nodejs","tags":["demo"],"code":"console.log(1)"}'
```

## Data Layer

Snippets are stored in `data/snippets.json`. The `data/store.js` module handles reading, writing, and ID assignment. If the file is missing, the server recreates it as an empty array. The file is seed data for a fresh checkout.
