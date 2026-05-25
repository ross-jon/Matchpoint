'use client'

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { LoginScreen } from '@/components/screens/login-screen'
import { TopNav, MobileBottomNav, UserSidebar, type Screen } from '@/components/navigation'
import { FeedScreen } from '@/components/screens/feed-screen'
import { MatchDetailScreen } from '@/components/screens/match-details-screen'
import { MatchesScreen } from '@/components/screens/matches-screen'
import { LeaderboardScreen } from '@/components/screens/leaderboard-screen'
import { DiscoverScreen } from '@/components/screens/discover-screen'
import { MessagesScreen } from '@/components/screens/messages-screen'
import { ProfileScreen } from '@/components/screens/profile-screen'
import { ChallengeSheet } from '@/components/challenge-sheet'
import { matchChallenges, type Player } from '@/lib/data'

export default function MatchPointApp() {
  const [activeScreen, setActiveScreen] = useState<Screen>('feed')
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [unreadMessages, setUnreadMessages] = useState(0)
  
  // Challenge sheet state
  const [challengeSheetOpen, setChallengeSheetOpen] = useState(false)
  const [selectedPlayerForChallenge, setSelectedPlayerForChallenge] = useState<Player | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadUser = async () => {
      const { data } = await supabase.auth.getSession()
      if (isMounted) {
        setUser(data.session?.user ?? null)
        setAuthChecked(true)
      }
    }

    loadUser()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setUser(session?.user ?? null)
        setAuthChecked(true)
      }
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadUnreadMessages = async (userId: string) => {
      const messageCountResult = await supabase
        .from('messages')
        .select('id, conversations!inner(user_alpha, user_beta)', { count: 'exact', head: true })
        .eq('is_read', false)
        .neq('sender_id', userId)
        .or(`user_alpha.eq.${userId},user_beta.eq.${userId}`, { referencedTable: 'conversations' })

      if (messageCountResult.error) {
        console.error('Error loading unread message counts:', JSON.stringify(messageCountResult.error))
        if (isMounted) setUnreadMessages(0)
        return
      }

      if (isMounted) {
        setUnreadMessages(messageCountResult.count ?? 0)
      }
    }

    if (!user?.id) {
      setUnreadMessages(0)
      return () => {
        isMounted = false
      }
    }

    const userId = user.id
    loadUnreadMessages(userId)

    const channel = supabase.channel(`unread-messages-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => loadUnreadMessages(userId)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        () => loadUnreadMessages(userId)
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  const notifications = 2 // System notifications
  const pendingChallenges = matchChallenges.filter(
    c => c.status === 'pending' && c.challengedId === 'current'
  ).length

  // Navigation handlers — Fixed: Clear state hooks to prevent visual account memory bleeding
  const handleNavigate = useCallback((screen: Screen) => {
    setActiveScreen(screen)
    setSelectedPlayerId(null) // ◄ Crucial: Wipes target profile memory on explicit core menu clicks
    if (screen !== 'messages') {
      setSelectedConversationId(null)
    }
  }, [])

  const handleNavigateToMatches = useCallback(() => {
    setActiveScreen('matches')
  }, [])

  const handleAuthSuccess = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    setUser(data.session?.user ?? null)
    setActiveScreen('feed')
    setAuthChecked(true)
  }, [])

  // Challenge handlers
  const handleOpenChallenge = useCallback((player: any) => {
    setSelectedPlayerForChallenge(player)
    setChallengeSheetOpen(true)
  }, [])

  const handleSubmitChallenge = useCallback(async (data: {
    playerId: string
    scheduled_time: string
    proposed_location: string
    challenger_note: string
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase.from('matches').insert({
        home_player_id: user.id,
        away_player_id: data.playerId,
        status: 'pending',
        scheduled_time: data.scheduled_time,
        proposed_location: data.proposed_location,
        challenger_note: data.challenger_note || null,
      })

      if (error) throw error

      setChallengeSheetOpen(false)
      setActiveScreen('matches')
    } catch (err: any) {
      console.error('Failed to submit challenge:', err.message)
    }
  }, [])

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-2">
          <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">Checking your authentication...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onAuthSuccess={handleAuthSuccess} />
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <TopNav
        activeScreen={activeScreen}
        onNavigate={handleNavigate}
        unreadMessages={unreadMessages}
        notifications={notifications}
        profile={null}
      />

      {/* Main Layout */}
      <div className="mx-auto flex max-w-7xl">
        {/* Left Sidebar - User Profile (Strava style) */}
        {(activeScreen === 'feed' || activeScreen === 'discover' || activeScreen === 'matches') && (
          <UserSidebar onNavigate={handleNavigate} profile={null} />
        )}

        {/* Main Content */}
        <main className="min-w-0 flex-1">
          {(() => {
            switch (activeScreen) {
              case 'feed':
                return (
                  <FeedScreen 
                    onViewProfile={(id) => {
                      setSelectedPlayerId(id)
                      setActiveScreen('profile')
                    }} 
                    onViewMatch={(id) => {
                      setSelectedMatchId(id)
                      setActiveScreen('match-detail')
                    }}
                  />
                )
              case 'matches':
                return <MatchesScreen />
              case 'match-detail':
                if (!selectedMatchId) {
                  // Guard: if ID is missing, bounce back to feed to prevent empty-string Supabase query
                  setActiveScreen('feed')
                  return null
                }
                return (
                  <MatchDetailScreen
                    matchId={selectedMatchId}
                    onBack={() => setActiveScreen('feed')}
                    onViewProfile={(id) => {
                      setSelectedPlayerId(id)
                      setActiveScreen('profile')
                    }}
                  />
                )
              case 'leaderboard':
                return (
                  <LeaderboardScreen 
                    onViewProfile={(id) => { 
                      setSelectedPlayerId(id)
                      setActiveScreen('profile') 
                    }} 
                  />
                )
              case 'discover':
                return <DiscoverScreen onChallenge={handleOpenChallenge} />
              case 'messages':
                return (
                  <MessagesScreen
                    selectedConversationId={selectedConversationId}
                    onSelectConversation={setSelectedConversationId}
                    onNavigateToMatches={handleNavigateToMatches}
                  />
                )
              case 'profile':
                return (
                  <ProfileScreen 
                    targetPlayerId={selectedPlayerId} 
                    onNavigateToMessages={(conversationId) => {
                      setSelectedConversationId(conversationId)
                      setActiveScreen('messages')
                    }}
                    onOpenChallengeModal={(player) => {
                      handleOpenChallenge(player)
                    }}
                  />
                )
              default:
                return <FeedScreen />
            }
          })()}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        activeScreen={activeScreen}
        onNavigate={handleNavigate}
        unreadMessages={unreadMessages}
      />

      {/* Challenge Sheet */}
      <ChallengeSheet
        player={selectedPlayerForChallenge}
        open={challengeSheetOpen}
        onOpenChange={setChallengeSheetOpen}
        onSubmit={handleSubmitChallenge}
      />
    </div>
  )
}