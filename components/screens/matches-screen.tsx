'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/utils/supabase/client'
import {
  Calendar as CalendarIcon, MapPin, Check, AlertCircle, X, Clock,
  Edit2, Trophy, Loader2, Search, ChevronDown, ChevronRight, Plus, Swords
} from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

interface Court {
  id: string
  name: string
}

const timeSlots = [
  '6:00 AM','7:00 AM','8:00 AM','9:00 AM','10:00 AM','11:00 AM',
  '12:00 PM','1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM',
  '6:00 PM','7:00 PM','8:00 PM','9:00 PM',
]

const EX = '!'
const MATCH_QUERY = [
  '*',
  `home_player:profiles${EX}home_player_id(id, name, avatar_url, elo_rating, geographic_hubs)`,
  `away_player:profiles${EX}away_player_id(id, name, avatar_url, elo_rating, geographic_hubs)`,
].join(',')

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchProfile {
  id: string
  name: string
  avatar_url: string
  elo_rating: number
  geographic_hubs?: string[]
}

interface MatchRecord {
  id: string
  home_player_id: string
  away_player_id: string
  status: string
  proposed_location: string
  scheduled_time: string
  home_set_scores: number[]
  away_set_scores: number[]
  score_last_edited_by: string
  home_player: MatchProfile
  away_player: MatchProfile
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatTimeSlot(isoString?: string) {
  if (!isoString) return ''
  const dt = new Date(isoString)
  const hours = dt.getHours()
  const minutes = dt.getMinutes()
  const meridiem = hours >= 12 ? 'PM' : 'AM'
  const normalized = hours % 12 === 0 ? 12 : hours % 12
  return `${normalized}:${minutes.toString().padStart(2, '0')} ${meridiem}`
}

function combineDateAndTime(date: string, timeSlot: string) {
  if (!date) return ''
  if (!timeSlot) return new Date(`${date}T00:00:00`).toISOString()
  const [time, meridiem] = timeSlot.split(' ')
  let [hours, minutes] = time.split(':').map(Number)
  if (meridiem === 'PM' && hours !== 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0
  return new Date(`${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`).toISOString()
}

function getDateBounds() {
  const today = new Date()
  const nextYear = new Date()
  nextYear.setFullYear(today.getFullYear() + 1)
  return { min: today.toISOString().split('T')[0], max: nextYear.toISOString().split('T')[0] }
}

function formatMatchDate(isoString?: string) {
  if (!isoString) return 'TBD'
  const dt = new Date(isoString)
  const now = new Date()
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
  if (dt.toDateString() === now.toDateString()) return 'Today'
  if (dt.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatScore(homeScores: number[], awayScores: number[]) {
  if (!homeScores?.length) return ''
  return homeScores.map((s, i) => `${s}–${awayScores[i]}`).join(', ')
}

function getInitials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

// ─── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">{label}</span>
      {count !== undefined && (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">
          {count}
        </span>
      )}
    </div>
  )
}

// ─── Court Selector ────────────────────────────────────────────────────────────

function CourtSelector({ homeProfile, awayProfile, value, onChange }: {
  homeProfile?: MatchProfile
  awayProfile?: MatchProfile
  value: string
  onChange: (val: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [courts, setCourts] = useState<Court[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadCourts = async () => {
      const { data, error } = await supabase.from('courts').select('id, name').order('name')
      if (!error && data) setCourts(data as Court[])
    }
    loadCourts()
  }, [])

  const courtNameMap = useMemo(() => Object.fromEntries(courts.map(court => [court.id, court.name])), [courts])
  const homeHubs = (homeProfile?.geographic_hubs || []).map((hub) => courtNameMap[hub] ?? hub)
  const awayHubs = (awayProfile?.geographic_hubs || []).map((hub) => courtNameMap[hub] ?? hub)
  const availableHubs = useMemo(() => Array.from(new Set([...courts.map(court => court.name), ...homeHubs, ...awayHubs])), [courts, homeHubs, awayHubs])
  const suggestions = useMemo(() => {
    const shared = homeHubs.filter(h => awayHubs.includes(h))
    if (shared.length > 0) return shared
    if (homeHubs.length > 0) return homeHubs
    return courts.map(court => court.name)
  }, [courts, homeHubs, awayHubs])
  const filteredHubs = useMemo(() => {
    const trimmed = search.trim()
    return trimmed ? availableHubs.filter(h => h.toLowerCase().includes(trimmed.toLowerCase())) : availableHubs
  }, [availableHubs, search])

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-border bg-muted/40 px-3 text-sm text-foreground transition-colors hover:bg-muted/60"
      >
        <span className={cn('truncate', !value && 'text-muted-foreground')}>{value || 'Select location'}</span>
        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground ml-2" />
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
          <div className="border-b border-border/60 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search courts…" className="h-8 pl-8 text-xs" />
            </div>
          </div>
          <div className="max-h-52 overflow-auto p-1">
            {(search ? filteredHubs : suggestions).map(hub => (
              <button key={hub} type="button" onClick={() => { onChange(hub); setIsOpen(false); setSearch('') }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs hover:bg-accent text-left">
                <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />{hub}
              </button>
            ))}
            {!search && suggestions.length < availableHubs.length && (
              <>
                <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase mt-1">All courts</div>
                {availableHubs.filter(h => !suggestions.includes(h)).map(hub => (
                  <button key={hub} type="button" onClick={() => { onChange(hub); setIsOpen(false); setSearch('') }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs hover:bg-accent text-left">
                    <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />{hub}
                  </button>
                ))}
              </>
            )}
            {search && filteredHubs.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">No courts found</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Date + Time Inline Pickers ─────────────────────────────────────────────

function MatchDateTimePicker({ selectedDate, setSelectedDate, editTime, setEditTime }: {
  selectedDate: Date | undefined
  setSelectedDate: (d: Date | undefined) => void
  editTime: string
  setEditTime: (t: string) => void
}) {
  const dateBounds = getDateBounds()
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between border-border bg-muted/40 text-left text-xs h-10 font-normal">
              <span className={selectedDate ? 'text-foreground' : 'text-muted-foreground'}>
                {selectedDate ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pick date'}
              </span>
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-50">
            <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate}
              disabled={{ before: new Date(dateBounds.min), after: new Date(dateBounds.max) }}
              fromDate={new Date(dateBounds.min)} toDate={new Date(dateBounds.max)} className="border-0 bg-background" />
          </PopoverContent>
        </Popover>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Time</label>
        <Select value={editTime} onValueChange={setEditTime}>
          <SelectTrigger className="w-full border-border bg-muted/40 text-foreground text-xs h-10">
            <SelectValue placeholder="Choose time" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border text-foreground">
            {timeSlots.map(slot => (
              <SelectItem key={slot} value={slot} className="text-xs cursor-pointer">{slot}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

// ─── Score Grid ───────────────────────────────────────────────────────────────

function ScoreGrid({ homePlayer, awayPlayer, homeScores, awayScores, setHomeScores, setAwayScores, currentUserId }: {
  homePlayer: MatchProfile
  awayPlayer: MatchProfile
  homeScores: string[]
  awayScores: string[]
  setHomeScores: (s: string[]) => void
  setAwayScores: (s: string[]) => void
  currentUserId: string | null
}) {
  const isHome = homePlayer.id === currentUserId
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_52px_52px_52px] gap-2 items-center">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Player</div>
        {['Set 1', 'Set 2', 'Set 3'].map(s => (
          <div key={s} className="text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s}</div>
        ))}
      </div>
      {[
        { player: homePlayer, scores: homeScores, setter: setHomeScores, isYou: isHome },
        { player: awayPlayer, scores: awayScores, setter: setAwayScores, isYou: !isHome },
      ].map(({ player, scores, setter, isYou }) => (
        <div key={player.id} className="grid grid-cols-[1fr_52px_52px_52px] gap-2 items-center">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarImage src={player.avatar_url} />
              <AvatarFallback className="text-[10px]">{getInitials(player.name)}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-semibold truncate">{player.name}{isYou ? <span className="text-muted-foreground font-normal"> (you)</span> : ''}</span>
          </div>
          {[0, 1, 2].map(i => (
            <Input key={i} type="number" min="0" max="99" value={scores[i]}
              onChange={e => { const n = [...scores]; n[i] = e.target.value; setter(n) }}
              className="h-10 w-full text-center px-1 font-black text-base bg-muted/40 border-border" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── ACTION REQUIRED: Pending Score Card ──────────────────────────────────────

function PendingScoreCard({ match, currentUserId, onApprove, onDispute }: {
  match: MatchRecord
  currentUserId: string | null
  onApprove: (id: string) => void
  onDispute: (id: string, homeScores: number[], awayScores: number[]) => void
}) {
  const [isDisputing, setIsDisputing] = useState(false)
  const [homeScores, setHomeScores] = useState<string[]>(
    match.home_set_scores?.map(String) || ['', '', '']
  )
  const [awayScores, setAwayScores] = useState<string[]>(
    match.away_set_scores?.map(String) || ['', '', '']
  )

  const handleSubmitDispute = () => {
    const finalHome = homeScores.map(s => parseInt(s)).filter(n => !isNaN(n))
    const finalAway = awayScores.map(s => parseInt(s)).filter(n => !isNaN(n))
    if (finalHome.length > 0 && finalHome.length === finalAway.length) {
      onDispute(match.id, finalHome, finalAway)
      setIsDisputing(false)
    }
  }

  const scoreString = formatScore(match.home_set_scores, match.away_set_scores)
  const playedDate = match.scheduled_time
    ? `Played ${new Date(match.scheduled_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : ''

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Alert banner */}
      <div className="flex items-center justify-between gap-3 bg-muted/30 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/30">
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Score pending verification</p>
            <p className="text-xs text-muted-foreground">Please verify and approve the final score.</p>
          </div>
        </div>
        {!isDisputing && (
          <Button
            onClick={() => onApprove(match.id)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-9 px-4 shrink-0 rounded-lg"
            size="sm"
          >
            Verify Score
          </Button>
        )}
      </div>

      {/* Players + score row */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Home player */}
          <div className="flex items-center gap-2.5">
            <Avatar className="h-9 w-9 border-2 border-border">
              <AvatarImage src={match.home_player?.avatar_url} />
              <AvatarFallback>{getInitials(match.home_player?.name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-foreground leading-none">{match.home_player?.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">@{match.home_player?.name?.toLowerCase().replace(/\s/g, '.')}</p>
            </div>
          </div>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">vs</span>
          {/* Away player */}
          <div className="flex items-center gap-2.5">
            <Avatar className="h-9 w-9 border-2 border-border">
              <AvatarImage src={match.away_player?.avatar_url} />
              <AvatarFallback>{getInitials(match.away_player?.name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-foreground leading-none">{match.away_player?.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">@{match.away_player?.name?.toLowerCase().replace(/\s/g, '.')}</p>
            </div>
          </div>
        </div>
        <div className="text-right shrink-0 ml-3">
          <p className="text-base font-black text-foreground tabular-nums">{scoreString}</p>
          {playedDate && <p className="text-[11px] text-muted-foreground">{playedDate}</p>}
        </div>
      </div>

      {/* Dispute section */}
      {!isDisputing ? (
        <div className="px-4 pb-3">
          <button
            onClick={() => setIsDisputing(true)}
            className="text-xs font-semibold text-destructive hover:underline"
          >
            Dispute score
          </button>
        </div>
      ) : (
        <div className="border-t border-border/60 bg-destructive/5 px-4 py-4 space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-semibold text-destructive">Edit disputed score</span>
          </div>
          <ScoreGrid
            homePlayer={match.home_player}
            awayPlayer={match.away_player}
            homeScores={homeScores}
            awayScores={awayScores}
            setHomeScores={setHomeScores}
            setAwayScores={setAwayScores}
            currentUserId={currentUserId}
          />
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" className="flex-1 h-9 text-xs" onClick={() => setIsDisputing(false)}>
              Cancel
            </Button>
            <Button size="sm" className="flex-1 h-9 text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold" onClick={handleSubmitDispute}>
              Submit Dispute
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── RECEIVED INVITES: Request Card ──────────────────────────────────────────

function ReceivedRequestCard({ match, onAction }: {
  match: MatchRecord
  onAction: (id: string, action: 'accepted' | 'declined') => void
}) {
  const [expanded, setExpanded] = useState(true)

  const dateLabel = formatMatchDate(match.scheduled_time)
  const timeLabel = formatTimeSlot(match.scheduled_time)
  const locationParts = match.proposed_location?.split(' ') || []
  const locationMain = locationParts.slice(0, -2).join(' ') || match.proposed_location || 'TBD'
  const locationSub = locationParts.slice(-2).join(' ') || ''

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-border">
            <AvatarImage src={match.home_player?.avatar_url} />
            <AvatarFallback>{getInitials(match.home_player?.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-bold text-foreground">Challenge from {match.home_player?.name}</p>
            <p className="text-xs text-muted-foreground">Elo: {match.home_player?.elo_rating}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{dateLabel}</span>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
        </div>
      </button>

      {/* Details */}
      {expanded && (
        <>
          <div className="grid grid-cols-2 gap-px bg-border mx-4 mb-3 rounded-xl overflow-hidden border border-border">
            <div className="bg-card px-4 py-3 flex items-center gap-3">
              <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">{dateLabel !== 'TBD' ? new Date(match.scheduled_time).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD'}</p>
                <p className="text-xs text-muted-foreground">{match.scheduled_time ? new Date(match.scheduled_time).toLocaleDateString('en-US', { weekday: 'long' }) + ' • ' + timeLabel : 'Time TBD'}</p>
              </div>
            </div>
            <div className="bg-card px-4 py-3 flex items-center gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">{locationMain}</p>
                <p className="text-xs text-muted-foreground">{locationSub || 'Courts'}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 px-4 pb-4">
            <Button
              variant="outline"
              className="h-11 font-semibold border-border hover:bg-muted/40"
              onClick={() => onAction(match.id, 'declined')}
            >
              Decline
            </Button>
            <Button
              className="h-11 font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              onClick={() => onAction(match.id, 'accepted')}
            >
              <Check className="h-4 w-4" /> Accept
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── SCHEDULED MATCHES: Upcoming Card ─────────────────────────────────────────

function UpcomingMatchCard({ match, currentUserId, onCancel, onUpdateDetails, onSubmitScore }: {
  match: MatchRecord
  currentUserId: string | null
  onCancel: () => void
  onUpdateDetails: (loc: string, scheduledTime: string) => void
  onSubmitScore: (h: number[], a: number[]) => void
}) {
  const isHome = match.home_player_id === currentUserId
  const me = isHome ? match.home_player : match.away_player
  const opponent = isHome ? match.away_player : match.home_player

  const [isEditing, setIsEditing] = useState(false)
  const [isScoring, setIsScoring] = useState(false)
  const [editLoc, setEditLoc] = useState(match.proposed_location || '')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(match.scheduled_time ? new Date(match.scheduled_time) : undefined)
  const [editTime, setEditTime] = useState(formatTimeSlot(match.scheduled_time))
  const [homeScores, setHomeScores] = useState<string[]>(['', '', ''])
  const [awayScores, setAwayScores] = useState<string[]>(['', '', ''])

  const handleSaveDetails = () => {
    const dateValue = selectedDate ? selectedDate.toISOString().split('T')[0] : ''
    const updatedScheduledTime = dateValue ? combineDateAndTime(dateValue, editTime) : match.scheduled_time || ''
    onUpdateDetails(editLoc, updatedScheduledTime)
    setIsEditing(false)
  }

  const handleSaveScore = () => {
    const finalHome = homeScores.map(s => parseInt(s)).filter(n => !isNaN(n))
    const finalAway = awayScores.map(s => parseInt(s)).filter(n => !isNaN(n))
    if (finalHome.length > 0 && finalHome.length === finalAway.length) {
      onSubmitScore(finalHome, finalAway)
      setIsScoring(false)
    }
  }

  const dateLabel = formatMatchDate(match.scheduled_time)
  const timeLabel = formatTimeSlot(match.scheduled_time)

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Main row */}
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          {/* Overlapping avatars */}
          <div className="relative flex shrink-0">
            <Avatar className="h-9 w-9 border-2 border-card">
              <AvatarImage src={me?.avatar_url} />
              <AvatarFallback className="text-xs">{getInitials(me?.name)}</AvatarFallback>
            </Avatar>
            <Avatar className="h-9 w-9 border-2 border-card -ml-3">
              <AvatarImage src={opponent?.avatar_url} />
              <AvatarFallback className="text-xs">{getInitials(opponent?.name)}</AvatarFallback>
            </Avatar>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">
              {me?.name} <span className="font-normal text-muted-foreground">with</span> {opponent?.name}
            </p>
            <p className="text-xs text-muted-foreground truncate">{match.proposed_location || 'TBD'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-2">
          <div className="text-right">
            <p className="text-sm font-bold text-foreground">{dateLabel}</p>
            <p className="text-xs text-muted-foreground">{timeLabel || 'Time TBD'}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Edit details */}
      {isEditing && (
        <div className="border-t border-border/60 bg-muted/20 px-4 py-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Edit Match Details</p>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Location</label>
            <CourtSelector homeProfile={match.home_player} awayProfile={match.away_player} value={editLoc} onChange={setEditLoc} />
          </div>
          <MatchDateTimePicker selectedDate={selectedDate} setSelectedDate={setSelectedDate} editTime={editTime} setEditTime={setEditTime} />
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" className="flex-1 h-9 text-xs" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button size="sm" className="flex-1 h-9 text-xs font-bold" onClick={handleSaveDetails}>Save Updates</Button>
          </div>
        </div>
      )}

      {/* Score reporting */}
      {isScoring && (
        <div className="border-t border-border/60 bg-muted/20 px-4 py-4 space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Report Final Score</span>
          </div>
          <ScoreGrid
            homePlayer={match.home_player}
            awayPlayer={match.away_player}
            homeScores={homeScores}
            awayScores={awayScores}
            setHomeScores={setHomeScores}
            setAwayScores={setAwayScores}
            currentUserId={currentUserId}
          />
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" className="flex-1 h-9 text-xs" onClick={() => setIsScoring(false)}>Cancel</Button>
            <Button size="sm" className="flex-1 h-9 text-xs bg-primary font-bold" onClick={handleSaveScore}>Submit Score</Button>
          </div>
        </div>
      )}

      {/* Action buttons (bottom bar) */}
      {!isEditing && !isScoring && (
        <div className="flex border-t border-border/60">
          <button
            onClick={() => setIsScoring(true)}
            className="flex flex-1 items-center justify-center gap-2 py-3 text-xs font-bold text-primary hover:bg-primary/5 transition-colors border-r border-border/60"
          >
            <Trophy className="h-3.5 w-3.5" /> Report Score
          </button>
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center justify-center px-4 py-3 text-xs text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors border-r border-border/60"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onCancel}
            className="flex items-center justify-center px-4 py-3 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── COMPLETED: Report Score Card ─────────────────────────────────────────────

function CompletedReportCard({ match, currentUserId, onSubmitScore, onCancel }: {
  match: MatchRecord
  currentUserId: string | null
  onSubmitScore: (h: number[], a: number[]) => void
  onCancel: () => void
}) {
  const isHome = match.home_player_id === currentUserId
  const me = isHome ? match.home_player : match.away_player
  const opponent = isHome ? match.away_player : match.home_player
  const [isScoring, setIsScoring] = useState(false)
  const [homeScores, setHomeScores] = useState<string[]>(['', '', ''])
  const [awayScores, setAwayScores] = useState<string[]>(['', '', ''])

  const handleSaveScore = () => {
    const finalHome = homeScores.map(s => parseInt(s)).filter(n => !isNaN(n))
    const finalAway = awayScores.map(s => parseInt(s)).filter(n => !isNaN(n))
    if (finalHome.length > 0 && finalHome.length === finalAway.length) {
      onSubmitScore(finalHome, finalAway)
      setIsScoring(false)
    }
  }

  const dateLabel = formatMatchDate(match.scheduled_time)
  const timeLabel = formatTimeSlot(match.scheduled_time)

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Main row */}
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex shrink-0">
            <Avatar className="h-9 w-9 border-2 border-card">
              <AvatarImage src={me?.avatar_url} />
              <AvatarFallback className="text-xs">{getInitials(me?.name)}</AvatarFallback>
            </Avatar>
            <Avatar className="h-9 w-9 border-2 border-card -ml-3">
              <AvatarImage src={opponent?.avatar_url} />
              <AvatarFallback className="text-xs">{getInitials(opponent?.name)}</AvatarFallback>
            </Avatar>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">
              {me?.name} <span className="font-normal text-muted-foreground">vs</span> {opponent?.name}
            </p>
            <p className="text-xs text-muted-foreground truncate">{match.proposed_location || 'TBD'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <div className="text-right">
            <p className="text-sm font-bold text-foreground">{dateLabel}</p>
            <p className="text-xs text-muted-foreground">{timeLabel || 'Time TBD'}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Score reporting */}
      {isScoring ? (
        <div className="border-t border-border/60 bg-muted/20 px-4 py-4 space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Report Final Score</span>
          </div>
          <ScoreGrid
            homePlayer={match.home_player}
            awayPlayer={match.away_player}
            homeScores={homeScores}
            awayScores={awayScores}
            setHomeScores={setHomeScores}
            setAwayScores={setAwayScores}
            currentUserId={currentUserId}
          />
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" className="flex-1 h-9 text-xs" onClick={() => setIsScoring(false)}>Cancel</Button>
            <Button size="sm" className="flex-1 h-9 text-xs bg-primary font-bold" onClick={handleSaveScore}>Submit Score</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 bg-muted/10">
          <div>
            <p className="text-sm font-bold text-foreground">Match finished?</p>
            <p className="text-xs text-muted-foreground">Report the score to update your ELO.</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-primary text-primary font-bold hover:bg-primary/10 h-9 px-4"
            onClick={() => setIsScoring(true)}
          >
            Report Score
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── SENT REQUESTS ─────────────────────────────────────────────────────────────

function SentRequestCard({ match, onCancel, onUpdateDetails }: {
  match: MatchRecord
  onCancel: () => void
  onUpdateDetails: (loc: string, scheduledTime: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editLoc, setEditLoc] = useState(match.proposed_location || '')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(match.scheduled_time ? new Date(match.scheduled_time) : undefined)
  const [editTime, setEditTime] = useState(formatTimeSlot(match.scheduled_time))

  const handleSave = () => {
    const dateValue = selectedDate ? selectedDate.toISOString().split('T')[0] : ''
    const updatedScheduledTime = dateValue ? combineDateAndTime(dateValue, editTime) : match.scheduled_time || ''
    onUpdateDetails(editLoc, updatedScheduledTime)
    setIsEditing(false)
  }

  const dateLabel = formatMatchDate(match.scheduled_time)
  const timeLabel = formatTimeSlot(match.scheduled_time)

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-9 w-9 border border-border">
            <AvatarImage src={match.away_player?.avatar_url} />
            <AvatarFallback>{getInitials(match.away_player?.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">Waiting on {match.away_player?.name}</p>
            <p className="text-xs text-muted-foreground">{dateLabel} {timeLabel ? `• ${timeLabel}` : ''} {match.proposed_location ? `• ${match.proposed_location}` : ''}</p>
          </div>
        </div>
        <div className="flex gap-1 shrink-0 ml-2">
          <button onClick={() => setIsEditing(!isEditing)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors">
            <Edit2 className="h-4 w-4" />
          </button>
          <button onClick={onCancel} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {isEditing && (
        <div className="border-t border-border/60 bg-muted/20 px-4 py-4 space-y-3">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Location</label>
            <CourtSelector homeProfile={match.home_player} awayProfile={match.away_player} value={editLoc} onChange={setEditLoc} />
          </div>
          <MatchDateTimePicker selectedDate={selectedDate} setSelectedDate={setSelectedDate} editTime={editTime} setEditTime={setEditTime} />
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" className="flex-1 h-9 text-xs" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button size="sm" className="flex-1 h-9 text-xs font-bold" onClick={handleSave}>Save Updates</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── NEW MATCH MODAL ────────────────────────────────────────────────────────────

function NewMatchModal({ currentUserId, onClose, onCreated }: {
  currentUserId: string | null
  onClose: () => void
  onCreated: () => void
}) {
  const [playerSearch, setPlayerSearch] = useState('')
  const [searchResults, setSearchResults] = useState<MatchProfile[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<MatchProfile | null>(null)
  const [currentUserProfile, setCurrentUserProfile] = useState<MatchProfile | null>(null)
  const [location, setLocation] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState('')
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load current user's profile for CourtSelector
  useEffect(() => {
    if (!currentUserId) return
    supabase.from('profiles').select('id, name, avatar_url, elo_rating, geographic_hubs').eq('id', currentUserId).single()
      .then(({ data }) => { if (data) setCurrentUserProfile(data as MatchProfile) })
  }, [currentUserId])

  // Debounced player search
  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current)
    if (!playerSearch.trim() || playerSearch.length < 2) { setSearchResults([]); return }
    setSearching(true)
    searchRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, elo_rating')
        .neq('id', currentUserId)
        .ilike('name', `%${playerSearch}%`)
        .limit(8)
      setSearchResults((data as MatchProfile[]) || [])
      setSearching(false)
    }, 300)
  }, [playerSearch, currentUserId])

  const handleSubmit = async () => {
    if (!selectedPlayer || !currentUserId) return
    setSubmitting(true)
    const dateValue = selectedDate ? selectedDate.toISOString().split('T')[0] : ''
    const scheduledTime = dateValue ? combineDateAndTime(dateValue, selectedTime) : null
    const { error } = await supabase.from('matches').insert({
      home_player_id: currentUserId,
      away_player_id: selectedPlayer.id,
      status: 'pending',
      proposed_location: location || null,
      scheduled_time: scheduledTime,
    })
    setSubmitting(false)
    if (!error) { onCreated(); onClose() }
  }

  const isValid = !!selectedPlayer

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-card border border-border rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Swords className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">New Match</h2>
              <p className="text-xs text-muted-foreground">Schedule a match with another player</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Player search */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Opponent</label>
            {selectedPlayer ? (
              <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedPlayer.avatar_url} />
                    <AvatarFallback>{getInitials(selectedPlayer.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{selectedPlayer.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedPlayer.elo_rating} Elo</p>
                  </div>
                </div>
                <button onClick={() => setSelectedPlayer(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={playerSearch}
                  onChange={e => setPlayerSearch(e.target.value)}
                  placeholder="Search by name…"
                  className="pl-9 h-10 bg-muted/40 border-border"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground animate-spin" />
                )}
                {searchResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
                    {searchResults.map(player => (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => { setSelectedPlayer(player); setPlayerSearch(''); setSearchResults([]) }}
                        className="flex w-full items-center gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left"
                      >
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={player.avatar_url} />
                          <AvatarFallback className="text-xs">{getInitials(player.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{player.name}</p>
                          <p className="text-xs text-muted-foreground">{player.elo_rating} Elo</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Location */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Location <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span></label>
            <CourtSelector
              homeProfile={currentUserProfile || undefined}
              awayProfile={selectedPlayer || undefined}
              value={location}
              onChange={setLocation}
            />
          </div>

          {/* Date + Time */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Schedule <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span></label>
            <MatchDateTimePicker
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              editTime={selectedTime}
              setEditTime={setSelectedTime}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border">
          <Button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="w-full h-11 font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-2 rounded-xl"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
            Send Match Invite
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

export function MatchesScreen() {
  const [upcomingMatches, setUpcomingMatches] = useState<MatchRecord[]>([])
  const [pendingScores, setPendingScores] = useState<MatchRecord[]>([])
  const [receivedRequests, setReceivedRequests] = useState<MatchRecord[]>([])
  const [sentRequests, setSentRequests] = useState<MatchRecord[]>([])
  const [completedUnreported, setCompletedUnreported] = useState<MatchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showNewMatch, setShowNewMatch] = useState(false)

  const loadMatches = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setCurrentUserId(user.id)

    const { data, error } = await supabase
      .from('matches')
      .select(MATCH_QUERY)
      .or(`home_player_id.eq.${user.id},away_player_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (error) { console.error('Error fetching matches:', error); setLoading(false); return }

    const matchRows = (data ?? []) as unknown as MatchRecord[]

    // Matches where the *other* player submitted the score — I need to verify
    setPendingScores(matchRows.filter(m => m.status === 'completed' && m.score_last_edited_by !== user.id))
    // Matches where the *current* user submitted the score — waiting on other side
    setCompletedUnreported(matchRows.filter(m => m.status === 'accepted' &&
      new Date(m.scheduled_time) < new Date()))
    setReceivedRequests(matchRows.filter(m => m.status === 'pending' && m.away_player_id === user.id))
    setSentRequests(matchRows.filter(m => m.status === 'pending' && m.home_player_id === user.id))
    setUpcomingMatches(matchRows.filter(m => m.status === 'accepted' &&
      (!m.scheduled_time || new Date(m.scheduled_time) >= new Date())))
    setLoading(false)
  }

  useEffect(() => { loadMatches() }, [])

  const handleApproveScore = async (matchId: string) => {
    const { error } = await supabase.from('matches').update({ status: 'verified', score_submitted_at: new Date().toISOString() }).eq('id', matchId)
    if (!error) setPendingScores(prev => prev.filter(m => m.id !== matchId))
  }

  const handleDisputeScore = async (matchId: string, homeScores: number[], awayScores: number[]) => {
    if (!currentUserId) return
    const { error } = await supabase.from('matches').update({
      status: 'completed',
      home_set_scores: homeScores,
      away_set_scores: awayScores,
      score_last_edited_by: currentUserId,
    }).eq('id', matchId)
    if (!error) setPendingScores(prev => prev.filter(m => m.id !== matchId))
  }

  const handleRequestAction = async (matchId: string, action: 'accepted' | 'declined') => {
    setReceivedRequests(prev => prev.filter(m => m.id !== matchId))
    if (action === 'declined') {
      await supabase.from('matches').delete().eq('id', matchId)
    } else {
      const matchToUpdate = receivedRequests.find(m => m.id === matchId)
      if (matchToUpdate) {
        setUpcomingMatches(prev => [...prev, { ...matchToUpdate, status: 'accepted' }])
        await supabase.from('matches').update({ status: 'accepted' }).eq('id', matchId)
      }
    }
  }

  const handleCancelMatch = async (matchId: string, source: 'sent' | 'upcoming' | 'completed') => {
    if (source === 'sent') setSentRequests(prev => prev.filter(m => m.id !== matchId))
    if (source === 'upcoming') setUpcomingMatches(prev => prev.filter(m => m.id !== matchId))
    if (source === 'completed') setCompletedUnreported(prev => prev.filter(m => m.id !== matchId))
    await supabase.from('matches').delete().eq('id', matchId)
  }

  const handleUpdateMatchDetails = async (matchId: string, location: string, scheduledTime: string) => {
    await supabase.from('matches').update({ proposed_location: location, scheduled_time: scheduledTime }).eq('id', matchId)
    loadMatches()
  }

  const handleSubmitScore = async (matchId: string, homeScores: number[], awayScores: number[]) => {
    if (!currentUserId) return
    const { error } = await supabase.from('matches').update({
      status: 'completed',
      home_set_scores: homeScores,
      away_set_scores: awayScores,
      score_last_edited_by: currentUserId,
    }).eq('id', matchId)
    if (!error) loadMatches()
  }

  const actionCount = pendingScores.length + receivedRequests.length

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading matches…</p>
      </div>
    )
  }

  return (
    <>
      <main className="mx-auto max-w-2xl space-y-6 px-4 pt-4 pb-24">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-foreground tracking-tight">Matches</h1>
          <Button
            onClick={() => setShowNewMatch(true)}
            className="gap-1.5 h-9 font-bold bg-transparent border border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-xl transition-colors"
            size="sm"
          >
            <Plus className="h-4 w-4" /> New Match
          </Button>
        </div>

        {/* 1. Action Required */}
        {actionCount > 0 && (
          <section>
            <SectionHeader label="Action Required" count={actionCount} />
            <div className="space-y-3">
              {pendingScores.map(match => (
                <PendingScoreCard
                  key={match.id}
                  match={match}
                  currentUserId={currentUserId}
                  onApprove={handleApproveScore}
                  onDispute={handleDisputeScore}
                />
              ))}
              {receivedRequests.map(match => (
                <ReceivedRequestCard key={match.id} match={match} onAction={handleRequestAction} />
              ))}
            </div>
          </section>
        )}

        {/* 2. Scheduled Matches */}
        {upcomingMatches.length > 0 && (
          <section>
            <SectionHeader label="Scheduled Matches" count={upcomingMatches.length} />
            <div className="space-y-2">
              {upcomingMatches.map(match => (
                <UpcomingMatchCard
                  key={match.id}
                  match={match}
                  currentUserId={currentUserId}
                  onCancel={() => handleCancelMatch(match.id, 'upcoming')}
                  onUpdateDetails={(loc, t) => handleUpdateMatchDetails(match.id, loc, t)}
                  onSubmitScore={(h, a) => handleSubmitScore(match.id, h, a)}
                />
              ))}
            </div>
          </section>
        )}

        {/* 3. Completed – Report Score */}
        {completedUnreported.length > 0 && (
          <section>
            <SectionHeader label="Completed – Report Score" count={completedUnreported.length} />
            <div className="space-y-2">
              {completedUnreported.map(match => (
                <CompletedReportCard
                  key={match.id}
                  match={match}
                  currentUserId={currentUserId}
                  onSubmitScore={(h, a) => handleSubmitScore(match.id, h, a)}
                  onCancel={() => handleCancelMatch(match.id, 'completed')}
                />
              ))}
            </div>
          </section>
        )}

        {/* 4. Sent Requests */}
        {sentRequests.length > 0 && (
          <section>
            <SectionHeader label="Sent Requests" count={sentRequests.length} />
            <div className="space-y-2">
              {sentRequests.map(match => (
                <SentRequestCard
                  key={match.id}
                  match={match}
                  onCancel={() => handleCancelMatch(match.id, 'sent')}
                  onUpdateDetails={(loc, t) => handleUpdateMatchDetails(match.id, loc, t)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {actionCount === 0 && upcomingMatches.length === 0 && completedUnreported.length === 0 && sentRequests.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
            <Swords className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">No matches yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Challenge a player to get started</p>
          </div>
        )}

      </main>

      {/* New Match Modal */}
      {showNewMatch && (
        <NewMatchModal
          currentUserId={currentUserId}
          onClose={() => setShowNewMatch(false)}
          onCreated={loadMatches}
        />
      )}
    </>
  )
}