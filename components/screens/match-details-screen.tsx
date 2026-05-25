'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trophy, Calendar, MapPin, ThumbsUp, MessageCircle, Send, ArrowLeft, Loader2 } from 'lucide-react'
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
  elo_delta: number | null
  home_elo_delta: number | null
  away_elo_delta: number | null
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

  // Flat Fetch Pattern (Safely bypasses Turbopack/Supabase relational bugs)
  useEffect(() => {
    if (!matchId || matchId.trim() === '') {
      setLoading(false)
      return
    }

    const loadMatchDetails = async () => {
      const { data: session } = await supabase.auth.getSession()
      if (session?.session?.user) setCurrentUserId(session.session.user.id)

      try {
        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .select('*')
          .eq('id', matchId)
          .single()

        if (matchError || !matchData) throw matchError

        const [
          { data: likesData },
          { data: commentsData }
        ] = await Promise.all([
          supabase.from('match_likes').select('user_id').eq('match_id', matchId),
          supabase.from('match_comments').select('id, user_id, content, created_at').eq('match_id', matchId).order('created_at', { ascending: true })
        ])

        const neededProfileIds = new Set<string>()
        neededProfileIds.add(matchData.home_player_id)
        neededProfileIds.add(matchData.away_player_id)
        likesData?.forEach(l => neededProfileIds.add(l.user_id))
        commentsData?.forEach(c => neededProfileIds.add(c.user_id))

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, elo_rating')
          .in('id', Array.from(neededProfileIds))

        const profileMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p
          return acc
        }, {} as Record<string, MatchProfile>)

        const assembledMatch: DetailMatchRecord = {
          ...matchData,
          home_player: profileMap[matchData.home_player_id],
          away_player: profileMap[matchData.away_player_id],
          likes: (likesData || []).map(l => ({
            user_id: l.user_id,
            user: profileMap[l.user_id] || { name: 'Unknown Player', avatar_url: '' }
          })),
          comments: (commentsData || []).map(c => ({
            id: c.id,
            content: c.content,
            created_at: c.created_at,
            user: profileMap[c.user_id] || { name: 'Unknown Player', avatar_url: '' }
          }))
        }

        setMatch(assembledMatch)
      } catch (err) {
        console.error("Failed to stitch local match data:", err)
      } finally {
        setLoading(false)
      }
    }

    loadMatchDetails()
  }, [matchId])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!match) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] p-8 text-center max-w-xl mx-auto space-y-4">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-2">
          <Trophy className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">Match Not Found</h3>
          <p className="text-sm text-muted-foreground mt-1">We couldn't locate the activity data for this match.</p>
        </div>
        <Button onClick={onBack} variant="outline" className="mt-4 rounded-full px-6">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>
      </div>
    )
  }

  // --- STATISTICAL CALCULATIONS ---
  let homeSetsWon = 0
  let awaySetsWon = 0
  match.home_set_scores?.forEach((score, i) => {
    if (score > match.away_set_scores[i]) homeSetsWon++
    else awaySetsWon++
  })

  const homeWon = homeSetsWon > awaySetsWon
  
  // Games & Percentages
  const homeGames = match.home_set_scores?.reduce((a, b) => a + b, 0) || 0
  const awayGames = match.away_set_scores?.reduce((a, b) => a + b, 0) || 0
  const totalGames = homeGames + awayGames
  const homeWinPct = totalGames > 0 ? Math.round((homeGames / totalGames) * 100) : 0
  const awayWinPct = totalGames > 0 ? 100 - homeWinPct : 0

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || isSubmitting) return

    let userId = currentUserId
    if (!userId) {
      const { data: session } = await supabase.auth.getSession()
      userId = session?.session?.user?.id ?? null
    }

    if (!userId) {
      console.error('Cannot submit comment: no authenticated user found.')
      return
    }

    setIsSubmitting(true)

    const { data, error } = await supabase
      .from('match_comments')
      .insert({ match_id: matchId, user_id: userId, content: newComment.trim() })
      .select('id, content, created_at')
      .single()

    if (error) {
      console.error('Error posting comment:', error)
      setIsSubmitting(false)
      return
    }

    const { data: myProfile, error: profileError } = await supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('Error loading commenter profile:', profileError)
    }

    if (data) {
      setMatch(prev => prev ? {
        ...prev,
        comments: [...prev.comments, {
          id: data.id,
          content: data.content,
          created_at: data.created_at,
          user: myProfile || { name: 'You', avatar_url: '' }
        }]
      } : null)
      setNewComment('')
    }

    setIsSubmitting(false)
  }

  return (
    <div className="min-h-screen pb-16 bg-background text-foreground animate-in slide-in-from-right-2 duration-200">
      {/* Sticky Dashboard Back Button */}
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-muted/80">
              <ArrowLeft className="h-4 w-4" /> 
            </div>
            Back to Dashboard
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-5xl p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT & CENTER COLUMN: Neutral Match Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. Head-to-Head Banner */}
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm flex flex-col items-center">
            {/* Match Meta Context */}
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-8 text-center bg-secondary/30 px-4 py-1.5 rounded-full">
              <Calendar className="h-3.5 w-3.5" /> 
              {new Date(match.score_submitted_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              {match.proposed_location && (
                <>
                  <span className="opacity-50">•</span>
                  <MapPin className="h-3.5 w-3.5 ml-0.5" /> 
                  {match.proposed_location}
                </>
              )}
            </div>

            {/* Split UI Layout */}
            <div className="flex w-full items-center justify-between max-w-lg mx-auto">
              
              {/* Home Player Side */}
              <div 
                className="flex flex-col items-center flex-1 gap-3 cursor-pointer group" 
                onClick={() => onViewProfile(match.home_player.id)}
              >
                <div className="relative">
                  <Avatar className="h-20 w-20 md:h-24 md:w-24 border-4 border-background shadow-md ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                    <AvatarImage src={match.home_player.avatar_url} />
                    <AvatarFallback className="text-xl font-bold">{match.home_player.name[0]}</AvatarFallback>
                  </Avatar>
                  {homeWon && (
                    <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground h-8 w-8 rounded-full flex items-center justify-center border-2 border-background shadow-sm">
                      <Trophy className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-sm md:text-base text-foreground group-hover:text-primary transition-colors">{match.home_player.name}</h3>
                  <span className={cn("text-xs font-bold block mt-0.5", homeWon ? "text-emerald-500" : "text-red-500")}>
                    {match.home_elo_delta !== null ? (match.home_elo_delta >= 0 ? `▲ +${match.home_elo_delta}` : `▼ ${match.home_elo_delta}`) : '—'} Elo
                  </span>
                </div>
              </div>

              {/* Center Score Status */}
              <div className="flex flex-col items-center px-2 md:px-6 shrink-0">
                <div className="flex items-center gap-3 text-4xl md:text-5xl font-black tracking-tighter">
                  <span className={cn(homeWon ? "text-primary" : "text-muted-foreground/60")}>{homeSetsWon}</span>
                  <span className="text-muted-foreground/20 text-3xl font-light">-</span>
                  <span className={cn(!homeWon ? "text-primary" : "text-muted-foreground/60")}>{awaySetsWon}</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-3">Final</span>
              </div>

              {/* Away Player Side */}
              <div 
                className="flex flex-col items-center flex-1 gap-3 cursor-pointer group" 
                onClick={() => onViewProfile(match.away_player.id)}
              >
                <div className="relative">
                  <Avatar className="h-20 w-20 md:h-24 md:w-24 border-4 border-background shadow-md ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                    <AvatarImage src={match.away_player.avatar_url} />
                    <AvatarFallback className="text-xl font-bold">{match.away_player.name[0]}</AvatarFallback>
                  </Avatar>
                  {!homeWon && (
                    <div className="absolute -bottom-2 -left-2 bg-primary text-primary-foreground h-8 w-8 rounded-full flex items-center justify-center border-2 border-background shadow-sm">
                      <Trophy className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-sm md:text-base text-foreground group-hover:text-primary transition-colors">{match.away_player.name}</h3>
                  <span className={cn("text-xs font-bold block mt-0.5", !homeWon ? "text-emerald-500" : "text-red-500")}>
                    {match.away_elo_delta !== null ? (match.away_elo_delta >= 0 ? `▲ +${match.away_elo_delta}` : `▼ ${match.away_elo_delta}`) : '—'} Elo
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Shared Central Stats & Set Breakdown */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-8">
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-6 text-center">Match Statistics</h4>
              <div className="space-y-6 max-w-md mx-auto">
                
                {/* Stat Row: Total Games */}
                <div className="flex items-center justify-between">
                  <span className={cn("w-12 text-center font-bold text-lg", homeGames > awayGames ? "text-foreground" : "text-muted-foreground")}>{homeGames}</span>
                  <span className="flex-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Games Won</span>
                  <span className={cn("w-12 text-center font-bold text-lg", awayGames > homeGames ? "text-foreground" : "text-muted-foreground")}>{awayGames}</span>
                </div>

                {/* Stat Row: Game Win % Progress Bar */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className={cn("w-12 text-center font-bold text-lg", homeWinPct > awayWinPct ? "text-foreground" : "text-muted-foreground")}>{homeWinPct}%</span>
                    <span className="flex-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Game Win %</span>
                    <span className={cn("w-12 text-center font-bold text-lg", awayWinPct > homeWinPct ? "text-foreground" : "text-muted-foreground")}>{awayWinPct}%</span>
                  </div>
                  <div className="flex h-2 w-full rounded-full overflow-hidden bg-muted">
                    <div style={{ width: `${homeWinPct}%` }} className={cn("h-full transition-all", homeWinPct > awayWinPct ? "bg-primary" : "bg-muted-foreground/30")} />
                    <div style={{ width: `${awayWinPct}%` }} className={cn("h-full transition-all", awayWinPct > homeWinPct ? "bg-primary" : "bg-muted-foreground/30")} />
                  </div>
                </div>

              </div>
            </div>

            {/* Detailed Set-by-Set Score Grid */}
            <div className="pt-4 border-t border-border/60">
              <div className="overflow-hidden rounded-xl border border-border bg-secondary/10 mt-2">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <th className="p-3 pl-4">Player</th>
                      {match.home_set_scores.map((_, i) => (
                        <th key={i} className="p-3 text-center">Set {i + 1}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    <tr className={cn(homeWon ? "font-bold text-foreground bg-primary/5" : "text-muted-foreground font-medium hover:bg-muted/20")}>
                      <td className="p-3 pl-4 flex items-center gap-2 cursor-pointer hover:underline" onClick={() => onViewProfile(match.home_player.id)}>
                        <Avatar className="h-6 w-6"><AvatarImage src={match.home_player.avatar_url} /><AvatarFallback>{match.home_player.name[0]}</AvatarFallback></Avatar>
                        {match.home_player.name}
                      </td>
                      {match.home_set_scores.map((score, i) => (
                        <td key={i} className={cn("p-3 text-center text-base", score > match.away_set_scores[i] && "text-primary font-black")}>{score}</td>
                      ))}
                    </tr>
                    <tr className={cn(!homeWon ? "font-bold text-foreground bg-primary/5" : "text-muted-foreground font-medium hover:bg-muted/20")}>
                      <td className="p-3 pl-4 flex items-center gap-2 cursor-pointer hover:underline" onClick={() => onViewProfile(match.away_player.id)}>
                         <Avatar className="h-6 w-6"><AvatarImage src={match.away_player.avatar_url} /><AvatarFallback>{match.away_player.name[0]}</AvatarFallback></Avatar>
                        {match.away_player.name}
                      </td>
                      {match.away_set_scores.map((score, i) => (
                        <td key={i} className={cn("p-3 text-center text-base", score > match.home_set_scores[i] && "text-primary font-black")}>{score}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Social Proof Row */}
          {match.likes?.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center gap-3 overflow-hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                <ThumbsUp className="h-4 w-4 fill-primary" />
              </div>
              <div className="flex -space-x-2 overflow-hidden shrink-0">
                {match.likes.slice(0, 5).map((like, idx) => (
                  <Avatar key={idx} className="h-7 w-7 border-2 border-card ring-0">
                    <AvatarImage src={like.user.avatar_url} />
                    <AvatarFallback>?</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <p className="text-sm text-muted-foreground truncate pl-1">
                Liked by <span className="font-semibold text-foreground">{match.likes[0].user.name}</span>
                {match.likes.length > 1 && ` and ${match.likes.length - 1} others`}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Banter, Comments & Social Interactions Tray */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col h-[600px] lg:sticky lg:top-20">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b border-border/60 pb-3 shrink-0">
              <MessageCircle className="h-4 w-4" /> Match Banter ({match.comments?.length || 0})
            </h3>

            {/* Comments List Thread */}
            <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-3">
              {match.comments?.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-80 space-y-2">
                  <MessageCircle className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-center text-muted-foreground font-medium">No comments yet. <br/> Drop some match feedback!</p>
                </div>
              ) : (
                match.comments?.map((comment) => (
                  <div key={comment.id} className="flex gap-2.5 items-start group">
                    <Avatar className="h-7 w-7 mt-0.5 shrink-0">
                      <AvatarImage src={comment.user?.avatar_url} />
                      <AvatarFallback>?</AvatarFallback>
                    </Avatar>
                    <div className="bg-muted/40 rounded-xl px-3.5 py-2.5 flex-1 min-w-0 border border-transparent group-hover:border-border/60 transition-colors">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-foreground text-xs truncate">{comment.user?.name}</span>
                        <span className="text-[10px] font-medium text-muted-foreground shrink-0">{new Date(comment.created_at).toLocaleDateString([], {month: 'short', day: 'numeric'})}</span>
                      </div>
                      <p className="text-foreground text-[13px] leading-relaxed break-words">{comment.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input Form Box */}
            <form onSubmit={handlePostComment} className="flex items-center gap-2 pt-3 border-t border-border/60 shrink-0">
              <Input
                placeholder="Add a comment..."
                className="h-10 bg-muted/30 border-border/50 text-sm focus-visible:ring-primary rounded-full px-4"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                disabled={isSubmitting}
                autoComplete="off"
              />
              <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-full transition-transform active:scale-95" disabled={!newComment.trim() || isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}