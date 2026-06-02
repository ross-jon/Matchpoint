'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MapPin, Search, Check, Plus, Loader2, X, Camera, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProfileSetupScreenProps {
  onComplete: () => void
}

interface Court {
  id: string
  name: string
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

const getDicebearAvatar = (seed: string) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=166534&radius=50`

export function ProfileSetupScreen({ onComplete }: ProfileSetupScreenProps) {
  const [firstName, setFirstName]   = useState('')
  const [lastName, setLastName]     = useState('')
  const [gender, setGender]         = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthDay, setBirthDay]     = useState('')
  const [birthYear, setBirthYear]   = useState('')
  const [bio, setBio]               = useState('')
  const [avatarUrl, setAvatarUrl]   = useState('')
  const [openToChallenges, setOpenToChallenges] = useState(true)
  const [loading, setLoading]           = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Courts state
  const [allCourts, setAllCourts]       = useState<Court[]>([])
  const [selectedHubs, setSelectedHubs] = useState<string[]>([])
  const [courtSearch, setCourtSearch]   = useState('')
  const [addingCourt, setAddingCourt]   = useState(false)

  // Generate year options: current year - 10 down to current year - 100
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 91 }, (_, i) => currentYear - 10 - i)

  // Days in selected month/year
  const daysInMonth = birthMonth && birthYear
    ? new Date(parseInt(birthYear), parseInt(birthMonth), 0).getDate()
    : 31
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  useEffect(() => {
    const loadProfile = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      if (!userId) return

      const [profileResult, courtsResult] = await Promise.all([
        supabase.from('profiles').select('first_name, last_name, name, bio, avatar_url, geographic_hubs, gender, birthdate, open_to_challenges').eq('id', userId).single(),
        supabase.from('courts').select('id, name').order('name')
      ])

      if (profileResult.data) {
        const d = profileResult.data
        if (d.first_name) setFirstName(d.first_name)
        if (d.last_name)  setLastName(d.last_name)
        if (d.gender)     setGender(d.gender)
        if (d.bio)        setBio(d.bio)
        if (d.geographic_hubs) setSelectedHubs(d.geographic_hubs)
        if (d.open_to_challenges !== null) setOpenToChallenges(d.open_to_challenges)
        if (d.avatar_url) {
          setAvatarUrl(d.avatar_url)
        } else {
          const displayName = [d.first_name, d.last_name].filter(Boolean).join(' ')
          setAvatarUrl(getDicebearAvatar(displayName || userId))
        }
        if (d.birthdate) {
          const bd = new Date(d.birthdate)
          setBirthMonth(String(bd.getMonth() + 1))
          setBirthDay(String(bd.getDate()))
          setBirthYear(String(bd.getFullYear()))
        }
      }

      if (!courtsResult.error && courtsResult.data) {
        setAllCourts(courtsResult.data as Court[])
      }
    }
    loadProfile()
  }, [])

  // Update avatar initials preview when name changes
  useEffect(() => {
    const displayName = [firstName, lastName].filter(Boolean).join(' ')
    if (displayName && !avatarUrl.includes('supabase')) {
      setAvatarUrl(getDicebearAvatar(displayName))
    }
  }, [firstName, lastName])

  const uploadAvatar = async (file: File, userId: string) => {
    setError(null)
    setUploadingAvatar(true)
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() ?? 'png'
      const filePath = `avatars/${userId}/${crypto.randomUUID()}.${fileExt}`
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true })
      if (uploadErr) {
        if (uploadErr.message && uploadErr.message.includes('Bucket not found')) {
          console.warn('Avatar upload failed: storage bucket not found. Falling back to generated avatar.')
          const fallback = getDicebearAvatar(`${firstName} ${lastName}`.trim() || userId)
          setAvatarUrl(fallback)
          return
        }
        throw uploadErr
      }
      const { data: urlData } = await supabase.storage.from('avatars').getPublicUrl(filePath)
      if (!urlData?.publicUrl) throw new Error('Unable to retrieve avatar URL.')
      setAvatarUrl(urlData.publicUrl)
    } catch (err: any) {
      setError(err?.message || 'Unable to upload photo. Please try again.')
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

  const toggleHub = (courtId: string) => {
    setSelectedHubs(prev =>
      prev.includes(courtId) ? prev.filter(h => h !== courtId) : [...prev, courtId]
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
        setSelectedHubs(prev => [...prev, data.id])
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

    if (!firstName.trim()) { setError('First name is required.'); return }
    if (!lastName.trim())  { setError('Last name is required.'); return }
    if (!gender)           { setError('Please select your gender.'); return }
    if (!birthMonth || !birthDay || !birthYear) { setError('Please complete your date of birth.'); return }

    setLoading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      if (!userId) throw new Error('Unable to confirm authenticated user.')

      const displayName = `${firstName.trim()} ${lastName.trim()}`
      const finalAvatar = avatarUrl || getDicebearAvatar(displayName)
      const birthdateStr = `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`

      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        email: userData?.user?.email ?? null,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        name: displayName,
        gender,
        birthdate: birthdateStr,
        bio: bio.trim() || null,
        avatar_url: finalAvatar,
        geographic_hubs: selectedHubs,
        open_to_challenges: openToChallenges,
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

  const courtNameMap = Object.fromEntries(allCourts.map(court => [court.id, court.name]))

  const filteredCourts = allCourts.filter(c =>
    c.name.toLowerCase().includes(courtSearch.toLowerCase())
  )
  const exactMatch = allCourts.some(c => c.name.toLowerCase() === courtSearch.toLowerCase().trim())
  const showAddNew = courtSearch.trim().length > 1 && !exactMatch
  const avatarInitials = [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase() || 'P'

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-2xl">
        <Card className="border-border bg-card shadow-xl">
          <CardHeader className="space-y-3 text-center pb-4">
            <CardTitle className="text-3xl font-black tracking-tight">Finish Your Profile</CardTitle>
            <CardDescription className="text-muted-foreground">
              Set up your player identity. Your date of birth and gender are private and used only for matchmaking — they won't appear on your public profile.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">

              {/* ── Avatar ── */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Avatar className="h-24 w-24 ring-2 ring-border shadow-md">
                    <AvatarImage src={avatarUrl} alt={[firstName, lastName].filter(Boolean).join(' ') || 'Avatar'} />
                    <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">{avatarInitials}</AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar || loading}
                    className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {uploadingAvatar ? 'Uploading…' : 'Tap the camera icon to upload a photo, or your initials will be used automatically.'}
                </p>
              </div>

              {/* ── Name ── */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Alex"
                    disabled={loading}
                    className="bg-background border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Morgan"
                    disabled={loading}
                    className="bg-background border-border"
                  />
                </div>
              </div>

              {/* ── Gender ── */}
              <div className="space-y-2">
                <Label htmlFor="gender">Gender <span className="text-destructive">*</span></Label>
                <p className="text-xs text-muted-foreground">Private — used for matchmaking only.</p>
                <select
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select gender…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non-binary">Non-binary</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              {/* ── Date of Birth ── */}
              <div className="space-y-2">
                <Label>Date of Birth <span className="text-destructive">*</span></Label>
                <p className="text-xs text-muted-foreground">Private — used for age-based discovery only.</p>
                <div className="grid grid-cols-3 gap-3">
                  {/* Month */}
                  <select
                    value={birthMonth}
                    onChange={(e) => { setBirthMonth(e.target.value); setBirthDay('') }}
                    disabled={loading}
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Month</option>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={String(i + 1)}>{m}</option>
                    ))}
                  </select>
                  {/* Day */}
                  <select
                    value={birthDay}
                    onChange={(e) => setBirthDay(e.target.value)}
                    disabled={loading || !birthMonth}
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                  >
                    <option value="">Day</option>
                    {days.map(d => (
                      <option key={d} value={String(d)}>{d}</option>
                    ))}
                  </select>
                  {/* Year */}
                  <select
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    disabled={loading}
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Year</option>
                    {years.map(y => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Bio ── */}
              <div className="space-y-2">
                <Label htmlFor="bio">Bio <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Tell opponents about yourself and your game — e.g. 'Left-handed baseline counter-puncher, heavy topspin on the forehand. Available most weekday evenings and weekends.'"
                  disabled={loading}
                />
              </div>

              {/* ── Open to Challenges ── */}
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/10 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Open to Challenges</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Allow other players to send you match requests</p>
                </div>
                <Switch
                  checked={openToChallenges}
                  onCheckedChange={setOpenToChallenges}
                  disabled={loading}
                />
              </div>

              {/* ── Preferred Courts ── */}
              <div className="space-y-2">
                <Label>Preferred Courts <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                <p className="text-xs text-muted-foreground">Search courts in your area, or add one that isn't listed yet.</p>

                {selectedHubs.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedHubs.map(courtId => ({ id: courtId, name: courtNameMap[courtId] ?? courtId })).map(court => (
                      <span key={court.id} className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 text-primary px-3 py-1.5 text-xs font-medium">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {court.name}
                        <button type="button" onClick={() => toggleHub(court.id)} className="ml-0.5 hover:text-destructive transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

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

                {courtSearch.length > 0 && (
                  <div className="mt-1 rounded-lg border border-border bg-background divide-y divide-border/50 max-h-48 overflow-y-auto">
                    {filteredCourts.map(court => {
                      const selected = selectedHubs.includes(court.id)
                      return (
                        <button
                          key={court.id}
                          type="button"
                          onClick={() => toggleHub(court.id)}
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

                {courtSearch.length === 0 && allCourts.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {allCourts.map(court => {
                      const selected = selectedHubs.includes(court.id)
                      return (
                        <button
                          key={court.id}
                          type="button"
                          onClick={() => toggleHub(court.id)}
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
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading || uploadingAvatar} className="w-full font-bold py-2.5">
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving profile…</>
                ) : 'Save profile and continue →'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}