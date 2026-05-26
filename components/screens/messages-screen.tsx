'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/utils/supabase/client'
import { ArrowLeft, Send, ClipboardCheck, Loader2, MoreVertical, Circle, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Profile {
  id: string
  name: string
  avatar_url: string
}

interface ConversationRow {
  id: string
  user_alpha: string
  user_beta: string
  last_message_snippet: string | null
  updated_at: string
  user_alpha_profile: Profile
  user_beta_profile: Profile
  unread_count?: number
}

interface MessageRow {
  id: string
  conversation_id: string
  sender_id: string
  message_text: string
  created_at: string
}

function formatTime(date: string) {
  if (!date) return ''
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (hours < 1) return 'Just now'
  if (hours < 24) return new Date(date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function groupMessagesByDate(messages: MessageRow[]) {
  const groups: { [key: string]: MessageRow[] } = {}
  messages.forEach((msg) => {
    const date = new Date(msg.created_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
    if (!groups[date]) groups[date] = []
    groups[date].push(msg)
  })
  return groups
}

// --- New Message Player Selection Overlay ---
function NewMessageOverlay({ 
  currentUserId, 
  onClose, 
  onSelectOpponent 
}: { 
  currentUserId: string
  onClose: () => void
  onSelectOpponent: (profileId: string) => void 
}) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!search.trim()) {
      setResults([])
      return
    }
    let active = true
    const fetchUsers = async () => {
      setSearching(true)
      const { data } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .ilike('name', `%${search}%`)
        .neq('id', currentUserId)
        .limit(10)
      
      if (active && data) setResults(data as Profile[])
      if (active) setSearching(false)
    }
    const timeoutId = setTimeout(fetchUsers, 350)
    return () => { active = false; clearTimeout(timeoutId) }
  }, [search, currentUserId])

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-background animate-in slide-in-from-bottom-2 duration-200">
      <header className="shrink-0 border-b border-border bg-card p-3 flex items-center justify-between shadow-sm">
        <Button variant="ghost" onClick={onClose} className="font-medium">Cancel</Button>
        <h3 className="font-bold text-foreground">New Message</h3>
        <div className="w-[70px]" /> 
      </header>
      <div className="p-4 border-b border-border bg-card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search players by name..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            autoFocus
            className="pl-9 bg-muted/40"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {searching ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : results.length > 0 ? (
          results.map(profile => (
            <div 
              key={profile.id} 
              onClick={() => onSelectOpponent(profile.id)}
              className="flex items-center gap-3 p-3 rounded-xl border border-transparent hover:bg-muted/60 transition-colors cursor-pointer group"
            >
              <Avatar className="h-10 w-10 ring-2 ring-transparent group-hover:ring-primary/20">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback className="font-semibold">{profile.name[0]}</AvatarFallback>
              </Avatar>
              <span className="font-semibold text-[15px] group-hover:text-primary transition-colors">{profile.name}</span>
            </div>
          ))
        ) : search.trim() ? (
          <p className="text-center text-muted-foreground p-8">No players found.</p>
        ) : (
          <p className="text-center text-muted-foreground p-8 text-sm">Type a name above to search for players in the ladder.</p>
        )}
      </div>
    </div>
  )
}

function ConversationItem({ 
  conversation, 
  currentUserId, 
  onClick, 
  onViewProfile // FIX: Explicitly match the prop passed by MatchPointApp
}: { 
  conversation: ConversationRow; 
  currentUserId: string; 
  onClick: () => void; 
  onViewProfile?: (playerId: string) => void 
}) {
  const isAlpha = conversation.user_alpha === currentUserId
  const opponent = isAlpha ? conversation.user_beta_profile : conversation.user_alpha_profile
  const hasUnread = Boolean(conversation.unread_count && conversation.unread_count > 0)

  // FIX: Isolated and robust event click handler mapping safely directly to your router triggers
  const handleProfileClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (opponent?.id && onViewProfile) {
      onViewProfile(opponent.id)
    } else {
      console.warn("onViewProfile function callback parameter missing on parent instance mapping.")
    }
  }

  return (
    <div 
      className="flex w-full items-center gap-4 rounded-xl border border-border/60 bg-card p-3.5 text-left shadow-sm transition-all hover:border-primary/40 hover:bg-muted/40 cursor-pointer group relative"
      onClick={onClick}
    >
      <div 
        className="relative shrink-0 z-20 cursor-pointer pointer-events-auto hover:opacity-80 transition-opacity" 
        onClick={handleProfileClick}
      >
        <Avatar className="h-12 w-12 ring-2 ring-transparent group-hover:ring-primary/10 transition-all">
          <AvatarImage src={opponent?.avatar_url} alt={opponent?.name} />
          <AvatarFallback className="font-semibold text-muted-foreground">
            {opponent?.name ? opponent.name.split(' ').map((n) => n[0]).join('') : 'P'}
          </AvatarFallback>
        </Avatar>
        {hasUnread && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-background shadow-sm">
            {conversation.unread_count}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 py-1">
        <div className="flex items-center justify-between gap-2 mb-1">
          {/* FIX: Set clear pointer events and z-indexing to keep text links separate from the parent row card */}
          <span 
            className={cn(
                "truncate transition-colors text-[15px] font-semibold text-foreground/90 hover:text-primary hover:underline z-20 relative cursor-pointer pointer-events-auto", 
                hasUnread && "font-bold text-foreground"
            )}
            onClick={handleProfileClick}
          >
            {opponent?.name || 'Unknown Contender'}
          </span>
          <span className={cn("shrink-0 text-[11px]", hasUnread ? "text-primary font-bold" : "text-muted-foreground font-medium")}>
            {conversation.updated_at ? formatTime(conversation.updated_at) : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
            {hasUnread && <Circle className="h-2 w-2 fill-primary text-primary shrink-0" />}
            <p className={cn('truncate text-sm text-muted-foreground', hasUnread && 'text-foreground font-medium')}>
              {conversation.last_message_snippet ?? 'Start the conversation...'}
            </p>
        </div>
      </div>
    </div>
  )
}

function ChatBubble({ message, isCurrentUser }: { message: MessageRow; isCurrentUser: boolean }) {
  return (
    <div className={cn('flex w-full mb-1', isCurrentUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm break-words relative group',
          isCurrentUser 
            ? 'bg-primary text-primary-foreground rounded-br-sm' 
            : 'bg-muted/80 text-foreground rounded-bl-sm border border-border/40'
        )}
      >
        <p className="text-[15px] leading-snug">{message.message_text}</p>
        <span className={cn(
          'text-[10px] mt-1 block select-none',
          isCurrentUser ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground text-left'
        )}>
          {new Date(message.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}

interface ChatViewProps {
  opponent: Profile
  messages: MessageRow[]
  currentUserId: string
  onBack: () => void
  onSubmitScore: () => void
  onSend: (content: string) => Promise<void>
  onViewProfile?: (playerId: string) => void // FIX: Align with parent interface
}

function ChatView({ opponent, messages, currentUserId, onBack, onSubmitScore, onSend, onViewProfile }: ChatViewProps) {
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const groupedMessages = groupMessagesByDate(messages)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || isSending) return
    
    const text = newMessage.trim()
    setNewMessage('')
    setIsSending(true)
    
    await onSend(text)
    
    setIsSending(false)
    scrollToBottom()
  }

  return (
    <div className="absolute inset-0 z-[50] flex flex-col h-[100dvh] w-full bg-background overflow-hidden animate-in slide-in-from-right-2 duration-200">
      <header className="shrink-0 sticky top-0 z-[60] w-full border-b border-border bg-card/95 backdrop-blur-md p-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 h-9 w-9 rounded-full hover:bg-muted">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Button>
          
          {/* FIX: Corrected and verified navigation handlers for internal chat headers */}
          <div 
             className="flex items-center gap-3 cursor-pointer group min-w-0 pointer-events-auto z-20"
             onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (opponent?.id && onViewProfile) onViewProfile(opponent.id)
             }}
          >
              <Avatar className="h-10 w-10 shrink-0 ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                <AvatarImage src={opponent?.avatar_url} alt={opponent?.name} />
                <AvatarFallback className="font-semibold text-muted-foreground">{opponent?.name ? opponent.name.split(' ').map((n) => n[0]).join('') : 'P'}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h3 className="truncate font-bold text-[15px] leading-none group-hover:text-primary transition-colors">{opponent?.name || 'Unknown Player'}</h3>
                <p className="text-[11px] text-muted-foreground font-medium mt-1 group-hover:underline">Tap to view profile</p>
              </div>
          </div>
        </div>

        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground">
            <MoreVertical className="h-5 w-5" />
        </Button>
      </header>

       <div className="px-4 py-2 bg-muted/30 border-b border-border shrink-0 z-10 relative">
          <button
            onClick={onSubmitScore}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-background border border-border px-4 py-2 text-sm font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary shadow-sm"
          >
            <ClipboardCheck className="h-4 w-4" />
            Ready to log your match? Submit Score
          </button>
       </div>

      <div className="flex-1 overflow-y-auto p-4 bg-muted/10 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 opacity-80">
             <Avatar className="h-20 w-20 ring-4 ring-muted">
                <AvatarImage src={opponent?.avatar_url} className="opacity-50 grayscale" />
                <AvatarFallback className="text-2xl">{opponent?.name?.[0] || '?'}</AvatarFallback>
             </Avatar>
            <div>
              <p className="text-base font-semibold text-foreground">Say hi to {opponent?.name.split(' ')[0]}!</p>
              <p className="text-sm text-muted-foreground max-w-[200px] mt-1">Coordinate court times, ask for a match, or talk strategy.</p>
            </div>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date} className="space-y-4">
              <div className="flex justify-center my-6">
                <span className="bg-background/95 backdrop-blur-md text-muted-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm border border-border/50">
                  {date}
                </span>
              </div>
              <div className="space-y-1">
                 {msgs.map((message) => (
                    <ChatBubble key={message.id} message={message} isCurrentUser={message.sender_id === currentUserId} />
                 ))}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      <div className="shrink-0 border-t border-border bg-card p-3 safe-area-bottom relative z-20">
        <form onSubmit={handleSend} className="flex items-end gap-2 max-w-4xl mx-auto">
          <Input
            placeholder="Message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="min-h-[44px] bg-muted/30 border-border/50 rounded-2xl focus-visible:ring-primary/30 px-4 py-3"
            autoComplete="off"
          />
          <Button 
            type="submit" 
            size="icon" 
            className="h-11 w-11 shrink-0 rounded-full transition-transform active:scale-95" 
            disabled={!newMessage.trim() || isSending}
          >
            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 ml-0.5" />}
          </Button>
        </form>
      </div>
    </div>
  )
}

// FIX: Ensure interface perfectly aligns with app/page.tsx `<MessagesScreen />` rendering
interface MessagesScreenProps {
  selectedConversationId: string | null
  selectedMessageOpponentId?: string | null
  onSelectConversation: (id: string | null) => void
  onNavigateToMatches: () => void
  onViewProfile?: (playerId: string) => void 
}

export function MessagesScreen({ 
  selectedConversationId, 
  selectedMessageOpponentId, 
  onSelectConversation, 
  onNavigateToMatches, 
  onViewProfile 
}: MessagesScreenProps) {
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false)

  // -----------------------------------------------------------------------------
  // PERMANENT FIX: Complete removal of the single table join query string. 
  // We resolve the relational join manually across local JS memory steps. 
  // Turbopack can never throw an absolute path error since no '!' exists.
  // -----------------------------------------------------------------------------
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const currentId = sessionData?.session?.user?.id ?? null
        setUserId(currentId)

        if (!currentId) return

        // Step A: Fetch flat tables
        const { data: convData, error: convError } = await supabase
          .from('conversations')
          .select('id, user_alpha, user_beta, last_message_snippet, updated_at')
          .or(`user_alpha.eq.${currentId},user_beta.eq.${currentId}`)
          .order('updated_at', { ascending: false })

        if (convError) throw convError
        if (!convData || convData.length === 0) {
          setConversations([])
          return
        }

        // Step B: Collect distinct keys
        const neededProfileIds = new Set<string>()
        convData.forEach(c => {
          neededProfileIds.add(c.user_alpha)
          neededProfileIds.add(c.user_beta)
        })

        // Step C: Batch query profile identities
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', Array.from(neededProfileIds))

        const profileMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p
          return acc
        }, {} as Record<string, Profile>)

        // Step D: Stitch metadata models together locally
        const enrichedConversations = await Promise.all(
          convData.map(async (conv: any) => {
            let snippet = conv.last_message_snippet
            if (!snippet) {
               const { data: lastMsg } = await supabase
                 .from('messages')
                 .select('message_text')
                 .eq('conversation_id', conv.id)
                 .order('created_at', { ascending: false })
                 .limit(1)
                 .single()
               
               if (lastMsg) snippet = lastMsg.message_text
            }
            return {
              ...conv,
              last_message_snippet: snippet,
              user_alpha_profile: profileMap[conv.user_alpha] || { id: conv.user_alpha, name: 'User', avatar_url: '' },
              user_beta_profile: profileMap[conv.user_beta] || { id: conv.user_beta, name: 'User', avatar_url: '' }
            }
          })
        )

        setConversations(enrichedConversations as unknown as ConversationRow[])
      } catch (error) {
        console.error('Error stitching metadata packages:', error)
      } finally {
        setLoading(false)
      }
    }

    loadConversations()
  }, [])

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([])
      return
    }

    const channel = supabase.channel(`messages-${selectedConversationId}`)
    
    const loadMessages = async () => {
      const { data: msgData, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', selectedConversationId)
        .order('created_at', { ascending: true })

      if (msgError) {
        console.error('Error loading messages:', msgError)
      } else {
        setMessages((msgData ?? []) as MessageRow[])
      }
      
      setConversations(prev => 
         prev.map(c => c.id === selectedConversationId ? { ...c, unread_count: 0 } : c)
      )
    }

    loadMessages()

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${selectedConversationId}`
      },
      (payload) => {
        const newMsg = payload.new as MessageRow
        
        setMessages((current) => {
          if (current.some(m => m.id === newMsg.id)) return current
          return [...current, newMsg]
        })
        
        setConversations(prev => 
          prev.map(c => 
            c.id === selectedConversationId 
              ? { ...c, last_message_snippet: newMsg.message_text, updated_at: newMsg.created_at } 
              : c
          )
        )
      }
    ).subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedConversationId])

  const handleCreateConversation = useCallback(async (opponentId: string) => {
    if (!userId) return

    const isAlpha = userId < opponentId
    const userAlpha = isAlpha ? userId : opponentId
    const userBeta = isAlpha ? opponentId : userId

    const { data: existing, error: existingError } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_alpha', userAlpha)
      .eq('user_beta', userBeta)
      .maybeSingle()

    if (existing && existing.id) {
      onSelectConversation(existing.id)
      setIsNewMessageOpen(false)
      return
    }

    const { data: insertData, error: insertError } = await supabase
      .from('conversations')
      .insert({ user_alpha: userAlpha, user_beta: userBeta })
      .select('id')
      .single()

    if (insertError || !insertData) {
      console.error('Error establishing clean conversation logs:', insertError ?? existingError)
      return
    }

    const { data: opProfile } = await supabase.from('profiles').select('id, name, avatar_url').eq('id', opponentId).single()
    const { data: myProfile } = await supabase.from('profiles').select('id, name, avatar_url').eq('id', userId).single()

    const newConvData: ConversationRow = {
      id: insertData.id,
      user_alpha: userAlpha,
      user_beta: userBeta,
      last_message_snippet: null,
      updated_at: new Date().toISOString(),
      user_alpha_profile: myProfile as Profile,
      user_beta_profile: opProfile as Profile
    }

    setConversations(prev => [newConvData, ...prev])
    onSelectConversation(newConvData.id)
    setIsNewMessageOpen(false)
  }, [onSelectConversation, userId])

  useEffect(() => {
    if (!selectedMessageOpponentId || !userId || selectedConversationId) return
    handleCreateConversation(selectedMessageOpponentId)
  }, [selectedMessageOpponentId, userId, selectedConversationId, handleCreateConversation])

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId)
  
  const opponentProfile = selectedConversation
    ? selectedConversation.user_alpha === userId
      ? selectedConversation.user_beta_profile
      : selectedConversation.user_alpha_profile
    : null

  const handleSendMessage = async (content: string) => {
    if (!selectedConversationId || !userId) return

    const messagePayload = {
      conversation_id: selectedConversationId,
      sender_id: userId,
      message_text: content.trim()
    }

    const { data, error } = await supabase
      .from('messages')
      .insert([messagePayload])
      .select()

    if (error) {
      console.error('Error sending message:', error)
      return
    }

    await supabase
       .from('conversations')
       .update({ 
           last_message_snippet: content.trim(),
           updated_at: new Date().toISOString()
       })
       .eq('id', selectedConversationId)

    if (data?.[0]) {
      setMessages((current) => {
        if (current.some(m => m.id === data[0].id)) return current
        return [...current, data[0] as MessageRow]
      })
      setConversations(prev => 
         prev.map(c => 
            c.id === selectedConversationId 
              ? { ...c, last_message_snippet: content, updated_at: new Date().toISOString() } 
              : c
         ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      )
    }
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-80px)] w-full items-center justify-center text-muted-foreground bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="relative w-full h-[calc(100vh-80px)] md:h-screen bg-background overflow-hidden flex flex-col">
      
      {isNewMessageOpen && (
        <NewMessageOverlay 
          currentUserId={userId ?? ''}
          onClose={() => setIsNewMessageOpen(false)}
          onSelectOpponent={handleCreateConversation}
        />
      )}

      {selectedConversation && opponentProfile ? (
        <ChatView
          opponent={opponentProfile}
          messages={messages}
          currentUserId={userId ?? ''}
          onBack={() => onSelectConversation(null)}
          onSubmitScore={onNavigateToMatches}
          onSend={handleSendMessage}
          onViewProfile={onViewProfile}
        />
      ) : (
        <>
          <header className="shrink-0 border-b border-border bg-background/95 backdrop-blur-md px-4 py-4 md:px-6 shadow-sm z-10">
            <div className="max-w-2xl mx-auto flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">Messages</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Coordinate matches with your rivals.</p>
                </div>
                <Button 
                   variant="outline" 
                   size="icon" 
                   className="h-9 w-9 rounded-full shrink-0 hover:border-primary hover:text-primary transition-colors"
                   onClick={() => setIsNewMessageOpen(true)}
                >
                   <span className="text-lg leading-none mb-0.5">+</span>
                </Button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="max-w-2xl mx-auto">
              {conversations.length > 0 ? (
                <div className="space-y-3 pb-20">
                  {conversations.map((conversation) => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      currentUserId={userId ?? ''}
                      onClick={() => onSelectConversation(conversation.id)}
                      onViewProfile={onViewProfile}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-16 flex flex-col items-center text-center border border-dashed border-border/60 rounded-2xl bg-muted/10">
                   <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                       <Send className="h-6 w-6 text-primary ml-1" />
                   </div>
                  <h3 className="text-lg font-semibold text-foreground">Your inbox is empty</h3>
                  <p className="mt-2 text-sm text-muted-foreground max-w-xs">Start a conversation by challenging a player from the ladder roster.</p>
                  <Button onClick={() => setIsNewMessageOpen(true)} className="mt-6 rounded-full" variant="outline">
                      New Message
                  </Button>
                </div>
              )}
            </div>
          </main>
        </>
      )}
    </div>
  )
}