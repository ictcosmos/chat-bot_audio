import React, { useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'

import Chat from './pages/Chat'
import Login from './pages/Login'
import Signup from './pages/Signup'
import VoiceChat from './pages/VoiceChat'
import { auth } from './services/firebase'
import { voiceAPI } from './services/api'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const voicePreloadStartedRef = useRef(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        })
      } else {
        setUser(null)
        voicePreloadStartedRef.current = false
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return
    if (voicePreloadStartedRef.current) return

    voicePreloadStartedRef.current = true

    const preloadVoiceModels = async () => {
      try {
        console.log('[App] Auto-preloading voice models...')
        await voiceAPI.preload()
        console.log('[App] Voice models preloaded.')
      } catch (err) {
        console.warn(
          '[App] Voice preload failed/skipped:',
          err.response?.data?.detail || err.message
        )
      }
    }

    preloadVoiceModels()
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[var(--border-color)] border-t-[var(--accent)] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[var(--text-secondary)]">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />

      <Route
        path="/signup"
        element={user ? <Navigate to="/" replace /> : <Signup />}
      />

      <Route
        path="/"
        element={user ? <Chat user={user} /> : <Navigate to="/login" replace />}
      />

      <Route
        path="/voice"
        element={user ? <VoiceChat user={user} /> : <Navigate to="/login" replace />}
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App