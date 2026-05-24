'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trophy, Calendar, MapPin, ThumbsUp, MessageCircle, Send, ArrowLeft, Loader2, Award } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MatchProfile {
  id: string
  name: string
  avatar_url: string
  elo_rating: number
}

interface DetailMatchRecord {
  id: string
  home_player_id: string
  away_player_id: string
  proposed_location: string
  score_submitted_at: string
  elo_delta: number
  home_set_scores: number[]
  away_set_scores: number[]
  home_player: MatchProfile
  away_player: MatchProfile
  likes: { user_id: string; user: { name: string; avatar_url: string } }[]
  comments: { id: string; content: string; created_at: string; user: { name: string; avatar_url: string } }[]
}

interface MatchDetailScreenProps {
  matchId: string
  onBack: () => void
  onViewProfile: (id: string) => void
}

export function MatchDetailScreen({ matchId, onBack, onViewProfile }: MatchDetailScreenProps) {
  const [match, setMatch] = useState<DetailMatchRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    // Guard against missing matchId to prevent unnecessary API calls
    if (!matchId) {
      setLoading(false);
      return;
    }
    const loadMatchDetails = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)

      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          home_player:profiles!home_player_id(id, name, avatar_url, elo_rating),
          away_player:profiles!away_player_id(id, name, avatar_url, elo_rating),
          likes:match_likes(user_id, user:profiles!user_id(name, avatar_url)),
          comments:match_comments(id, content, created_at, user:profiles!user_id(name, avatar_url))
        `)
        .eq('id', matchId)
        .single()

      if (!error && data) {
        setMatch(data as unknown as DetailMatchRecord)
      }
      setLoading(false)
    }

    loadMatchDetails()
  }, [matchId])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!match) {
    return (
      <div className="p-8 text-center text-muted-foreground max-w-xl mx-auto">
        Match activity data could not be located.
        <Button onClick={onBack} variant="link" className="mt-2 block mx-auto">Go Back</Button>
      </div>
    )
  }

  // Calculate Match Specifics
  let homeSetsWon = 0
  let awaySetsWon = 0
  match.home_set_scores?.forEach((score, i) => {
    if (score > match.away_set_scores[i]) homeSetsWon++
    else awaySetsWon++
  })

  const homeWon = homeSetsWon > awaySetsWon
  const winner = homeWon ? match.home_player : match.away_player
  const loser = homeWon ? match.away_player : match.home_player
  const winnerSets = homeWon ? homeSetsWon : awaySetsWon
  const loserSets = homeWon ? awaySetsWon : homeSetsWon
  
  // FIXED: Declared totalSets variable
  const totalSets = match.home_set_scores?.length || 0
  
  const totalGames = [...(match.home_set_scores || []), ...(match.away_set_scores || [])].reduce((a, b) => a + b, 0)
  const hasLiked = match.likes?.some(l => l.user_id === currentUserId) || false

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !currentUserId || isSubmitting) return
    setIsSubmitting(true)

    const { data, error } = await supabase
      .from('match_comments')
      .insert({ match_id: matchId, user_id: currentUserId, content: newComment.trim() })
      .select(`id, content, created_at, user:profiles!user_id(name, avatar_url)`).single()

    if (!error && data) {
      setMatch(prev => prev ? { ...prev, comments: [...prev.comments, data as any] } : null)
      setNewComment('')
    }
    setIsSubmitting(false)
  }

  return (
    <div className="min-h-screen pb-16 bg-background text-foreground">
      {/* Dynamic Sub-header Context Bar */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex h-12 max-w-5xl items-center px-4">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-5xl p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT & CENTER COLUMN: Performance Breakdown Analysis */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            
            {/* Strava Athlete Header Look */}
            <div className="flex items-center gap-4 border-b border-border/60 pb-4">
              <Avatar className="h-16 w-16 border-2 border-primary/20 cursor-pointer" onClick={() => onViewProfile(winner.id)}>
                <AvatarImage src={winner.avatar_url} />
                <AvatarFallback>W</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  {winner.name} — <span className="text-primary font-semibold">Match Win</span>
                </h2>
                <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-2 mt-1">
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {new Date(match.score_submitted_at).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  {match.proposed_location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {match.proposed_location}</span>}
                </p>
              </div>
            </div>

            {/* Performance Metric Dashboard Cards Block */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-b border-border/60">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Match Outcome</span>
                <p className="text-2xl font-black text-foreground">{winnerSets} - {loserSets} <span className="text-sm font-normal text-muted-foreground">Sets</span></p>
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sets Played</span>
                <p className="text-2xl font-black text-foreground">{totalSets}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Games</span>
                <p className="text-2xl font-black text-foreground">{totalGames}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Elo Exchange</span>
                <p className="text-2xl font-black text-primary">+{match.elo_delta}</p>
              </div>
            </div>

            {/* Detailed Set-by-Set Score Grid */}
            <div className="pt-6">
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Set Breakdown Analysis</h4>
              <div className="overflow-hidden rounded-lg border border-border bg-secondary/10">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="p-3 pl-4">Player</th>
                      {match.home_set_scores.map((_, i) => (
                        <th key={i} className="p-3 text-center">Set {i + 1}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    <tr className={cn(homeWon ? "font-semibold text-foreground bg-primary/5" : "text-muted-foreground")}>
                      <td className="p-3 pl-4 flex items-center gap-2">
                        {match.home_player.name} {homeWon && <Badge variant="default" className="text-[10px] h-4 px-1 border-none bg-primary text-primary-foreground">Winner</Badge>}
                      </td>
                      {match.home_set_scores.map((score, i) => (
                        <td key={i} className={cn("p-3 text-center text-base", score > match.away_set_scores[i] && "text-primary font-bold")}>{score}</td>
                      ))}
                    </tr>
                    <tr className={cn(!homeWon ? "font-semibold text-foreground bg-primary/5" : "text-muted-foreground")}>
                      <td className="p-3 pl-4 flex items-center gap-2">
                        {match.away_player.name} {!homeWon && <Badge variant="default" className="text-[10px] h-4 px-1 border-none bg-primary text-primary-foreground">Winner</Badge>}
                      </td>
                      {match.away_set_scores.map((score, i) => (
                        <td key={i} className={cn("p-3 text-center text-base", score > match.home_set_scores[i] && "text-primary font-bold")}>{score}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Kudos/Likes Render Row Section */}
          {match.likes?.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center gap-2 overflow-hidden">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                <ThumbsUp className="h-3.5 w-3.5 fill-primary" />
              </div>
              <div className="flex -space-x-2 overflow-hidden shrink-0">
                {match.likes.slice(0, 5).map((like, idx) => (
                  <Avatar key={idx} className="h-6 w-6 border-2 border-card ring-0">
                    <AvatarImage src={like.user.avatar_url} />
                    <AvatarFallback>?</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <p className="text-xs text-muted-foreground truncate pl-1">
                Liked by <span className="font-semibold text-foreground">{match.likes[0].user.name}</span>
                {match.likes.length > 1 && ` and ${match.likes.length - 1} other ladder contenders`}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Banter, Comments & Social Interactions Tray */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b border-border/60 pb-2">
              <MessageCircle className="h-4 w-4" /> Match Banter ({match.comments?.length || 0})
            </h3>

            {/* Comments List Thread */}
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {match.comments?.length === 0 ? (
                <p className="text-xs text-center text-muted-foreground py-6">No comments yet. Drop some match feedback!</p>
              ) : (
                match.comments?.map((comment) => (
                  <div key={comment.id} className="flex gap-2 text-sm items-start">
                    <Avatar className="h-7 w-7 mt-0.5 shrink-0">
                      <AvatarImage src={comment.user?.avatar_url} />
                      <AvatarFallback>?</AvatarFallback>
                    </Avatar>
                    <div className="bg-secondary/30 rounded-lg px-3 py-2 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="font-bold text-foreground text-xs truncate">{comment.user?.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{new Date(comment.created_at).toLocaleDateString([], {month: 'short', day: 'numeric'})}</span>
                      </div>
                      <p className="text-foreground text-xs leading-relaxed break-words">{comment.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input Form Box */}
            <form onSubmit={handlePostComment} className="flex items-center gap-2 pt-2 border-t border-border/60">
              <Input
                placeholder="Write a message..."
                className="h-9 bg-background border-border text-xs focus-visible:ring-primary"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                disabled={isSubmitting}
              />
              <Button type="submit" size="sm" className="h-9 w-9 p-0 shrink-0 bg-primary" disabled={!newComment.trim() || isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
