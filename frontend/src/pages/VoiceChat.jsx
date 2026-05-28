import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, Square, ArrowLeft, Loader2, Languages, Volume2 } from 'lucide-react'
import { voiceAPI, chatAPI } from '../services/api'

export default function VoiceChat({ user }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [answer, setAnswer] = useState('')
  const [language, setLanguage] = useState('auto')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [chatId, setChatId] = useState(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const synthRef = useRef(window.speechSynthesis)
  const autoListenRef = useRef(false)

  useEffect(() => {
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel()
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  const speakText = useCallback((text, lang) => {
    return new Promise((resolve) => {
      if (!synthRef.current) {
        resolve()
        return
      }
      synthRef.current.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang === 'ne' ? 'ne-NP' : 'en-US'
      utterance.rate = 1.0
      utterance.pitch = 1.0
      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => {
        setIsSpeaking(false)
        resolve()
      }
      utterance.onerror = () => {
        setIsSpeaking(false)
        resolve()
      }
      synthRef.current.speak(utterance)
    })
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await processAudio(blob)
      }

      mediaRecorder.start()
      setStatus('listening')
      setTranscript('')
      setAnswer('')
      if (synthRef.current) synthRef.current.cancel()
    } catch (err) {
      console.error('Failed to start recording:', err)
      setStatus('error')
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const processAudio = async (blob) => {
    setStatus('processing')
    try {
      const formData = new FormData()
      formData.append('audio', blob, 'recording.webm')

      const response = await voiceAPI.transcribe(formData)
      const data = response.data

      const detectedLang = data.language || 'en'
      setTranscript(data.answer || '')
      setAnswer(data.answer || '')

      if (data.answer) {
        const speakLang = language === 'auto' ? detectedLang : language
        await speakText(data.answer, speakLang)

        if (autoListenRef.current) {
          setStatus('idle')
          setTimeout(() => startRecording(), 500)
        } else {
          setStatus('done')
        }
      } else {
        setStatus('done')
      }
    } catch (err) {
      console.error('Voice processing failed:', err)
      setStatus('error')
    }
  }

  const toggleRecording = () => {
    if (status === 'listening') {
      stopRecording()
    } else {
      autoListenRef.current = true
      startRecording()
    }
  }

  const stopConversation = () => {
    autoListenRef.current = false
    if (synthRef.current) synthRef.current.cancel()
    stopRecording()
    setStatus('idle')
  }

  const languageLabel =
    language === 'auto' ? 'Auto' : language === 'ne' ? 'Nepali' : 'English'

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-primary)] border-b border-[var(--border-color)]">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">Back to Chat</span>
        </button>
        <button
          onClick={() => {
            const langs = { auto: 'ne', ne: 'en', en: 'auto' }
            setLanguage(langs[language])
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <Languages size={16} />
          {languageLabel}
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {status === 'idle' && (
          <div className="text-center mb-8">
            <div className="w-24 h-24 rounded-full bg-[var(--accent)] bg-opacity-10 flex items-center justify-center mx-auto mb-4">
              <Mic size={40} className="text-[var(--accent)]" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              Voice Chat
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Tap the mic and start speaking
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Supports Nepali and English
            </p>
          </div>
        )}

        {status === 'listening' && (
          <div className="text-center mb-8">
            <div className="w-24 h-24 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Mic size={40} className="text-white" />
            </div>
            <p className="text-lg font-medium text-red-500">Listening...</p>
            <p className="text-xs text-[var(--text-secondary)] mt-2 opacity-50">
              {transcript || 'Speak now...'}
            </p>
          </div>
        )}

        {status === 'processing' && (
          <div className="text-center mb-8">
            <div className="w-24 h-24 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-4">
              <Loader2 size={40} className="text-[var(--accent)] animate-spin" />
            </div>
            <p className="text-lg font-medium text-[var(--text-primary)]">Thinking...</p>
            <div className="max-w-md mt-4">
              <p className="text-sm text-[var(--text-secondary)] opacity-60 italic">
                "{transcript}"
              </p>
            </div>
          </div>
        )}

        {status === 'done' && (
          <div className="text-center mb-8 max-w-lg">
            <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
              isSpeaking ? 'bg-green-500 animate-pulse' : 'bg-green-100 dark:bg-green-900/30'
            }`}>
              <Volume2 size={28} className={isSpeaking ? 'text-white' : 'text-green-600'} />
            </div>
            {isSpeaking && (
              <p className="text-sm font-medium text-green-600 mb-2">Speaking...</p>
            )}
            <div className="bg-[var(--bg-primary)] rounded-2xl p-4 shadow-sm border border-[var(--border-color)]">
              <p className="text-xs text-[var(--text-secondary)] opacity-50 mb-2">
                You said:
              </p>
              <p className="text-sm text-[var(--text-secondary)] italic mb-4">
                "{transcript}"
              </p>
              <p className="text-sm text-[var(--text-primary)]">
                {answer}
              </p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center mb-8">
            <div className="w-24 h-24 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <Mic size={40} className="text-red-500" />
            </div>
            <p className="text-lg font-medium text-red-500 mb-2">Something went wrong</p>
            <p className="text-sm text-[var(--text-secondary)]">Please try again</p>
          </div>
        )}

        <div className="flex items-center gap-4">
          {status === 'listening' || status === 'idle' ? (
            <button
              onClick={toggleRecording}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                status === 'listening'
                  ? 'bg-red-500 text-white scale-110 shadow-lg shadow-red-500/40 animate-pulse'
                  : 'bg-[var(--accent)] text-white hover:shadow-lg hover:scale-105'
              }`}
            >
              {status === 'listening' ? <Square size={28} /> : <Mic size={32} />}
            </button>
          ) : (
            <button
              onClick={stopConversation}
              className="px-6 py-3 bg-[var(--accent)] text-white rounded-full font-medium hover:bg-[var(--accent-hover)] transition-colors"
            >
              {status === 'processing' ? 'Processing...' : 'Start New'}
            </button>
          )}
        </div>

        {status === 'listening' && (
          <p className="mt-4 text-xs text-[var(--text-secondary)] opacity-60">
            Tap again to stop
          </p>
        )}
      </div>
    </div>
  )
}
