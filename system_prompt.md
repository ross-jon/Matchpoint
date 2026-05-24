# System Architecture Specification: MatchPoint (V1 Beta)

This document serves as the absolute single source of truth for the system architecture, database schema, design constraints, and product workflows of **MatchPoint**—a competitive, self-regulating local tennis flex ladder application optimized for mobile-first views.

---

## 1. Core Tech Stack & Design Architecture

### Technical Stack
- **Framework:** Next.js (App Router, React, Tailwind CSS)
- **UI Components:** shadcn/ui (Radix Primitives) & Lucide React Icons
- **Backend & Database:** Supabase (PostgreSQL, Auth, Real-time Engine)
- **PWA Package:** `@ducanh2912/next-pwa` (Full-screen standalone mobile configuration)

### UI/UX Rules & Design Tokens (90 / 7 / 3 Rule)
- **90% Neutral Structural Base:** Deep Slate backgrounds (`bg-slate-950` / `bg-slate-900`) and surface panels (`bg-slate-800`).
- **7% Typography & Boundaries:** Stark white text for visibility (`text-white`), muted slate text for details (`text-slate-400`), and thin borders (`border-slate-800`).
- **3% Gamified Arcade Spark:** High-contrast Digital Lime (`#a3e635` / `text-lime-400` / `bg-lime-400`). Reserved strictly for active navbar highlights, `+Elo` values, unread message badges, and primary action buttons (e.g., "Approve").
- **Layout Shell:** Strava-style configuration. Responsive top utility navigation header (Brand on left; Search, Messages, Notifications, and Profile Avatar clustered on right). Sticky 3-Tab Bottom Navigation menu for core screen transitions ("Feed", "The Ladder", "My Matches").

---

## 2. Database Schema (PostgreSQL & Supabase Constraints)

The database maps feature architectures to vertical user slices using explicit relationships and a zero-sum rating system.

```sql
-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (User Accounts & Tennis Data)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    elo_rating INT DEFAULT 1200 NOT NULL,
    wins INT DEFAULT 0 NOT NULL,
    losses INT DEFAULT 0 NOT NULL,
    streak_count INT DEFAULT 0 NOT NULL,
    streak_type TEXT DEFAULT 'win' CHECK (streak_type IN ('win', 'loss')),
    geographic_hubs TEXT[] DEFAULT '{}'::TEXT[] NOT NULL, -- Array of preferred courts
    open_to_challenges BOOLEAN DEFAULT TRUE NOT NULL,
    last_played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. CONVERSATIONS TABLE (Anti-Duplicate Global Index)
-- Enforces a unique constraint via alphabetical string sorting (user_alpha < user_beta)
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_alpha UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    user_beta UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    last_message_snippet TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_user_pair UNIQUE (user_alpha, user_beta),
    CONSTRAINT alphabetical_order CHECK (user_alpha < user_beta)
);

-- 3. MESSAGES TABLE (Chat Streams)
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    message_text TEXT NOT NULL,
    is_system_message BOOLEAN DEFAULT FALSE NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. MATCHES TABLE (The Schedule & Score Ledger)
CREATE TYPE match_status_type AS ENUM ('pending', 'accepted', 'completed', 'verified');

CREATE TABLE public.matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    home_player_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL, -- The Challenger
    away_player_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL, -- The Challenged
    status match_status_type DEFAULT 'pending' NOT NULL,
    proposed_location TEXT NOT NULL,
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    challenger_note TEXT,
    
    -- Score Arrays (Null until status is 'completed' or 'verified')
    home_set_scores INT[] DEFAULT NULL, -- e.g., [6, 3, 7]
    away_set_scores INT[] DEFAULT NULL, -- e.g., [4, 6, 6]
    score_submitted_at TIMESTAMP WITH TIME ZONE,
    score_last_edited_by UUID REFERENCES public.profiles(id),
    
    -- Rating Bookkeeping
    elo_delta INT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- RLS & Realtime Directives
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
-- (Note: Enable Supabase Realtime tracking for messages and matches tables to support instant chat updates and score boards)

3. Core Functional Modules & UX Flow SpecsModule A: User Onboarding & ProfilesThe Ingest Loop: Upon account creation, users undergo a mandatory profile screen workflow.Rules of Conduct: Users must select an interactive checkbox verifying acceptance of the Strict Co-Ed Professionalism Rule: Zero tolerance for unsolicited flirting or harassment. Immediate lifetime ban.Data Capture: Form captures profile photo upload, bio text block, and multi-select tags for local court networks (e.g., "Sandy Parks", "Draper Indoor"). Default Elo initialized at 1200.Module B: Matchmaking Roster & DiscoveryRoster Index: Clean directory of players in the league, searchable by player name and filterable by geographic court tags.Privacy Gate: If a user’s profile toggle open_to_challenges is false, the profile card hides the booking triggers. If true, displays [ Message ] and [ Challenge ].Module C: The Challenge System (The "Uber" Flow)The Protocol: Whomever initializes a match challenge is designated by the database as the Home Team (home_player_id). The recipient is the Away Team (away_player_id).The Interface Trigger: Clicking "Challenge" invokes a modal bottom sheet sliding up from the base of the screen. Home team selects location hub, inputs scheduled date/time, and inserts an optional note.The Dispatch: Clicking "Send Official Challenge" creates a row in the matches table (status = 'pending'), inserts a dynamic interactive system notification card directly into their private chat thread, and flags the Away team’s Matches Tab under Action Required.The Resolution: Away team can review and click [ Accept Challenge ] (shifts status to accepted and populates both players' upcoming schedules) or click [ Message ] to jump into the text window to negotiate alternate dates.Module D: Collaborative 24-Hour Reporting & VerificationOnce the match clock passes the designated scheduled_time, the match item transitions into an interactive data transaction canvas with a strict 24-hour expiration window.The Shared Window Rule: For exactly 24 hours post-match, the match card opens an editable grid access block. Either player can enter, update, or tweak the set scores.The Edit Loop: If Player A inputs scores incorrectly, Player B can tap [ Edit Score ] to correct the cells. The match remains fluid while the 24-hour countdown timer ticks down.The Lock Triggers (Mutually Exclusive):Instant Manual Lock: The moment either player clicks [ Approve Score ] on a scoreline entered by their opponent, the edit window instantly locks. The status flips to verified, the Elo engine parses the numbers, and changes become permanent.Automated Timer Lock: If the 24-hour countdown timer hits zero and any score is sitting inside the rows unapproved, the database automatically closes the window, forces status = 'verified', and locks whatever values exist in the cells as the immutable truth.The Forfeit Penalty (No-Show Protection): If the 24-hour countdown timer hits zero and neither player has entered any scores, the system marks the match as a double-default. The Home Team is penalised with an automatic Forfeit Loss (-32 Elo), and the Away team receives 0 changes.Module E: The Live Activity Feed (Strava Feed)The League Landing Page: Serves as the global landing view when a logged-in player boots up the application.The Feed UI: A vertical, scrolling feed display of chronologically sorted, completed matches. Cards feature player avatars, winner indicators, final game scores (6-4, 3-6, 7-6), match locations, and clear, colored pill metrics showing performance outcomes (e.g., Jon +14 Elo / Sarah -14 Elo).Module F: The Ladder LeaderboardThe Standings Engine: Renders an absolute global sorting table ranking all profiles by elo_rating DESC.The Interface Fields: Position index (#1), Player Name, current Elo, and a row of tiny, high-contrast historical tracking circles displaying form strings (W - W - L - W - W) alongside active streak counts (e.g., 🔥 3 Wins).Anti-Camping Protocol: If a profile’s last_played_at date exceeds 21 days, their row is systematically filtered out of the live rankings table and shifted down to a grayed-out "Inactive Tray" at the bottom of the viewport to preserve ladder competitive integrity.4. The Elo Calculation EngineWhen a match shifts to status = 'verified', the system instantly computes rating revisions using a custom, zero-sum algorithm.Step 1: Calculate Transformed RatingsFor both the Home Player ($R_H$) and the Away Player ($R_A$), calculate their transformed scaling values ($Q_H$ and $Q_A$):$$Q_H = 10^{\frac{R_H}{400}}$$$$Q_A = 10^{\frac{R_A}{400}}$$Step 2: Calculate Expected OutcomesDetermine the expected probability of victory ($E_H$ and $E_A$) for each player:$$E_H = \frac{Q_H}{Q_H + Q_A}$$$$E_A = \frac{Q_A}{Q_H + Q_A}$$Step 3: Parse Actual Match Outcomes ($S$)If Home Player won the match: $S_H = 1$, $S_A = 0$If Away Player won the match: $S_H = 0$, $S_A = 1$Step 4: Compute Final Revisions with K-Factor ScalingThe league operates with a static sensitivity index ($K = 32$). Update the ratings seamlessly:$$\text{New } R_H = R_H + 32 \times (S_H - E_H)$$$$\text{New } R_A = R_A + 32 \times (S_A - E_A)$$Implementation Note: All final Elo shifts are integers (rounded mathematically) and must balance perfectly to zero sum ($+\Delta \text{Elo} = -\Delta \text{Elo}$).