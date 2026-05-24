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
import { conversations, matchChallenges, type Player } from '@/lib/data'

export default function MatchPointApp() {
  const [activeScreen, setActiveScreen] = useState<Screen>('feed')
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  
  // Challenge sheet state
  const [challengeSheetOpen, setChallengeSheetOpen] = useState(false)
  const [selectedPlayerForChallenge, setSelectedPlayerForChallenge] = useState<Player | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadUser = async () => {
      const { data } = await supabase.auth.getSession()
      if (isMounted) {
        setUser(data.session?.user ?? null)
      }
    }

    loadUser()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setUser(session?.user ?? null)
      }
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  // Calculate badge counts
  const unreadMessages = conversations.reduce((sum, c) => sum + c.unreadCount, 0)
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

  // Challenge handlers
  const handleOpenChallenge = useCallback((player: any) => {
    setSelectedPlayerForChallenge(player)
    setChallengeSheetOpen(true)
  }, [])

  const handleSubmitChallenge = useCallback((data: {
    playerId: string
    date: string
    time: string
    location: string
    message: string
  }) => {
    console.log('Challenge submitted:', data)
    setActiveScreen('matches')
  }, [])

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
                return (
                 <MatchDetailScreen
                   matchId={selectedMatchId ?? ''}
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
