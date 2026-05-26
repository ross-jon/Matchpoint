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
import { ProfileSetupScreen } from '@/components/screens/profile-setup-screen'
import { ChallengeSheet } from '@/components/challenge-sheet'
import { matchChallenges, type Player } from '@/lib/data'

export default function MatchPointApp() {
  // Navigation & UI State
  type AppScreen = Screen | 'onboarding'
  const [activeScreen, setActiveScreen] = useState<AppScreen>('feed')
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [selectedMessageOpponentId, setSelectedMessageOpponentId] = useState<string | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  
  // App State
  const [user, setUser] = useState<any>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [profileChecked, setProfileChecked] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)
  
  // Challenge Sheet State
  const [challengeSheetOpen, setChallengeSheetOpen] = useState(false)
  const [selectedPlayerForChallenge, setSelectedPlayerForChallenge] = useState<Player | null>(null)

  // Auth Lifecycle Hook
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

  // Unread Messages Listener Hook
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

  const notifications = 2 // System notifications Placeholder
  const pendingChallenges = matchChallenges.filter(
    c => c.status === 'pending' && c.challengedId === 'current'
  ).length

  useEffect(() => {
    let isMounted = true

    if (!authChecked || !user) {
      setProfileChecked(true)
      return () => {
        isMounted = false
      }
    }

    const verifyProfile = async () => {
      setProfileChecked(false)

      const { data, error } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single()

      if (!isMounted) return

      const needsSetup = !!error || !data?.name?.trim()
      if (needsSetup) {
        setActiveScreen('onboarding')
      } else if (activeScreen === 'onboarding') {
        setActiveScreen('feed')
      }

      setProfileChecked(true)
    }

    verifyProfile()

    return () => {
      isMounted = false
    }
  }, [authChecked, user, activeScreen])

  // Unified Navigation Handlers
  const handleNavigate = useCallback((screen: AppScreen) => {
    setActiveScreen(screen)
    setSelectedPlayerId(null) // Crucial: Wipes target profile memory on explicit core menu clicks
    if (screen !== 'messages') {
      setSelectedConversationId(null)
      setSelectedMessageOpponentId(null)
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

  const handleNavigateToMessages = useCallback((playerId?: string) => {
    setSelectedConversationId(null)
    setSelectedMessageOpponentId(playerId ?? null)
    setActiveScreen('messages')
  }, [])

  // Challenge Submissions
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

  // Initial Auth Loading State
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

  // Intercept Unauthenticated Users -> Login Screen
  if (!user) {
    return (
      <LoginScreen 
        onAuthSuccess={handleAuthSuccess} 
        onRequireProfileSetup={() => handleNavigate('onboarding')} 
      />
    )
  }

  if (!profileChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-2">
          <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">Verifying your profile...</p>
        </div>
      </div>
    )
  }

  // Authenticated user onboarding flow
  if (activeScreen === 'onboarding') {
    return <ProfileSetupScreen onComplete={() => setActiveScreen('feed')} />
  }

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-background font-sans text-foreground">
      
      {/* Top Navigation Bar */}
      <TopNav
        activeScreen={activeScreen as Screen}
        onNavigate={handleNavigate}
        unreadMessages={unreadMessages}
        notifications={notifications}
        profile={null}
      />

      {/* Main Layout */}
      <div className="mx-auto flex max-w-7xl flex-1 w-full">
        {/* Left Sidebar - User Profile (Strava style) */}
        {(activeScreen === 'feed' || activeScreen === 'discover' || activeScreen === 'matches') && (
          <div className="hidden md:block">
            <UserSidebar onNavigate={handleNavigate} profile={null} />
          </div>
        )}

        {/* Main Content Router */}
        <main className="min-w-0 flex-1 overflow-y-auto relative bg-muted/10 md:bg-background pb-16 md:pb-0 safe-area-bottom">
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
                return (
                  <DiscoverScreen
                    onChallenge={handleOpenChallenge}
                    onViewProfile={(player) => {
                      setSelectedPlayerId(player.id)
                      setActiveScreen('profile')
                    }}
                    onMessage={(player) => handleNavigateToMessages(player.id)}
                  />
                )
              case 'messages':
                return (
                  <MessagesScreen
                    selectedConversationId={selectedConversationId}
                    selectedMessageOpponentId={selectedMessageOpponentId}
                    onSelectConversation={setSelectedConversationId}
                    onNavigateToMatches={handleNavigateToMatches}
                    onViewProfile={(id) => {
                      setSelectedPlayerId(id)
                      setActiveScreen('profile')
                    }}
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
                return null
            }
          })()}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        activeScreen={activeScreen as Screen}
        onNavigate={handleNavigate}
        unreadMessages={unreadMessages}
      />

      {/* Challenge Sheet Component */}
      <ChallengeSheet
        player={selectedPlayerForChallenge}
        open={challengeSheetOpen}
        onOpenChange={setChallengeSheetOpen}
        onSubmit={handleSubmitChallenge}
      />
    </div>
  )
}