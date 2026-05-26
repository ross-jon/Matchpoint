# Brain Map – Core Context Documentation

This document is the canonical source of truth for the Matchpoint application. It captures the
architecture, directory responsibilities, and a granular feature index that maps every
user‑facing screen to its underlying data contracts and Supabase tables.

## Architecture Overview

* **Framework** – Next.js 13 (app router) with TypeScript.
* **State Management** – Local React state and context via custom hooks (`useToast`, `useMobile`).
* **Styling** – Tailwind CSS with a custom component library under `components/ui`.
* **Database** – Supabase Postgres. All data access is performed through the shared client in
  `utils/supabase/client.ts`.
* **Auth** – Supabase Auth; user session is available via `supabase.auth.getSession()`.
* **Storage** – Supabase Storage bucket `avatars` for user profile pictures.

## Component & Data Directory

| Directory | Responsibility |
|-----------|----------------|
| `app/` | Global layout, global styles, and the root page.
| `components/` | Reusable UI atoms, molecules, and screen components.
| `components/ui/` | Low‑level UI primitives (buttons, inputs, dialogs, etc.).
| `components/screens/` | Full‑page screens that compose atoms and UI primitives.
| `hooks/` | Custom React hooks for shared logic.
| `lib/` | Utility functions and data helpers.
| `utils/supabase/` | Supabase client and related helpers.
| `public/` | Static assets (icons, placeholders).
| `scripts/` | Development/test scripts.
| `MemoryBank/` | Project documentation, decision logs, and system patterns.

## Feature Index

| Feature | Intent | Primary Entry Point | Supporting Components | Supabase Tables | Edge Functions / Webhooks |
|---------|--------|---------------------|-----------------------|-----------------|--------------------------|
| **Login** | Authenticate a user and load profile name. | `components/screens/login-screen.tsx` | – | `profiles` (read `name`) | – |
| **Profile View** | Display user profile, avatar, and courts. | `components/screens/profile-screen.tsx` | `components/challenge-sheet.tsx` | `profiles`, `courts` | – |
| **Profile Setup** | Create or update profile details and avatar. | `components/screens/profile-setup-screen.tsx` | – | `profiles`, `courts` | – |
| **Discover** | Browse other players by Elo and challenge status. | `components/screens/discover-screen.tsx` | – | `profiles` (elo, bio, open_to_challenges) | – |
| **Feed** | View recent matches, likes, and comments. | `components/screens/feed-screen.tsx` | – | `matches`, `match_likes`, `match_comments`, `profiles` | – |
| **Matches Dashboard** | Approve/decline match scores and update status. | `components/screens/matches-screen.tsx` | – | `matches` | – |
| **Match Details** | View match details, likes, comments, and submit a comment. | `components/screens/match-details-screen.tsx` | – | `matches`, `match_likes`, `match_comments`, `profiles` | – |
| **Messages** | Conversation list and chat interface. | `components/screens/messages-screen.tsx` | – | `conversations`, `messages`, `profiles` | – |
| **Leaderboard** | Display player rankings by Elo. | `components/screens/leaderboard-screen.tsx` | – | `profiles` (elo, wins, losses) | – |
| **Challenge Sheet** | Show challenge details for a match. | `components/challenge-sheet.tsx` | – | `matches` | – |

All features are implemented as React components that consume data via the Supabase client. No
server‑side Edge Functions are currently present; all data manipulation occurs client‑side.

