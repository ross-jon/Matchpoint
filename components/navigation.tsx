'use client'

import { useState, useEffect } from 'react'
import { Trophy, MessageCircle, User, ChevronDown, Search, Compass, LayoutDashboard, Medal, Calendar, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { supabase } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export type Screen = 'feed' | 'matches' | 'leaderboard' | 'discover' | 'messages' | 'profile' | 'match-detail' | 'onboarding'

interface NavProfileData {
  id: string
  name: string
  avatar_url: string
  elo_rating: number
  wins: number
  losses: number
}

interface TopNavProps {
  activeScreen: Screen
  onNavigate: (screen: Screen) => void
  unreadMessages: number
  notifications: number
  profile: NavProfileData | null
  onNavigateToProfile?: () => void
}

const mainNavItems: { id: Screen; label: string }[] = [
  { id: 'feed', label: 'Feed' },
  { id: 'matches', label: 'Matches' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'discover', label: 'Discover' },
]

export function TopNav({ activeScreen, onNavigate, unreadMessages, profile }: TopNavProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [pendingMatches, setPendingMatches] = useState(0)
  const router = useRouter()

  // Fetch pending match requests to power the notification badge on the Matches tab
  useEffect(() => {
    const fetchPendingMatches = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { count } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('away_player_id', user.id)
        .eq('status', 'pending')

      if (count !== null) setPendingMatches(count)
    }

    fetchPendingMatches()
  }, [])

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error executing account sign out:', error)
    } else {
      router.refresh()
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        {/* Left: Logo & Main Nav */}
        <div className="flex items-center gap-6">
          <button 
            onClick={() => onNavigate('feed')}
            className="flex items-center gap-2"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Trophy className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="hidden text-lg font-bold tracking-tight text-foreground sm:block">
              MatchPoint
            </span>
          </button>

          <button className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <Search className="h-5 w-5" />
          </button>

          {/* Main Nav Items */}
          <nav className="hidden items-center gap-1 md:flex">
            {mainNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  'relative px-4 py-4 text-sm font-medium transition-colors',
                  activeScreen === item.id
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="flex items-center gap-1.5">
                  {item.label}
                  {/* Matches Notification Badge */}
                  {item.id === 'matches' && pendingMatches > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                      {pendingMatches}
                    </span>
                  )}
                </span>
                {activeScreen === item.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-1 bg-primary" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Right: Actions & Profile Dropdown */}
        <div className="flex items-center gap-2 relative">
          
          <button 
            onClick={() => onNavigate('messages')}
            className={cn(
              'relative flex h-9 w-9 items-center justify-center rounded-full transition-colors',
              activeScreen === 'messages'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <MessageCircle className="h-5 w-5" />
            {unreadMessages > 0 && activeScreen !== 'messages' && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {unreadMessages}
              </span>
            )}
          </button>

          {/* User Profile Context Actions Menu */}
          <div className="relative">
            <button 
              onClick={() => setShowDropdown(!showDropdown)}
              className={cn(
                'flex items-center gap-1 rounded-full p-1 transition-colors',
                activeScreen === 'profile' ? 'bg-primary/20' : 'hover:bg-secondary'
              )}
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={profile?.avatar_url} alt={profile?.name} />
                <AvatarFallback>{profile?.name ? profile.name.split(' ').map(n => n[0]).join('') : 'P'}</AvatarFallback>
              </Avatar>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", showDropdown && "rotate-180")} />
            </button>

            {showDropdown && (
              <>
                <div className="fixed inset-0 z-[110]" onClick={() => setShowDropdown(false)} />
                <div className="absolute right-0 mt-2 w-48 rounded-md border border-border bg-card p-1 shadow-xl z-[120] animate-in fade-in slide-in-from-top-2 duration-100">
                  <button
                    onClick={() => {
                      onNavigate('profile')
                      setShowDropdown(false)
                    }}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                  >
                    <User className="h-4 w-4 text-muted-foreground" />
                    My Profile
                  </button>
                  <div className="my-1 border-t border-border" />
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors font-medium"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

// ... (MobileBottomNav and UserSidebar components remain exactly the same as your original script below this point)
interface MobileNavProps {
  activeScreen: Screen
  onNavigate: (screen: Screen) => void
  unreadMessages: number
}

const mobileNavItems: { id: Screen; label: string; icon: typeof Trophy }[] = [
  { id: 'feed', label: 'Feed', icon: LayoutDashboard },
  { id: 'matches', label: 'Matches', icon: Calendar },
  { id: 'leaderboard', label: 'Ladder', icon: Medal },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'profile', label: 'Profile', icon: User },
]

export function MobileBottomNav({ activeScreen, onNavigate, unreadMessages }: MobileNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm md:hidden">
      <div className="flex items-center justify-around py-2">
        {mobileNavItems.map((item) => {
          const Icon = item.icon
          const isActive = activeScreen === item.id
          const badge = item.id === 'messages' ? unreadMessages : 0

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'relative flex flex-col items-center gap-1 px-3 py-2 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
              {badge > 0 && (
                <span className="absolute right-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

interface UserSidebarProps {
  onNavigate: (screen: Screen) => void
  profile: NavProfileData | null
}

export function UserSidebar({ onNavigate, profile }: UserSidebarProps) {
  const router = useRouter()

  const handleSidebarSignOut = async () => {
    await supabase.auth.signOut()
    router.refresh()
  }

  if (!profile) {
    return (
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-20 p-4 border border-border bg-card rounded-lg text-center text-xs text-muted-foreground">
          Loading navigation sidebar data...
        </div>
      </aside>
    )
  }

  return (
    <aside className="hidden w-64 shrink-0 lg:block">
      <div className="sticky top-20 space-y-4 p-4">
        {/* Profile Card */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-col items-center text-center">
            <button onClick={() => onNavigate('profile')}>
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarImage src={profile.avatar_url} alt={profile.name} />
                <AvatarFallback>{profile.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
              </Avatar>
            </button>
            <h3 className="mt-3 text-lg font-semibold text-foreground">{profile.name}</h3>
            
            {/* Stats Row */}
            <div className="mt-4 flex w-full justify-around border-t border-border pt-4 text-center">
              <div>
                <p className="text-lg font-bold text-foreground">{profile.wins}</p>
                <p className="text-xs text-muted-foreground">Wins</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{profile.losses}</p>
                <p className="text-xs text-muted-foreground">Losses</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{profile.elo_rating}</p>
                <p className="text-xs text-muted-foreground">Elo</p>
              </div>
            </div>
          </div>

          {/* Latest Activity Summary Frame */}
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground">League Status</p>
            <p className="mt-1 text-sm text-primary font-semibold">
              Active Ladder Contender
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Seeded Profile Synced</p>
          </div>

          {/* Sidebar Navigation Action Links */}
          <div className="mt-4 border-t border-border pt-4 flex flex-col gap-2">
            <button 
              onClick={() => onNavigate('profile')}
              className="flex w-full items-center justify-between text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <span>View Player Profile</span>
              <ChevronDown className="h-4 w-4 -rotate-90" />
            </button>
            <button 
              onClick={handleSidebarSignOut}
              className="flex w-full items-center justify-between text-sm text-destructive/80 transition-colors hover:text-destructive font-medium mt-1"
            >
              <span>Sign Out of Shell</span>
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}