'use client'

import { useState, useEffect, useRef } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/utils/supabase/client'
import { ArrowLeft, Send, ClipboardCheck, Loader2 } from 'lucide-react'
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
  unread_count?: number // Maintained hook capability for future badge features
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
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString()
}

interface ConversationItemProps {
  conversation: ConversationRow
  currentUserId: string
  onClick: () => void
}

function ConversationItem({ conversation, currentUserId, onClick }: ConversationItemProps) {
  const isAlpha = conversation.user_alpha === currentUserId
  const opponent = isAlpha ? conversation.user_beta_profile : conversation.user_alpha_profile

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-secondary/50 bg-card"
    >
      <div className="relative shrink-0">
        <Avatar className="h-14 w-14">
          <AvatarImage src={opponent?.avatar_url} alt={opponent?.name} />
          <AvatarFallback>
            {opponent?.name ? opponent.name.split(' ').map((n) => n[0]).join('') : 'P'}
          </AvatarFallback>
        </Avatar>
        {conversation.unread_count && conversation.unread_count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
            {conversation.unread_count}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-foreground">{opponent?.name || 'Unknown Contender'}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {conversation.updated_at ? formatTime(conversation.updated_at) : 'No activity'}
          </span>
        </div>
        <p className={cn(
          'mt-1 truncate text-sm text-muted-foreground'
        )}>
          {conversation.last_message_snippet ?? 'No messages yet'}
        </p>
      </div>
    </button>
  )
}

function ChatBubble({ message, isCurrentUser }: { message: MessageRow; isCurrentUser: boolean }) {
  return (
    <div className={cn('flex w-full', isCurrentUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm break-words',
          isCurrentUser ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-secondary text-foreground rounded-tl-none'
        )}
      >
        <p className="text-sm leading-relaxed">{message.message_text}</p>
        <p className={cn(
          'mt-1 text-[10px] text-right',
          isCurrentUser ? 'text-primary-foreground/70' : 'text-muted-foreground'
        )}>
          {formatTime(message.created_at)}
        </p>
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
}

function ChatView({ opponent, messages, currentUserId, onBack, onSubmitScore, onSend }: ChatViewProps) {
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="shrink-0 border-b border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 md:hidden">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={opponent?.avatar_url} alt={opponent?.name} />
            <AvatarFallback>{opponent?.name ? opponent.name.split(' ').map((n) => n[0]).join('') : 'P'}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-foreground">{opponent?.name || 'Unknown Player'}</h3>
            <p className="text-xs text-muted-foreground">Messaging Room</p>
          </div>
        </div>

        <button
          onClick={onSubmitScore}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-primary bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
        >
          <ClipboardCheck className="h-4 w-4" />
          Ready to log your match? Submit Match Score
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-secondary/5">
        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} isCurrentUser={message.sender_id === currentUserId} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 border-t border-border bg-card p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (newMessage.trim()) {
              onSend(newMessage.trim())
              setNewMessage('')
            }
          }}
          className="flex items-center gap-3"
        >
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 bg-background"
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}

interface MessagesScreenProps {
  selectedConversationId: string | null
  onSelectConversation: (id: string | null) => void
  onNavigateToMatches: () => void
}

export function MessagesScreen({ selectedConversationId, onSelectConversation, onNavigateToMatches }: MessagesScreenProps) {
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadConversations = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const currentId = sessionData?.session?.user?.id ?? null
        setUserId(currentId)

        if (!currentId) return

        // Adjusted specifically to fetch profiles mapped via your constraints
        const { data: convData, error: convError } = await supabase
          .from('conversations')
          .select(`
            *,
            user_alpha_profile:profiles!conversations_user_alpha_fkey(id, name, avatar_url),
            user_beta_profile:profiles!conversations_user_beta_fkey(id, name, avatar_url)
          `)
          .or(`user_alpha.eq.${currentId},user_beta.eq.${currentId}`)
          .order('updated_at', { ascending: false })

        if (convError) throw convError

        setConversations((convData ?? []) as unknown as ConversationRow[])
      } catch (error) {
        console.error('Error loading conversations:', error)
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

    let messageSubscription: any
    
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

      messageSubscription = supabase
        .channel(`messages-${selectedConversationId}`)
        .on('postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${selectedConversationId}`,
          },
          (payload) => {
            setMessages((current) => [...current, payload.new as MessageRow])
          }
        )
        .subscribe()
    }

    loadMessages()

    return () => {
      if (messageSubscription) {
        supabase.removeChannel(messageSubscription)
      }
    }
  }, [selectedConversationId])

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId)
  
  // Dynamically pull the correct profile metadata depending on if you are alpha or beta
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

    if (data?.[0]) {
      // Update local message log
      setMessages((current) => [...current, data[0] as MessageRow])
      // Update local text snippet optimistically in conversation list
      setConversations(prev => prev.map(c => c.id === selectedConversationId ? { ...c, last_message_snippet: content } : c))
    }
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-80px)] items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (selectedConversation && opponentProfile) {
    return (
      <div className="flex h-[calc(100vh-80px)] flex-col md:h-screen">
        <ChatView
          opponent={opponentProfile}
          messages={messages}
          currentUserId={userId ?? ''}
          onBack={() => onSelectConversation(null)}
          onSubmitScore={onNavigateToMatches}
          onSend={handleSendMessage}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24 md:pb-8 bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-4 py-4 md:px-6">
          <h2 className="text-xl font-bold text-foreground">Messages</h2>
          <p className="mt-1 text-sm text-muted-foreground">Coordinate matches with other players</p>
        </div>
      </header>

      <main className="p-4 md:p-6">
        {conversations.length > 0 ? (
          <div className="space-y-2 max-w-2xl mx-auto">
            {conversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                currentUserId={userId ?? ''}
                onClick={() => onSelectConversation(conversation.id)}
              />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center border border-dashed border-border rounded-xl bg-card max-w-2xl mx-auto">
            <p className="text-muted-foreground font-medium">No conversations yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Start by challenging a player from the ladder roster!</p>
          </div>
        )}
      </main>
    </div>
  )
}