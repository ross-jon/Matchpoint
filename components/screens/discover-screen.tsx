'use client'

import { useState, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/utils/supabase/client'
import { Search, MapPin, Shield, X, SlidersHorizontal, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

const GEOGRAPHIC_HUBS = [
  'Flat Iron Park (Sandy)',
  'Murray Park Courts',
  'Draper Indoor Hub',
  'Lone Peak Park'
]

interface DiscoverPlayer {
  id: string
  name: string
  avatar_url: string
  elo_rating: number
  wins: number
  losses: number
  bio: string
  open_to_challenges: boolean
  geographic_hubs: string[]
}

interface PlayerCardProps {
  player: DiscoverPlayer
  onChallenge: (player: any) => void
}

function PlayerCard({ player, onChallenge }: PlayerCardProps) {
  const totalMatches = player.wins + player.losses
  const winRate = totalMatches > 0 ? Math.round((player.wins / totalMatches) * 100) : 0
  
  return (
    <div className="rounded-xl border border-border bg-card transition-colors hover:border-primary/30">
      {/* Header with Avatar */}
      <div className="flex items-start gap-4 p-4">
        <Avatar className="h-14 w-14 shrink-0 ring-2 ring-border">
          <AvatarImage src={player.avatar_url} alt={player.name} />
          <AvatarFallback>{player.name ? player.name.split(' ').map(n => n[0]).join('') : 'P'}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-foreground">{player.name}</h3>
              <p className="text-sm text-muted-foreground">{player.elo_rating} Elo</p>
            </div>
            {player.open_to_challenges && (
              <Badge variant="outline" className="shrink-0 border-primary/50 text-primary bg-primary/10">
                Open
              </Badge>
            )}
          </div>
          
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{player.bio || 'No bio provided.'}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 border-t border-border bg-secondary/20 px-4 py-3">
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{player.wins}</p>
          <p className="text-xs text-muted-foreground">Wins</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{player.losses}</p>
          <p className="text-xs text-muted-foreground">Losses</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{winRate}%</p>
          <p className="text-xs text-muted-foreground">Win Rate</p>
        </div>
      </div>

      {/* Locations & Actions */}
      <div className="border-t border-border p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(player.geographic_hubs || []).map(hub => (
            <Badge key={hub} variant="secondary" className="flex items-center gap-1 text-xs border-none">
              <MapPin className="h-3 w-3" />
              {hub}
            </Badge>
          ))}
        </div>

        {player.open_to_challenges ? (
          <Button size="sm" className="w-full gap-2" onClick={() => onChallenge(player)}>
            <Trophy className="h-4 w-4" />
            Challenge to a Match
          </Button>
        ) : (
          <Button size="sm" variant="secondary" className="w-full gap-2" disabled>
            Not Accepting Challenges
          </Button>
        )}
      </div>
    </div>
  )
}

function SuggestedPlayer({ player, onChallenge }: { player: DiscoverPlayer; onChallenge: (player: any) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <Avatar className="h-12 w-12">
        <AvatarImage src={player.avatar_url} alt={player.name} />
        <AvatarFallback>{player.name ? player.name.split(' ').map(n => n[0]).join('') : 'P'}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{player.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {player.elo_rating} Elo • {player.geographic_hubs?.[0] || 'Salt Lake'}
        </p>
      </div>
      <Button 
        size="sm" 
        variant="outline"
        onClick={() => onChallenge(player)}
        disabled={!player.open_to_challenges}
      >
        <Trophy className="h-4 w-4" />
      </Button>
    </div>
  )
}

interface DiscoverScreenProps {
  onChallenge: (player: any) => void
}

export function DiscoverScreen({ onChallenge }: DiscoverScreenProps) {
  const [players, setPlayers] = useState<DiscoverPlayer[]>([])
  const [currentUserElo, setCurrentUserElo] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedHubs, setSelectedHubs] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    const loadDiscoveryData = async () => {
      try {
        // 1. Pull current user meta data to calculate Elo offsets
        const { data: authData, error: authError } = await supabase.auth.getUser()
        const user = authData?.user
        if (authError) {
          console.error('Supabase auth error:', authError.message || authError)
          return
        }
        let currentUserId = ''
        if (user) {
          currentUserId = user.id
          const { data: profile } = await supabase
            .from('profiles')
            .select('elo_rating')
            .eq('id', user.id)
            .single()
          if (profile) setCurrentUserElo(profile.elo_rating)
        }

        // 2. Query all opponent profile logs from the matrix database
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, elo_rating, wins, losses, bio, open_to_challenges, geographic_hubs')
          .neq('id', currentUserId) // Filters yourself out of discovery list bounds
          .order('name', { ascending: true })

        if (error) {
          // Log a more descriptive error message and the raw error object
          console.error('Error hydrating discovery directory lists:', error.message || error, JSON.stringify(error))
          console.debug('Supabase error details:', error)
        } else if (data) {
          setPlayers(data as DiscoverPlayer[])
        }
      } catch (err) {
        console.error('Unexpected error loading discovery data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDiscoveryData()
  }, [])

  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesHub = selectedHubs.length === 0 || player.geographic_hubs?.some(hub => selectedHubs.includes(hub))
    return matchesSearch && matchesHub
  })

  // 3. Smart Filter: Identify players within tight skill parameters (+/- 150 points)
  const suggestedPlayers = players
    .filter(p => p.open_to_challenges)
    .filter(p => currentUserElo === null || Math.abs(p.elo_rating - currentUserElo) <= 150)
    .slice(0, 3)

  const toggleHub = (hub: string) => {
    setSelectedHubs(prev =>
      prev.includes(hub) ? prev.filter(h => h !== hub) : [...prev, hub]
    )
  }

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="px-4 py-4 md:px-6">
          <h2 className="text-xl font-bold text-foreground">Discover Players</h2>
          <p className="mt-1 text-sm text-muted-foreground">Find new opponents in your area</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 md:p-6">
        {/* Safety Warning */}
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <Shield className="h-5 w-5 shrink-0 text-destructive" />
          <p className="text-sm text-slate-300">
            <strong>Community Guidelines:</strong> Zero tolerance for unsolicited flirting or harassment. Violations result in an immediate profile ban.
          </p>
        </div>

        {/* Search & Filter Row */}
        <div className="mb-6 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              disabled={loading}
            />
          </div>
          <Button 
            variant={showFilters ? 'default' : 'outline'} 
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
            disabled={loading}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {selectedHubs.length > 0 && (
              <Badge variant="secondary" className="ml-1 border-none">{selectedHubs.length}</Badge>
            )}
          </Button>
        </div>

        {/* Hub Filters */}
        {showFilters && (
          <div className="mb-6 rounded-lg border border-border bg-card p-4">
            <p className="mb-3 text-sm font-medium text-foreground">Filter by Location</p>
            <div className="flex flex-wrap gap-2">
              {GEOGRAPHIC_HUBS.map(hub => (
                <button
                  key={hub}
                  onClick={() => toggleHub(hub)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                    selectedHubs.includes(hub)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-secondary text-muted-foreground hover:border-primary/50'
                  )}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {hub}
                  {selectedHubs.includes(hub) && <X className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            Searching local tennis registry...
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Player Grid */}
            <div className="lg:col-span-2">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {selectedHubs.length > 0 ? 'Filtered Results' : 'All Opponents'} ({filteredPlayers.length})
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredPlayers.map(player => (
                  <PlayerCard key={player.id} player={player} onChallenge={onChallenge} />
                ))}
              </div>

              {filteredPlayers.length === 0 && (
                <div className="py-12 text-center border border-dashed border-border rounded-lg">
                  <p className="text-muted-foreground text-sm">No competitive players found matching your criteria</p>
                </div>
              )}
            </div>

            {/* Sidebar - Suggested */}
            <div className="hidden lg:block">
              <div className="sticky top-20">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Suggested Matches
                </h3>
                {suggestedPlayers.length > 0 ? (
                  <div className="space-y-3">
                    {suggestedPlayers.map(player => (
                      <SuggestedPlayer key={player.id} player={player} onChallenge={onChallenge} />
                    ))}
                  </div>
                ) : (
                  <div className="p-4 border border-border bg-card rounded-lg text-center text-xs text-muted-foreground">
                    No active players in your immediate Elo range right now.
                  </div>
                )}

                <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
                  Automatically curated for you based on a matching skill level parameter of +/- 150 Elo rating points.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}