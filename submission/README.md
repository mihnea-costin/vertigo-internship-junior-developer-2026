# Submission

## Short Description

**Overview & Setup**
This is the completed assignment for the Junior Software Developer Internship 2026. 
To run the project locally without Docker:
* **Backend:** Navigate to the `/server` folder, run `bun install`, then `bun run dev` (starts on port 4001 with pre-configured SQLite seed data).
* **Frontend:** Navigate to the `/client` folder, run `bun install`, then `bun run dev` (starts on port 3000).

**Design Choices**
* **Real-time updates:** I chose to use **TanStack Query** with a `refetchInterval: 5000` (5-second polling). This approach provides a dynamic user experience (odds and balances update automatically) without the overhead and complexity of maintaining WebSocket connections for this scale.
* **API Architecture:** I refactored the market listing handler to return a structured `{ data, pagination }` object. This ensures better scalability and clean pagination state management on the frontend.
* **Admin Security:** Critical actions (Resolve/Archive) are protected on the frontend by checking the user's role (`user.role === 'admin'`) and on the backend via the authentication middleware.
* **Bonus Task (Bot Support):** I implemented a full **API Key** system. Users can generate unique keys from their profile, and the authentication middleware was updated to allow programmatic access via the `x-api-key` header, seamlessly supporting bots.

**Challenges Faced**
* **Data Synchronization (The `hasMore` error):** My biggest challenge was a `TypeError` on the main dashboard, where the UI tried to access pagination metadata before the server sent it properly formatted. I solved this by updating the backend route validation schema, refactoring the handler to return the correct paginated JSON structure, and implementing defensive coding on the frontend.
* **Payout Distribution Logic:** Calculating the proportional distribution of the total pot to the winners required careful mathematical operations and SQL transactions to ensure user balances updated flawlessly after a market resolved.

## Images or Video Demo

The demo video showcasing the full user flow can be found in this repository within the `./submission` folder.