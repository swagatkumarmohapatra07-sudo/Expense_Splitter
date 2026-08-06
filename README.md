# SplitMate — Roommate & Friend Expense Splitter

> Split bills, stay friends. Track who paid, split every bill, and settle up in seconds — no more "who owes who" arguments.

[Live Demo](https://expense-splitter-murex-beta.vercel.app) · [Report an Issue](https://github.com/anomalyco/opencode/issues)

## Try it live

[**expense-splitter-murex-beta.vercel.app**](https://expense-splitter-murex-beta.vercel.app)

Create your own group in seconds (you become the admin), add roommates, and start splitting.

## Features

- **Equal expense splitting** — log an expense, pick who paid, and split it evenly with any selection of members
- **Live net balances** — every member's "gets back / owes" at a glance
- **Smart settlement suggestions** — the app works out the minimum set of transfers so everyone can settle up
- **Settlement tracking** — mark payments as done, restore them, or delete them, with a running "Settled" total
- **Transaction history** — searchable status per expense (Successful / Pending), with dates and split details
- **Private member logins** — the admin creates a group and adds friends; each member gets their own generated username & password
- **Admin controls** — only the admin can add/remove members, change passwords, or reset all data
- **Rupee-first** — amounts are formatted in ₹ (Indian Rupee) with the en-IN locale
- **100% local & private** — all data lives in your browser via `localStorage`; no server, no accounts, no tracking

## How it works

1. **Create a group** on the login page — you become the **admin**.
2. **Add friends** from the *Friends* page. Each friend is issued their own private login credential to share with them.
3. **Log expenses** on the *Home* page: description, amount, date, who paid, and who shares the cost.
4. **Track balances** on the *Balances* page — see net balances, who owes whom, and mark settlements as paid.
5. **Review history** on the *History* page for the full list of expenses and their settle status.

## Project structure

```
.
├── index.html      # Home dashboard — log expenses, recent activity, quick settlements
├── friends.html    # Manage members and their login credentials
├── balances.html   # Net balances + settlement suggestions
├── history.html    # Full transaction history
├── login.html      # Sign in / create group
├── app.js          # Core logic — data model, balances, settlements, rendering
├── login.js        # Auth (local-only credentials & session)
└── style.css       # Styling
```

## Getting started

No build step, no dependencies, no install. The app is plain HTML, CSS, and JavaScript.

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/expense-splitter.git
   cd expense-splitter
   ```
2. Open `login.html` in a browser (or serve the folder):
   ```bash
   python -m http.server 8000
   # then visit http://localhost:8000/login.html
   ```
3. Create a group and start splitting.

## Data & privacy

Everything is stored **locally in your browser** using `localStorage`. Passwords never leave the device — there is no backend or database. Clearing your browser data removes the group, so export anything you need to keep before doing so.

## Tech stack

- Vanilla HTML5, CSS, and JavaScript (ES6+) — no frameworks, no build tools
- `localStorage` for persistence
- `crypto.randomUUID()` for IDs and `crypto.getRandomValues()` for credential generation

## Roadmap ideas

- Split amounts unevenly (custom per-member shares)
- Categories, comments, and receipts
- Currency selector
- Export/import data (JSON or CSV)
- Recurring bills

## License

This project is open source. Feel free to fork, use, and adapt it.
