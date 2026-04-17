# Submission - Junior Software Developer Internship 2026

## Short Description

**Overview & Setup**
This is the completed assignment for the prediction market application. The project is split into a Bun-based backend and a React/TanStack frontend.
To run the project locally:
* **Backend:** Navigate to the `/server` folder, run `bun install`, then `bun run dev` (running on port 4001).
* **Frontend:** Navigate to the `/client` folder, run `bun install`, then `bun run dev` (running on port 3000).
* **Database:** The project uses the pre-configured SQLite database with seed data.

**Design Choices**
* **Real-time Updates (Polling):** I implemented **TanStack Query** with a `refetchInterval: 5000` (5-second polling). This ensures that market odds, total bets, and user balances stay synchronized across the dashboard and profile pages without the architectural complexity of WebSockets for this MVP.
* **API Architecture:** I refactored the backend market listing handler to return a structured `{ data, pagination }` object. This allowed for clean, state-driven pagination on the frontend using TanStack Router.
* **Role-Based Access:** Administrative actions (Resolve/Archive) are guarded at two levels: UI-level conditional rendering based on `user.role` and backend-level verification via authentication middleware.
* **Bonus Task (API & Bot Support):** I implemented a dedicated **API Key** system. Users can generate a unique key from their profile page. I updated the backend authentication middleware to support the `x-api-key` header, allowing programmatic access to market listing and betting endpoints.

**Challenges Faced**
* **Data Synchronization (Frontend/Backend Mismatch):** One of the main hurdles was a `TypeError` on the dashboard caused by the frontend expecting a specific pagination metadata structure that the initial backend didn't provide. I resolved this by aligning the Elysia route schemas with the frontend requirements.
* **Live Balance Refresh:** Ensuring the global header balance reflected bet deductions immediately was tricky due to static state in the Auth Context. I solved this by connecting the Header's balance display to a live React Query hook, which is invalidated and refetched automatically whenever a bet is placed.
* **Proportional Payout Logic:** Implementing the resolution logic required careful calculation of stakes to ensure the "house" distributes the total pot proportionally among all users who bet on the winning outcome, while correctly updating balances and market status in a single flow.

## Images or Video Demo

The demo video showcasing the full user flow can be found in the `./submission` folder of this repository.