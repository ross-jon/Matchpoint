'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { supabase } from '@/utils/supabase/client'
import { useEffect, useState, useMemo } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type MatchForm = {
  delta: number
  matchId: string
}

type LeaderboardPlayer = {
  id: string
  name: string
  avatar: string
  elo: number
  wins: number
  losses: number
  currentRank: number
  trendAmount: number
  trendDirection: 'up' | 'down' | 'flat'
  recentForm: MatchForm[]
}

interface LeaderboardScreenProps {
  onViewProfile: (playerId: string) => void
  onViewMatch?: (matchId: string) => void
}

export function LeaderboardScreen({ onViewProfile, onViewMatch }: LeaderboardScreenProps) {
  const [playersData, setPlayersData] = useState<LeaderboardPlayer[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLeaderboardData = async () => {
      const [profilesRes, matchesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, avatar_url, elo_rating, previous_week_rank')
          .order('elo_rating', { ascending: false }),
        supabase
          .from('matches')
          .select('id, home_player_id, away_player_id, home_elo_delta, away_elo_delta')
          .eq('status', 'verified')
          .order('score_submitted_at', { ascending: false })
      ])

      if (profilesRes.error || matchesRes.error) {
        console.error('Error fetching leaderboard data:', profilesRes.error || matchesRes.error)
        setLoading(false)
        return
      }

      const matches = matchesRes.data || []

      const mappedData: LeaderboardPlayer[] = (profilesRes.data || []).map((profile, index) => {
        const currentRank = index + 1
        const previousRank = profile.previous_week_rank

        let trendAmount = 0
        let trendDirection: 'up' | 'down' | 'flat' = 'flat'
        
        if (previousRank) {
          const difference = previousRank - currentRank
          if (difference > 0) {
            trendAmount = difference
            trendDirection = 'up'
          } else if (difference < 0) {
            trendAmount = Math.abs(difference)
            trendDirection = 'down'
          }
        }

        let wins = 0
        let losses = 0
        const recentForm: MatchForm[] = []

        for (const match of matches) {
          const isHome = match.home_player_id === profile.id
          const isAway = match.away_player_id === profile.id

          if (isHome || isAway) {
            const delta = isHome ? match.home_elo_delta : match.away_elo_delta
            if (delta !== null) {
              if (delta > 0) wins++
              else if (delta < 0) losses++
              
              if (recentForm.length < 5) {
                recentForm.push({ delta, matchId: match.id })
              }
            }
          }
        }

        return {
          id: profile.id,
          name: profile.name,
          avatar: profile.avatar_url,
          elo: profile.elo_rating,
          wins,
          losses,
          currentRank,
          trendAmount,
          trendDirection,
          recentForm: recentForm.reverse()
        }
      })

      setPlayersData(mappedData)
      setLoading(false)
    }

    fetchLeaderboardData()
  }, [])

  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return playersData
    return playersData.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [playersData, searchQuery])

  return (
    <div className="min-h-screen pb-24 md:pb-8 bg-background">
      
      {/* STICKY HEADER & COLUMNS */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm pt-4 pb-2 px-4 md:px-6 shadow-sm">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground tracking-tight">Leaderboard Rankings</h2>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mt-0.5">
                Global Ladder ({playersData.length} Active)
              </p>
            </div>
            
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find a player..."
                className="pl-9 h-10 bg-card/50 border-border/60 focus-visible:ring-lime-500/30 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Sticky Column Labels (Aligned with the thicker bands below) */}
          <div className="flex items-center gap-4 md:gap-6 px-4 md:px-5 pr-5 pt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <div className="w-10 text-center shrink-0">Rank</div>
            <div className="w-10 text-center shrink-0">Trend</div>
            <div className="hidden sm:block w-12 shrink-0"></div> {/* Avatar spacer */}
            <div className="flex-1 min-w-0">Player</div>
            <div className="hidden md:flex min-w-[150px] shrink-0 justify-end">Recent Form</div>
            <div className="text-right shrink-0 min-w-[5rem] sm:min-w-[7rem]">Rating</div>
          </div>
        </div>
      </header>

      {/* LEADERBOARD LIST */}
      <main className="mx-auto max-w-4xl p-4 md:p-6 space-y-3">
        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            No players found matching "{searchQuery}"
          </div>
        ) : (
          filteredPlayers.map((player) => {
            const isTop3 = player.currentRank <= 3
            // Fallback for hot-reloading state safety
            const safeRecentForm = player.recentForm || []

            return (
              <div
                key={player.id}
                className={cn(
                  "flex items-center gap-4 md:gap-6 p-4 md:p-5 pr-5 rounded-xl border transition-colors",
                  isTop3 
                    ? "border-lime-400/40 bg-lime-500/10 shadow-sm" 
                    : "border-border/60 bg-card hover:bg-muted/30"
                )}
              >
                {/* 1. Rank */}
                <div className={cn(
                  "w-10 text-center font-black text-xl md:text-2xl shrink-0", 
                  isTop3 ? "text-lime-400" : "text-muted-foreground"
                )}>
                  #{player.currentRank}
                </div>

                {/* 2. Trend */}
                <div className="w-10 text-center text-xs font-bold shrink-0">
                  {player.trendDirection === 'up' && <span className="text-lime-400">↑{player.trendAmount}</span>}
                  {player.trendDirection === 'down' && <span className="text-red-500">↓{player.trendAmount}</span>}
                  {player.trendDirection === 'flat' && <span className="text-muted-foreground opacity-50">—</span>}
                </div>

                {/* 3. Avatar (Increased Size) */}
                <Avatar className="h-12 w-12 shrink-0 border-2 border-background shadow-sm hidden sm:block">
                  <AvatarImage src={player.avatar} alt={player.name} />
                  <AvatarFallback className="text-sm bg-muted text-muted-foreground">{player.name[0]}</AvatarFallback>
                </Avatar>

                {/* 4. Name & Record (Increased text sizing & layout) */}
                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                  <button
                    onClick={() => onViewProfile(player.id)}
                    className="text-left font-bold text-base md:text-xl text-foreground truncate hover:text-lime-300 transition-colors"
                  >
                    {player.name}
                  </button>
                  <span className="text-sm font-bold text-muted-foreground shrink-0 uppercase tracking-widest">
                    ({player.wins}-{player.losses})
                  </span>
                </div>

                {/* 5. Clickable Recent Form Guide */}
                <div className="hidden md:flex items-center justify-end gap-2 min-w-[150px] shrink-0">
                  {safeRecentForm.map((item, i) => (
                    <button 
                      key={i}
                      onClick={() => onViewMatch?.(item.matchId)}
                      title="View Match Details"
                      className={cn(
                        "flex items-center justify-center h-6 min-w-[28px] px-1.5 rounded text-[10px] font-bold font-mono transition-transform hover:scale-110 hover:brightness-125 cursor-pointer",
                        item.delta >= 0 
                          ? "bg-lime-500/15 text-lime-400 border border-lime-400/30" 
                          : "bg-red-500/10 text-red-500 border border-red-500/20"
                      )}
                    >
                      {item.delta > 0 ? '+' : ''}{item.delta}
                    </button>
                  ))}
                  {/* Fill empty spots safely */}
                  {Array.from({ length: Math.max(0, 5 - safeRecentForm.length) }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-6 w-[28px] rounded border border-border/40 bg-muted/10 pointer-events-none" />
                  ))}
                </div>

                {/* 6. Rating (Increased Size) */}
                <div className="text-right shrink-0 min-w-[5rem] sm:min-w-[7rem]">
                  <span className="text-2xl md:text-3xl font-black text-foreground tracking-tighter">{player.elo}</span>
                </div>
              </div>
            )
          })
        )}
      </main>
    </div>
  )
}