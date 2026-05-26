'use client'

import { useState, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/utils/supabase/client'
import { Calendar, MapPin, Check, AlertCircle, X, Clock, Edit2, Trophy, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

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

// FIX: Turbopack safe flat-fetch helper query
const EX = '!'
const MATCH_QUERY = [
  '*',
  `home_player:profiles${EX}home_player_id(id, name, avatar_url, elo_rating)`,
  `away_player:profiles${EX}away_player_id(id, name, avatar_url, elo_rating)`
].join(',')

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

  // Action: Approve a submitted score (Moves match to 'verified')
  const handleApproveScore = async (matchId: string) => {
    const { error } = await supabase.from('matches').update({ status: 'verified', score_submitted_at: new Date().toISOString() }).eq('id', matchId)
    if (!error) setPendingScores(prev => prev.filter(m => m.id !== matchId))
  }

  // Action: Accept or Decline a received request
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

  // General Match Deletion (Cancel Request or Cancel Match)
  const handleCancelMatch = async (matchId: string, source: 'sent' | 'upcoming') => {
    if (source === 'sent') setSentRequests(prev => prev.filter(m => m.id !== matchId))
    if (source === 'upcoming') setUpcomingMatches(prev => prev.filter(m => m.id !== matchId))
    await supabase.from('matches').delete().eq('id', matchId)
  }

  // Update Match Details (Location / Date)
  const handleUpdateMatchDetails = async (matchId: string, location: string, date: string) => {
    await supabase.from('matches').update({ proposed_location: location, scheduled_time: date }).eq('id', matchId)
    loadMatches() // Reload to refresh all buckets just in case
  }

  // Submit Match Score
  const handleSubmitScore = async (matchId: string, homeScores: number[], awayScores: number[]) => {
    if (!currentUserId) return
    const { error } = await supabase.from('matches').update({
      status: 'completed',
      home_set_scores: homeScores,
      away_set_scores: awayScores,
      score_last_edited_by: currentUserId
    }).eq('id', matchId)

    if (!error) {
       loadMatches() // Reload completely to trigger the move from Upcoming -> Pending for the opponent
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
                 onUpdateDetails={(loc, date) => handleUpdateMatchDetails(match.id, loc, date)}
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
                 onUpdateDetails={(loc, date) => handleUpdateMatchDetails(match.id, loc, date)}
              />
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
        <Button size="sm" variant="outline" onClick={() => onAction(match.id, 'declined')} className="w-full gap-1.5 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30">
          <X className="h-4 w-4" /> Decline
        </Button>
      </div>
    </div>
  )
}

function SentRequestCard({ match, onCancel, onUpdateDetails }: { match: MatchRecord; onCancel: () => void; onUpdateDetails: (loc: string, date: string) => void }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editLoc, setEditLoc] = useState(match.proposed_location || '')
  const [editDate, setEditDate] = useState(match.scheduled_time ? match.scheduled_time.split('T')[0] : '')

  const handleSave = () => {
    onUpdateDetails(editLoc, editDate)
    setIsEditing(false)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 opacity-90 transition-opacity">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-10 w-10 shrink-0 grayscale">
            <AvatarImage src={match.away_player?.avatar_url} />
            <AvatarFallback>{match.away_player?.name?.[0]}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-foreground truncate">Waiting on {match.away_player?.name}</h4>
            {!isEditing && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                 <Calendar className="h-3 w-3 inline mr-1" />{match.scheduled_time ? new Date(match.scheduled_time).toLocaleDateString() : 'TBD'} 
                 <span className="mx-1">•</span> 
                 <MapPin className="h-3 w-3 inline mr-1" />{match.proposed_location || 'TBD'}
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
           <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Location</label>
                <Input value={editLoc} onChange={e => setEditLoc(e.target.value)} placeholder="TBD" className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Date</label>
                <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-8 text-xs" />
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
  onUpdateDetails: (loc: string, date: string) => void;
  onSubmitScore: (h: number[], a: number[]) => void;
}) {
  const isHome = match.home_player_id === currentUserId
  const opponent = isHome ? match.away_player : match.home_player

  // State Toggles
  const [isEditing, setIsEditing] = useState(false)
  const [isScoring, setIsScoring] = useState(false)

  // Edit State
  const [editLoc, setEditLoc] = useState(match.proposed_location || '')
  const [editDate, setEditDate] = useState(match.scheduled_time ? match.scheduled_time.split('T')[0] : '')

  // Score State (Supporting up to 3 sets)
  const [homeScores, setHomeScores] = useState<string[]>(['', '', ''])
  const [awayScores, setAwayScores] = useState<string[]>(['', '', ''])

  const handleSaveDetails = () => {
    onUpdateDetails(editLoc, editDate)
    setIsEditing(false)
  }

  const handleSaveScore = () => {
    // Filter out empty sets
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
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {match.scheduled_time ? new Date(match.scheduled_time).toLocaleDateString() : 'TBD'}</span>
                <span className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{match.proposed_location || 'TBD'}</span></span>
              </p>
            )}
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary uppercase shrink-0 bg-primary/5 hidden sm:flex">
          Accepted
        </Badge>
      </div>

      {/* Editing View */}
      {isEditing && (
        <div className="pt-3 border-t border-border/50 space-y-3 bg-muted/10 -mx-4 px-4 pb-4">
           <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Edit Match Details</h5>
           <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Location</label>
                <Input value={editLoc} onChange={e => setEditLoc(e.target.value)} placeholder="TBD" className="h-8 text-xs bg-background" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Date</label>
                <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-8 text-xs bg-background" />
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

      {/* Action Button Row */}
      {!isEditing && !isScoring && (
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" variant="secondary" className="flex-1 text-xs font-bold h-8" onClick={() => setIsScoring(true)}>
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
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
          <AlertCircle className="h-4 w-4" /> Score Pending Verification
        </div>
        <Button size="sm" onClick={() => onApprove(match.id)} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-1.5 h-8 shadow-sm">
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