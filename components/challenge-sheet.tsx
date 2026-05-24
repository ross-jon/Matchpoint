'use client'

import { useState } from 'react'
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
import { Calendar, Clock, MapPin, Send, Trophy } from 'lucide-react'

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
    date: string
    time: string
    location: string
    message: string
  }) => void
}

const timeSlots = [
  '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM'
]

export function ChallengeSheet({ player, open, onOpenChange, onSubmit }: ChallengeSheetProps) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!player) return null

  const avatarUrl = 'avatar_url' in player ? player.avatar_url : player.avatar
  const targetHubs = 'geographic_hubs' in player ? player.geographic_hubs : player.preferredHubs || []

  const handleSubmit = async () => {
    if (!date || !time || !location) return
    
    setIsSubmitting(true)
    
    onSubmit({
      playerId: player.id,
      date,
      time,
      location,
      message
    })
    
    setDate('')
    setTime('')
    setLocation('')
    setMessage('')
    setIsSubmitting(false)
    onOpenChange(false)
  }

  const isValid = date && time && location

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split('T')[0]

  const sortedLocations = [...GEOGRAPHIC_HUBS].sort((a, b) => {
    const aPreferred = targetHubs.includes(a) ? -1 : 1
    const bPreferred = targetHubs.includes(b) ? -1 : 1
    return aPreferred - bPreferred
  })

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
              Proposed Date
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={minDate}
              className="w-full bg-background border-border text-foreground"
            />
          </div>

          {/* Proposed Time Input — Fixed: Removed Duplicate SelectTrigger */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Proposed Time
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

          {/* Court Hub Location Picker — Fixed: Removed Duplicate SelectTrigger */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Location
            </label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger className="w-full border-border bg-background text-foreground">
                <SelectValue placeholder="Select a court hub" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                {sortedLocations.map(loc => (
                  <SelectItem key={loc} value={loc} className="hover:bg-secondary focus:bg-secondary focus:text-foreground text-foreground cursor-pointer">
                    <span className="flex items-center gap-2">
                      {loc}
                      {targetHubs.includes(loc) && (
                        <span className="text-xs text-primary font-medium">(Their preferred)</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Challenge Note Textbox */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Message (optional)
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