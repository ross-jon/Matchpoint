// login-screen.tsx
'use client'

import { useState, type FormEvent } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Trophy } from 'lucide-react' // Added Trophy icon import

interface LoginScreenProps {
  onAuthSuccess?: () => void
  onRequireProfileSetup?: () => void // NEW PROP
}

export function LoginScreen({ onAuthSuccess, onRequireProfileSetup }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // NEW: Function to check profile status after login/signup
  const checkProfileStatus = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', userId)
        .single()

      if (error && error.code !== 'PGRST116') { // Ignore "Row not found" if they literally just signed up
        console.error('Error fetching profile:', error)
      }

      const needsSetup = !profile?.name || profile.name.trim() === ''

      if (needsSetup && onRequireProfileSetup) {
        onRequireProfileSetup()
      } else if (onAuthSuccess) {
        onAuthSuccess()
      }
    } catch (err) {
      console.error("Profile check error:", err)
      if (onAuthSuccess) onAuthSuccess() // Fallback
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (isSignUp) {
      // 1. EXECUTE NEW PLAYER REGISTRATION
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      // If sign up requires email verification
      if (data.user && !data.session) {
        setError('Please check your email to verify your account before logging in.')
        setLoading(false)
        return
      }

      if (data.user) {
        await checkProfileStatus(data.user.id)
      }

    } else {
      // 2. EXECUTE EXISTING PLAYER LOGIN
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }
      
      if (data.user) {
        await checkProfileStatus(data.user.id)
      }
    }

    setLoading(false)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md space-y-8 animate-in slide-in-from-bottom-4 duration-500 fade-in">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="rounded-full bg-lime-400/10 p-4 mb-2">
            <Trophy className="h-8 w-8 text-lime-400" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Matchpoint
          </h1>
          <p className="text-slate-400 text-sm font-medium max-w-xs">
            The competitive ladder for serious tennis players.
          </p>
        </div>

        <Card className="border-slate-800 bg-slate-900/50 shadow-2xl backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white text-xl text-center">
              {isSignUp ? 'Join the Ladder' : 'Welcome Back'}
            </CardTitle>
            <CardDescription className="text-slate-400 text-center">
              {isSignUp ? 'Create your account to start challenging.' : 'Sign in to check your standings.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="federer@example.com"
                  className="bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus-visible:ring-lime-400 focus-visible:border-lime-400"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-slate-300">Password</Label>
                  {!isSignUp && (
                    <a href="#" className="text-xs text-lime-400 hover:text-lime-300 transition-colors">
                      Forgot?
                    </a>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus-visible:ring-lime-400 focus-visible:border-lime-400"
                  required
                  disabled={loading}
                />
              </div>

              {error && (
                <div className={`p-3 rounded text-sm ${error.includes('verification') ? 'bg-blue-950/50 border border-blue-900 text-blue-300' : 'bg-red-950/50 border border-red-900 text-red-400'}`}>
                  {error}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full bg-lime-400 text-slate-950 font-bold hover:bg-lime-300 transition-colors py-2 rounded shadow-md"
                disabled={loading}
              >
                {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 text-center border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError(null)
                }}
                className="text-lime-400 hover:text-lime-300 text-sm font-medium transition-colors"
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}