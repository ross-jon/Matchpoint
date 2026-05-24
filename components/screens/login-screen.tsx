'use client'

import { useState, type FormEvent } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface LoginScreenProps {
  onAuthSuccess?: () => void
}

export function LoginScreen({ onAuthSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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

      // If email auto-confirm is off, data.session will fill instantly
      if (data?.user && data?.session) {
        setLoading(false)
        onAuthSuccess?.()
      } else if (data?.user) {
        // If email confirmation is enabled or trigger auto-provisions row
        setLoading(false)
        onAuthSuccess?.()
      } else {
        setError('Check your email inbox for a verification link to activate your ladder profile!')
        setLoading(false)
      }
    } else {
      // 2. EXECUTE RETURNING PLAYER SIGN IN
      const { error: signInError } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      setLoading(false)
      onAuthSuccess?.() // ◄ Cleanly flags the single-page framework shell state
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
      <Card className="max-w-sm w-full mx-auto bg-slate-900 border-slate-800 text-white shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight text-white">
            {isSignUp ? 'Create Profile' : 'Welcome Back'}
          </CardTitle>
          <CardDescription className="text-slate-400 text-sm">
            {isSignUp 
              ? 'Join the local flex ladder and start tracking ranks.' 
              : 'Log in to manage active match challenges.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300 text-sm font-medium">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus-visible:ring-lime-400 focus-visible:border-lime-400"
                required
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300 text-sm font-medium">Password</Label>
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
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}