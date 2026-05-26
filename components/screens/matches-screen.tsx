'use client'

import { useState, useEffect, useMemo } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/utils/supabase/client'
import { Calendar as CalendarIcon, MapPin, Check, AlertCircle, X, Clock, Edit2, Trophy, Loader2, Search } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

// Global Default Courts
const GEOGRAPHIC_HUBS = [
  'Flat Iron Park (Sandy)',
  'Murray Park Courts',
  'Draper Indoor Hub',
  'Lone Peak Park'
]

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

const EX = '!'
const MATCH_QUERY = [
  '*',
  `home_player:profiles${EX}home_player_id(id, name, avatar_url, elo_rating, geographic_hubs)`,
  `away_player:profiles${EX}away_player_id(id, name, avatar_url, elo_rating, geographic_hubs)`
].join(',')

const timeSlots = [
  '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM'
]

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

// --- Utility function for Date Validation bounds ---
function getDateBounds() {
  const today = new Date()
  const nextYear = new Date()
  nextYear.setFullYear(today.getFullYear() + 1)
  
  return {
    min: today.toISOString().split('T')[0],
    max: nextYear.toISOString().split('T')[0]
  }
}

export function MatchesScreen() {
  const [upcomingMatches, setUpcomingMatches] = useState<MatchRecord[]>([])
  const [pendingScores, setPendingScores] = useState<MatchRecord[]>([])
  const [receivedRequests, setReceivedRequests] = useState<MatchRecord[]>([])
  const [sentRequests, setSentRequests] = useState<MatchRecord[]>([])
  
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const loadMatches = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    setCurrentUserId(user.id)

    const { data, error } = await supabase
      .from('matches')
      .select(MATCH_QUERY)
      .or(`home_player_id.eq.${user.id},away_player_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching system matches:', error)
      setLoading(false)
      return
    }

    const matchRows = (data ?? []) as unknown as MatchRecord[]

    setPendingScores(matchRows.filter(m => m.status === 'completed' && m.score_last_edited_by !== user.id))
    setReceivedRequests(matchRows.filter(m => m.status === 'pending' && m.away_player_id === user.id))
    setSentRequests(matchRows.filter(m => m.status === 'pending' && m.home_player_id === user.id))
    setUpcomingMatches(matchRows.filter(m => m.status === 'accepted'))
    
    setLoading(false)
  }

  useEffect(() => {
    loadMatches()
  }, [])

  const handleApproveScore = async (matchId: string) => {
    const { error } = await supabase.from('matches').update({ status: 'verified', score_submitted_at: new Date().toISOString() }).eq('id', matchId)
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

  const handleCancelMatch = async (matchId: string, source: 'sent' | 'upcoming') => {
    if (source === 'sent') setSentRequests(prev => prev.filter(m => m.id !== matchId))
    if (source === 'upcoming') setUpcomingMatches(prev => prev.filter(m => m.id !== matchId))
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
      score_last_edited_by: currentUserId
    }).eq('id', matchId)

    if (!error) {
       loadMatches() 
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground max-w-2xl mx-auto mt-6">
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
        Loading match dashboard...
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-4 pb-24 md:pb-8">
      
      {/* 1. Pending Score Approvals */}
      {pendingScores.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" /> Action Required: Approve Scores
          </h3>
          <div className="space-y-3">
            {pendingScores.map(match => (
              <PendingScoreCard key={match.id} match={match} onApprove={handleApproveScore} />
            ))}
          </div>
        </section>
      )}

      {/* 2. Received Requests */}
      {receivedRequests.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" /> Received Invites ({receivedRequests.length})
          </h3>
          <div className="space-y-3">
            {receivedRequests.map(match => (
              <ReceivedRequestCard key={match.id} match={match} onAction={handleRequestAction} />
            ))}
          </div>
        </section>
      )}

      {/* 3. Upcoming Scheduled Duels */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Upcoming Matches ({upcomingMatches.length})
        </h3>
        {upcomingMatches.length === 0 && receivedRequests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No active matches scheduled. Go to the Discover tab to challenge an opponent!
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingMatches.map(match => (
              <UpcomingMatchCard 
                 key={match.id} 
                 match={match} 
                 currentUserId={currentUserId}
                 onCancel={() => handleCancelMatch(match.id, 'upcoming')}
                 onUpdateDetails={(loc, scheduledTime) => handleUpdateMatchDetails(match.id, loc, scheduledTime)}
                 onSubmitScore={(hScores, aScores) => handleSubmitScore(match.id, hScores, aScores)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 4. Sent Requests */}
      {sentRequests.length > 0 && (
        <section className="space-y-3 pt-4 border-t border-border/50">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> Sent Requests ({sentRequests.length})
          </h3>
          <div className="space-y-3">
            {sentRequests.map(match => (
              <SentRequestCard 
                 key={match.id} 
                 match={match} 
                 onCancel={() => handleCancelMatch(match.id, 'sent')}
                 onUpdateDetails={(loc, scheduledTime) => handleUpdateMatchDetails(match.id, loc, scheduledTime)}
              />
            ))}
          </div>
        </section>
      )}

    </main>
  )
}

// --- SUB-COMPONENTS ---

function CourtSelector({ 
  homeProfile, 
  awayProfile, 
  value, 
  onChange 
}: { 
  homeProfile: MatchProfile; 
  awayProfile: MatchProfile; 
  value: string; 
  onChange: (val: string) => void 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')

  const homeHubs = homeProfile.geographic_hubs || []
  const awayHubs = awayProfile.geographic_hubs || []

  const availableHubs = useMemo(() => {
    return Array.from(new Set([...homeHubs, ...awayHubs, ...GEOGRAPHIC_HUBS]))
  }, [homeHubs, awayHubs])

  const suggestions = useMemo(() => {
    const shared = homeHubs.filter((hub) => awayHubs.includes(hub))
    if (shared.length > 0) return shared
    if (homeHubs.length > 0) return homeHubs
    return GEOGRAPHIC_HUBS
  }, [homeHubs, awayHubs])

  const filteredHubs = useMemo(() => {
    if (!search.trim()) return availableHubs
    return availableHubs.filter((hub) => hub.toLowerCase().includes(search.toLowerCase()))
  }, [availableHubs, search])

  return (
    <div className="relative">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-8 w-full cursor-pointer items-center justify-between rounded-md border border-input bg-background px-3 text-xs shadow-sm"
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
          {value || 'Select Location'}
        </span>
        <MapPin className="h-3 w-3 opacity-50" />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
          <div className="border-b border-border/60 px-3 py-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search courts"
                className="h-9 w-full rounded-md border border-input bg-background pl-9 text-sm"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-auto p-1">
            <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">
              {search ? 'Search results' : 'Suggested courts'}
            </div>
            {search && filteredHubs.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No courts found.</div>
            )}
            {(search ? filteredHubs : suggestions).map((hub) => (
              <div
                key={hub}
                onClick={() => {
                  onChange(hub)
                  setIsOpen(false)
                  setSearch('')
                }}
                className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-accent hover:text-accent-foreground"
              >
                <MapPin className="mr-2 h-3 w-3 text-muted-foreground" />
                {hub}
              </div>
            ))}
            {!search && (
              <>
                <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">All courts</div>
                {availableHubs.map((hub) => (
                  <div
                    key={hub}
                    onClick={() => {
                      onChange(hub)
                      setIsOpen(false)
                      setSearch('')
                    }}
                    className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-accent hover:text-accent-foreground"
                  >
                    <MapPin className="mr-2 h-3 w-3 text-muted-foreground" />
                    {hub}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ReceivedRequestCard({ match, onAction }: { match: MatchRecord; onAction: (id: string, action: 'accepted'|'declined') => void }) {
  const dateStr = match.scheduled_time ? new Date(match.scheduled_time).toLocaleDateString() : 'TBD'
  
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-12 w-12 shrink-0 border-2 border-primary/20">
            <AvatarImage src={match.home_player?.avatar_url} alt={match.home_player?.name} />
            <AvatarFallback>{match.home_player?.name?.[0]}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h4 className="font-semibold text-foreground truncate">Challenge from {match.home_player?.name}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Elo: {match.home_player?.elo_rating}</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs bg-card/50 rounded-lg p-3 border border-border/50">
        <div className="flex items-center gap-1.5 text-muted-foreground truncate">
          <CalendarIcon className="h-3.5 w-3.5 shrink-0" /> {dateStr}
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground truncate">
          <MapPin className="h-3.5 w-3.5 shrink-0" /> {match.proposed_location || 'TBD'}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={() => onAction(match.id, 'accepted')} className="w-full gap-1.5 font-bold shadow-md">
          <Check className="h-4 w-4" /> Accept
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAction(match.id, 'declined')} className="w-full gap-1.5 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30">
          <X className="h-4 w-4" /> Decline
        </Button>
      </div>
    </div>
  )
}

function SentRequestCard({ match, onCancel, onUpdateDetails }: { match: MatchRecord; onCancel: () => void; onUpdateDetails: (loc: string, scheduledTime: string) => void }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editLoc, setEditLoc] = useState(match.proposed_location || '')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(match.scheduled_time ? new Date(match.scheduled_time) : undefined)
  const [editTime, setEditTime] = useState(formatTimeSlot(match.scheduled_time))

  const dateBounds = getDateBounds()

  const handleSave = () => {
    const dateValue = selectedDate ? selectedDate.toISOString().split('T')[0] : ''
    const updatedScheduledTime = dateValue ? combineDateAndTime(dateValue, editTime) : match.scheduled_time || ''
    onUpdateDetails(editLoc, updatedScheduledTime)
    setIsEditing(false)
  }

  // UI Polish: Removed grayscale & opacity drops to look neutral, not declined.
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 transition-opacity">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={match.away_player?.avatar_url} />
            <AvatarFallback>{match.away_player?.name?.[0]}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-foreground truncate">Waiting on {match.away_player?.name}</h4>
            {!isEditing && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                <span className="inline-flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {match.scheduled_time ? new Date(match.scheduled_time).toLocaleDateString() : 'TBD'}
                </span>
                <span className="mx-1">•</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {match.scheduled_time ? formatTimeSlot(match.scheduled_time) : 'TBD'}
                </span>
                <span className="mx-1">•</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {match.proposed_location || 'TBD'}
                </span>
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
           <Button size="icon" variant="ghost" onClick={() => setIsEditing(!isEditing)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
             <Edit2 className="h-4 w-4" />
           </Button>
           <Button size="icon" variant="ghost" onClick={onCancel} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
             <X className="h-4 w-4" />
           </Button>
        </div>
      </div>

      {isEditing && (
        <div className="pt-3 border-t border-border/50 space-y-3">
           <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 relative z-10">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Location</label>
                <CourtSelector 
                  homeProfile={match.home_player}
                  awayProfile={match.away_player}
                  value={editLoc}
                  onChange={setEditLoc}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between border-border bg-background text-left text-foreground text-xs h-8"
                    >
                      <span className={selectedDate ? 'text-foreground' : 'text-muted-foreground'}>
                        {selectedDate ? selectedDate.toLocaleDateString() : 'Pick date'}
                      </span>
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={{ before: new Date(dateBounds.min), after: new Date(dateBounds.max) }}
                      fromDate={new Date(dateBounds.min)}
                      toDate={new Date(dateBounds.max)}
                      className="border-0 bg-background"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Time</label>
                <Select value={editTime} onValueChange={setEditTime}>
                  <SelectTrigger className="w-full border-border bg-background text-foreground text-xs h-8">
                    <SelectValue placeholder="Choose time" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    {timeSlots.map((slot) => (
                      <SelectItem key={slot} value={slot} className="hover:bg-secondary focus:bg-secondary focus:text-foreground text-foreground cursor-pointer">
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
           </div>
           <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleSave}>Save Updates</Button>
           </div>
        </div>
      )}
    </div>
  )
}

function UpcomingMatchCard({ 
  match, 
  currentUserId,
  onCancel,
  onUpdateDetails,
  onSubmitScore
}: { 
  match: MatchRecord; 
  currentUserId: string | null;
  onCancel: () => void;
  onUpdateDetails: (loc: string, scheduledTime: string) => void;
  onSubmitScore: (h: number[], a: number[]) => void;
}) {
  const isHome = match.home_player_id === currentUserId
  const opponent = isHome ? match.away_player : match.home_player

  const [isEditing, setIsEditing] = useState(false)
  const [isScoring, setIsScoring] = useState(false)

  const [editLoc, setEditLoc] = useState(match.proposed_location || '')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(match.scheduled_time ? new Date(match.scheduled_time) : undefined)
  const [editTime, setEditTime] = useState(formatTimeSlot(match.scheduled_time))

  const [homeScores, setHomeScores] = useState<string[]>(['', '', ''])
  const [awayScores, setAwayScores] = useState<string[]>(['', '', ''])
  
  const dateBounds = getDateBounds()

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

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-12 w-12 shrink-0 border border-border/50 shadow-sm">
            <AvatarImage src={opponent?.avatar_url} alt={opponent?.name} />
            <AvatarFallback>{opponent?.name ? opponent.name.split(' ').map(n => n[0]).join('') : 'P'}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h4 className="font-semibold text-foreground truncate">vs {opponent?.name}</h4>
            {!isEditing && (
              <p className="text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1">
                <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> {match.scheduled_time ? new Date(match.scheduled_time).toLocaleDateString() : 'TBD'}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {match.scheduled_time ? formatTimeSlot(match.scheduled_time) : 'TBD'}</span>
                <span className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{match.proposed_location || 'TBD'}</span></span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Editing View */}
      {isEditing && (
        <div className="pt-3 border-t border-border/50 space-y-3 bg-muted/10 -mx-4 px-4 pb-4">
           <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Edit Match Details</h5>
           <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 relative z-10">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Location</label>
                <CourtSelector 
                  homeProfile={match.home_player}
                  awayProfile={match.away_player}
                  value={editLoc}
                  onChange={setEditLoc}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between border-border bg-background text-left text-foreground text-xs h-8"
                    >
                      <span className={selectedDate ? 'text-foreground' : 'text-muted-foreground'}>
                        {selectedDate ? selectedDate.toLocaleDateString() : 'Pick date'}
                      </span>
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={{ before: new Date(dateBounds.min), after: new Date(dateBounds.max) }}
                      fromDate={new Date(dateBounds.min)}
                      toDate={new Date(dateBounds.max)}
                      className="border-0 bg-background"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Time</label>
                <Select value={editTime} onValueChange={setEditTime}>
                  <SelectTrigger className="w-full border-border bg-background text-foreground text-xs h-8">
                    <SelectValue placeholder="Choose time" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    {timeSlots.map((slot) => (
                      <SelectItem key={slot} value={slot} className="hover:bg-secondary focus:bg-secondary focus:text-foreground text-foreground cursor-pointer">
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
           </div>
           <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button size="sm" className="h-8 text-xs" onClick={handleSaveDetails}>Save Updates</Button>
           </div>
        </div>
      )}

      {/* Scoring View */}
      {isScoring && (
         <div className="pt-4 border-t border-border/50 space-y-4 bg-secondary/10 -mx-4 px-4 pb-4">
            <div className="flex items-center justify-between">
               <h5 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5" /> Report Final Score</h5>
            </div>
            
            <div className="space-y-3">
               <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  <div>Player</div>
                  <div className="w-12 text-center">Set 1</div>
                  <div className="w-12 text-center">Set 2</div>
                  <div className="w-12 text-center">Set 3</div>
               </div>

               {/* Home Player Score Row */}
               <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                  <div className="text-sm font-semibold truncate pr-2">{match.home_player.name} {isHome ? '(You)' : ''}</div>
                  <Input type="number" min="0" max="99" value={homeScores[0]} onChange={e => setHomeScores([e.target.value, homeScores[1], homeScores[2]])} className="h-9 w-12 text-center px-1 font-black bg-background" />
                  <Input type="number" min="0" max="99" value={homeScores[1]} onChange={e => setHomeScores([homeScores[0], e.target.value, homeScores[2]])} className="h-9 w-12 text-center px-1 font-black bg-background" />
                  <Input type="number" min="0" max="99" value={homeScores[2]} onChange={e => setHomeScores([homeScores[0], homeScores[1], e.target.value])} className="h-9 w-12 text-center px-1 font-black bg-background" />
               </div>

               {/* Away Player Score Row */}
               <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                  <div className="text-sm font-semibold truncate pr-2">{match.away_player.name} {!isHome ? '(You)' : ''}</div>
                  <Input type="number" min="0" max="99" value={awayScores[0]} onChange={e => setAwayScores([e.target.value, awayScores[1], awayScores[2]])} className="h-9 w-12 text-center px-1 font-black bg-background" />
                  <Input type="number" min="0" max="99" value={awayScores[1]} onChange={e => setAwayScores([awayScores[0], e.target.value, awayScores[2]])} className="h-9 w-12 text-center px-1 font-black bg-background" />
                  <Input type="number" min="0" max="99" value={awayScores[2]} onChange={e => setAwayScores([awayScores[0], awayScores[1], e.target.value])} className="h-9 w-12 text-center px-1 font-black bg-background" />
               </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setIsScoring(false)}>Cancel</Button>
              <Button size="sm" className="h-8 text-xs bg-primary text-primary-foreground font-bold" onClick={handleSaveScore}>Submit Score</Button>
           </div>
         </div>
      )}

      {/* Action Button Row - UI Polish applied */}
      {!isEditing && !isScoring && (
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" variant="default" className="flex-1 text-xs font-bold h-8 bg-primary/90 hover:bg-primary" onClick={() => setIsScoring(true)}>
             <Trophy className="h-3.5 w-3.5 mr-1.5" /> Report Score
          </Button>
          <Button size="icon" variant="outline" className="h-8 w-8 shrink-0 text-muted-foreground" onClick={() => setIsEditing(true)}>
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="outline" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

function PendingScoreCard({ match, onApprove }: { match: MatchRecord; onApprove: (id: string) => void }) {
  const scoreString = match.home_set_scores?.map((score, i) => `${score}-${match.away_set_scores[i]}`).join(', ')

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <AlertCircle className="h-4 w-4" /> Score Pending Verification
        </div>
        <Button size="sm" onClick={() => onApprove(match.id)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-1.5 h-8 shadow-sm">
          <Check className="h-3.5 w-3.5" /> Verify Score
        </Button>
      </div>
      
      <div className="flex items-center justify-between border-t border-border/50 pt-3">
        <div className="flex items-center gap-4 sm:gap-8">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-7 w-7 border border-background shadow-sm">
              <AvatarImage src={match.home_player?.avatar_url} alt={match.home_player?.name} />
              <AvatarFallback>H</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground truncate">{match.home_player?.name}</span>
          </div>
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest shrink-0">VS</span>
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-7 w-7 border border-background shadow-sm">
              <AvatarImage src={match.away_player?.avatar_url} alt={match.away_player?.name} />
              <AvatarFallback>A</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground truncate">{match.away_player?.name}</span>
          </div>
        </div>
        <div className="text-sm font-black text-foreground bg-background px-3 py-1.5 rounded-md border border-border shadow-sm shrink-0 tabular-nums">
          {scoreString}
        </div>
      </div>
    </div>
  )
}