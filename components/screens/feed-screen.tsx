'use client'

import React, { useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/utils/supabase/client'
import { ThumbsUp, MessageCircle, Send, Loader2, MapPin, User, Clock, Box, MoreHorizontal, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DatabaseMatch {
  id: string
  home_player_id: string
  away_player_id: string
  status: string
  proposed_location: string
  home_set_scores: number[]
  away_set_scores: number[]
  score_submitted_at: string
  start_time: string | null
  end_time: string | null
  surface: string | null
  match_type: string | null
  home_player_note: string | null
  away_player_note: string | null
  home_elo_delta: number | null
  away_elo_delta: number | null
  home_player: { id: string; name: string; avatar_url: string }
  away_player: { id: string; name: string; avatar_url: string }
  likes: { user_id: string }[]
  comments: { id: string }[]
}

interface CommentData {
  id: string
  content: string
  created_at: string
  user: { id: string; name: string; avatar_url: string }
}

export function FeedScreen({ onViewProfile, onViewMatch }: { onViewProfile?: (id: string) => void, onViewMatch?: (id: string) => void }) {
  const [feedMatches, setFeedMatches] = useState<DatabaseMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const fetchFeed = async () => {
      const { data: session } = await supabase.auth.getSession()
      if (session?.session?.user) setCurrentUserId(session.session.user.id)

      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'verified')
        .order('score_submitted_at', { ascending: false })

      if (error || !data) {
        setLoading(false)
        return
      }

      const neededProfileIds = new Set<string>()
      data.forEach(m => {
        neededProfileIds.add(m.home_player_id)
        neededProfileIds.add(m.away_player_id)
      })

      const { data: profiles } = await supabase.from('profiles').select('id, name, avatar_url').in('id', Array.from(neededProfileIds))
      const profileMap = (profiles || []).reduce((acc: any, p: any) => { acc[p.id] = p; return acc }, {})

      const enrichedMatches = await Promise.all(data.map(async (match) => {
        const [{ data: likes }, { data: comments }] = await Promise.all([
           supabase.from('match_likes').select('user_id').eq('match_id', match.id),
           supabase.from('match_comments').select('id').eq('match_id', match.id)
        ])
        return {
          ...match,
          home_player: profileMap[match.home_player_id],
          away_player: profileMap[match.away_player_id],
          likes: likes || [],
          comments: comments || []
        }
      }))

      setFeedMatches(enrichedMatches as unknown as DatabaseMatch[])
      setLoading(false)
    }

    fetchFeed()
  }, [])

  return (
    <div className="min-h-screen pb-24 md:pb-8 bg-background">
      <main className="mx-auto max-w-3xl space-y-6 p-4">
        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : feedMatches.map((match) => (
          <MatchCard key={match.id} match={match} onViewProfile={onViewProfile} onViewMatch={onViewMatch} currentUserId={currentUserId} />
        ))}
      </main>
    </div>
  )
}

function formatDuration(start?: string | null, end?: string | null) {
  if (!start || !end) return '—'
  const diffMs = new Date(end).getTime() - new Date(start).getTime()
  if (diffMs <= 0) return '—'
  const hrs = Math.floor(diffMs / 3600000)
  const mins = Math.floor((diffMs % 3600000) / 60000)
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
}

function timeAgo(dateString: string) {
  const diffHours = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 3600000)
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

function MatchCard({ match, onViewProfile, onViewMatch, currentUserId }: { match: DatabaseMatch, onViewProfile?: (id: string) => void, onViewMatch?: (id: string) => void, currentUserId: string | null }) {
  // Social Functionality State
  const initialLiked = match.likes?.some(l => l.user_id === currentUserId) || false
  const [hasLiked, setHasLiked] = useState(initialLiked)
  const [likesCount, setLikesCount] = useState(match.likes?.length || 0)
  
  const [commentsCount, setCommentsCount] = useState(match.comments?.length || 0)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<CommentData[]>([])
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingComments, setIsLoadingComments] = useState(false)

  // Math Setup
  let homeSetsWon = 0
  let awaySetsWon = 0
  match.home_set_scores.forEach((s, i) => { if (s > match.away_set_scores[i]) homeSetsWon++; else awaySetsWon++ })
  const homeWon = homeSetsWon > awaySetsWon

  // Interactions Logic
  const toggleLike = async () => {
    if (!currentUserId) return
    setHasLiked(!hasLiked)
    setLikesCount(prev => hasLiked ? prev - 1 : prev + 1)

    if (hasLiked) {
      await supabase.from('match_likes').delete().match({ match_id: match.id, user_id: currentUserId })
    } else {
      await supabase.from('match_likes').insert({ match_id: match.id, user_id: currentUserId })
    }
  }

  const toggleComments = async () => {
    setShowComments(!showComments)
    if (!showComments && comments.length === 0) {
      setIsLoadingComments(true)
      const { data: commentsData } = await supabase.from('match_comments').select('id, content, created_at, user_id').eq('match_id', match.id).order('created_at', { ascending: true })
      if (!commentsData) { setIsLoadingComments(false); return }

      const userIds = Array.from(new Set(commentsData.map((c: any) => c.user_id)))
      const { data: profilesData } = await supabase.from('profiles').select('id, name, avatar_url').in('id', userIds)
      
      const profileMap = (profilesData || []).reduce((acc: Record<string, any>, profile: any) => {
        acc[profile.id] = profile
        return acc
      }, {} as Record<string, any>)

      const loadedComments = commentsData.map((comment: any) => ({
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at,
        user: profileMap[comment.user_id] || { id: comment.user_id, name: 'Unknown', avatar_url: '' }
      }))

      setComments(loadedComments as CommentData[])
      setIsLoadingComments(false)
    }
  }

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !currentUserId || isSubmitting) return
    setIsSubmitting(true)

    const { data, error } = await supabase
      .from('match_comments')
      .insert({ match_id: match.id, user_id: currentUserId, content: newComment.trim() })
      .select('id, content, created_at').single()

    if (!error && data) {
      const { data: profileData } = await supabase.from('profiles').select('id, name, avatar_url').eq('id', currentUserId).single()
      setComments(prev => [...prev, {
        id: data.id, content: data.content, created_at: data.created_at,
        user: profileData ?? { id: currentUserId, name: 'You', avatar_url: '' }
      }])
      setCommentsCount(prev => prev + 1)
      setNewComment('')
    }
    setIsSubmitting(false)
  }

  const deleteComment = async (commentId: string) => {
    if (!currentUserId) return
    const { error } = await supabase.from('match_comments').delete().match({ id: commentId, user_id: currentUserId })
    if (!error) {
      setComments(prev => prev.filter((comment) => comment.id !== commentId))
      setCommentsCount(prev => Math.max(prev - 1, 0))
    }
  }

  return (
    <article className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden text-foreground">
      
      {/* HEADER: Social Context[cite: 1] */}
      <div className="p-5 flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <div 
              className="flex items-center gap-1.5 cursor-pointer group" 
              onClick={() => onViewProfile?.(match.home_player.id)}
            >
              <Avatar className="h-7 w-7 border border-border/50 shadow-sm transition-transform group-hover:scale-105">
                <AvatarImage src={match.home_player?.avatar_url} />
                <AvatarFallback className="text-[10px]">{match.home_player?.name?.[0]}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-semibold group-hover:underline">{match.home_player?.name}</span>
            </div>
            
            <span className="text-sm text-muted-foreground font-normal">with</span>
            
            <div 
              className="flex items-center gap-1.5 cursor-pointer group" 
              onClick={() => onViewProfile?.(match.away_player.id)}
            >
              <Avatar className="h-7 w-7 border border-border/50 shadow-sm transition-transform group-hover:scale-105">
                <AvatarImage src={match.away_player?.avatar_url} />
                <AvatarFallback className="text-[10px]">{match.away_player?.name?.[0]}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-semibold group-hover:underline">{match.away_player?.name}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {match.proposed_location} <span className="opacity-50">•</span> {timeAgo(match.score_submitted_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-secondary/50 px-2 py-1 rounded-full">Ranked</span>
          <button className="text-muted-foreground hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button>
        </div>
      </div>

      {/* BODY: Strava-Style Grid Layout[cite: 1] */}
      <div className="px-5 pb-5">
        <div 
          onClick={() => onViewMatch?.(match.id)}
          className="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-[1px] bg-border rounded-xl overflow-hidden cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all"
        >
          {/* Col 1: Player Context & Scores */}
          <div className="flex flex-col bg-card/50">
            {/* Home Player Row */}
            <div className="flex items-stretch border-b border-border/50 w-full">
              {/* Player Info (Darker Background) */}
              <div className="w-1/2 flex items-center gap-2.5 p-3 pl-3 bg-background/50 min-w-0">
                <div className="w-3 flex justify-center shrink-0">
                   {homeWon && <svg className="h-3 w-3 text-lime-400 fill-current" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21" /></svg>}
                </div>
                <Avatar className="h-7 w-7 border border-border/50 shrink-0">
                  <AvatarImage src={match.home_player?.avatar_url} />
                  <AvatarFallback className="text-[10px]">{match.home_player?.name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex flex-1 items-center min-w-0">
                  <span className={cn("font-semibold text-sm truncate block", homeWon ? "text-foreground" : "text-muted-foreground")}>
                    {match.home_player.name}
                  </span>
                </div>
                <span className={cn("text-xs font-bold text-right shrink-0 min-w-[2.5rem]", (match.home_elo_delta || 0) >= 0 ? "text-lime-400" : "text-red-500")}>
                  {(match.home_elo_delta || 0) > 0 ? '+' : ''}{match.home_elo_delta || 0}
                </span>
              </div>
              {/* Score Grid (Lighter Background) */}
              <div className="w-1/2 flex items-center justify-end gap-1.5 p-3 pr-4 bg-muted/20 min-w-0 shrink-0">
                {match.home_set_scores.map((s, i) => {
                  const isWinner = s > match.away_set_scores[i]
                  return (
                    <div key={i} className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-md border font-mono text-[15px] shrink-0",
                      isWinner 
                        ? "bg-lime-500/15 border-lime-400/30 text-lime-300 font-bold" 
                        : "bg-muted/40 border-border/60 text-muted-foreground font-medium"
                    )}>
                      {s}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Away Player Row */}
            <div className="flex items-stretch w-full">
              {/* Player Info (Darker Background) */}
              <div className="w-1/2 flex items-center gap-2.5 p-3 pl-3 bg-background/50 min-w-0">
                <div className="w-3 flex justify-center shrink-0">
                   {!homeWon && <svg className="h-3 w-3 text-lime-400 fill-current" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21" /></svg>}
                </div>
                <Avatar className="h-7 w-7 border border-border/50 shrink-0">
                  <AvatarImage src={match.away_player?.avatar_url} />
                  <AvatarFallback className="text-[10px]">{match.away_player?.name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex flex-1 items-center min-w-0">
                  <span className={cn("font-semibold text-sm truncate block", !homeWon ? "text-foreground" : "text-muted-foreground")}>
                    {match.away_player.name}
                  </span>
                </div>
                <span className={cn("text-xs font-bold text-right shrink-0 min-w-[2.5rem]", (match.away_elo_delta || 0) >= 0 ? "text-lime-400" : "text-red-500")}>
                  {(match.away_elo_delta || 0) > 0 ? '+' : ''}{match.away_elo_delta || 0}
                </span>
              </div>
              {/* Score Grid (Lighter Background) */}
              <div className="w-1/2 flex items-center justify-end gap-1.5 p-3 pr-4 bg-muted/20 min-w-0 shrink-0">
                {match.away_set_scores.map((s, i) => {
                  const isWinner = s > match.home_set_scores[i]
                  return (
                    <div key={i} className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-md border font-mono text-[15px] shrink-0",
                      isWinner 
                        ? "bg-lime-500/15 border-lime-400/30 text-lime-300 font-bold" 
                        : "bg-muted/40 border-border/60 text-muted-foreground font-medium"
                    )}>
                      {s}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Col 2: Match Info */}
          <div className="bg-card/50 p-4">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Match Info</h4>
            <div className="space-y-2.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2.5"><User className="h-3.5 w-3.5" /> {match.match_type || 'Singles'}</div>
              <div className="flex items-center gap-2.5"><Box className="h-3.5 w-3.5" /> {match.surface || 'Outdoor Hard'}</div>
              <div className="flex items-center gap-2.5"><Clock className="h-3.5 w-3.5" /> {formatDuration(match.start_time, match.end_time)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* PINNED MATCH NOTES */}
      {(match.home_player_note || match.away_player_note) && (
        <div className="px-5 pb-4">
           <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 border-b border-border/50 pb-2">Match Notes</h4>
           <div className="space-y-4">
             {match.home_player_note && (
               <div className="flex gap-3">
                 <Avatar className="h-8 w-8 shrink-0 border border-border/50"><AvatarImage src={match.home_player.avatar_url} /><AvatarFallback>{match.home_player.name[0]}</AvatarFallback></Avatar>
                 <div>
                   <div className="flex items-baseline gap-2 mb-0.5">
                     <span className="text-xs font-bold">{match.home_player.name}</span>
                     <span className="text-[10px] text-muted-foreground">{timeAgo(match.score_submitted_at)}</span>
                   </div>
                   <p className="text-sm text-foreground/90 leading-relaxed">{match.home_player_note}</p>
                 </div>
               </div>
             )}
             {match.away_player_note && (
               <div className="flex gap-3">
                 <Avatar className="h-8 w-8 shrink-0 border border-border/50"><AvatarImage src={match.away_player.avatar_url} /><AvatarFallback>{match.away_player.name[0]}</AvatarFallback></Avatar>
                 <div>
                   <div className="flex items-baseline gap-2 mb-0.5">
                     <span className="text-xs font-bold">{match.away_player.name}</span>
                     <span className="text-[10px] text-muted-foreground">{timeAgo(match.score_submitted_at)}</span>
                   </div>
                   <p className="text-sm text-foreground/90 leading-relaxed">{match.away_player_note}</p>
                 </div>
               </div>
             )}
           </div>
        </div>
      )}

      {/* FOOTER: Social Interactions */}
      <div className="flex items-center justify-between border-t border-border bg-secondary/5 px-5 py-3">
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleLike}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium transition-colors py-1 rounded-md",
              hasLiked ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ThumbsUp className={cn("h-4 w-4 transition-transform active:scale-75", hasLiked && "fill-primary text-primary")} />
            <span>{likesCount} {likesCount === 1 ? 'Like' : 'Likes'}</span>
          </button>
          
          <button 
            onClick={toggleComments}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium transition-colors py-1 rounded-md",
              showComments ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageCircle className={cn("h-4 w-4 transition-transform active:scale-75", showComments && "fill-muted-foreground/20")} />
            <span>{commentsCount} Comments</span>
          </button>
        </div>
      </div>

      {/* Expandable Comments Tray */}
      {showComments && (
        <div className="border-t border-border bg-background px-5 py-4 space-y-4 animate-in slide-in-from-top-1 duration-200">
          {isLoadingComments ? (
            <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : comments.length === 0 ? (
            <p className="text-[11px] font-medium uppercase tracking-wider text-center text-muted-foreground py-4 border border-dashed border-border/60 rounded-lg">No comments yet. Start the banter!</p>
          ) : (
            <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-2.5 items-start group">
                  <Avatar className="h-7 w-7 mt-0.5 shrink-0 border border-border">
                    <AvatarImage src={comment.user?.avatar_url} />
                    <AvatarFallback className="text-[9px] font-bold">{comment.user?.name?.[0] || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="bg-muted/30 border border-border/40 rounded-xl rounded-tl-sm px-3.5 py-2 text-xs flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 gap-2">
                       <span className="font-bold text-foreground">{comment.user?.name}</span>
                       <span className="text-[9px] text-muted-foreground">{new Date(comment.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <span className="text-foreground/90 break-words leading-relaxed">{comment.content}</span>
                  </div>
                  {comment.user.id === currentUserId && (
                    <button
                      type="button"
                      onClick={() => deleteComment(comment.id)}
                      className="inline-flex h-7 w-7 mt-1 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <form onSubmit={submitComment} className="flex items-center gap-2 pt-2">
            <Input 
              placeholder="Add a comment..." 
              className="h-10 bg-muted/20 border-border text-sm focus-visible:ring-primary/40 rounded-full px-4"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={isSubmitting}
              autoComplete="off"
            />
            <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-full transition-transform active:scale-90" disabled={!newComment.trim() || isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
            </Button>
          </form>
        </div>
      )}
    </article>
  )
}