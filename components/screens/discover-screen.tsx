'use client'

import { useState, useEffect, useRef } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/utils/supabase/client'
import {
  Search,
  MapPin,
  X,
  SlidersHorizontal,
  Trophy,
  Swords,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Court {
  id: string
  name: string
}

interface DiscoverPlayer {
  id: string
  name: string
  avatar_url: string
  elo_rating: number
  bio: string
  open_to_challenges: boolean
  geographic_hubs: string[]
}

// ---------------------------------------------------------------------------
// PlayerCard – vertical stack layout
// ---------------------------------------------------------------------------
interface PlayerCardProps {
  player: DiscoverPlayer
  onChallenge: (player: DiscoverPlayer) => void
  onViewProfile: (player: DiscoverPlayer) => void
  onMessage: (player: DiscoverPlayer) => void
  currentUserHubs?: string[]
  courtNameMap?: Record<string, string>
}

function PlayerCard({
  player,
  onChallenge,
  onViewProfile,
  onMessage,
  currentUserHubs = [],
  courtNameMap = {},
}: PlayerCardProps) {
  return (
    <div className="border border-border bg-card rounded-xl p-4 transition-colors hover:border-primary/30 flex flex-col gap-3">

      {/* Row 1 – Avatar + Name + Elo */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onViewProfile(player)}
          className="shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
          aria-label={`View ${player.name}'s profile`}
        >
          <Avatar className="h-12 w-12 ring-2 ring-border hover:ring-primary/60 transition-all">
            <AvatarImage src={player.avatar_url} alt={player.name} />
            <AvatarFallback>
              {player.name ? player.name.split(' ').map(n => n[0]).join('') : 'P'}
            </AvatarFallback>
          </Avatar>
        </button>

        <div className="min-w-0 flex-1">
          <button
            onClick={() => onViewProfile(player)}
            className="text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            <h3 className="font-semibold text-foreground hover:text-primary transition-colors leading-tight truncate">
              {player.name}
            </h3>
          </button>
          <Badge
            variant="secondary"
            className="bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 mt-1 border-none"
          >
            {player.elo_rating} Elo
          </Badge>
        </div>
      </div>

      {/* Row 2 – Bio (fixed 2-line area, scrollable overflow) */}
      <div className="h-[2.6rem] overflow-y-auto text-sm text-muted-foreground leading-[1.3rem] scrollbar-thin scrollbar-thumb-primary/40 scrollbar-track-slate-900/20 dark:scrollbar-track-slate-800/40">
        {player.bio ? (
          <p>{player.bio}</p>
        ) : (
          /* invisible spacer keeps the row height consistent */
          <span aria-hidden className="block" />
        )}
      </div>

      {/* Row 3 – Action buttons */}
      <div className="flex flex-col gap-2">
        <Button size="sm" className="w-full gap-2" onClick={() => onChallenge(player)}>
          <Swords className="h-4 w-4" />
          Challenge to a Match
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-full gap-2"
          onClick={() => onMessage(player)}
        >
          <MessageSquare className="h-4 w-4" />
          Message {player.name}
        </Button>
      </div>

      {/* Row 4 – Preferred courts (scrollable, fixed height) */}
      {(player.geographic_hubs?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1 max-h-[3.5rem] overflow-y-auto scrollbar-thin scrollbar-thumb-primary/40 scrollbar-track-slate-900/20 dark:scrollbar-track-slate-800/40 pt-0.5">
          {(player.geographic_hubs ?? []).map(hub => {
            const label = courtNameMap[hub] ?? hub
            const shared = currentUserHubs.includes(hub)
            return (
              <Badge
                key={hub}
                variant="secondary"
                className={cn(
                  'flex items-center gap-1 text-[11px] px-1.5 py-0.5 border-none leading-none shrink-0',
                  shared
                    ? 'bg-primary/20 text-primary font-semibold'
                    : 'bg-secondary text-muted-foreground'
                )}
              >
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate max-w-[120px]">{label}</span>
                {shared && (
                  <span className="ml-0.5 text-[9px] font-bold uppercase tracking-wide opacity-70">
                    shared
                  </span>
                )}
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SuggestedPlayer (sidebar)
// ---------------------------------------------------------------------------
function SuggestedPlayer({
  player,
  onChallenge,
  onViewProfile,
  courtNameMap = {},
}: {
  player: DiscoverPlayer
  onChallenge: (player: DiscoverPlayer) => void
  onViewProfile: (player: DiscoverPlayer) => void
  courtNameMap?: Record<string, string>
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <button
        onClick={() => onViewProfile(player)}
        className="shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
        aria-label={`View ${player.name}'s profile`}
      >
        <Avatar className="h-12 w-12 hover:ring-2 hover:ring-primary/50 transition-all">
          <AvatarImage src={player.avatar_url} alt={player.name} />
          <AvatarFallback>
            {player.name ? player.name.split(' ').map(n => n[0]).join('') : 'P'}
          </AvatarFallback>
        </Avatar>
      </button>
      <div className="min-w-0 flex-1">
        <button
          onClick={() => onViewProfile(player)}
          className="text-left w-full focus:outline-none"
        >
          <p className="truncate font-medium text-foreground hover:text-primary transition-colors">
            {player.name}
          </p>
        </button>
        <p className="text-xs text-muted-foreground truncate">
          {player.elo_rating} Elo · {(player.geographic_hubs?.[0] && courtNameMap[player.geographic_hubs[0]]) || player.geographic_hubs?.[0] || 'Salt Lake'}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => onChallenge(player)}
        disabled={!player.open_to_challenges}
        aria-label={`Challenge ${player.name}`}
      >
        <Trophy className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// EloRangeInput
// ---------------------------------------------------------------------------
interface EloRangeInputProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}
function EloRangeInput({ label, value, onChange, placeholder }: EloRangeInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground font-medium">{label}</label>
      <Input
        type="number"
        min={0}
        max={3000}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-8 text-sm w-24"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// FilterPanel – with searchable location picker
// ---------------------------------------------------------------------------
interface FilterPanelProps {
  selectedHubs: string[]
  onToggleHub: (hub: string) => void
  courts: Court[]
  eloMin: string
  eloMax: string
  onEloMinChange: (v: string) => void
  onEloMaxChange: (v: string) => void
  onClearAll: () => void
  activeFilterCount: number
  /** Hubs belonging to the current user – shown as quick-pick tiles */
  currentUserHubs: string[]
}

function FilterPanel({
  selectedHubs,
  onToggleHub,
  courts,
  eloMin,
  eloMax,
  onEloMinChange,
  onEloMaxChange,
  onClearAll,
  activeFilterCount,
  currentUserHubs,
}: FilterPanelProps) {
  const [hubSearch, setHubSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // All hubs that match the search term (case-insensitive)
  const courtNameMap = Object.fromEntries(courts.map(court => [court.id, court.name]))
  const searchResults = hubSearch.trim()
    ? courts.filter(court => court.name.toLowerCase().includes(hubSearch.toLowerCase()))
    : []

  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-4 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Filters</p>
        {activeFilterCount > 0 && (
          <button
            onClick={onClearAll}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" /> Clear all
          </button>
        )}
      </div>

      {/* ── Location ── */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Location / Court
        </p>

        {/* Quick-pick: user's own courts */}
        {currentUserHubs.length > 0 && (
          <div className="mb-2">
            <p className="text-[11px] text-muted-foreground mb-1.5">Your courts</p>
            <div className="flex flex-wrap gap-1.5">
              {currentUserHubs.map(hub => (
                <button
                  key={hub}
                  onClick={() => onToggleHub(hub)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    selectedHubs.includes(hub)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-secondary text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  )}
                >
                  <MapPin className="h-3 w-3 shrink-0" />
                  {courtNameMap[hub] ?? hub}
                  {selectedHubs.includes(hub) && <X className="h-3 w-3 ml-0.5" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Searchable input for all other hubs */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            placeholder="Search courts…"
            value={hubSearch}
            onChange={e => setHubSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
          {hubSearch && (
            <button
              onClick={() => setHubSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <div className="mt-1 rounded-md border border-border bg-popover shadow-md overflow-hidden">
            {searchResults.map(court => (
              <button
                key={court.id}
                onClick={() => { onToggleHub(court.id); setHubSearch('') }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-accent',
                  selectedHubs.includes(court.id) && 'bg-primary/10 text-primary'
                )}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                {court.name}
                {selectedHubs.includes(court.id) && <X className="h-3 w-3 ml-auto" />}
              </button>
            ))}
          </div>
        )}

        {hubSearch.trim() && searchResults.length === 0 && (
          <p className="mt-1.5 text-xs text-muted-foreground px-1">No courts match "{hubSearch}"</p>
        )}

        {/* Active selections chip strip */}
        {selectedHubs.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selectedHubs.map(hub => (
              <span
                key={hub}
                className="inline-flex items-center gap-1 rounded-md bg-primary/15 text-primary text-[11px] px-2 py-0.5 font-medium"
              >
                {courtNameMap[hub] ?? hub}
                <button onClick={() => onToggleHub(hub)} aria-label={`Remove ${hub}`}>
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Elo Range ── */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Elo Range
        </p>
        <div className="flex items-end gap-3">
          <EloRangeInput label="Min" value={eloMin} onChange={onEloMinChange} placeholder="e.g. 900" />
          <span className="text-muted-foreground mb-1.5 text-sm">–</span>
          <EloRangeInput label="Max" value={eloMax} onChange={onEloMaxChange} placeholder="e.g. 1400" />
          {(eloMin || eloMax) && (
            <button
              onClick={() => { onEloMinChange(''); onEloMaxChange('') }}
              className="mb-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DiscoverScreen (main)
// ---------------------------------------------------------------------------
interface DiscoverScreenProps {
  onChallenge: (player: DiscoverPlayer) => void
  onViewProfile: (player: DiscoverPlayer) => void
  onMessage: (player: DiscoverPlayer) => void
}

export function DiscoverScreen({ onChallenge, onViewProfile, onMessage }: DiscoverScreenProps) {
  const [players, setPlayers] = useState<DiscoverPlayer[]>([])
  const [courts, setCourts] = useState<Court[]>([])
  const [currentUserElo, setCurrentUserElo] = useState<number | null>(null)
  const [currentUserHubs, setCurrentUserHubs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedHubs, setSelectedHubs] = useState<string[]>([])
  const [eloMin, setEloMin] = useState('')
  const [eloMax, setEloMax] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Navigation helpers – wired to app shell callbacks
  const handleViewProfile = (player: DiscoverPlayer) => {
    onViewProfile(player)
  }

  const handleMessage = (player: DiscoverPlayer) => {
    onMessage(player)
  }

  useEffect(() => {
    const loadDiscoveryData = async () => {
      try {
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
            .select('elo_rating, geographic_hubs')
            .eq('id', user.id)
            .single()
          if (profile) {
            setCurrentUserElo(profile.elo_rating)
            setCurrentUserHubs(profile.geographic_hubs ?? [])
          }
        }

        const [courtsResult, profilesResult] = await Promise.all([
          supabase.from('courts').select('id, name').order('name'),
          supabase.from('profiles').select('id, name, avatar_url, elo_rating, bio, open_to_challenges, geographic_hubs').neq('id', currentUserId).order('name', { ascending: true })
        ])

        if (!courtsResult.error && courtsResult.data) setCourts(courtsResult.data as Court[])

        const { data, error } = profilesResult

        if (error) {
          console.error('Error hydrating discovery directory lists:', error.message || error, JSON.stringify(error))
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

  const courtNameMap = Object.fromEntries(courts.map(court => [court.id, court.name]))

  const activeFilterCount = selectedHubs.length + (eloMin ? 1 : 0) + (eloMax ? 1 : 0)

  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesHub =
      selectedHubs.length === 0 ||
      player.geographic_hubs?.some(hub => selectedHubs.includes(hub))
    const elo = player.elo_rating
    const matchesEloMin = eloMin === '' || elo >= parseInt(eloMin, 10)
    const matchesEloMax = eloMax === '' || elo <= parseInt(eloMax, 10)
    return matchesSearch && matchesHub && matchesEloMin && matchesEloMax
  })

  const suggestedPlayers = players
    .filter(p => p.open_to_challenges)
    .filter(p => currentUserElo === null || Math.abs(p.elo_rating - currentUserElo) <= 150)
    .slice(0, 3)

  const toggleHub = (hub: string) => {
    setSelectedHubs(prev =>
      prev.includes(hub) ? prev.filter(h => h !== hub) : [...prev, hub]
    )
  }

  const clearAllFilters = () => {
    setSelectedHubs([])
    setEloMin('')
    setEloMax('')
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

        {/* Search & Filter Row */}
        <div className="mb-4 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search players..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
              disabled={loading}
            />
          </div>

          <Button
            variant={showFilters ? 'default' : 'outline'}
            onClick={() => setShowFilters(v => !v)}
            className="gap-2 shrink-0"
            disabled={loading}
            aria-expanded={showFilters}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 border-none h-4 min-w-4 px-1 text-[10px]">
                {activeFilterCount}
              </Badge>
            )}
            {showFilters
              ? <ChevronUp className="h-3.5 w-3.5 ml-0.5 opacity-70" />
              : <ChevronDown className="h-3.5 w-3.5 ml-0.5 opacity-70" />
            }
          </Button>
        </div>

        {/* Active filter summary chips (when panel is collapsed) */}
        {!showFilters && activeFilterCount > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-muted-foreground">Filtered by:</span>
            {selectedHubs.map(hub => (
              <span
                key={hub}
                className="inline-flex items-center gap-1 rounded-md bg-primary/15 text-primary text-[11px] px-2 py-0.5 font-medium"
              >
                <MapPin className="h-2.5 w-2.5" />
                {courtNameMap[hub] ?? hub}
                <button onClick={() => toggleHub(hub)} aria-label={`Remove ${courtNameMap[hub] ?? hub}`}>
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            {(eloMin || eloMax) && (
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 text-primary text-[11px] px-2 py-0.5 font-medium">
                Elo {eloMin || '…'}–{eloMax || '…'}
                <button onClick={() => { setEloMin(''); setEloMax('') }} aria-label="Remove Elo filter">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )}
            <button
              onClick={clearAllFilters}
              className="text-[11px] text-muted-foreground hover:text-foreground underline ml-1"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Expanded Filter Panel */}
        {showFilters && (
          <FilterPanel
            selectedHubs={selectedHubs}
            onToggleHub={toggleHub}
            eloMin={eloMin}
            eloMax={eloMax}
            onEloMinChange={setEloMin}
            onEloMaxChange={setEloMax}
            onClearAll={clearAllFilters}
            activeFilterCount={activeFilterCount}
            currentUserHubs={currentUserHubs}
            courts={courts}
          />
        )}

        {loading ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            Searching local tennis registry…
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">

            {/* Main Player Grid */}
            <div className="lg:col-span-2">
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {activeFilterCount > 0 ? 'Filtered Results' : 'All Opponents'}{' '}
                <span className="text-foreground">({filteredPlayers.length})</span>
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                {filteredPlayers.map(player => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    onChallenge={onChallenge}
                    onViewProfile={handleViewProfile}
                    onMessage={handleMessage}
                    currentUserHubs={currentUserHubs}
                    courtNameMap={courtNameMap}
                  />
                ))}
              </div>

              {filteredPlayers.length === 0 && (
                <div className="py-12 text-center border border-dashed border-border rounded-lg">
                  <p className="text-muted-foreground text-sm">
                    No players match your current filters
                  </p>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearAllFilters}
                      className="mt-2 text-xs text-primary hover:underline"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar – Suggested Matches */}
            <div className="hidden lg:block">
              <div className="sticky top-20">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Suggested Matches
                </h3>
                {suggestedPlayers.length > 0 ? (
                  <div className="space-y-3">
                    {suggestedPlayers.map(player => (
                      <SuggestedPlayer
                        key={player.id}
                        player={player}
                        onChallenge={onChallenge}
                        onViewProfile={handleViewProfile}
                        courtNameMap={courtNameMap}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="p-4 border border-border bg-card rounded-lg text-center text-xs text-muted-foreground">
                    No active players in your immediate Elo range right now.
                  </div>
                )}
                <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
                  Automatically curated based on a ±150 Elo skill match.
                </p>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  )
}