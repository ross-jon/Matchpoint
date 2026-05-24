# System Patterns

## Tech Stack
* **Next.js** – App Router, React, Tailwind CSS, shadcn/ui components.
* **Supabase** – PostgreSQL database, Auth, Realtime, Storage.
* **PWA** – `@ducanh2912/next-pwa` configured for full‑screen standalone mode.

## Alpha/Beta Sorting Rules
Conversation keys are UUID strings. For deterministic ordering the
`user_alpha` and `user_beta` columns are stored in alphabetical order
(`user_alpha < user_beta`). This ensures a unique, repeatable key for a
conversation between any two users.

## Design Token Color Balance (90/7/3 Rule)
* **90 %** Neutral Structural Base – Deep Slate (`bg-slate-950`, `bg-slate-900`).
* **7 %** Typography & Boundaries – White text (`text-white`), muted slate
  (`text-slate-400`), thin borders (`border-slate-800`).
* **3 %** Gamified Arcade Spark – Digital Lime (`#a3e635`, `text-lime-400`,
  `bg-lime-400`) used for active highlights, Elo changes, and primary
  action buttons.

All values are derived from the specifications in `system_prompt.md`.
