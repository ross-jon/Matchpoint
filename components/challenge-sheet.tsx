'use client'

import { useEffect, useMemo, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Player } from '@/lib/data'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import { Clock, MapPin, Send, Trophy, Calendar, Search } from 'lucide-react'
import { supabase } from '@/utils/supabase/client'
import { cn } from '@/lib/utils'

interface Court {
  id: string
  name: string
}

interface DatabasePlayer {
  id: string
  name: string
  avatar_url: string
  elo_rating: number
  geographic_hubs: string[]
}

interface ChallengeSheetProps {
  player: DatabasePlayer | Player | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: {
    playerId: string
    scheduled_time: string
    proposed_location: string
    challenger_note: string
  }) => void
}

const timeSlots = [
  '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM'
]

function toISOTimestamp(date: string, timeSlot: string): string {
  if (!date) return new Date('2099-01-01T00:00:00').toISOString()
  if (!timeSlot) return new Date(`${date}T00:00:00`).toISOString()
  const [time, meridiem] = timeSlot.split(' ')
  let [hours, minutes] = time.split(':').map(Number)
  if (meridiem === 'PM' && hours !== 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0
  const dt = new Date(`${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
  return dt.toISOString()
}

export function ChallengeSheet({ player, open, onOpenChange, onSubmit }: ChallengeSheetProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [locationSearch, setLocationSearch] = useState('')
  const [allCourts, setAllCourts] = useState<Court[]>([])
  const [myHubs, setMyHubs] = useState<string[]>([])  // current user's court IDs
  const [customLocation, setCustomLocation] = useState('')
  const [useCustomLocation, setUseCustomLocation] = useState(false)
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const today = new Date()
  const minDate = new Date(today)
  const maxDate = new Date(today)
  maxDate.setFullYear(maxDate.getFullYear() + 1)

  // Load courts + current user's hubs whenever sheet opens
  useEffect(() => {
    if (!open) return
    const load = async () => {
      const [{ data: courtsData }, { data: { user } }] = await Promise.all([
        supabase.from('courts').select('id, name').order('name'),
        supabase.auth.getUser(),
      ])
      if (courtsData) setAllCourts(courtsData as Court[])
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('geographic_hubs')
          .eq('id', user.id)
          .single()
        setMyHubs(profile?.geographic_hubs ?? [])
      }
    }
    load()
  }, [open])

  // Build ID→name map
  const courtNameMap = useMemo(
    () => Object.fromEntries(allCourts.map(c => [c.id, c.name])),
    [allCourts]
  )

  // Target player's court IDs (normalised from either Player shape)
  const targetHubIds: string[] = useMemo(() => {
    if (!player) return []
    return 'geographic_hubs' in player ? (player.geographic_hubs ?? []) : []
  }, [player])

  // Resolve to name sets for tier logic
  const myHubNames   = useMemo(() => myHubs.map(id => courtNameMap[id] ?? id),      [myHubs, courtNameMap])
  const theirHubNames = useMemo(() => targetHubIds.map(id => courtNameMap[id] ?? id), [targetHubIds, courtNameMap])

  // Tier 1: courts both players prefer
  const sharedNames   = useMemo(() => myHubNames.filter(n => theirHubNames.includes(n)), [myHubNames, theirHubNames])
  // Tier 2: courts only they prefer (not shared)
  const theirOnlyNames = useMemo(() => theirHubNames.filter(n => !sharedNames.includes(n)), [theirHubNames, sharedNames])
  // Suggestion tiles = shared + their-only
  const suggestionNames = useMemo(() => [...sharedNames, ...theirOnlyNames], [sharedNames, theirOnlyNames])

  // Tier 3: all other courts (search-only, not in suggestions)
  const allCourtNames = useMemo(() => allCourts.map(c => c.name), [allCourts])
  const searchResults = useMemo(() => {
    const q = locationSearch.trim().toLowerCase()
    if (!q) return []
    // Search all courts, but put suggestions first in results
    return allCourtNames
      .filter(n => n.toLowerCase().includes(q))
      .sort((a, b) => {
        const aScore = suggestionNames.includes(a) ? 0 : 1
        const bScore = suggestionNames.includes(b) ? 0 : 1
        return aScore - bScore || a.localeCompare(b)
      })
  }, [locationSearch, allCourtNames, suggestionNames])

  const selectedDateString = selectedDate ? selectedDate.toISOString().split('T')[0] : ''
  const formattedDate = selectedDate
    ? selectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Choose a date'

  const handleSubmit = async () => {
    if (!selectedDate || !player) return
    const resolvedLocation = useCustomLocation ? customLocation.trim() : location
    setIsSubmitting(true)
    onSubmit({
      playerId: player.id,
      scheduled_time: toISOTimestamp(selectedDateString, time),
      proposed_location: resolvedLocation || 'TBD',
      challenger_note: message,
    })
    setSelectedDate(undefined)
    setTime('')
    setLocation('')
    setLocationSearch('')
    setCustomLocation('')
    setUseCustomLocation(false)
    setMessage('')
    setIsSubmitting(false)
    onOpenChange(false)
  }

  const isValid = !!selectedDate

  if (!player) return null

  const avatarUrl = 'avatar_url' in player ? player.avatar_url : (player as any).avatar
  const displayElo = ('elo_rating' in player ? player.elo_rating : (player as any).elo) as number

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg border-l border-border bg-card text-foreground">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <Trophy className="h-5 w-5 text-primary" />
            Challenge to a Match
          </SheetTitle>
          <SheetDescription className="text-muted-foreground">
            Send a match request with your proposed time and location
          </SheetDescription>
        </SheetHeader>

        {/* Player Info Summary Card */}
        <div className="mt-6 flex items-center gap-4 rounded-lg border border-border bg-secondary/30 p-4">
          <Avatar className="h-14 w-14 ring-2 ring-border">
            <AvatarImage src={avatarUrl} alt={player.name} />
            <AvatarFallback>{player.name ? player.name.split(' ').map((n: string) => n[0]).join('') : 'P'}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground truncate">{player.name}</h3>
            <p className="text-sm text-muted-foreground">{displayElo} Elo</p>
            {theirHubNames.length > 0 && (
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{theirHubNames.join(', ')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Challenge Form Options */}
        <div className="mt-6 space-y-5">
          {/* Date */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Proposed Date <span className="text-muted-foreground font-normal">(required)</span>
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between border-border bg-background text-left text-foreground"
                >
                  <span className={selectedDate ? 'text-foreground' : 'text-muted-foreground'}>
                    {formattedDate}
                  </span>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarPicker
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={{ before: minDate, after: maxDate }}
                  fromDate={minDate}
                  toDate={maxDate}
                  className="border-0 bg-background"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Proposed Time <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger className="w-full border-border bg-background text-foreground">
                <SelectValue placeholder="Select a timing slot" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                {timeSlots.map(slot => (
                  <SelectItem key={slot} value={slot} className="hover:bg-secondary focus:bg-secondary focus:text-foreground text-foreground cursor-pointer">
                    {slot}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Location <span className="text-muted-foreground font-normal">(optional)</span>
            </label>

            {!useCustomLocation ? (
              <div className="space-y-3">
                {/* Suggestion tiles: shared courts (green) + their-preferred */}
                {suggestionNames.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {suggestionNames.map(name => {
                      const isShared = sharedNames.includes(name)
                      const isSelected = location === name
                      return (
                        <button
                          type="button"
                          key={name}
                          onClick={() => setLocation(isSelected ? '' : name)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                            isSelected
                              ? isShared
                                ? 'border-lime-500 bg-lime-500 text-white'
                                : 'border-primary bg-primary text-primary-foreground'
                              : isShared
                                ? 'border-lime-500/40 bg-lime-500/10 text-lime-400 hover:bg-lime-500/20'
                                : 'border-border bg-background text-foreground hover:border-primary/60 hover:bg-primary/10'
                          )}
                        >
                          <MapPin className="h-3 w-3 shrink-0" />
                          {name}
                          {isShared && (
                            <span className={cn(
                              'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                              isSelected ? 'bg-white/20 text-white' : 'bg-lime-500/20 text-lime-400'
                            )}>
                              shared
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Inline search for all courts */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={locationSearch}
                    onChange={e => { setLocationSearch(e.target.value); if (location) setLocation('') }}
                    placeholder="Search all courts…"
                    className="pl-9 h-9 bg-background border-border text-foreground text-sm"
                  />
                  {locationSearch && (
                    <button
                      type="button"
                      onClick={() => setLocationSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Search results */}
                {searchResults.length > 0 && (
                  <div className="rounded-lg border border-border bg-background divide-y divide-border/40 max-h-44 overflow-y-auto">
                    {searchResults.map(name => {
                      const isShared = sharedNames.includes(name)
                      const isTheirs = theirOnlyNames.includes(name)
                      return (
                        <button
                          type="button"
                          key={name}
                          onClick={() => { setLocation(name); setLocationSearch('') }}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {name}
                          </span>
                          {isShared && (
                            <span className="text-[10px] font-bold text-lime-400 uppercase tracking-wide">shared</span>
                          )}
                          {isTheirs && !isShared && (
                            <span className="text-[10px] font-medium text-muted-foreground">their court</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
                {locationSearch.trim() && searchResults.length === 0 && (
                  <p className="text-xs text-muted-foreground px-1">No courts match "{locationSearch}"</p>
                )}

                {/* Show selected court if chosen from tiles (not search) */}
                {location && !locationSearch && (
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium">{location}</span>
                    <button type="button" onClick={() => setLocation('')} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
                      Clear
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setUseCustomLocation(true)}
                  className="text-xs text-primary hover:underline"
                >
                  + Enter a custom location
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  value={customLocation}
                  onChange={e => setCustomLocation(e.target.value)}
                  placeholder="e.g. Liberty Park Court 3"
                  className="w-full bg-background border-border text-foreground"
                />
                <button
                  type="button"
                  onClick={() => { setUseCustomLocation(false); setCustomLocation('') }}
                  className="text-xs text-primary hover:underline"
                >
                  ← Pick from court list instead
                </button>
              </div>
            )}
          </div>

          {/* Message */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Message <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Looking forward to hitting out on the courts!"
              className="min-h-[80px] resize-none bg-background border-border text-foreground placeholder-muted-foreground"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="mt-8">
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="w-full gap-2 font-bold shadow-md"
            size="lg"
          >
            <Send className="h-4 w-4" />
            {isSubmitting ? 'Sending Challenge...' : 'Send Challenge'}
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground leading-relaxed">
            {player.name} will receive a notification request inside their match hub calendar view window.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}