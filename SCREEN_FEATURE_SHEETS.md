# Screen‑by‑Screen Feature Sheet

This document lists every feature that manifests on a particular screen or view. For each
feature we provide the exact file paths, state/context usage, and the Supabase data contracts
involved.

## Player Profile View
* **Feature**: View own profile
  * **Files**: `components/screens/profile-screen.tsx`
  * **State & Context**: Uses local state for `profile`, `courts`, and `avatarUrl`. No global context.
  * **Data Contracts**: `profiles` (id, name, avatar_url, elo_rating, wins, losses, streak_*), `courts` (id, name)
* **Feature**: Edit avatar
  * **Files**: `components/screens/profile-screen.tsx` (avatar upload logic)
  * **State & Context**: Local `avatarUrl` state.
  * **Data Contracts**: Supabase Storage bucket `avatars`; `profiles` upsert.

## Profile Setup
* **Feature**: Create or update profile
  * **Files**: `components/screens/profile-setup-screen.tsx`
  * **State & Context**: Local form state; `useToast` for notifications.
  * **Data Contracts**: `profiles` (name, bio, avatar_url, geographic_hubs), `courts` (id, name)

## Discover Screen
* **Feature**: Browse players by Elo
  * **Files**: `components/screens/discover-screen.tsx`
  * **State & Context**: Local filter state; `useToast`.
  * **Data Contracts**: `profiles` (elo_rating, open_to_challenges, bio)

## Feed Screen
* **Feature**: List recent matches
  * **Files**: `components/screens/feed-screen.tsx`
  * **State & Context**: Local `matches` array; `useToast`.
  * **Data Contracts**: `matches` (id, home_player_id, away_player_id, status, scheduled_time, ...), `profiles` (id, name, avatar_url)
* **Feature**: Like a match
  * **Files**: `components/screens/feed-screen.tsx` (like button handler)
  * **State & Context**: Local `hasLiked` flag.
  * **Data Contracts**: `match_likes` (match_id, user_id)
* **Feature**: View comments
  * **Files**: `components/screens/feed-screen.tsx` (comment toggle)
  * **State & Context**: Local `comments` array.
  * **Data Contracts**: `match_comments` (id, match_id, user_id, content, created_at), `profiles` (id, name, avatar_url)

## Matches Dashboard
* **Feature**: Approve/decline match scores
  * **Files**: `components/screens/matches-screen.tsx`
  * **State & Context**: Local `pendingScores` array.
  * **Data Contracts**: `matches` (status, score_submitted_at)
* **Feature**: Accept a match
  * **Files**: `components/screens/matches-screen.tsx`
  * **State & Context**: Local `upcomingMatches` array.
  * **Data Contracts**: `matches` (status)

## Match Details
* **Feature**: View match details
  * **Files**: `components/screens/match-details-screen.tsx`
  * **State & Context**: Local `match` object, `currentUserId`, `newComment`.
  * **Data Contracts**: `matches`, `match_likes`, `match_comments`, `profiles`
* **Feature**: Submit a comment
  * **Files**: `components/screens/match-details-screen.tsx` (form submit handler)
  * **State & Context**: Local `isSubmitting` flag.
  * **Data Contracts**: `match_comments` (insert), `profiles` (select name, avatar_url)

## Messages Screen
* **Feature**: List conversations
  * **Files**: `components/screens/messages-screen.tsx`
  * **State & Context**: Local `conversations` array.
  * **Data Contracts**: `conversations` (id, user_alpha, user_beta, last_message_snippet, updated_at), `profiles` (id, name, avatar_url)
* **Feature**: View a conversation
  * **Files**: `components/screens/messages-screen.tsx` (conversation view logic)
  * **State & Context**: Local `messages` array.
  * **Data Contracts**: `messages` (id, conversation_id, user_id, message_text, created_at), `profiles` (id, name, avatar_url)
* **Feature**: Send a message
  * **Files**: `components/screens/messages-screen.tsx` (send handler)
  * **State & Context**: Local `newMessage` input.
  * **Data Contracts**: `messages` (insert)

## Leaderboard
* **Feature**: Display rankings
  * **Files**: `components/screens/leaderboard-screen.tsx`
  * **State & Context**: Local `leaderboard` array.
  * **Data Contracts**: `profiles` (elo_rating, wins, losses, streak_* )

## Challenge Sheet
* **Feature**: Show challenge details
  * **Files**: `components/challenge-sheet.tsx`
  * **State & Context**: Receives `match` prop.
  * **Data Contracts**: `matches` (id, home_player_id, away_player_id, status, scheduled_time)

