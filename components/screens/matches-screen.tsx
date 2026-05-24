'use client'

import { useState, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { supabase } from '@/utils/supabase/client'
import { Calendar, MapPin, Trophy, Check, AlertCircle, X, Clock } from 'lucide-react'

interface MatchProfile {
  id: string
  name: string
  avatar_url: string
  elo_rating: number
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

export function MatchesScreen() {
  const [upcomingMatches, setUpcomingMatches] = useState<MatchRecord[]>([])
  const [pendingScores, setPendingScores] = useState<MatchRecord[]>([])
  const [receivedRequests, setReceivedRequests] = useState<MatchRecord[]>([])
  const [sentRequests, setSentRequests] = useState<MatchRecord[]>([])
  
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const loadMatches = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
      setCurrentUserId(user.id)

      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          home_player:profiles!home_player_id(id, name, avatar_url, elo_rating),
          away_player:profiles!away_player_id(id, name, avatar_url, elo_rating)
        `)
        .or(`home_player_id.eq.${user.id},away_player_id.eq.${user.id}`)

      if (error) {
        console.error('Error fetching system matches:', error)
        setLoading(false)
        return
      }

      const matchRows = (data ?? []) as MatchRecord[]

      // Cleanly segment the dashboard into the four actionable buckets
      setPendingScores(matchRows.filter(m => m.status === 'completed' && m.score_last_edited_by !== user.id))
      setReceivedRequests(matchRows.filter(m => m.status === 'pending' && m.away_player_id === user.id))
      setSentRequests(matchRows.filter(m => m.status === 'pending' && m.home_player_id === user.id))
      setUpcomingMatches(matchRows.filter(m => m.status === 'accepted'))
      
      setLoading(false)
    }

    loadMatches()
  }, [])

  // Action: Approve a submitted score
  const handleApproveScore = async (matchId: string) => {
    const { error } = await supabase.from('matches').update({ status: 'verified' }).eq('id', matchId)
    if (!error) setPendingScores(prev => prev.filter(m => m.id !== matchId))
  }

  // Action: Accept or Decline a received request
  const handleRequestAction = async (matchId: string, action: 'accepted' | 'declined') => {
    // Optimistic UI update
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

  // Action: Cancel a request you sent
  const handleCancelRequest = async (matchId: string) => {
    setSentRequests(prev => prev.filter(m => m.id !== matchId))
    await supabase.from('matches').delete().eq('id', matchId)
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground max-w-2xl mx-auto mt-6">
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

      {/* 2. Received Requests (Needs your approval) */}
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
              <UpcomingMatchCard key={match.id} match={match} currentUserId={currentUserId} />
            ))}
          </div>
        )}
      </section>

      {/* 4. Sent Requests (Waiting for opponent) */}
      {sentRequests.length > 0 && (
        <section className="space-y-3 pt-4 border-t border-border/50">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> Sent Requests ({sentRequests.length})
          </h3>
          <div className="space-y-3">
            {sentRequests.map(match => (
              <SentRequestCard key={match.id} match={match} onCancel={handleCancelRequest} />
            ))}
          </div>
        </section>
      )}

    </main>
  )
}

// --- SUB-COMPONENTS ---

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
          <Calendar className="h-3.5 w-3.5 shrink-0" /> {dateStr}
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground truncate">
          <MapPin className="h-3.5 w-3.5 shrink-0" /> {match.proposed_location || 'TBD'}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={() => onAction(match.id, 'accepted')} className="w-full gap-1.5 font-bold shadow-md">
          <Check className="h-4 w-4" /> Accept
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAction(match.id, 'declined')} className="w-full gap-1.5">
          <X className="h-4 w-4" /> Decline
        </Button>
      </div>
    </div>
  )
}

function SentRequestCard({ match, onCancel }: { match: MatchRecord; onCancel: (id: string) => void }) {
  const dateStr = match.scheduled_time ? new Date(match.scheduled_time).toLocaleDateString() : 'TBD'

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 flex items-center justify-between gap-4 opacity-75 hover:opacity-100 transition-opacity">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="h-10 w-10 shrink-0 grayscale">
          <AvatarImage src={match.away_player?.avatar_url} />
          <AvatarFallback>{match.away_player?.name?.[0]}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-foreground truncate">Waiting on {match.away_player?.name}</h4>
          <p className="text-xs text-muted-foreground truncate">
            {dateStr} • {match.proposed_location || 'TBD'}
          </p>
        </div>
      </div>
      <Button size="sm" variant="ghost" onClick={() => onCancel(match.id)} className="h-8 text-xs text-muted-foreground hover:text-destructive">
        Cancel
      </Button>
    </div>
  )
}

function UpcomingMatchCard({ match, currentUserId }: { match: MatchRecord; currentUserId: string | null }) {
  const isHome = match.home_player_id === currentUserId
  const opponent = isHome ? match.away_player : match.home_player

  const dateStr = match.scheduled_time ? new Date(match.scheduled_time).toLocaleDateString() : 'TBD'
  const timeStr = match.scheduled_time && match.scheduled_time.includes('T') 
    ? new Date(match.scheduled_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
    : ''

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="h-12 w-12 shrink-0">
          <AvatarImage src={opponent?.avatar_url} alt={opponent?.name} />
          <AvatarFallback>{opponent?.name ? opponent.name.split(' ').map(n => n[0]).join('') : 'P'}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h4 className="font-semibold text-foreground truncate">Match vs {opponent?.name}</h4>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Calendar className="h-3 w-3" /> {dateStr} {timeStr && `at ${timeStr}`}
          </p>
          {match.proposed_location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
              <MapPin className="h-3 w-3" /> {match.proposed_location}
            </p>
          )}
        </div>
      </div>
      <Badge variant="outline" className="text-xs border-primary/30 text-primary uppercase shrink-0 bg-primary/5">
        Accepted
      </Badge>
    </div>
  )
}

function PendingScoreCard({ match, onApprove }: { match: MatchRecord; onApprove: (id: string) => void }) {
  const scoreString = match.home_set_scores?.map((score, i) => `${score}-${match.away_set_scores[i]}`).join(', ')

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
          <AlertCircle className="h-4 w-4" /> Opponent submitted a score log
        </div>
        <Button size="sm" onClick={() => onApprove(match.id)} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-1.5 h-8">
          <Check className="h-3.5 w-3.5" /> Approve Score
        </Button>
      </div>
      
      <div className="flex items-center justify-between border-t border-border/50 pt-3">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarImage src={match.home_player?.avatar_url} alt={match.home_player?.name} />
              <AvatarFallback>H</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground">{match.home_player?.name}</span>
          </div>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">VS</span>
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarImage src={match.away_player?.avatar_url} alt={match.away_player?.name} />
              <AvatarFallback>A</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground">{match.away_player?.name}</span>
          </div>
        </div>
        <div className="text-sm font-bold text-foreground bg-card px-3 py-1 rounded border border-border">
          {scoreString}
        </div>
      </div>
    </div>
  )
}