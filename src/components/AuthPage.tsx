'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { GraduationCap, Brain, BookOpen, Users, Mail, CheckCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AuthPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signUpSuccess, setSignUpSuccess] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState(false)
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false)

  // Check for password reset URL on component mount
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const accessToken = hashParams.get('access_token')
    const type = hashParams.get('type')
    
    if (accessToken && type === 'recovery') {
      setIsResettingPassword(true)
      // Clear the URL hash for security
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSignUpSuccess(false)
    setResetEmailSent(false)
    setPasswordResetSuccess(false)

    try {
      if (isResettingPassword) {
        // Validate passwords match
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match')
        }
        
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long')
        }

        const { error } = await supabase.auth.updateUser({
          password: password
        })
        if (error) throw error
        
        setPasswordResetSuccess(true)
        setPassword('')
        setConfirmPassword('')
      } else if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        
        setResetEmailSent(true)
        setEmail('')
      } else if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        
        // Check if user needs email confirmation
        if (data.user && !data.session) {
          setSignUpSuccess(true)
          setEmail('')
          setPassword('')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleModeSwitch = (mode: 'signin' | 'signup' | 'forgot') => {
    setIsSignUp(mode === 'signup')
    setIsForgotPassword(mode === 'forgot')
    setIsResettingPassword(false)
    setError(null)
    setSignUpSuccess(false)
    setResetEmailSent(false)
    setPasswordResetSuccess(false)
    setEmail('')
    setPassword('')
    setConfirmPassword('')
  }

  const getCardTitle = () => {
    if (signUpSuccess) return 'Check Your Email'
    if (resetEmailSent) return 'Password reset sent'
    if (passwordResetSuccess) return 'Password updated!'
    if (isResettingPassword) return 'Set new password'
    if (isForgotPassword) return 'Reset your password'
    if (isSignUp) return 'Create an Account'
    return 'Welcome Back'
  }

  const getCardDescription = () => {
    if (signUpSuccess) return 'We sent you a confirmation email'
    if (resetEmailSent) return 'Check your email for password reset instructions'
    if (passwordResetSuccess) return 'Your password has been successfully updated'
    if (isResettingPassword) return 'Please enter your new password below'
    if (isForgotPassword) return 'Enter your email to receive a password reset link'
    if (isSignUp) return 'Enter your details to create your account'
    return 'Sign in to your account to continue'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left side - Hero content */}
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <GraduationCap className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">AI StudyMate</h1>
            </div>
            <h2 className="text-4xl font-bold text-foreground leading-tight">
              Master Complex Subjects with AI-Powered Learning
            </h2>
            <p className="text-lg text-muted-foreground">
              Get personalized content, interactive explanations, and a 24/7 AI tutor 
              to help you excel in mathematics, science, and technical subjects.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start space-x-3">
              <Brain className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground">AI-Generated Content</h3>
                <p className="text-sm text-muted-foreground">Dynamic lessons adapted to your learning pace</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <BookOpen className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground">Interactive Tutor</h3>
                <p className="text-sm text-muted-foreground">Chat with AI to clarify concepts instantly</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Users className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground">Progress Tracking</h3>
                <p className="text-sm text-muted-foreground">Visual progress indicators and mastery stats</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Auth form */}
        <div className="flex justify-center">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center">
                {getCardTitle()}
              </CardTitle>
              <CardDescription className="text-center">
                {getCardDescription()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {signUpSuccess ? (
                <div className="space-y-6">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-medium">Account created successfully!</p>
                        <p>Please check your email and click the confirmation link to activate your account.</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                  
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        <Mail className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium mb-1">What&apos;s next?</p>
                          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                            <li>Check your email inbox (and spam folder)</li>
                            <li>Click the confirmation link in the email</li>
                            <li>Return here to sign in and start learning</li>
                          </ol>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : resetEmailSent ? (
                <div className="space-y-6">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-medium">Password reset email sent!</p>
                        <p>Please check your email and follow the instructions to reset your password.</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                  
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        <Mail className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium mb-1">What&apos;s next?</p>
                          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                            <li>Check your email inbox (and spam folder)</li>
                            <li>Click the password reset link in the email</li>
                            <li>Create a new password when prompted</li>
                            <li>Return here to sign in with your new password</li>
                          </ol>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : passwordResetSuccess ? (
                <div className="space-y-6">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-medium">Password updated successfully!</p>
                        <p>You can now sign in with your new password.</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                  
                  <Button
                    type="button"
                    onClick={() => handleModeSwitch('signin')}
                    className="w-full h-11"
                  >
                    Continue to sign in
                  </Button>
                </div>
              ) : (
                <>
                  <form onSubmit={handleAuth} className="space-y-4">
                    {!isResettingPassword && (
                      <div className="space-y-2">
                        <Input
                          type="email"
                          placeholder="Enter your email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={isLoading}
                          className="h-11"
                        />
                      </div>
                    )}
                    {!isForgotPassword && (
                      <div className="space-y-2">
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder={isResettingPassword ? "Enter your new password" : "Enter your password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={isLoading}
                            className="h-11 pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            disabled={isLoading}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    )}
                    {isResettingPassword && (
                      <div className="space-y-2">
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm your new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            disabled={isLoading}
                            className="h-11 pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            disabled={isLoading}
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    )}
                    {error && (
                      <Alert className="bg-red-50 border-red-200">
                        <AlertDescription className="text-red-800">
                          {error}
                        </AlertDescription>
                      </Alert>
                    )}
                    <Button 
                      type="submit" 
                      className="w-full h-11" 
                      disabled={isLoading}
                    >
                      {isLoading ? 'Please wait...' : (
                        isResettingPassword ? 'Update password' :
                        isForgotPassword ? 'Send reset email' : 
                        (isSignUp ? 'Create account' : 'Sign in')
                      )}
                    </Button>
                  </form>
                  
                  <div className="mt-6 space-y-3 text-center">
                    {isForgotPassword || isResettingPassword ? (
                      <button
                        type="button"
                        onClick={() => handleModeSwitch('signin')}
                        className="flex items-center justify-center space-x-2 text-sm text-blue-600 hover:text-blue-700 hover:underline mx-auto"
                        disabled={isLoading}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to sign in</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleModeSwitch(isSignUp ? 'signin' : 'signup')}
                          className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                          disabled={isLoading}
                        >
                          {isSignUp 
                            ? 'Already have an account? Sign in' 
                            : "Don&apos;t have an account? Sign up"
                          }
                        </button>
                        {!isSignUp && (
                          <div>
                            <button
                              type="button"
                              onClick={() => handleModeSwitch('forgot')}
                              className="text-sm text-gray-600 hover:text-gray-700 hover:underline"
                              disabled={isLoading}
                            >
                              Forgot your password?
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 