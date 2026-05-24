export interface Player {
  id: string
  name: string
  avatar: string
  elo: number
  wins: number
  losses: number
  recentForm: ('W' | 'L')[]
  streak: number
  streakType: 'win' | 'loss'
  bio: string
  preferredHubs: string[]
  openToChallenges: boolean
  lastActive: Date
  isInactive: boolean
}

export interface Message {
  id: string
  senderId: string
  receiverId: string
  content: string
  timestamp: Date
  read: boolean
}

export interface Conversation {
  id: string
  participantId: string
  participant: Player
  lastMessage: Message
  unreadCount: number
}

export interface MatchReport {
  id: string
  winnerId: string
  loserId: string
  winner: Player
  loser: Player
  sets: { winnerGames: number; loserGames: number }[]
  status: 'pending' | 'approved' | 'disputed'
  disputeReason?: string
  reportedAt: Date
  reportedBy: string
}

export interface MatchChallenge {
  id: string
  challengerId: string
  challenger: Player
  challengedId: string
  challenged: Player
  proposedDate: Date
  proposedTime: string
  location: string
  message?: string
  status: 'pending' | 'accepted' | 'declined' | 'completed'
  createdAt: Date
}

export const GEOGRAPHIC_HUBS = [
  'Sandy Parks',
  'Draper Indoor',
  'Salt Lake Hub',
  'Murray Courts',
  'Provo Tennis Center',
  'Ogden Recreation',
]

export const players: Player[] = [
  {
    id: '1',
    name: 'Marcus Chen',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
    elo: 1680,
    wins: 42,
    losses: 12,
    recentForm: ['W', 'W', 'W', 'L', 'W'],
    streak: 3,
    streakType: 'win',
    bio: 'Former D1 player, aggressive baseline style. Always looking for competitive matches.',
    preferredHubs: ['Sandy Parks', 'Draper Indoor'],
    openToChallenges: true,
    lastActive: new Date(),
    isInactive: false,
  },
  {
    id: '2',
    name: 'Sarah Mitchell',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
    elo: 1620,
    wins: 38,
    losses: 15,
    recentForm: ['W', 'L', 'W', 'W', 'W'],
    streak: 3,
    streakType: 'win',
    bio: 'Serve and volley specialist. Weekday evenings work best.',
    preferredHubs: ['Salt Lake Hub', 'Murray Courts'],
    openToChallenges: true,
    lastActive: new Date(),
    isInactive: false,
  },
  {
    id: '3',
    name: 'David Park',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
    elo: 1580,
    wins: 35,
    losses: 18,
    recentForm: ['L', 'W', 'W', 'L', 'W'],
    streak: 1,
    streakType: 'win',
    bio: 'Defensive counterpuncher. Love long rallies and strategic play.',
    preferredHubs: ['Draper Indoor', 'Sandy Parks'],
    openToChallenges: true,
    lastActive: new Date(),
    isInactive: false,
  },
  {
    id: '4',
    name: 'Elena Rodriguez',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
    elo: 1550,
    wins: 30,
    losses: 20,
    recentForm: ['W', 'W', 'L', 'L', 'W'],
    streak: 1,
    streakType: 'win',
    bio: 'All-court player with a killer backhand. Weekend warrior.',
    preferredHubs: ['Salt Lake Hub'],
    openToChallenges: false,
    lastActive: new Date(),
    isInactive: false,
  },
  {
    id: '5',
    name: 'James Wilson',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
    elo: 1520,
    wins: 28,
    losses: 22,
    recentForm: ['L', 'L', 'W', 'W', 'L'],
    streak: 1,
    streakType: 'loss',
    bio: 'Big server, working on consistency. Always up for a challenge!',
    preferredHubs: ['Murray Courts', 'Provo Tennis Center'],
    openToChallenges: true,
    lastActive: new Date(),
    isInactive: false,
  },
  {
    id: '6',
    name: 'Amanda Foster',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face',
    elo: 1490,
    wins: 25,
    losses: 25,
    recentForm: ['W', 'L', 'W', 'L', 'W'],
    streak: 1,
    streakType: 'win',
    bio: 'Consistent player, great at reading opponents. Morning matches preferred.',
    preferredHubs: ['Ogden Recreation', 'Salt Lake Hub'],
    openToChallenges: true,
    lastActive: new Date(),
    isInactive: false,
  },
  {
    id: '7',
    name: 'Ryan Thompson',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face',
    elo: 1460,
    wins: 22,
    losses: 28,
    recentForm: ['L', 'W', 'L', 'W', 'L'],
    streak: 1,
    streakType: 'loss',
    bio: 'Former college player getting back into the game. Flexible schedule.',
    preferredHubs: ['Sandy Parks'],
    openToChallenges: true,
    lastActive: new Date(),
    isInactive: false,
  },
  {
    id: '8',
    name: 'Michelle Kim',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
    elo: 1430,
    wins: 20,
    losses: 30,
    recentForm: ['L', 'L', 'L', 'W', 'L'],
    streak: 2,
    streakType: 'loss',
    bio: 'Technical player with a focus on improvement. Coach recommended.',
    preferredHubs: ['Draper Indoor', 'Murray Courts'],
    openToChallenges: true,
    lastActive: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
    isInactive: true,
  },
  {
    id: '9',
    name: 'Chris Anderson',
    avatar: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=100&h=100&fit=crop&crop=face',
    elo: 1400,
    wins: 18,
    losses: 32,
    recentForm: ['L', 'W', 'L', 'L', 'L'],
    streak: 3,
    streakType: 'loss',
    bio: 'New to competitive tennis but improving fast. Open to all skill levels.',
    preferredHubs: ['Provo Tennis Center'],
    openToChallenges: true,
    lastActive: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    isInactive: true,
  },
]

export const currentUser: Player = {
  id: 'current',
  name: 'Alex Johnson',
  avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcabd36?w=100&h=100&fit=crop&crop=face',
  elo: 1540,
  wins: 32,
  losses: 18,
  recentForm: ['W', 'W', 'L', 'W', 'W'],
  streak: 2,
  streakType: 'win',
  bio: 'Competitive player focused on improvement. Love early morning matches and tough competition.',
  preferredHubs: ['Sandy Parks', 'Salt Lake Hub'],
  openToChallenges: true,
  lastActive: new Date(),
  isInactive: false,
}

export const conversations: Conversation[] = [
  {
    id: 'conv1',
    participantId: '1',
    participant: players[0],
    lastMessage: {
      id: 'msg1',
      senderId: '1',
      receiverId: 'current',
      content: 'How about Saturday at 9am at Sandy Parks?',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      read: false,
    },
    unreadCount: 2,
  },
  {
    id: 'conv2',
    participantId: '3',
    participant: players[2],
    lastMessage: {
      id: 'msg2',
      senderId: 'current',
      receiverId: '3',
      content: 'Great match yesterday! Want to play again next week?',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      read: true,
    },
    unreadCount: 0,
  },
  {
    id: 'conv3',
    participantId: '5',
    participant: players[4],
    lastMessage: {
      id: 'msg3',
      senderId: '5',
      receiverId: 'current',
      content: 'I approved the match score. Good game!',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      read: true,
    },
    unreadCount: 0,
  },
]

export const chatMessages: Record<string, Message[]> = {
  conv1: [
    {
      id: 'm1',
      senderId: 'current',
      receiverId: '1',
      content: 'Hey Marcus! I saw you\'re ranked #1 right now. Would love to challenge you for a match.',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
      read: true,
    },
    {
      id: 'm2',
      senderId: '1',
      receiverId: 'current',
      content: 'Hey Alex! Sure, I\'m always up for a good match. What\'s your availability this week?',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      read: true,
    },
    {
      id: 'm3',
      senderId: 'current',
      receiverId: '1',
      content: 'I\'m free Saturday or Sunday morning. Sandy Parks or Draper Indoor work for me.',
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
      read: true,
    },
    {
      id: 'm4',
      senderId: '1',
      receiverId: 'current',
      content: 'How about Saturday at 9am at Sandy Parks?',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      read: false,
    },
  ],
  conv2: [
    {
      id: 'm5',
      senderId: '3',
      receiverId: 'current',
      content: 'That was a tough match! Your serve has really improved.',
      timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000),
      read: true,
    },
    {
      id: 'm6',
      senderId: 'current',
      receiverId: '3',
      content: 'Thanks David! Your counterpunching kept me on my toes the whole time.',
      timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000),
      read: true,
    },
    {
      id: 'm7',
      senderId: 'current',
      receiverId: '3',
      content: 'Great match yesterday! Want to play again next week?',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      read: true,
    },
  ],
  conv3: [
    {
      id: 'm8',
      senderId: 'current',
      receiverId: '5',
      content: 'Just submitted the match score. Let me know if everything looks correct.',
      timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      read: true,
    },
    {
      id: 'm9',
      senderId: '5',
      receiverId: 'current',
      content: 'I approved the match score. Good game!',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      read: true,
    },
  ],
}

export const pendingMatches: MatchReport[] = [
  {
    id: 'match1',
    winnerId: '2',
    loserId: 'current',
    winner: players[1],
    loser: currentUser,
    sets: [
      { winnerGames: 6, loserGames: 4 },
      { winnerGames: 3, loserGames: 6 },
      { winnerGames: 7, loserGames: 6 },
    ],
    status: 'pending',
    reportedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    reportedBy: '2',
  },
  {
    id: 'match2',
    winnerId: 'current',
    loserId: '7',
    winner: currentUser,
    loser: players[6],
    sets: [
      { winnerGames: 6, loserGames: 2 },
      { winnerGames: 6, loserGames: 4 },
    ],
    status: 'pending',
    reportedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    reportedBy: 'current',
  },
]

export const recentMatches: MatchReport[] = [
  {
    id: 'match3',
    winnerId: 'current',
    loserId: '3',
    winner: currentUser,
    loser: players[2],
    sets: [
      { winnerGames: 6, loserGames: 4 },
      { winnerGames: 7, loserGames: 5 },
    ],
    status: 'approved',
    reportedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    reportedBy: 'current',
  },
  {
    id: 'match4',
    winnerId: '1',
    loserId: '4',
    winner: players[0],
    loser: players[3],
    sets: [
      { winnerGames: 6, loserGames: 3 },
      { winnerGames: 6, loserGames: 2 },
    ],
    status: 'approved',
    reportedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    reportedBy: '1',
  },
]

export const matchChallenges: MatchChallenge[] = [
  {
    id: 'challenge1',
    challengerId: '1',
    challenger: players[0],
    challengedId: 'current',
    challenged: currentUser,
    proposedDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    proposedTime: '9:00 AM',
    location: 'Sandy Parks',
    message: 'Looking forward to a great match! I heard you have been playing well lately.',
    status: 'pending',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'challenge2',
    challengerId: 'current',
    challenger: currentUser,
    challengedId: '3',
    challenged: players[2],
    proposedDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    proposedTime: '6:00 PM',
    location: 'Draper Indoor',
    message: 'Rematch from last week?',
    status: 'accepted',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'challenge3',
    challengerId: '5',
    challenger: players[4],
    challengedId: 'current',
    challenged: currentUser,
    proposedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    proposedTime: '10:00 AM',
    location: 'Murray Courts',
    status: 'pending',
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
  },
]
