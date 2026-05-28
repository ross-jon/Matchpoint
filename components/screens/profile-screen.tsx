'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { supabase } from '@/utils/supabase/client'
import { Camera, Check, MapPin, Trophy, Target, MessageSquare, Swords, Loader2, Search, Plus, X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

interface ProfileData {
  id: string
  name: string
  first_name: string | null
  last_name: string | null
  gender: string | null
  birthdate: string | null
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

interface MatchRecord {
  id: string
  home_player_id: string
  away_player_id: string
  home_elo_delta: number | null
  away_elo_delta: number | null
  status: string
  scheduled_time: string | null
  created_at: string
  score_submitted_at: string | null
}

interface Court {
  id: string
  name: string
}

interface ProfileScreenProps {
  targetPlayerId?: string | null
  onNavigateToMessages?: (conversationId: string) => void
  onOpenChallengeModal?: (player: { id: string; name: string }) => void
  onViewMatch?: (matchId: string) => void
}

// ── Constants ──────────────────────────────────────────────────────────────

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 91 }, (_, i) => currentYear - 10 - i)

// ── ELO Chart ─────────────────────────────────────────────────────────────

function EloChart({ matches, currentUserId, currentElo }: {
  matches: MatchRecord[]
  currentUserId: string
  currentElo: number
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  // Build 8 anchor timestamps: today + 7 evenly-spaced points 7 days apart going back
  const anchorPoints = useMemo(() => {
    const now = new Date()
    now.setHours(23, 59, 59, 999)
    return Array.from({ length: 8 }, (_, i) => {
      const d = new Date(now)
      d.setDate(now.getDate() - (7 * (7 - i)))
      return d
    })
    // index 0 = 7 weeks ago, index 7 = today
  }, [])

  const filledPoints = useMemo((): number[] => {
    // Completion timestamp: prefer score_submitted_at, fall back to created_at
    const ct = (m: MatchRecord) =>
      new Date(m.score_submitted_at ?? m.created_at).getTime()

    // All verified matches sorted oldest → newest
    const completed = matches
      .filter(m => m.status === 'verified')
      .sort((a, b) => ct(a) - ct(b))

    if (completed.length === 0) {
      // No matches at all — flat line at currentElo
      return anchorPoints.map(() => currentElo)
    }

    // Walk newest → oldest, reconstructing the elo at each match boundary.
    // ratedMatches[i].eloAfter  = elo immediately after match i completed
    // ratedMatches[i].eloBefore = elo immediately before match i completed
    // We sort newest-first for the walk, then reverse back to oldest-first.
    const newestFirst = [...completed].reverse()
    let runningElo = currentElo
    const timeline: { ts: number; eloBefore: number; eloAfter: number }[] = newestFirst.map(m => {
      const isHome = m.home_player_id === currentUserId
      const delta = (isHome ? m.home_elo_delta : m.away_elo_delta) ?? 0
      const eloAfter = runningElo
      const eloBefore = runningElo - delta
      runningElo = eloBefore
      return { ts: ct(m), eloBefore, eloAfter }
    }).reverse() // back to oldest-first

    // eloAtTime: what was the player's elo at timestamp t?
    // - Before the first match: eloBefore of first match
    // - After match i: eloAfter of that match (until next match fires)
    // - After last match: currentElo
    const eloAtTime = (t: number): number => {
      if (t < timeline[0].ts) return timeline[0].eloBefore
      for (let i = timeline.length - 1; i >= 0; i--) {
        if (t >= timeline[i].ts) return timeline[i].eloAfter
      }
      return timeline[0].eloBefore
    }

    return anchorPoints.map(d => eloAtTime(d.getTime()))
  }, [matches, currentUserId, currentElo, anchorPoints])

  const delta = filledPoints[7] - filledPoints[0]
  const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'

  const rawMin = Math.min(...filledPoints)
  const rawMax = Math.max(...filledPoints)
  const naturalRange = rawMax - rawMin
  const pad = Math.max(naturalRange * 0.2, 12)
  const minElo = rawMin - pad
  const maxElo = rawMax + pad
  const range = maxElo - minElo || 1

  const W = 280, H = 96
  const padX = 12, padY = 10

  const toX = (i: number) => padX + (i / 7) * (W - padX * 2)
  const toY = (elo: number) => padY + (1 - (elo - minElo) / range) * (H - padY * 2)

  const pathD = filledPoints.map((elo, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(elo).toFixed(1)}`).join(' ')
  const areaD = `${pathD} L ${toX(7).toFixed(1)} ${H} L ${toX(0).toFixed(1)} ${H} Z`

  const hoveredElo = hoveredIdx !== null ? filledPoints[hoveredIdx] : null
  const hoveredDate = hoveredIdx !== null ? anchorPoints[hoveredIdx] : null

  // Always lime green — direction doesn't change color
  const LINE_COLOR = '#84cc16'
  const gradId = `eloGrad-${currentUserId.slice(0, 8)}`

  return (
    <div className="w-full h-full flex flex-col px-4 pt-3 pb-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Elo Over Time</span>
        {hoveredIdx !== null && hoveredElo !== null && hoveredDate !== null ? (
          <span className="text-[10px] font-semibold">
            <span className="text-muted-foreground">{hoveredDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            <span className="mx-1 text-muted-foreground/40">·</span>
            <span className="font-black" style={{ color: LINE_COLOR }}>{hoveredElo} Elo</span>
          </span>
        ) : (
          <span className="text-xs font-bold flex items-center gap-1 text-lime-400">
            {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : trend === 'down' ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {delta > 0 ? '+' : ''}{delta} pts (8 wks)
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full flex-1 overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LINE_COLOR} stopOpacity="0.18" />
            <stop offset="100%" stopColor={LINE_COLOR} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Subtle grid lines */}
        {[0.25, 0.5, 0.75].map(frac => {
          const gridY = padY + frac * (H - padY * 2)
          return (
            <line key={frac} x1={padX} y1={gridY.toFixed(1)} x2={W - padX} y2={gridY.toFixed(1)}
              stroke="currentColor" strokeOpacity="0.06" strokeWidth="1" className="text-foreground" />
          )
        })}

        {/* Area fill */}
        <path d={areaD} fill={`url(#${gradId})`} />
        {/* Line */}
        <path d={pathD} fill="none" stroke={LINE_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Hover vertical guide */}
        {hoveredIdx !== null && (
          <line
            x1={toX(hoveredIdx)} y1={padY}
            x2={toX(hoveredIdx)} y2={H}
            stroke={LINE_COLOR} strokeWidth="1" strokeDasharray="3 2" opacity="0.5"
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* Nodes */}
        {filledPoints.map((elo, i) => {
          const cx = toX(i)
          const cy = toY(elo)
          const isHov = hoveredIdx === i
          return (
            <g key={i}>
              {/* Large invisible hit target */}
              <circle cx={cx} cy={cy} r="11" fill="transparent" style={{ cursor: 'crosshair' }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
              {/* Outer ring on hover */}
              {isHov && (
                <circle cx={cx} cy={cy} r="7" fill={LINE_COLOR} opacity="0.15" style={{ pointerEvents: 'none' }} />
              )}
              {/* Visible dot */}
              <circle cx={cx} cy={cy} r={isHov ? 4.5 : 2.8}
                fill={isHov ? LINE_COLOR : 'hsl(var(--card))'}
                stroke={LINE_COLOR}
                strokeWidth="2"
                style={{ pointerEvents: 'none', transition: 'r 0.1s' }}
              />
            </g>
          )
        })}
      </svg>

      {/* X-axis dates */}
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-muted-foreground/60">
          {anchorPoints[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
        <span className="text-[9px] font-semibold text-lime-400/70">Today</span>
      </div>
    </div>
  )
}

// ── Recent Form Strip ──────────────────────────────────────────────────────

function RecentFormStrip({ matches, currentUserId, onViewMatch }: {
  matches: MatchRecord[]
  currentUserId: string
  onViewMatch?: (matchId: string) => void
}) {
  const recent = useMemo(() => {
    return matches
      .filter(m => m.status === 'verified')
      .sort((a, b) => new Date(b.score_submitted_at ?? b.created_at).getTime() - new Date(a.score_submitted_at ?? a.created_at).getTime())
      .slice(0, 5)
  }, [matches])

  if (recent.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <p className="text-xs text-muted-foreground">No completed matches yet.</p>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-2 px-4 h-full">
      {recent.map((match) => {
        const isHome = match.home_player_id === currentUserId
        const delta = isHome ? match.home_elo_delta : match.away_elo_delta
        const isWin = delta !== null ? delta > 0 : null

        return (
          <button
            key={match.id}
            onClick={() => onViewMatch?.(match.id)}
            title={`View match — ${match.scheduled_time ? new Date(match.scheduled_time).toLocaleDateString() : ''}`}
            className={cn(
              'flex h-6 min-w-[28px] items-center justify-center rounded px-1.5 text-[10px] font-bold font-mono',
              'transition-transform hover:scale-110 hover:brightness-125 cursor-pointer',
              isWin === true
                ? 'bg-lime-500/15 text-lime-400 border border-lime-400/30'
                : isWin === false
                  ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                  : 'bg-muted/40 text-muted-foreground border border-border/40'
            )}
          >
            {delta !== null ? (delta > 0 ? `+${delta}` : `${delta}`) : '–'}
          </button>
        )
      })}
      {/* Empty slot fill to maintain 5-slot width */}
      {Array.from({ length: Math.max(0, 5 - recent.length) }).map((_, i) => (
        <div key={`empty-${i}`} className="h-6 w-[28px] rounded border border-border/30 bg-muted/10 pointer-events-none" />
      ))}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export function ProfileScreen({ targetPlayerId, onNavigateToMessages, onOpenChallengeModal, onViewMatch }: ProfileScreenProps) {
  const [isEditing, setIsEditing]       = useState(false)
  const [profile, setProfile]           = useState<ProfileData | null>(null)
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [matches, setMatches]           = useState<MatchRecord[]>([])
  const [showChallengeTooltip, setShowChallengeTooltip] = useState(false)
  const [playerRank, setPlayerRank]     = useState<number | null>(null)

  // Edit form state
  const [firstName, setFirstName]     = useState('')
  const [lastName, setLastName]       = useState('')
  const [gender, setGender]           = useState('')
  const [birthMonth, setBirthMonth]   = useState('')
  const [birthDay, setBirthDay]       = useState('')
  const [birthYear, setBirthYear]     = useState('')
  const [bio, setBio]                 = useState('')
  const [openToChallenges, setOpenToChallenges] = useState(true)
  const [selectedHubs, setSelectedHubs] = useState<string[]>([])
  const [avatarUrl, setAvatarUrl]     = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Courts state
  const [allCourts, setAllCourts]   = useState<Court[]>([])
  const [courtSearch, setCourtSearch] = useState('')
  const [addingCourt, setAddingCourt] = useState(false)
  const [newCourtName, setNewCourtName] = useState('')

  const isMe = !targetPlayerId || targetPlayerId === currentUserId
  const profileId = profile?.id ?? ''

  const verifiedMatches = useMemo(() => (
    matches.filter(m => m.status === 'verified')
  ), [matches])

  const matchStats = useMemo(() => {
    let computedWins = 0
    let computedLosses = 0

    for (const match of verifiedMatches) {
      const isHome = match.home_player_id === profileId
      const delta = isHome ? match.home_elo_delta : match.away_elo_delta
      if (delta == null) continue
      if (delta > 0) computedWins += 1
      else if (delta < 0) computedLosses += 1
    }

    return {
      computedWins,
      computedLosses,
    }
  }, [verifiedMatches, profileId])

  const wins = profile?.wins ?? matchStats.computedWins
  const losses = profile?.losses ?? matchStats.computedLosses
  const totalMatches = wins + losses
  const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : '0.0'

  const daysInMonth = birthMonth && birthYear
    ? new Date(parseInt(birthYear), parseInt(birthMonth), 0).getDate()
    : 31
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  useEffect(() => {
    const fetchProfileContext = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      const activeId = user?.id ?? null
      setCurrentUserId(activeId)

      const targetId = targetPlayerId || activeId
      if (!targetId) { setLoading(false); return }

      const eightWeeksAgo = new Date()
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)

      const [profileResult, courtsResult, matchesResult, rankResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', targetId).single(),
        supabase.from('courts').select('id, name').order('name'),
        supabase.from('matches')
          .select('id, home_player_id, away_player_id, home_elo_delta, away_elo_delta, status, scheduled_time, created_at, score_submitted_at')
          .or(`home_player_id.eq.${targetId},away_player_id.eq.${targetId}`)
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, elo_rating').order('elo_rating', { ascending: false })
      ])

      if (profileResult.error) {
        console.error('Error loading profile:', profileResult.error)
      }
      if (courtsResult.error) {
        console.error('Error loading courts:', courtsResult.error)
      }
      if (matchesResult.error) {
        console.error('Error loading profile matches:', matchesResult.error)
      }

      if (!profileResult.error && profileResult.data) {
        const data = profileResult.data as ProfileData
        setProfile(data)
        setFirstName(data.first_name || '')
        setLastName(data.last_name || '')
        setGender(data.gender || '')
        setBio(data.bio || '')
        setOpenToChallenges(data.open_to_challenges ?? true)
        setSelectedHubs(data.geographic_hubs || [])
        setAvatarUrl(data.avatar_url || '')
        if (data.birthdate) {
          const bd = new Date(data.birthdate)
          setBirthMonth(String(bd.getMonth() + 1))
          setBirthDay(String(bd.getDate()))
          setBirthYear(String(bd.getFullYear()))
        }
      }

      if (!courtsResult.error && courtsResult.data) {
        setAllCourts(courtsResult.data as Court[])
      }

      if (!matchesResult.error && matchesResult.data) {
        setMatches(matchesResult.data as MatchRecord[])
      }

      if (!rankResult.error && rankResult.data) {
        const rank = rankResult.data.findIndex(p => p.id === targetId)
        if (rank !== -1) setPlayerRank(rank + 1)
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
      if (error) {
        // If bucket is not present, fail gracefully and fallback to a generated avatar
        if (error.message && error.message.includes('Bucket not found')) {
          console.warn('Avatar upload failed: storage bucket not found. Falling back to generated avatar.')
          const seed = (profile && profile.name) ? profile.name : (currentUserId || 'player')
          const fallback = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=166534&radius=50`
          setAvatarUrl(fallback)
          return
        }
        throw error
      }
      const { data: urlData } = await supabase.storage.from('avatars').getPublicUrl(filePath)
      if (urlData?.publicUrl) setAvatarUrl(urlData.publicUrl)
    } catch (err: any) {
      console.error('Avatar upload error:', err?.message || err)
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
        setSelectedHubs(prev => [...prev, data.id])
        setNewCourtName('')
        setCourtSearch('')
      }
    } catch (err: any) {
      console.error('Add court error:', err.message)
    } finally {
      setAddingCourt(false)
    }
  }

  const toggleHub = (courtId: string) => {
    setSelectedHubs(prev =>
      prev.includes(courtId) ? prev.filter(h => h !== courtId) : [...prev, courtId]
    )
  }

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
    const birthdateStr = birthMonth && birthDay && birthYear
      ? `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`
      : null

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        name: displayName || profile.name,
        gender: gender || null,
        birthdate: birthdateStr,
        bio: bio.trim() || null,
        avatar_url: avatarUrl,
        open_to_challenges: openToChallenges,
        geographic_hubs: selectedHubs,
      })
      .eq('id', profile.id)

    if (!error) {
      setProfile(prev => prev ? {
        ...prev,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        name: displayName || prev.name,
        gender,
        birthdate: birthdateStr,
        bio: bio.trim(),
        avatar_url: avatarUrl,
        open_to_challenges: openToChallenges,
        geographic_hubs: selectedHubs,
      } : null)
      setIsEditing(false)
    }
    setSaving(false)
  }

  const handleCancelEdit = () => {
    if (!profile) return
    setFirstName(profile.first_name || '')
    setLastName(profile.last_name || '')
    setGender(profile.gender || '')
    setBio(profile.bio || '')
    setOpenToChallenges(profile.open_to_challenges ?? true)
    setSelectedHubs(profile.geographic_hubs || [])
    setAvatarUrl(profile.avatar_url || '')
    setCourtSearch('')
    if (profile.birthdate) {
      const bd = new Date(profile.birthdate)
      setBirthMonth(String(bd.getMonth() + 1))
      setBirthDay(String(bd.getDate()))
      setBirthYear(String(bd.getFullYear()))
    }
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

  const filteredCourts = allCourts.filter(c =>
    c.name.toLowerCase().includes(courtSearch.toLowerCase())
  )
  const exactMatch = allCourts.some(c => c.name.toLowerCase() === courtSearch.toLowerCase().trim())
  const showAddNew = isEditing && courtSearch.trim().length > 1 && !exactMatch
  // Map court IDs → names for display (geographic_hubs stores IDs in the DB)
  const courtNameMap = Object.fromEntries(allCourts.map(c => [c.id, c.name]))

  const displayFirstName = profile.first_name || profile.name?.split(' ')[0] || ''
  const displayLastName = profile.last_name || profile.name?.split(' ').slice(1).join(' ') || ''

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
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>Edit Profile</Button>
            )
          )}
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">

        {/* ── Profile Header ── */}
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-6 px-2">

          {/* Left col: Avatar + action buttons stacked beneath */}
          <div className="shrink-0 flex flex-col items-center gap-3">
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

            {/* Message + Challenge buttons sit under the avatar */}
            {!isMe && !isEditing && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleInitiateChat} className="gap-1.5 font-semibold">
                  <MessageSquare className="h-3.5 w-3.5" /> Message
                </Button>
                <div className="relative">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (profile.open_to_challenges) {
                        onOpenChallengeModal?.({ id: profile.id, name: profile.name })
                      }
                    }}
                    onMouseEnter={() => !profile.open_to_challenges && setShowChallengeTooltip(true)}
                    onMouseLeave={() => setShowChallengeTooltip(false)}
                    className={cn(
                      "gap-1.5 font-semibold",
                      !profile.open_to_challenges && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Swords className="h-3.5 w-3.5" /> Challenge
                  </Button>
                  {!profile.open_to_challenges && showChallengeTooltip && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-popover border border-border shadow-lg text-xs text-popover-foreground whitespace-nowrap z-50">
                      This player is not open to challenges at this time
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-popover" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right col: Name / badges / bio */}
          <div className="flex-1 min-w-0 w-full pt-1">
            {isEditing ? (
              <div className="space-y-3">
                {/* First + Last Name */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Name</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1 block uppercase tracking-wide">First</label>
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className="bg-background border-border text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1 block uppercase tracking-wide">Last</label>
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className="bg-background border-border text-sm" />
                    </div>
                  </div>
                </div>

                {/* Gender (private — only shown in own edit mode) */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Gender <span className="italic">(private)</span></label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                  >
                    <option value="">Select gender…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non-binary">Non-binary</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>

                {/* Birthdate (private — only shown in own edit mode) */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Date of Birth <span className="italic">(private)</span></label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={birthMonth}
                      onChange={(e) => { setBirthMonth(e.target.value); setBirthDay('') }}
                      className="rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                    >
                      <option value="">Month</option>
                      {MONTHS.map((m, i) => (
                        <option key={m} value={String(i + 1)}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={birthDay}
                      onChange={(e) => setBirthDay(e.target.value)}
                      disabled={!birthMonth}
                      className="rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 disabled:opacity-50"
                    >
                      <option value="">Day</option>
                      {days.map(d => <option key={d} value={String(d)}>{d}</option>)}
                    </select>
                    <select
                      value={birthYear}
                      onChange={(e) => setBirthYear(e.target.value)}
                      className="rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                    >
                      <option value="">Year</option>
                      {YEARS.map(y => <option key={y} value={String(y)}>{y}</option>)}
                    </select>
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Bio</label>
                  <Textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="bg-background border-border text-sm focus-visible:ring-primary"
                    placeholder="Describe your playstyle, e.g. Left-handed baseline counter-puncher, heavy topspin forehand. Available weekday evenings."
                    rows={3}
                  />
                </div>
              </div>
            ) : (
              <>
                {/* Name */}
                <h3 className="text-2xl font-bold text-foreground tracking-tight truncate text-center sm:text-left">
                  {profile.name}
                </h3>
                {/* Elo + Rank stacked below name */}
                <div className="mt-2 flex flex-col items-center sm:items-start gap-1.5">
                  <Badge className="bg-primary/10 text-primary border-none text-xs font-semibold px-2.5 py-1">
                    <Trophy className="mr-1.5 h-3.5 w-3.5" />{profile.elo_rating} Elo
                  </Badge>
                  {playerRank !== null && (
                    <Badge className="bg-lime-500/10 text-lime-400 border border-lime-400/20 text-xs font-black px-2.5 py-1 tabular-nums">
                      Rank #{playerRank}
                    </Badge>
                  )}
                </div>
                {/* Bio */}
                {profile.bio ? (
                  <p className="mt-3 text-muted-foreground text-sm leading-relaxed text-center sm:text-left">
                    {profile.bio}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>

        {/* ── Stats + Actions ── */}
        {!isEditing && (
        <div className="mt-6 rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col sm:flex-row">

          {/* Left Column: ELO chart + recent form (own profile) OR actions (other's profile) */}
          <div className="flex flex-col w-full sm:w-1/2 border-b sm:border-b-0 sm:border-r border-border">

            {/* Top: ELO Chart (show for both own and other profiles) */}
            <div className="flex-1 border-b border-border" style={{ minHeight: '140px' }}>
              <EloChart
                matches={matches}
                currentUserId={profile.id}
                currentElo={profile.elo_rating}
              />
            </div>

            {/* Bottom: Recent Form strip */}
            <div className="p-3 flex flex-col" style={{ minHeight: '56px' }}>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1 mb-1">Recent Form</p>
              <RecentFormStrip
                matches={matches}
                currentUserId={isMe ? (currentUserId ?? '') : profile.id}
                onViewMatch={onViewMatch}
              />
            </div>
          </div>

          {/* Right Column: Match stats */}
          <div className="w-full sm:w-1/2 p-6 flex flex-col items-center justify-center bg-card">
            <div className="flex flex-col items-center mb-6">
              <span className="text-5xl font-black text-foreground tracking-tighter leading-none">{totalMatches}</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2">Total Matches</span>
            </div>
            <div className="flex justify-center gap-10 w-full mb-6">
              <div className="flex flex-col items-center">
                <span className="text-3xl font-black text-primary leading-none">{wins}</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2">Wins</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl font-black text-destructive leading-none">{losses}</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2">Losses</span>
              </div>
            </div>
            <Badge variant="secondary" className="text-sm font-bold px-4 py-1.5 border-none shadow-sm">
              <Target className="mr-1.5 h-4 w-4" />
              {winRate}% Win Rate
            </Badge>
          </div>
        </div>
       
        )}

        {/* ── Open to Challenges (edit mode own profile only) ── */}
        {isMe && isEditing && (
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-5 shadow-sm">
            <div>
              <h4 className="font-bold text-foreground text-sm sm:text-base">Open to Challenges</h4>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-normal">
                Allow other players to issue direct match requests
              </p>
            </div>
            <Switch
              checked={openToChallenges}
              onCheckedChange={setOpenToChallenges}
            />
          </div>
        )}

        {/* ── Preferred Courts ── */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h4 className="font-bold text-foreground text-sm sm:text-base">Preferred Courts</h4>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-normal">
            {isEditing ? "Search and select courts, or add a new one if yours isn't listed." : 'Home courts for match scheduling.'}
          </p>

          {(isEditing ? selectedHubs : profile.geographic_hubs ?? []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(isEditing ? selectedHubs : profile.geographic_hubs ?? []).map(courtId => (
                <span key={courtId} className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
                  'border-primary bg-primary/10 text-primary'
                )}>
                  <MapPin className="h-3 w-3 shrink-0" />
                  {courtNameMap[courtId] ?? courtId}
                  {isEditing && (
                    <button onClick={() => toggleHub(courtId)} className="ml-0.5 hover:text-destructive transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {isEditing && (
            <div className="mt-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={courtSearch}
                  onChange={(e) => setCourtSearch(e.target.value)}
                  placeholder="Search courts…"
                  className="pl-8 h-9 bg-background border-border text-sm"
                />
              </div>

              {courtSearch.length > 0 && (
                <div className="rounded-lg border border-border bg-background divide-y divide-border/50 max-h-48 overflow-y-auto">
                  {filteredCourts.length > 0 ? filteredCourts.map(court => {
                    const selected = selectedHubs.includes(court.id)
                    return (
                      <button
                        key={court.id}
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
                  }) : (
                    <div className="px-3 py-2.5 text-sm text-muted-foreground">No courts found.</div>
                  )}
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

              {courtSearch.length === 0 && allCourts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {allCourts.map(court => {
                    const selected = selectedHubs.includes(court.id)
                    return (
                      <button
                        key={court.id}
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
          )}
        </div>
      </main>
    </div>
  )
}