'use client'

import { useState, useEffect, useRef } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { supabase } from '@/utils/supabase/client'
import { Camera, Check, MapPin, Trophy, Target, MessageSquare, Swords, Loader2, Search, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const getDicebearAvatar = (seed: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=0D0E12&radius=50`

const AVATAR_SEEDS = ['MatchPoint', 'Baseline', 'Ace', 'Champion', 'Rally']

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
  // Added for the new recent form UI - you will need to map this from your match history
  recent_elo_deltas?: string[] 
}

interface Court {
  id: string
  name: string
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

  // Edit form state
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [openToChallenges, setOpenToChallenges] = useState(true)
  const [selectedHubs, setSelectedHubs] = useState<string[]>([])
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Courts state
  const [allCourts, setAllCourts] = useState<Court[]>([])
  const [courtSearch, setCourtSearch] = useState('')
  const [addingCourt, setAddingCourt] = useState(false)
  const [newCourtName, setNewCourtName] = useState('')

  const isMe = !targetPlayerId || targetPlayerId === currentUserId

  useEffect(() => {
    const fetchProfileContext = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      const activeId = user?.id ?? null
      setCurrentUserId(activeId)

      const targetId = targetPlayerId || activeId
      if (!targetId) { setLoading(false); return }

      const [profileResult, courtsResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', targetId).single(),
        supabase.from('courts').select('id, name').order('name')
      ])

      if (!profileResult.error && profileResult.data) {
        const data = profileResult.data as ProfileData
        setProfile(data)
        setName(data.name || '')
        setBio(data.bio || '')
        setOpenToChallenges(data.open_to_challenges ?? true)
        setSelectedHubs(data.geographic_hubs || [])
        setAvatarUrl(data.avatar_url || '')
      } else if (profileResult.error) {
        console.error('Error loading profile:', profileResult.error)
      }

      if (!courtsResult.error && courtsResult.data) {
        setAllCourts(courtsResult.data as Court[])
      }

      setLoading(false)
    }
    fetchProfileContext()
  }, [targetPlayerId])

  const handleUploadAvatar = async (file: File) => {
    if (!currentUserId) return
    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
      const filePath = `avatars/${currentUserId}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true })
      if (error) throw error
      const { data: urlData } = await supabase.storage.from('avatars').getPublicUrl(filePath)
      if (urlData?.publicUrl) setAvatarUrl(urlData.publicUrl)
    } catch (err: any) {
      console.error('Avatar upload error:', err.message)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleAddCourt = async () => {
    const trimmed = newCourtName.trim()
    if (!trimmed || !currentUserId) return
    setAddingCourt(true)
    try {
      const { data, error } = await supabase
        .from('courts')
        .insert({ name: trimmed, added_by: currentUserId })
        .select('id, name')
        .single()
      if (error) throw error
      if (data) {
        setAllCourts(prev => [...prev, data as Court].sort((a, b) => a.name.localeCompare(b.name)))
        setSelectedHubs(prev => [...prev, data.name])
        setNewCourtName('')
        setCourtSearch('')
      }
    } catch (err: any) {
      console.error('Add court error:', err.message)
    } finally {
      setAddingCourt(false)
    }
  }

  const toggleHub = (hubName: string) => {
    setSelectedHubs(prev =>
      prev.includes(hubName) ? prev.filter(h => h !== hubName) : [...prev, hubName]
    )
  }

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        name: name.trim(),
        bio: bio.trim() || null,
        avatar_url: avatarUrl,
        open_to_challenges: openToChallenges,
        geographic_hubs: selectedHubs,
      })
      .eq('id', profile.id)

    if (!error) {
      setProfile(prev => prev ? {
        ...prev,
        name: name.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl,
        open_to_challenges: openToChallenges,
        geographic_hubs: selectedHubs,
      } : null)
      setIsEditing(false)
      setShowAvatarPicker(false)
    }
    setSaving(false)
  }

  const handleCancelEdit = () => {
    if (!profile) return
    setName(profile.name || '')
    setBio(profile.bio || '')
    setOpenToChallenges(profile.open_to_challenges ?? true)
    setSelectedHubs(profile.geographic_hubs || [])
    setAvatarUrl(profile.avatar_url || '')
    setShowAvatarPicker(false)
    setCourtSearch('')
    setIsEditing(false)
  }

  const handleInitiateChat = async () => {
    if (!currentUserId || !profile || isMe) return
    setActionLoading(true)
    const isAlpha = currentUserId < profile.id
    const userAlpha = isAlpha ? currentUserId : profile.id
    const userBeta = isAlpha ? profile.id : currentUserId

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
      if (!createErr && newConv) onNavigateToMessages?.(newConv.id)
    }
    setActionLoading(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-destructive font-medium">
        Could not load profile.
      </div>
    )
  }

  const totalMatches = profile.wins + profile.losses
  const winRate = totalMatches > 0 ? ((profile.wins / totalMatches) * 100).toFixed(1) : '0.0'

  const filteredCourts = allCourts.filter(c =>
    c.name.toLowerCase().includes(courtSearch.toLowerCase())
  )
  const exactMatch = allCourts.some(c => c.name.toLowerCase() === courtSearch.toLowerCase().trim())
  const showAddNew = isEditing && courtSearch.trim().length > 1 && !exactMatch

  return (
    <div className="min-h-screen pb-24 md:pb-8 bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-4 md:px-6">
          <h2 className="text-xl font-bold text-foreground">
            {isMe ? 'My Profile' : 'Player Profile'}
          </h2>
          {isMe && (
            isEditing ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={saving}>Cancel</Button>
                <Button size="sm" onClick={handleSave} className="gap-1.5" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>Edit Profile</Button>
            )
          )}
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">

        {/* Profile Details Area */}
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-6 px-2">
          {/* Avatar */}
          <div className="shrink-0 flex flex-col items-center gap-2">
            <div className="relative">
              <Avatar className="h-28 w-28 ring-2 ring-border">
                <AvatarImage src={isEditing ? avatarUrl : profile.avatar_url} alt={profile.name} />
                <AvatarFallback className="text-2xl font-bold">
                  {profile.name ? profile.name.split(' ').map(n => n[0]).join('') : 'P'}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
                >
                  {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (file) await handleUploadAvatar(file)
                }}
              />
            </div>

            {/* Avatar picker toggle */}
            {isEditing && (
              <button
                onClick={() => setShowAvatarPicker(p => !p)}
                className="text-xs text-primary hover:underline"
              >
                {showAvatarPicker ? 'Hide avatars' : 'Choose avatar'}
              </button>
            )}

            {/* Dicebear avatar grid */}
            {isEditing && showAvatarPicker && (
              <div className="grid grid-cols-5 gap-1.5 mt-1">
                {AVATAR_SEEDS.map(seed => {
                  const url = getDicebearAvatar(seed)
                  return (
                    <button
                      key={seed}
                      type="button"
                      onClick={() => setAvatarUrl(url)}
                      className={cn(
                        'rounded-lg border p-0.5 transition',
                        avatarUrl === url ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                      )}
                    >
                      <img src={url} alt={seed} className="h-10 w-10 rounded-md object-cover" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Name & Bio */}
          <div className="flex-1 min-w-0 w-full pt-1">
            {isEditing ? (
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="text-lg font-bold bg-background border-border mb-3"
              />
            ) : (
              <div className="flex items-center gap-3 justify-center sm:justify-start">
                <h3 className="text-2xl font-bold text-foreground tracking-tight truncate">{profile.name}</h3>
                <Badge className="bg-primary/10 text-primary border-none text-xs font-semibold px-2 py-0.5">
                  <Trophy className="mr-1.5 h-3.5 w-3.5" />{profile.elo_rating} Elo
                </Badge>
              </div>
            )}

            {isEditing ? (
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="mt-4 bg-background border-border text-sm focus-visible:ring-primary"
                placeholder="Describe your playstyle, e.g. Left-handed baseline counter-puncher..."
                rows={3}
              />
            ) : (
              <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
                {profile.bio || 'No playstyle bio added yet.'}
              </p>
            )}
          </div>
        </div>

        {/* Combined Stats & Actions Rectangle */}
        <div className="mt-6 rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col sm:flex-row">
          {/* Left Column: Actions & Form */}
          <div className="flex flex-col w-full sm:w-1/2 border-b sm:border-b-0 sm:border-r border-border">
            
            {/* Rectangle 1: Actions */}
            <div className="flex-1 p-5 border-b border-border flex flex-col justify-center gap-3">
              {!isMe ? (
                <>
                  <Button variant="outline" onClick={handleInitiateChat} className="w-full gap-2 font-semibold" disabled={actionLoading}>
                    <MessageSquare className="h-4 w-4" /> Message
                  </Button>
                  {profile.open_to_challenges && (
                    <Button onClick={() => onOpenChallengeModal?.({ id: profile.id, name: profile.name })} className="w-full gap-2 font-semibold">
                      <Swords className="h-4 w-4" /> Challenge
                    </Button>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <p className="text-sm font-semibold text-foreground">Your Public View</p>
                  <p className="text-xs text-center mt-1">Opponents see challenge and message actions here.</p>
                </div>
              )}
            </div>

            {/* Rectangle 2: Recent Form */}
            <div className="flex-1 p-5 flex flex-col justify-center items-center bg-muted/10">
              <p className="mb-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Recent Form</p>
              <div className="flex items-center gap-1.5">
                {/* Fallback mock data for elo deltas until wired up to DB */}
                {(profile.recent_elo_deltas || ['+14', '+12', '-8', '+16', '-10']).map((delta, i) => (
                  <span key={i} className={cn(
                    'flex h-7 w-9 items-center justify-center rounded text-xs font-bold shadow-sm select-none',
                    delta.startsWith('+')
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-destructive/10 text-destructive border border-destructive/20'
                  )}>
                    {delta}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Rectangle 3: Match History Triangle */}
          <div className="w-full sm:w-1/2 p-6 flex flex-col items-center justify-center bg-card">
            
            {/* Triangle Tip: Total Matches */}
            <div className="flex flex-col items-center mb-6">
              <span className="text-5xl font-black text-foreground tracking-tighter leading-none">{totalMatches}</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2">Total Matches</span>
            </div>

            {/* Triangle Base: W / L */}
            <div className="flex justify-center gap-10 w-full mb-6">
              <div className="flex flex-col items-center">
                <span className="text-3xl font-black text-primary leading-none">{profile.wins}</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2">Wins</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl font-black text-destructive leading-none">{profile.losses}</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2">Losses</span>
              </div>
            </div>

            {/* Inside the Box: Win % */}
            <Badge variant="secondary" className="text-sm font-bold px-4 py-1.5 border-none shadow-sm">
              <Target className="mr-1.5 h-4 w-4" />
              {winRate}% Win Rate
            </Badge>
          </div>
        </div>

        {/* Open to Challenges */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-5 shadow-sm mt-4">
          <div>
            <h4 className="font-bold text-foreground text-sm sm:text-base">Open to Challenges</h4>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-normal">
              Allow other players to issue direct match requests
            </p>
          </div>
          <Switch
            checked={isEditing ? openToChallenges : profile.open_to_challenges}
            onCheckedChange={setOpenToChallenges}
            disabled={!isEditing}
          />
        </div>

        {/* Preferred Courts */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm mt-4">
          <h4 className="font-bold text-foreground text-sm sm:text-base">Preferred Courts</h4>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-normal">
            {isEditing ? 'Search and select courts, or add a new one if yours isn\'t listed.' : 'Home courts for match scheduling.'}
          </p>

          {/* Selected hubs */}
          {(isEditing ? selectedHubs : profile.geographic_hubs ?? []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(isEditing ? selectedHubs : profile.geographic_hubs ?? []).map(hub => (
                <span key={hub} className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
                  'border-primary bg-primary/10 text-primary'
                )}>
                  <MapPin className="h-3 w-3 shrink-0" />
                  {hub}
                  {isEditing && (
                    <button onClick={() => toggleHub(hub)} className="ml-0.5 hover:text-destructive transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Search + picker — only in edit mode */}
          {isEditing && (
            <div className="mt-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={courtSearch}
                  onChange={(e) => setCourtSearch(e.target.value)}
                  placeholder="Search courts..."
                  className="pl-8 h-9 bg-background border-border text-sm"
                />
              </div>

              {/* Court list */}
              {courtSearch.length > 0 && (
                <div className="rounded-lg border border-border bg-background divide-y divide-border/50 max-h-48 overflow-y-auto">
                  {filteredCourts.length > 0 ? filteredCourts.map(court => {
                    const selected = selectedHubs.includes(court.name)
                    return (
                      <button
                        key={court.id}
                        onClick={() => toggleHub(court.name)}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-2.5 text-sm text-left hover:bg-muted/50 transition-colors',
                          selected && 'bg-primary/5'
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          {court.name}
                        </span>
                        {selected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </button>
                    )
                  }) : (
                    <div className="px-3 py-2.5 text-sm text-muted-foreground">No courts found.</div>
                  )}

                  {/* Add new court inline */}
                  {showAddNew && (
                    <div className="px-3 py-2.5 flex items-center justify-between gap-2 bg-muted/20">
                      <span className="text-sm text-muted-foreground truncate">
                        Add <span className="font-semibold text-foreground">"{courtSearch.trim()}"</span> as a new court?
                      </span>
                      <Button
                        size="sm"
                        className="h-7 gap-1 shrink-0"
                        disabled={addingCourt}
                        onClick={() => { setNewCourtName(courtSearch.trim()); handleAddCourt() }}
                      >
                        {addingCourt ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        Add
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Browse all when no search */}
              {courtSearch.length === 0 && allCourts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {allCourts.map(court => {
                    const selected = selectedHubs.includes(court.name)
                    return (
                      <button
                        key={court.id}
                        onClick={() => toggleHub(court.name)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                          selected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-secondary text-muted-foreground hover:border-primary/50'
                        )}
                      >
                        <MapPin className="h-3 w-3 shrink-0" />
                        {court.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}