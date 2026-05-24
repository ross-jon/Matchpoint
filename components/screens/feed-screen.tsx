'use client'

import React, { useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/utils/supabase/client'
import { ThumbsUp, MessageCircle, Share2, MoreHorizontal, Send, Loader2, ChevronRight, Calendar, MapPin } from 'lucide-react'
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
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)

      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          home_player:profiles!home_player_id(id, name, avatar_url),
          away_player:profiles!away_player_id(id, name, avatar_url),
          likes:match_likes(user_id),
          comments:match_comments(id)
        `)
        .eq('status', 'verified')
        .order('score_submitted_at', { ascending: false })

      if (error) {
        console.error('Error fetching feed:', error)
      } else {
        setFeedMatches((data ?? []) as unknown as DatabaseMatch[])
      }
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

      <main className="mx-auto max-w-2xl space-y-4 p-4">
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
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
  const timeStr = date.toLocaleTimeString([], timeOptions)

  if (diffDays === 0) return `Today at ${timeStr}`
  if (diffDays === 1) return `Yesterday at ${timeStr}`
  if (diffDays < 7) {
    const day = date.toLocaleDateString([], { weekday: 'long' })
    return `${day} at ${timeStr}`
  }
  
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`
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
      const { data, error } = await supabase
        .from('match_comments')
        .select(`
          id, content, created_at,
          user:profiles!user_id(id, name, avatar_url)
        `)
        .eq('match_id', match.id)
        .order('created_at', { ascending: true })

      if (!error && data) {
        setComments(data as unknown as CommentData[])
      }
      setIsLoadingComments(false)
    }
  }

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !currentUserId || isSubmitting) return

    setIsSubmitting(true)
    const { data, error } = await supabase
      .from('match_comments')
      .insert({
        match_id: match.id,
        user_id: currentUserId,
        content: newComment.trim()
      })
      .select(`
        id, content, created_at,
        user:profiles!user_id(id, name, avatar_url)
      `)
      .single()

    if (!error && data) {
      setComments(prev => [...prev, data as unknown as CommentData])
      setCommentsCount(prev => prev + 1)
      setNewComment('')
    }
    setIsSubmitting(false)
  }

  return (
    <article className="rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-all duration-200 hover:border-muted-foreground/20">
      {/* 1. Activity Header */}
      <div className="p-4 pb-2.5 flex items-start justify-between">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary/90 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>
            Singles Tennis Match
          </h3>
          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDateTime(match.score_submitted_at)}</span>
            {match.proposed_location && (
              <span className="flex items-center gap-0.5 text-muted-foreground/80">
                • <MapPin className="h-3 w-3 inline ml-0.5" /> {match.proposed_location}
              </span>
            )}
          </div>
        </div>
        <button className="text-muted-foreground hover:text-foreground rounded-lg p-1 hover:bg-muted transition-colors">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* 2. Scoreboard Box Box Section Layout */}
      <div className="px-4 pb-3">
        <div 
          onClick={() => onViewMatch?.(match.id)}
          className="w-full text-left rounded-xl bg-muted/40 border border-muted/80 p-3.5 transition-all hover:bg-muted/70 relative group cursor-pointer flex items-center justify-between gap-4"
        >
          <div className="space-y-2.5 flex-1 min-w-0">
            {/* Row A: Home Player */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div 
                  onClick={(e) => { e.stopPropagation(); match.home_player?.id && onViewProfile?.(match.home_player.id); }}
                  className="shrink-0 hover:opacity-85 transition-opacity"
                >
                  <Avatar className="h-7 w-7 ring-1 ring-primary/5">
                    <AvatarImage src={match.home_player?.avatar_url} />
                    <AvatarFallback className="text-xs font-semibold">{match.home_player?.name?.[0] || 'H'}</AvatarFallback>
                  </Avatar>
                </div>
                <span 
                  onClick={(e) => { e.stopPropagation(); match.home_player?.id && onViewProfile?.(match.home_player.id); }}
                  className={cn(
                    "text-sm font-medium truncate hover:text-primary hover:underline cursor-pointer transition-colors", 
                    homeWon ? "text-foreground font-semibold" : "text-muted-foreground/90"
                  )}
                >
                  {match.home_player?.name}
                </span>
                {homeWon && <span className="text-primary font-bold text-xs select-none">✓</span>}
              </div>
              
              <div className="flex items-center gap-1 font-mono text-sm shrink-0">
                {match.home_set_scores?.map((score, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "h-6 w-6 text-xs flex items-center justify-center rounded border select-none font-bold",
                      score > match.away_set_scores[idx] 
                        ? "bg-primary/10 border-primary/40 text-primary font-bold" 
                        : "bg-background border-border text-muted-foreground/60"
                    )}
                  >
                    {score}
                  </div>
                ))}
              </div>
            </div>

            {/* Row B: Away Player */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div 
                  onClick={(e) => { e.stopPropagation(); match.away_player?.id && onViewProfile?.(match.away_player.id); }}
                  className="shrink-0 hover:opacity-85 transition-opacity"
                >
                  <Avatar className="h-7 w-7 ring-1 ring-primary/5">
                    <AvatarImage src={match.away_player?.avatar_url} />
                    <AvatarFallback className="text-xs font-semibold">{match.away_player?.name?.[0] || 'A'}</AvatarFallback>
                  </Avatar>
                </div>
                <span 
                  onClick={(e) => { e.stopPropagation(); match.away_player?.id && onViewProfile?.(match.away_player.id); }}
                  className={cn(
                    "text-sm font-medium truncate hover:text-primary hover:underline cursor-pointer transition-colors", 
                    !homeWon ? "text-foreground font-semibold" : "text-muted-foreground/90"
                  )}
                >
                  {match.away_player?.name}
                </span>
                {!homeWon && <span className="text-primary font-bold text-xs select-none">✓</span>}
              </div>
              
              <div className="flex items-center gap-1 font-mono text-sm shrink-0">
                {match.away_set_scores?.map((score, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "h-6 w-6 text-xs flex items-center justify-center rounded border select-none font-bold",
                      score > match.home_set_scores[idx] 
                        ? "bg-primary/10 border-primary/40 text-primary font-bold" 
                        : "bg-background border-border text-muted-foreground/60"
                    )}
                  >
                    {score}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Details Action Chevron */}
          <div className="shrink-0 pl-1">
            <div className="h-7 w-7 rounded-lg border border-border bg-background flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:border-primary/30 group-hover:bg-primary/5 transition-all">
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Footer: Social Interactions */}
      <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2.5">
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleLike}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium transition-colors py-1 px-2.5 rounded-lg hover:bg-muted",
              hasLiked ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ThumbsUp className={cn("h-3.5 w-3.5 transition-all", hasLiked && "fill-primary")} />
            <span>{likesCount}</span>
          </button>
          
          <button 
            onClick={toggleComments}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium transition-colors py-1 px-2.5 rounded-lg hover:bg-muted",
              showComments ? "text-foreground bg-muted" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageCircle className={cn("h-3.5 w-3.5", showComments && "fill-muted-foreground/20")} />
            <span>{commentsCount}</span>
          </button>
        </div>
        <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground py-1 px-2.5 rounded-lg hover:bg-muted">
          <Share2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Share</span>
        </button>
      </div>

      {/* Expandable Comments Tray */}
      {showComments && (
        <div className="border-t border-border bg-muted/10 px-4 py-3 space-y-3.5 animate-in slide-in-from-top-2 duration-200">
          {isLoadingComments ? (
            <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-center text-muted-foreground py-1">No comments yet. Be the first to banter!</p>
          ) : (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-2 items-start">
                  <Avatar className="h-6 w-6 mt-0.5 shrink-0">
                    <AvatarImage src={comment.user?.avatar_url} />
                    <AvatarFallback className="text-[10px] font-semibold">{comment.user?.name?.[0] || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="bg-muted/60 rounded-lg px-2.5 py-1.5 text-xs max-w-[85%] inline-block">
                    <span className="font-bold text-foreground mr-1.5">{comment.user?.name}</span>
                    <span className="text-foreground/90 break-words">{comment.content}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={submitComment} className="flex items-center gap-2 pt-0.5">
            <Input 
              placeholder="Add a comment..." 
              className="h-8 bg-background border-border text-xs focus-visible:ring-primary/40"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={isSubmitting}
            />
            <Button type="submit" size="sm" className="h-8 w-8 p-0 shrink-0" disabled={!newComment.trim() || isSubmitting}>
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </form>
        </div>
      )}
    </article>
  )
}