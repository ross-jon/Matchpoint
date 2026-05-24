'use client'

import { useState, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { supabase } from '@/utils/supabase/client'
import { Camera, Check, MapPin, Trophy, Target, MessageSquare, Swords, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Fallback constant for court options
const GEOGRAPHIC_HUBS = [
  'Flat Iron Park (Sandy)',
  'Murray Park Courts',
  'Draper Indoor Hub',
  'Lone Peak Park'
]

interface ProfileData {
  id: string
  name: string
  avatar_url: string
  bio: string
  elo_rating: number
  wins: number
  losses: number
  streak_count: number
  streak_type: 'win' | 'loss'
  geographic_hubs: string[]
  open_to_challenges: boolean
}

interface ProfileScreenProps {
  targetPlayerId?: string | null
  onNavigateToMessages?: (conversationId: string) => void
  onOpenChallengeModal?: (player: { id: string; name: string }) => void
}

export function ProfileScreen({ targetPlayerId, onNavigateToMessages, onOpenChallengeModal }: ProfileScreenProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Local mutable state form elements
  const [bio, setBio] = useState('')
  const [openToChallenges, setOpenToChallenges] = useState(true)
  const [selectedHubs, setSelectedHubs] = useState<string[]>([])

  // Boolean flag to drive all identity layouts
  const isMe = !targetPlayerId || targetPlayerId === currentUserId

  useEffect(() => {
    const fetchProfileContext = async () => {
      setLoading(true)
      
      // 1. Resolve current user identity
      const { data: { user } } = await supabase.auth.getUser()
      const activeId = user?.id ?? null
      setCurrentUserId(activeId)

      // 2. Decide lookup ID target
      const targetId = targetPlayerId || activeId

      if (!targetId) {
        setLoading(false)
        return
      }

      // 3. Query details
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetId)
        .single()

      if (!error && data) {
        setProfile(data as ProfileData)
        setBio(data.bio || '')
        setOpenToChallenges(data.open_to_challenges ?? true)
        setSelectedHubs(data.geographic_hubs || [])
      } else if (error) {
        console.error('Error loading player profile matching schema:', error)
      }
      setLoading(false)
    }

    fetchProfileContext()
  }, [targetPlayerId])

  const toggleHub = (hub: string) => {
    setSelectedHubs(prev =>
      prev.includes(hub) ? prev.filter(h => h !== hub) : [...prev, hub]
    )
  }

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        bio,
        open_to_challenges: openToChallenges,
        geographic_hubs: selectedHubs
      })
      .eq('id', profile.id)

    if (!error) {
      setProfile(prev => prev ? {
        ...prev,
        bio,
        open_to_challenges: openToChallenges,
        geographic_hubs: selectedHubs
      } : null)
      setIsEditing(false)
    }
    setSaving(false)
  }

  // Resolves or constructs alphabetical message pairing room context
  const handleInitiateChat = async () => {
    if (!currentUserId || !profile || isMe) return
    setActionLoading(true)

    // Enforce schema constraint check alphabetical_order ((user_alpha < user_beta))
    const isAlpha = currentUserId < profile.id
    const userAlpha = isAlpha ? currentUserId : profile.id
    const userBeta = isAlpha ? profile.id : currentUserId

    // Check if duplicate pairing exists or insert new room node smoothly
    const { data, error } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_alpha', userAlpha)
      .eq('user_beta', userBeta)
      .maybeSingle()

    if (!error && data) {
      onNavigateToMessages?.(data.id)
    } else if (!data) {
      const { data: newConv, error: createErr } = await supabase
        .from('conversations')
        .insert({ user_alpha: userAlpha, user_beta: userBeta })
        .select('id')
        .single()

      if (!createErr && newConv) {
        onNavigateToMessages?.(newConv.id)
      }
    }
    setActionLoading(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-sm text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-sm text-destructive font-medium">
        Error: Could not retrieve an active player profile context.
      </div>
    )
  }

  const totalMatches = profile.wins + profile.losses
  const winRate = totalMatches > 0 ? ((profile.wins / totalMatches) * 100).toFixed(1) : '0.0'
  const calculatedForm = Array(Math.min(profile.streak_count || 1, 5)).fill(profile.streak_type === 'win' ? 'W' : 'L')

  return (
    <div className="min-h-screen pb-24 md:pb-8 bg-background">
      {/* Dynamic Header Display Context */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-4 md:px-6">
          <h2 className="text-xl font-bold text-foreground">
            {isMe ? 'My Profile' : 'Player Profile'}
          </h2>
          
          {/* Render Context Action Trigger Buttons dynamically */}
          {isMe ? (
            isEditing ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} className="gap-1.5" disabled={saving}>
                  <Check className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                Edit Profile
              </Button>
            )
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleInitiateChat} className="gap-1.5" disabled={actionLoading}>
                <MessageSquare className="h-4 w-4" /> Message
              </Button>
              {profile.open_to_challenges && (
                <Button size="sm" onClick={() => onOpenChallengeModal?.({ id: profile.id, name: profile.name })} className="gap-1.5">
                  <Swords className="h-4 w-4" /> Challenge
                </Button>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left">
            <div className="relative mb-4 sm:mb-0 sm:mr-6 shrink-0">
              <Avatar className="h-28 w-28 ring-2 ring-border">
                <AvatarImage src={profile.avatar_url} alt={profile.name} />
                <AvatarFallback className="text-2xl font-bold">
                  {profile.name ? profile.name.split(' ').map(n => n[0]).join('') : 'P'}
                </AvatarFallback>
              </Avatar>
              {isMe && isEditing && (
                <button className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors">
                  <Camera className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-2xl font-bold text-foreground tracking-tight truncate">{profile.name}</h3>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <Badge className="bg-primary/10 text-primary border-none text-xs font-semibold">
                  <Trophy className="mr-1.5 h-3.5 w-3.5" />
                  {profile.elo_rating} Elo
                </Badge>
                <Badge variant="secondary" className="border-none text-xs font-semibold">
                  <Target className="mr-1.5 h-3.5 w-3.5" />
                  {winRate}% Win Rate
                </Badge>
              </div>

              {isMe && isEditing ? (
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="mt-4 bg-background border-border text-foreground text-sm focus-visible:ring-primary"
                  placeholder="Write something about your playstyle (e.g., Left-handed baseline counter-puncher)..."
                />
              ) : (
                <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
                  {bio || 'No playstyle bio added yet.'}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-border/60 pt-6 text-center">
            <div>
              <p className="text-2xl font-black text-primary tracking-tight">{profile.wins}</p>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">Wins</p>
            </div>
            <div className="border-x border-border/60">
              <p className="text-2xl font-black text-destructive tracking-tight">{profile.losses}</p>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">Losses</p>
            </div>
            <div>
              <p className="text-2xl font-black text-foreground tracking-tight">{totalMatches}</p>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">Matches</p>
            </div>
          </div>

          <div className="mt-6 border-t border-border/60 pt-6">
            <p className="mb-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Recent Form</p>
            <div className="flex items-center gap-2">
              {calculatedForm.map((result, i) => (
                <span
                  key={i}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black tracking-tight shadow-sm select-none',
                    result === 'W' ? 'bg-primary text-primary-foreground' : 'bg-secondary border border-border text-muted-foreground'
                  )}
                >
                  {result}
                </span>
              ))}
              {profile.streak_type === 'win' && profile.streak_count >= 2 && (
                <span className="ml-2 text-sm text-primary font-bold animate-pulse">
                  🔥 {profile.streak_count} Win Streak!
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-5 shadow-sm">
            <div>
              <h4 className="font-bold text-foreground text-sm sm:text-base">Open to Challenges</h4>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-normal">
                Allow other players to issue direct ladder match requests from their dashboards
              </p>
            </div>
            <Switch
              checked={openToChallenges}
              onCheckedChange={setOpenToChallenges}
              disabled={!isEditing}
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h4 className="font-bold text-foreground text-sm sm:text-base">Preferred Home Courts</h4>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-normal">
              Select key location hubs preferred for flex match scheduling around the valley
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {GEOGRAPHIC_HUBS.map(hub => {
                const isSelected = selectedHubs.includes(hub)
                return (
                  <button
                    key={hub}
                    onClick={() => isEditing && toggleHub(hub)}
                    disabled={!isEditing}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors shadow-sm',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-secondary text-muted-foreground',
                      isEditing && !isSelected && 'hover:border-primary/50',
                      !isEditing && 'cursor-default opacity-85'
                    )}
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {hub}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}