'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { ThumbsUp, MessageCircle, Share2, MoreHorizontal, Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Unified schema definition mapping the new relational tables
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
      // 1. Get current user to determine if they've liked a match
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)

      // 2. Fetch matches WITH their nested likes and comments arrays
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
    <div className="min-h-screen pb-24 md:pb-8">
      <header className="border-b border-border bg-card">
        <div className="px-4 py-4 md:px-6">
          <h2 className="text-xl font-bold text-foreground">Match Feed</h2>
          <p className="text-sm text-muted-foreground">Recent verified results across the ladder</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 p-4">
        {loading ? (
          <div className="rounded-lg border border-border bg-card p-8 flex justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : feedMatches.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
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
  // Social State
  const initialLiked = match.likes?.some(l => l.user_id === currentUserId) || false
  const [hasLiked, setHasLiked] = useState(initialLiked)
  const [likesCount, setLikesCount] = useState(match.likes?.length || 0)
  
  // Comments State
  const [commentsCount, setCommentsCount] = useState(match.comments?.length || 0)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<CommentData[]>([])
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingComments, setIsLoadingComments] = useState(false)

  // Math Setup to determine winner sets vs loser sets neutrally
  let homeSetsWon = 0
  let awaySetsWon = 0
  const totalSets = match.home_set_scores?.length || 0
  
  for (let i = 0; i < totalSets; i++) {
    if (match.home_set_scores[i] > match.away_set_scores[i]) homeSetsWon++
    else awaySetsWon++
  }

  const homeWon = homeSetsWon > awaySetsWon

  // Handle Like Toggle
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

  // Handle Fetching & Toggling Comments
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

  // Handle Submitting a New Comment
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
    <article className="rounded-xl border border-border bg-card shadow-sm overflow-hidden text-foreground">
      {/* 1. Activity-Centric Header */}
      <div className="p-4 pb-3 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
            Singles Tennis Match
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDateTime(match.score_submitted_at)}
            {match.proposed_location && ` • ${match.proposed_location}`}
          </p>
        </div>
        <button className="text-muted-foreground hover:text-foreground">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      {/* 2. Interactive Broadcast Scoreboard Block */}
      <div className="px-4 pb-2">
        <button 
          onClick={() => onViewMatch?.(match.id)}
          className="w-full text-left rounded-lg bg-secondary/20 border border-border/80 p-4 space-y-3 transition-colors hover:bg-secondary/40 group block"
        >
          {/* Row A: Home Competitor */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div 
                onClick={(e) => { e.stopPropagation(); match.home_player?.id && onViewProfile?.(match.home_player.id); }}
                className="shrink-0 hover:opacity-80 transition-opacity"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={match.home_player?.avatar_url} />
                  <AvatarFallback>{match.home_player?.name?.[0] || 'H'}</AvatarFallback>
                </Avatar>
              </div>
              <span className={cn("text-sm font-medium truncate", homeWon ? "text-foreground font-bold" : "text-muted-foreground")}>
                {match.home_player?.name}
              </span>
              {homeWon && <span className="text-primary font-bold text-xs shrink-0 select-none">✓</span>}
            </div>
            
            {/* Horizontal Set Block Grid */}
            <div className="flex items-center gap-1.5 font-mono text-sm shrink-0">
              {match.home_set_scores?.map((score, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "h-7 w-7 flex items-center justify-center rounded border select-none font-bold",
                    score > match.away_set_scores[idx] 
                      ? "bg-primary/10 border-primary text-primary font-black" 
                      : "bg-background border-border text-muted-foreground/70"
                  )}
                >
                  {score}
                </div>
              ))}
              <span className="text-xs text-muted-foreground font-sans ml-1">({homeSetsWon} Sets)</span>
            </div>
          </div>

          {/* Row B: Away Competitor */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div 
                onClick={(e) => { e.stopPropagation(); match.away_player?.id && onViewProfile?.(match.away_player.id); }}
                className="shrink-0 hover:opacity-80 transition-opacity"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={match.away_player?.avatar_url} />
                  <AvatarFallback>{match.away_player?.name?.[0] || 'A'}</AvatarFallback>
                </Avatar>
              </div>
              <span className={cn("text-sm font-medium truncate", !homeWon ? "text-foreground font-bold" : "text-muted-foreground")}>
                {match.away_player?.name}
              </span>
              {!homeWon && <span className="text-primary font-bold text-xs shrink-0 select-none">✓</span>}
            </div>
            
            {/* Horizontal Set Block Grid */}
            <div className="flex items-center gap-1.5 font-mono text-sm shrink-0">
              {match.away_set_scores?.map((score, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "h-7 w-7 flex items-center justify-center rounded border select-none font-bold",
                    score > match.home_set_scores[idx] 
                      ? "bg-primary/10 border-primary text-primary font-black" 
                      : "bg-background border-border text-muted-foreground/70"
                  )}
                >
                  {score}
                </div>
              ))}
              <span className="text-xs text-muted-foreground font-sans ml-1">({awaySetsWon} Sets)</span>
            </div>
          </div>

          {/* Context Action Prompt Anchor */}
          <div className="text-center pt-2 border-t border-border/40 text-[11px] text-muted-foreground group-hover:text-primary transition-colors font-medium">
            Click to view detailed match breakdown and analytics.
          </div>
        </button>
      </div>

      {/* 3. Footer: Social Actions */}
      <div className="flex items-center justify-between border-t border-border bg-secondary/10 px-4 py-3">
        <div className="flex items-center gap-6">
          <button 
            onClick={toggleLike}
            className={cn(
              "flex items-center gap-1.5 text-sm font-medium transition-colors",
              hasLiked ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ThumbsUp className={cn("h-4 w-4 transition-all", hasLiked && "fill-primary")} />
            <span>{likesCount}</span>
          </button>
          
          <button 
            onClick={toggleComments}
            className={cn(
              "flex items-center gap-1.5 text-sm font-medium transition-colors",
              showComments ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageCircle className={cn("h-4 w-4", showComments && "fill-muted")} />
            <span>{commentsCount}</span>
          </button>
        </div>
        <button className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">Share</span>
        </button>
      </div>

      {/* Expandable Comments Tray */}
      {showComments && (
        <div className="border-t border-border bg-secondary/5 px-4 py-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
          {isLoadingComments ? (
            <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-center text-muted-foreground pb-2">No comments yet. Be the first to banter!</p>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-2">
                  <Avatar className="h-6 w-6 mt-0.5 shrink-0">
                    <AvatarImage src={comment.user?.avatar_url} />
                    <AvatarFallback className="text-[10px]">{comment.user?.name?.[0] || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="bg-secondary/40 rounded-lg px-3 py-2 text-sm max-w-[85%]">
                    <span className="font-semibold text-foreground mr-2">{comment.user?.name}</span>
                    <span className="text-muted-foreground">{comment.content}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* New Comment Input */}
          <form onSubmit={submitComment} className="flex items-center gap-2 pt-1">
            <Input 
              placeholder="Add a comment..." 
              className="h-9 bg-background border-border text-sm"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={isSubmitting}
            />
            <Button type="submit" size="sm" className="h-9 w-9 p-0 shrink-0" disabled={!newComment.trim() || isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      )}
    </article>
  )
}