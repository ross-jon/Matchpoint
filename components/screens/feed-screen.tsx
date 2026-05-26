'use client'

import React, { useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge' // <--- ADDED THIS IMPORT
import { supabase } from '@/utils/supabase/client'
import { ThumbsUp, MessageCircle, Share2, MoreHorizontal, Send, Loader2, Calendar, MapPin, Trophy, Trash2 } from 'lucide-react'
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
  elo_delta: number
  home_player: { id: string; name: string; avatar_url: string }
  away_player: { id: string; name: string; avatar_url: string }
  likes: { user_id: string }[]
  comments: { id: string }[]
}

interface FeedScreenProps {
  onViewProfile?: (playerId: string) => void
  onViewMatch?: (matchId: string) => void
}

export function FeedScreen({ onViewProfile, onViewMatch }: FeedScreenProps) {
  const [feedMatches, setFeedMatches] = useState<DatabaseMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const fetchFeed = async () => {
      const { data: session } = await supabase.auth.getSession()
      if (session?.session?.user) setCurrentUserId(session.session.user.id)

      // Flat-fetch strategy to bypass Turbopack compiler bugs
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'verified')
        .order('score_submitted_at', { ascending: false })

      if (error) {
        console.error('Error fetching feed:', error)
        setLoading(false)
        return
      }

      if (!data || data.length === 0) {
        setFeedMatches([])
        setLoading(false)
        return
      }

      const neededProfileIds = new Set<string>()
      data.forEach(m => {
        neededProfileIds.add(m.home_player_id)
        neededProfileIds.add(m.away_player_id)
      })

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', Array.from(neededProfileIds))

      const profileMap = (profiles || []).reduce((acc: any, p: any) => {
        acc[p.id] = p
        return acc
      }, {})

      const enrichedMatches = await Promise.all(data.map(async (match) => {
        const [{ data: likes }, { data: comments }] = await Promise.all([
           supabase.from('match_likes').select('user_id').eq('match_id', match.id),
           supabase.from('match_comments').select('id').eq('match_id', match.id)
        ])
        
        return {
          ...match,
          home_player: profileMap[match.home_player_id] || { id: match.home_player_id, name: 'Unknown', avatar_url: '' },
          away_player: profileMap[match.away_player_id] || { id: match.away_player_id, name: 'Unknown', avatar_url: '' },
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
    <div className="min-h-screen pb-24 md:pb-8 bg-background text-foreground">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="px-4 py-4 md:px-6 max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Match Feed</h2>
            <p className="text-xs text-muted-foreground">Recent verified results across the ladder</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 p-4">
        {loading ? (
          <div className="rounded-xl border border-border bg-card p-12 flex justify-center text-muted-foreground shadow-sm">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : feedMatches.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground shadow-sm">
            No verified matches available yet.
          </div>
        ) : (
          feedMatches.map((match) => (
            <MatchCard 
              key={match.id} 
              match={match} 
              onViewProfile={onViewProfile} 
              onViewMatch={onViewMatch}
              currentUserId={currentUserId} 
            />
          ))
        )}
      </main>
    </div>
  )
}

function formatDateTime(dateString: string): string {
  if (!dateString) return 'Unknown Date'
  const date = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  if (diffDays === 0) return `Today, ${timeStr}`
  if (diffDays === 1) return `Yesterday, ${timeStr}`
  if (diffDays < 7) return `${date.toLocaleDateString([], { weekday: 'short' })}, ${timeStr}`
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`
}

interface CommentData {
  id: string
  content: string
  created_at: string
  user: { id: string; name: string; avatar_url: string }
}

function MatchCard({ match, onViewProfile, onViewMatch, currentUserId }: { match: DatabaseMatch; onViewProfile?: (playerId: string) => void; onViewMatch?: (matchId: string) => void; currentUserId: string | null }) {
  const initialLiked = match.likes?.some(l => l.user_id === currentUserId) || false
  const [hasLiked, setHasLiked] = useState(initialLiked)
  const [likesCount, setLikesCount] = useState(match.likes?.length || 0)
  
  const [commentsCount, setCommentsCount] = useState(match.comments?.length || 0)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<CommentData[]>([])
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingComments, setIsLoadingComments] = useState(false)

  let homeSetsWon = 0
  let awaySetsWon = 0
  const totalSets = match.home_set_scores?.length || 0
  
  for (let i = 0; i < totalSets; i++) {
    if (match.home_set_scores[i] > match.away_set_scores[i]) homeSetsWon++
    else awaySetsWon++
  }

  const homeWon = homeSetsWon > awaySetsWon

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

    const { error } = await supabase
      .from('match_comments')
      .delete()
      .match({ id: commentId, user_id: currentUserId })

    if (!error) {
      setComments(prev => prev.filter((comment) => comment.id !== commentId))
      setCommentsCount(prev => Math.max(prev - 1, 0))
    }
  }

  return (
    <article className="rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-all duration-200">
      
      {/* 1. Activity Header (Cleaned up meta-data) */}
      <div className="px-4 py-3 flex items-start justify-between bg-muted/10 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <Badge variant="outline" className="bg-background text-[9px] px-1.5 py-0 rounded-sm font-bold uppercase tracking-widest text-muted-foreground border-border">Official Match</Badge>
             <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {formatDateTime(match.score_submitted_at)}
             </span>
          </div>
          {match.proposed_location && (
            <span className="text-xs font-medium text-foreground/80 flex items-center gap-1">
              <MapPin className="h-3 w-3 text-muted-foreground" /> {match.proposed_location}
            </span>
          )}
        </div>
        <button className="text-muted-foreground hover:text-foreground rounded-lg p-1 transition-colors">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* 2. Broadcast-Style Scoreboard Matrix */}
      <div className="p-4 bg-background">
        <div
          onClick={() => onViewMatch?.(match.id)}
          className="w-full cursor-pointer rounded-3xl border border-border bg-muted/10 p-4 transition hover:border-primary/40"
        >
          <div className="space-y-4">
            <div className={cn(
              "rounded-3xl border border-border bg-background p-4",
              homeWon ? "shadow-sm border-emerald-300/30" : ""
            )}>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 shrink-0 border border-background shadow-sm">
                  <AvatarImage src={match.home_player?.avatar_url} />
                  <AvatarFallback className="text-[11px] font-bold">{match.home_player?.name?.[0] || 'H'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className={cn(
                    "truncate text-sm sm:text-base",
                    homeWon ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'
                  )}>
                    {match.home_player?.name}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Sets Won</div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {match.home_set_scores.map((score, idx) => {
                    const awayScore = match.away_set_scores[idx]
                    const won = score > awayScore
                    return (
                      <div key={idx} className={cn(
                        'min-w-[40px] rounded-2xl border px-2 py-2 text-center text-sm font-semibold tabular-nums',
                        won ? 'bg-emerald-500/15 text-emerald-600 border-emerald-300' : 'bg-muted/10 text-muted-foreground border-border'
                      )}>
                        {score}
                      </div>
                    )
                  })}
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Total</div>
                  <div className="text-sm font-semibold text-foreground">{homeSetsWon}</div>
                </div>
              </div>
            </div>

            <div className={cn(
              "rounded-3xl border border-border bg-background p-4",
              !homeWon ? "shadow-sm border-emerald-300/30" : ""
            )}>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 shrink-0 border border-background shadow-sm">
                  <AvatarImage src={match.away_player?.avatar_url} />
                  <AvatarFallback className="text-[11px] font-bold">{match.away_player?.name?.[0] || 'A'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className={cn(
                    "truncate text-sm sm:text-base",
                    !homeWon ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'
                  )}>
                    {match.away_player?.name}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Sets Won</div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {match.away_set_scores.map((score, idx) => {
                    const homeScore = match.home_set_scores[idx]
                    const won = score > homeScore
                    return (
                      <div key={idx} className={cn(
                        'min-w-[40px] rounded-2xl border px-2 py-2 text-center text-sm font-semibold tabular-nums',
                        won ? 'bg-emerald-500/15 text-emerald-600 border-emerald-300' : 'bg-muted/10 text-muted-foreground border-border'
                      )}>
                        {score}
                      </div>
                    )
                  })}
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Total</div>
                  <div className="text-sm font-semibold text-foreground">{awaySetsWon}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div className="rounded-2xl border border-border bg-muted/10 p-3">
                <div className="uppercase tracking-[0.22em] text-[10px]">Set Count</div>
                <div className="mt-1 text-sm font-semibold text-foreground">{totalSets} sets</div>
              </div>
              <div className="rounded-2xl border border-border bg-muted/10 p-3">
                <div className="uppercase tracking-[0.22em] text-[10px]">Match Winner</div>
                <div className="mt-1 text-sm font-semibold text-foreground">{homeWon ? match.home_player.name : match.away_player.name}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Footer: Social Interactions */}
      <div className="flex items-center justify-between border-t border-border bg-muted/10 px-4 py-2">
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleLike}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium transition-colors py-1 px-2 rounded-md hover:bg-muted/50",
              hasLiked ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ThumbsUp className={cn("h-3.5 w-3.5 transition-transform active:scale-75", hasLiked && "fill-primary")} />
            <span>{likesCount}</span>
          </button>
          
          <button 
            onClick={toggleComments}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium transition-colors py-1 px-2 rounded-md hover:bg-muted/50",
              showComments ? "text-foreground bg-muted/50" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageCircle className={cn("h-3.5 w-3.5 transition-transform active:scale-75", showComments && "fill-muted-foreground/20")} />
            <span>{commentsCount}</span>
          </button>
        </div>
      </div>

      {/* Expandable Comments Tray */}
      {showComments && (
        <div className="border-t border-border bg-background px-4 py-3 space-y-3 animate-in slide-in-from-top-1 duration-200">
          {isLoadingComments ? (
            <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : comments.length === 0 ? (
            <p className="text-[11px] font-medium uppercase tracking-wider text-center text-muted-foreground py-2 border border-dashed border-border/60 rounded-lg">No comments yet. Start the banter!</p>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-2 items-start group">
                  <Avatar className="h-6 w-6 mt-0.5 shrink-0 border border-border">
                    <AvatarImage src={comment.user?.avatar_url} />
                    <AvatarFallback className="text-[9px] font-bold">{comment.user?.name?.[0] || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="bg-muted/30 border border-border/40 rounded-xl rounded-tl-sm px-3 py-2 text-xs flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5 gap-2">
                       <span className="font-bold text-foreground">{comment.user?.name}</span>
                       <span className="text-[9px] text-muted-foreground">{new Date(comment.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <span className="text-foreground/90 break-words leading-relaxed">{comment.content}</span>
                  </div>
                  {comment.user.id === currentUserId && (
                    <button
                      type="button"
                      onClick={() => deleteComment(comment.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <form onSubmit={submitComment} className="flex items-center gap-2 pt-1">
            <Input 
              placeholder="Add a comment..." 
              className="h-9 bg-muted/20 border-border text-xs focus-visible:ring-primary/40 rounded-full px-4"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={isSubmitting}
            />
            <Button type="submit" size="icon" className="h-9 w-9 shrink-0 rounded-full transition-transform active:scale-90" disabled={!newComment.trim() || isSubmitting}>
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 ml-0.5" />}
            </Button>
          </form>
        </div>
      )}
    </article>
  )
}