# Internship Junior Software Developer 2026 - Project Documentation

## 1. Setup Instructions

To run the project locally without Docker, follow these steps:

### Backend
1. Open a terminal and navigate to the `/server` folder.
2. Run `bun install` to install dependencies.
3. Run `bun run dev` to start the API server on port 4001.
*(Note: The SQLite database and seed data are already configured).*

### Frontend
1. Open a new terminal and navigate to the `/client` folder.
2. Run `bun install` to install dependencies.
3. Run `bun run dev` to start the frontend interface on port 3000.
4. Open `http://localhost:3000` in your web browser.

---

## 2. Design Choices

* **Real-time updates:** I chose to use **TanStack Query** with a `refetchInterval: 5000` (5-second polling). This approach provides a dynamic user experience (odds and balances update automatically) without the overhead and complexity of maintaining WebSocket connections for this scale.
* **API Architecture:** I refactored the market listing handler to return a structured `{ data, pagination }` object. This ensures better scalability and clean pagination state management on the frontend.
* **Admin Security:** Critical actions (Resolve/Archive) are protected on the frontend by checking the user's role (`user.role === 'admin'`) and on the backend via the authentication middleware.
* **Bonus Task (Bot Support):** I implemented a full **API Key** system. Users can generate unique keys from their profile, and the authentication middleware was updated to allow programmatic access via the `x-api-key` header, seamlessly supporting bots.

---

## 3. Challenges Faced

* **Data Synchronization (The `hasMore` error):** My biggest challenge was a `TypeError` on the main dashboard, where the UI tried to access pagination metadata before the server sent it properly formatted. I solved this by:
    1. Updating the backend route validation schema to parse `page` and `limit` query parameters.
    2. Refactoring the backend handler to return the correct paginated JSON structure.
    3. Implementing "Defensive Coding" on the frontend (using optional chaining and loading states).
* **Payout Distribution Logic:** Calculating the proportional distribution of the total pot to the winners required careful mathematical operations and SQL transactions to ensure user balances updated flawlessly after a market resolved.

---

## 4. Visual Demo
*The demo video and screenshots can be found in this folder (`./submission/assets`).*