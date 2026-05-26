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
import { Clock, MapPin, Send, Trophy, Calendar } from 'lucide-react'
import { supabase } from '@/utils/supabase/client'

const GEOGRAPHIC_HUBS = [
  'Flat Iron Park (Sandy)',
  'Murray Park Courts',
  'Draper Indoor Hub',
  'Lone Peak Park'
]

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
    scheduled_time: string       // ISO timestamptz, ready for DB
    proposed_location: string    // matches DB column name
    challenger_note: string      // matches DB column name
  }) => void
}

const timeSlots = [
  '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM'
]

// Convert "7:00 AM" style slot + a date string into an ISO timestamptz
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
  const [locationQuery, setLocationQuery] = useState('')
  const [allCourts, setAllCourts] = useState<string[]>([])
  const [customLocation, setCustomLocation] = useState('')
  const [useCustomLocation, setUseCustomLocation] = useState(false)
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!player) return null

  const avatarUrl = 'avatar_url' in player ? player.avatar_url : player.avatar
  const targetHubs = 'geographic_hubs' in player ? player.geographic_hubs : player.preferredHubs || []

  const today = new Date()
  const minDate = new Date(today)
  const maxDate = new Date(today)
  maxDate.setFullYear(maxDate.getFullYear() + 1)

  useEffect(() => {
    const loadCourts = async () => {
      const { data, error } = await supabase.from('courts').select('name')
      if (error) {
        console.error('Error loading courts:', error)
        return
      }
      setAllCourts((data ?? []).map((court) => court.name).sort((a, b) => a.localeCompare(b)))
    }

    if (open) {
      loadCourts()
    }
  }, [open])

  const selectedDateString = selectedDate ? selectedDate.toISOString().split('T')[0] : ''
  const formattedDate = selectedDate
    ? selectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Choose a date'

  const handleSubmit = async () => {
    if (!selectedDate) return

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
    setLocationQuery('')
    setCustomLocation('')
    setUseCustomLocation(false)
    setMessage('')
    setIsSubmitting(false)
    onOpenChange(false)
  }

  const isValid = !!selectedDate

  const sortedLocations = useMemo(() => {
    return [...allCourts].sort((a, b) => a.localeCompare(b))
  }, [allCourts])

  const filteredLocations = useMemo(() => {
    const query = locationQuery.trim().toLowerCase()
    if (!query) return sortedLocations
    return sortedLocations.filter((loc) => loc.toLowerCase().includes(query))
  }, [locationQuery, sortedLocations])

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
            <AvatarFallback>{player.name ? player.name.split(' ').map(n => n[0]).join('') : 'P'}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground truncate">{player.name}</h3>
            <p className="text-sm text-muted-foreground">{('elo_rating' in player ? player.elo_rating : player.elo) as number} Elo</p>
            {targetHubs.length > 0 && (
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{targetHubs.join(', ')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Challenge Form Options */}
        <div className="mt-6 space-y-5">
          {/* Proposed Date Input */}
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

          {/* Proposed Time Input */}
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

          {/* Location Picker + Custom Location Toggle */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Location <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            {!useCustomLocation ? (
              <>
                {targetHubs.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {targetHubs.map((hub) => (
                      <button
                        type="button"
                        key={hub}
                        onClick={() => setLocation(hub)}
                        className={
                          `rounded-full border px-3 py-1 text-xs transition ${
                            location === hub
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-foreground hover:border-primary/80 hover:bg-primary/10'
                          }`
                        }
                      >
                        <span>{hub}</span>
                        <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          shared
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger className="w-full border-border bg-background text-foreground">
                    <SelectValue placeholder="Search any court or choose a shared court" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    <div className="px-3 py-2">
                      <Input
                        value={locationQuery}
                        onChange={(e) => setLocationQuery(e.target.value)}
                        placeholder="Search any court"
                        className="h-9 w-full bg-background border-border text-foreground"
                      />
                    </div>
                    {filteredLocations.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No matching courts found.</div>
                    ) : (
                      filteredLocations.map((loc) => (
                        <SelectItem
                          key={loc}
                          value={loc}
                          className="hover:bg-secondary focus:bg-secondary focus:text-foreground text-foreground cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            {loc}
                            {targetHubs.includes(loc) && (
                              <span className="text-xs text-primary font-medium">(shared)</span>
                            )}
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => setUseCustomLocation(true)}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  + Enter a custom location
                </button>
              </>
            ) : (
              <>
                <Input
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  placeholder="e.g. Liberty Park Court 3"
                  className="w-full bg-background border-border text-foreground"
                />
                <button
                  type="button"
                  onClick={() => { setUseCustomLocation(false); setCustomLocation('') }}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  ← Pick from court hubs instead
                </button>
              </>
            )}
          </div>

          {/* Challenge Note Textbox */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Message <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Looking forward to hitting out on the courts!"
              className="min-h-[80px] resize-none bg-background border-border text-foreground placeholder-muted-foreground"
            />
          </div>
        </div>

        {/* Form Submission Action Row */}
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