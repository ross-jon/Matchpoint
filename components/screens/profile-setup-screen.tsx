'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MapPin, Search, Check, Plus, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProfileSetupScreenProps {
  onComplete: () => void
}

interface Court {
  id: string
  name: string
}

const avatarSeeds = ['MatchPoint', 'Baseline', 'Ace', 'Champion', 'Rally']

const getDicebearAvatar = (seed: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=0D0E12&radius=50`

const buildDefaultAvatarUrl = (name: string, userId: string) =>
  getDicebearAvatar(name.trim() || userId || 'player')

export function ProfileSetupScreen({ onComplete }: ProfileSetupScreenProps) {
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Courts state
  const [allCourts, setAllCourts] = useState<Court[]>([])
  const [selectedHubs, setSelectedHubs] = useState<string[]>([])
  const [courtSearch, setCourtSearch] = useState('')
  const [addingCourt, setAddingCourt] = useState(false)

  useEffect(() => {
    const loadProfile = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      if (!userId) return

      const [profileResult, courtsResult] = await Promise.all([
        supabase.from('profiles').select('name, bio, avatar_url, geographic_hubs').eq('id', userId).single(),
        supabase.from('courts').select('id, name').order('name')
      ])

      if (profileResult.data) {
        const data = profileResult.data
        const generatedAvatar = buildDefaultAvatarUrl(data.name ?? '', userId)
        setAvatarUrl(data.avatar_url || generatedAvatar)
        if (data.name) setName(data.name)
        if (data.bio) setBio(data.bio)
        if (data.geographic_hubs) setSelectedHubs(data.geographic_hubs)
      }

      if (!courtsResult.error && courtsResult.data) {
        setAllCourts(courtsResult.data as Court[])
      }
    }
    loadProfile()
  }, [])

  const uploadAvatar = async (file: File, userId: string) => {
    setError(null)
    setUploadingAvatar(true)
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() ?? 'png'
      const filePath = `avatars/${userId}/${crypto.randomUUID()}.${fileExt}`
      const { error } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true })
      if (error) throw error
      const { data: urlData } = await supabase.storage.from('avatars').getPublicUrl(filePath)
      if (!urlData?.publicUrl) throw new Error('Unable to retrieve avatar URL.')
      setAvatarUrl(urlData.publicUrl)
    } catch (err: any) {
      setError(err?.message || 'Unable to upload avatar. Please try again.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) { setError('Unable to confirm authenticated user.'); return }
    await uploadAvatar(file, userId)
  }

  const toggleHub = (hubName: string) => {
    setSelectedHubs(prev =>
      prev.includes(hubName) ? prev.filter(h => h !== hubName) : [...prev, hubName]
    )
  }

  const handleAddCourt = async () => {
    const trimmed = courtSearch.trim()
    if (!trimmed) return
    setAddingCourt(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      const { data, error } = await supabase
        .from('courts')
        .insert({ name: trimmed, added_by: userId })
        .select('id, name')
        .single()
      if (error) throw error
      if (data) {
        setAllCourts(prev => [...prev, data as Court].sort((a, b) => a.name.localeCompare(b.name)))
        setSelectedHubs(prev => [...prev, data.name])
        setCourtSearch('')
      }
    } catch (err: any) {
      setError(err?.message || 'Could not add court.')
    } finally {
      setAddingCourt(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Please enter your name before continuing.'); return }
    setLoading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      if (!userId) throw new Error('Unable to confirm authenticated user.')
      const profileAvatar = avatarUrl || buildDefaultAvatarUrl(name.trim(), userId)
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        name: name.trim(),
        bio: bio.trim() || null,
        avatar_url: profileAvatar,
        geographic_hubs: selectedHubs,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      onComplete()
    } catch (err: any) {
      setError(err.message || 'Unable to save profile.')
    } finally {
      setLoading(false)
    }
  }

  const filteredCourts = allCourts.filter(c =>
    c.name.toLowerCase().includes(courtSearch.toLowerCase())
  )
  const exactMatch = allCourts.some(c => c.name.toLowerCase() === courtSearch.toLowerCase().trim())
  const showAddNew = courtSearch.trim().length > 1 && !exactMatch

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-2xl">
        <Card className="border-border bg-card shadow-xl">
          <CardHeader className="space-y-3 text-center">
            <CardTitle className="text-3xl">Finish Your Profile</CardTitle>
            <CardDescription>
              Help opponents find you by choosing a name and avatar. Courts and bio are optional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Name + Avatar preview */}
              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <Label htmlFor="name" className="text-slate-300">Full name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    required
                    disabled={loading}
                    className="mt-2"
                  />
                </div>
                <div className="text-center">
                  <Label className="text-slate-300">Avatar</Label>
                  <div className="mt-2 flex items-center justify-center">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={avatarUrl} alt={name || 'Avatar'} />
                      <AvatarFallback>{name ? name[0] : 'P'}</AvatarFallback>
                    </Avatar>
                  </div>
                </div>
              </div>

              {/* Upload photo */}
              <div>
                <Label htmlFor="avatarUpload" className="text-slate-300">Upload a photo</Label>
                <input
                  id="avatarUpload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  disabled={loading || uploadingAvatar}
                  className="mt-2 block w-full text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                />
                {uploadingAvatar && <p className="mt-2 text-xs text-muted-foreground">Uploading avatar…</p>}
              </div>

              {/* Generated avatars */}
              <div>
                <Label className="text-slate-300">Or choose a generated avatar</Label>
                <div className="grid grid-cols-5 gap-3 mt-2">
                  {avatarSeeds.map((seed) => {
                    const url = getDicebearAvatar(seed)
                    return (
                      <button
                        type="button"
                        key={seed}
                        onClick={() => setAvatarUrl(url)}
                        className={cn(
                          'rounded-xl border p-1 transition',
                          avatarUrl === url ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                        )}
                      >
                        <img src={url} alt={`Avatar ${seed}`} className="h-16 w-16 rounded-lg object-cover" />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Bio */}
              <div>
                <Label htmlFor="bio" className="text-slate-300">Bio <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Describe your playstyle, availability, or goals."
                  disabled={loading}
                />
              </div>

              {/* Preferred Courts */}
              <div>
                <Label className="text-slate-300">Preferred Courts <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <p className="text-xs text-muted-foreground mt-1 mb-3">Search courts in the valley or add one that isn't listed yet.</p>

                {/* Selected courts */}
                {selectedHubs.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedHubs.map(hub => (
                      <span key={hub} className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 text-primary px-3 py-1.5 text-xs font-medium">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {hub}
                        <button onClick={() => toggleHub(hub)} className="ml-0.5 hover:text-destructive transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={courtSearch}
                    onChange={(e) => setCourtSearch(e.target.value)}
                    placeholder="Search or add a court..."
                    className="pl-8 bg-background border-border"
                    disabled={loading}
                  />
                </div>

                {/* Results dropdown */}
                {courtSearch.length > 0 && (
                  <div className="mt-1 rounded-lg border border-border bg-background divide-y divide-border/50 max-h-48 overflow-y-auto">
                    {filteredCourts.map(court => {
                      const selected = selectedHubs.includes(court.name)
                      return (
                        <button
                          key={court.id}
                          type="button"
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
                    })}
                    {filteredCourts.length === 0 && !showAddNew && (
                      <div className="px-3 py-2.5 text-sm text-muted-foreground">No courts found.</div>
                    )}
                    {showAddNew && (
                      <div className="px-3 py-2.5 flex items-center justify-between gap-2 bg-muted/20">
                        <span className="text-sm text-muted-foreground truncate">
                          Add <span className="font-semibold text-foreground">"{courtSearch.trim()}"</span>?
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 gap-1 shrink-0"
                          disabled={addingCourt}
                          onClick={handleAddCourt}
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
                  <div className="flex flex-wrap gap-2 mt-3">
                    {allCourts.map(court => {
                      const selected = selectedHubs.includes(court.name)
                      return (
                        <button
                          key={court.id}
                          type="button"
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

              {error && (
                <div className="rounded-lg bg-red-950/50 border border-red-900 p-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Saving profile...' : 'Save profile and continue'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}