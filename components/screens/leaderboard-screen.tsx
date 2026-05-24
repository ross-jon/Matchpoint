'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

type LeaderboardPlayer = {
  id: string
  name: string
  avatar: string
  elo: number
  wins: number
  losses: number
  streakCount: number
  streakType: 'win' | 'loss'
  isInactive: boolean
}

interface PlayerRowProps {
  player: LeaderboardPlayer
  rank: number
  previousRank?: number
  onViewProfile: (playerId: string) => void // ◄ Dynamic navigation handler context link
}

function PlayerRow({ player, rank, previousRank, onViewProfile }: PlayerRowProps) {
  const isTop3 = rank <= 3

  return (
    <div
      className={`flex flex-col gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 sm:flex-row sm:items-center ${
        player.isInactive ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full font-bold ${
            isTop3 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
          }`}
        >
          {rank}
        </div>
        <Avatar className="h-12 w-12 shrink-0">
          <AvatarImage src={player.avatar} alt={player.name} />
          <AvatarFallback>{player.name ? player.name.split(' ').map(n => n[0]).join('') : 'P'}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          {/* 🛠️ Name converted to an interactive button link component frame */}
          <button
            onClick={() => onViewProfile(player.id)}
            className="text-left font-semibold text-foreground hover:text-primary hover:underline transition-colors block truncate max-w-full"
          >
            {player.name}
          </button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span>{player.wins + player.losses} matches</span>
            <span>•</span>
            <span className="capitalize">{player.streakType} streak ({player.streakCount})</span>
          </div>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{player.wins}</p>
          <p className="text-xs text-muted-foreground">Wins</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{player.losses}</p>
          <p className="text-xs text-muted-foreground">Losses</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{player.streakCount}</p>
          <p className="text-xs text-muted-foreground">Streak</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground capitalize">{player.streakType}</p>
          <p className="text-xs text-muted-foreground">Type</p>
        </div>
      </div>

      <div className="text-right">
        <div className="text-xl font-bold text-foreground">{player.elo}</div>
        <div className="text-xs text-muted-foreground">Elo</div>
      </div>
    </div>
  )
}

interface LeaderboardScreenProps {
  onViewProfile: (playerId: string) => void // ◄ Passed down from main root layout container
}

export function LeaderboardScreen({ onViewProfile }: LeaderboardScreenProps) {
  const [playersData, setPlayersData] = useState<LeaderboardPlayer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPlayers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, elo_rating, wins, losses, streak_count, streak_type')
        .order('elo_rating', { ascending: false })

      if (error) {
        console.error('Error fetching leaderboard:', error)
        setLoading(false)
        return
      }

      const mappedData: LeaderboardPlayer[] = (data ?? []).map((profile: any) => ({
        id: profile.id,
        name: profile.name,
        avatar: profile.avatar_url,
        elo: profile.elo_rating,
        wins: profile.wins,
        losses: profile.losses,
        streakCount: profile.streak_count,
        streakType: profile.streak_type || 'win',
        isInactive: profile.is_inactive ?? false,
      }))

      setPlayersData(mappedData)
      setLoading(false)
    }

    fetchPlayers()
  }, [])

  const activePlayers = playersData.filter((p) => !p.isInactive)
  const inactivePlayers = playersData.filter((p) => p.isInactive)

  const previousRanks: Record<string, number> = {}

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <header className="border-b border-border bg-card">
        <div className="px-4 py-4 md:px-6">
          <h2 className="text-xl font-bold text-foreground">Leaderboard</h2>
          <p className="text-sm text-muted-foreground">Salt Lake Tennis Ladder Rankings</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl p-4 md:p-6">
        <section>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Active Players
          </h3>

          {loading ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Loading leaderboard...
            </div>
          ) : (
            <div className="space-y-2">
              {activePlayers.map((player, index) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  rank={index + 1}
                  previousRank={previousRanks[player.id]}
                  onViewProfile={onViewProfile}
                />
              ))}
            </div>
          )}
        </section>

        {inactivePlayers.length > 0 && (
          <section className="mt-8">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Inactive (21+ days)
            </h3>
            <div className="space-y-2">
              {inactivePlayers.map((player, index) => (
                <PlayerRow 
                  key={player.id} 
                  player={player} 
                  rank={activePlayers.length + index + 1} 
                  onViewProfile={onViewProfile}
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}