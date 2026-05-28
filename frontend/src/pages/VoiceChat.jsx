import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Languages,
  Loader2,
  Mic,
  Square,
  Volume2,
  AlertCircle,
  Cpu,
} from 'lucide-react'
import { chatAPI, voiceAPI } from '../services/api'

export default function VoiceChat({ user }) {
  const navigate = useNavigate()

  const [status, setStatus] = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [answer, setAnswer] = useState('')
  const [language, setLanguage] = useState('auto')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [chatId, setChatId] = useState(() => localStorage.getItem('voiceChatId') || '')
  const [error, setError] = useState('')
  const [ttsProvider, setTtsProvider] = useState('')
  const [sttModel, setSttModel] = useState('')
  const [modelStatus, setModelStatus] = useState(null)
  const [modelMessage, setModelMessage] = useState('')
  const [preloading, setPreloading] = useState(false)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const processingRef = useRef(false)
  const audioRef = useRef(null)

  const checkVoiceModelStatus = useCallback(async () => {
    try {
      const response = await voiceAPI.status()
      const data = response.data || {}

      setModelStatus(data)

      if (data.whisper_loaded && data.kokoro_loaded) {
        setModelMessage(
          `Voice models loaded. STT: ${data.whisper_model}. English TTS: Kokoro ready.`
        )
      } else if (data.whisper_loaded && !data.kokoro_loaded) {
        setModelMessage(
          `Whisper loaded: ${data.whisper_model}. Kokoro will load when English TTS is needed.`
        )
      } else {
        setModelMessage(
          `Voice model not loaded yet. First request will load ${data.whisper_model || 'Whisper'}.`
        )
      }

      return data
    } catch (err) {
      console.error('Failed to check voice model status:', err)
      setModelMessage('Could not check voice model status.')
      return null
    }
  }, [])

  useEffect(() => {
    checkVoiceModelStatus()

    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        mediaRecorderRef.current.stop()
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }

      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
    }
  }, [checkVoiceModelStatus])

  const ensureVoiceChat = async () => {
    if (chatId) return chatId

    const response = await chatAPI.createChat({
      title: 'Voice Chat',
      mode: 'voice',
    })

    const newChatId = response.data.chat.id
    setChatId(newChatId)
    localStorage.setItem('voiceChatId', newChatId)

    return newChatId
  }

  const preloadModels = async () => {
    if (preloading) return

    setPreloading(true)
    setError('')
    setModelMessage('Loading voice models now. This may take time on the first run...')

    try {
      const response = await voiceAPI.preload()
      const data = response.data || {}

      setModelStatus(data)

      if (data.whisper_loaded && data.kokoro_loaded) {
        setModelMessage(
          `Voice models loaded. STT: ${data.whisper_model}. Kokoro: loaded.`
        )
      } else if (data.whisper_loaded) {
        setModelMessage(
          `Whisper loaded: ${data.whisper_model}. Kokoro is not loaded yet.`
        )
      } else {
        setModelMessage('Voice model preload finished, but Whisper is still not loaded.')
      }
    } catch (err) {
      console.error('Voice model preload failed:', err)

      const detail = err.response?.data?.detail
      const message =
        typeof detail === 'string'
          ? detail
          : detail
            ? JSON.stringify(detail, null, 2)
            : err.message || 'Failed to preload voice models.'

      setModelMessage(message)
    } finally {
      setPreloading(false)
      await checkVoiceModelStatus()
    }
  }

  const playBackendAudio = async (audioBase64, mimeType) => {
    if (!audioBase64 || !mimeType) return

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }

    const audioUrl = `data:${mimeType};base64,${audioBase64}`
    const audio = new Audio(audioUrl)

    audioRef.current = audio

    audio.onplay = () => setIsSpeaking(true)

    audio.onended = () => {
      setIsSpeaking(false)
    }

    audio.onerror = () => {
      setIsSpeaking(false)
    }

    await audio.play()
  }

  const processAudio = async (blob) => {
    if (processingRef.current) return

    processingRef.current = true
    setStatus('processing')
    setError('')

    if (!modelStatus?.whisper_loaded) {
      setModelMessage('Loading faster-whisper model. First request may take time...')
    } else {
      setModelMessage('Voice model loaded. Processing your audio...')
    }

    try {
      const realChatId = await ensureVoiceChat()

      const formData = new FormData()
      formData.append('audio', blob, 'recording.webm')
      formData.append('chat_id', realChatId)

      const response = await voiceAPI.transcribe(formData)
      const data = response.data || {}

      setModelMessage('Model loaded. Generating and playing response...')
      await checkVoiceModelStatus()

      const detectedTranscript = data.transcript || ''
      const detectedAnswer = data.answer || ''

      setTranscript(detectedTranscript)
      setAnswer(detectedAnswer)
      setTtsProvider(data.tts_provider || '')
      setSttModel(data.stt_model || '')

      if (data.chat_id) {
        setChatId(data.chat_id)
        localStorage.setItem('voiceChatId', data.chat_id)
      }

      setStatus('done')

      if (data.audio_base64 && data.audio_mime_type) {
        await playBackendAudio(data.audio_base64, data.audio_mime_type)
      }
    } catch (err) {
      console.error('Voice processing failed:', err)

      const detail = err.response?.data?.detail
      let errorText = 'Voice processing failed.'

      if (typeof detail === 'string') {
        errorText = detail
      } else if (detail) {
        errorText = JSON.stringify(detail, null, 2)
      } else if (err.message) {
        errorText = err.message
      }

      setError(errorText)
      setStatus('error')
    } finally {
      processingRef.current = false
    }
  }

  const startRecording = useCallback(async () => {
    try {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }

      setTranscript('')
      setAnswer('')
      setError('')
      setTtsProvider('')
      setSttModel('')

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      let options = {}

      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus' }
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' }
      }

      const mediaRecorder = new MediaRecorder(stream, options)

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
          streamRef.current = null
        }

        const mimeType = mediaRecorder.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })

        if (blob.size === 0) {
          setError('No audio was recorded. Please try again.')
          setStatus('error')
          return
        }

        await processAudio(blob)
      }

      mediaRecorder.start()
      setStatus('listening')
    } catch (err) {
      console.error('Failed to start recording:', err)
      setError(
        err.message ||
        'Could not access microphone. Please allow microphone permission.'
      )
      setStatus('error')
    }
  }, [chatId, modelStatus])

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const handleMicClick = () => {
    if (status === 'listening') {
      stopRecording()
      return
    }

    startRecording()
  }

  const stopEverything = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }

    setIsSpeaking(false)
    setStatus('idle')
  }

  const cycleLanguage = () => {
    const langs = {
      auto: 'ne',
      ne: 'en',
      en: 'auto',
    }

    setLanguage((prev) => langs[prev])
  }

  const languageLabel =
    language === 'auto' ? 'Auto' : language === 'ne' ? 'Nepali' : 'English'

  const whisperLoaded = Boolean(modelStatus?.whisper_loaded)
  const kokoroLoaded = Boolean(modelStatus?.kokoro_loaded)

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col">
      <header className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)] px-5 py-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
        >
          <ArrowLeft size={18} />
          Back to Chat
        </button>

        <button
          type="button"
          onClick={cycleLanguage}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          title="Language is detected automatically by faster-whisper. This button is only visual for now."
        >
          <Languages size={16} />
          {languageLabel}
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        <div className="w-full max-w-2xl text-center">
          <div className="mb-6 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 text-left shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Cpu size={18} className="text-[var(--accent)]" />
              <h2 className="font-semibold text-sm">Voice model status</h2>
            </div>

            <p className="text-sm text-[var(--text-secondary)]">
              {modelMessage || 'Checking voice model status...'}
            </p>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span
                className={`px-3 py-1 rounded-full ${whisperLoaded
                    ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400'
                  }`}
              >
                Whisper: {whisperLoaded ? 'loaded' : 'not loaded'}
              </span>

              <span
                className={`px-3 py-1 rounded-full ${kokoroLoaded
                    ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400'
                  }`}
              >
                Kokoro: {kokoroLoaded ? 'loaded' : 'not loaded'}
              </span>
            </div>

            <button
              type="button"
              onClick={preloadModels}
              disabled={preloading || status === 'listening' || status === 'processing'}
              className="mt-4 px-4 py-2 rounded-lg text-sm bg-[var(--bg-tertiary)] hover:bg-[var(--accent)] hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {preloading ? 'Loading models...' : 'Preload Voice Models'}
            </button>
          </div>

          {status === 'idle' && (
            <>
              <h1 className="text-3xl font-bold mb-3">Voice Chat</h1>
              <p className="text-[var(--text-secondary)]">
                Tap the mic, speak naturally, then tap again to stop.
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-2">
                faster-whisper large-v3 → Groq LLM → gTTS/Kokoro voice.
              </p>
            </>
          )}

          {status === 'listening' && (
            <>
              <h1 className="text-3xl font-bold mb-3">Listening...</h1>
              <p className="text-[var(--text-secondary)]">
                Speak now. Tap the button again when you finish.
              </p>
            </>
          )}

          {status === 'processing' && (
            <>
              <Loader2
                size={40}
                className="animate-spin mx-auto mb-4 text-[var(--accent)]"
              />
              <h1 className="text-3xl font-bold mb-3">Processing...</h1>
              <p className="text-[var(--text-secondary)]">
                Transcribing with faster-whisper and answering with Groq.
              </p>
              {modelMessage && (
                <p className="text-sm text-[var(--accent)] mt-3">
                  {modelMessage}
                </p>
              )}
              <p className="text-xs text-[var(--text-secondary)] mt-2">
                First run may be slow because the Whisper model loads.
              </p>
            </>
          )}

          {status === 'done' && (
            <div className="text-left rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-sm">
              {modelMessage && (
                <div className="mb-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                  {modelMessage}
                </div>
              )}

              {isSpeaking && (
                <div className="flex items-center gap-2 text-sm text-[var(--accent)] mb-3">
                  <Volume2 size={16} />
                  Speaking...
                </div>
              )}

              <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-1">
                You said
              </p>
              <p className="text-[var(--text-primary)] mb-4">
                {transcript || 'Transcript unavailable.'}
              </p>

              <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-1">
                Assistant
              </p>
              <p className="text-[var(--text-primary)] whitespace-pre-wrap">
                {answer || 'No answer returned.'}
              </p>

              <div className="mt-4 text-xs text-[var(--text-secondary)]">
                {sttModel && <p>STT: {sttModel}</p>}
                {ttsProvider && <p>TTS: {ttsProvider}</p>}
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-5">
              <div className="flex items-center justify-center gap-2 text-red-500 mb-2">
                <AlertCircle size={22} />
                <h1 className="text-2xl font-bold">Something went wrong</h1>
              </div>
              <p className="text-sm text-red-500 whitespace-pre-wrap">
                {error || 'Please try again.'}
              </p>
            </div>
          )}

          <div className="mt-10 flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={handleMicClick}
              disabled={status === 'processing' || preloading}
              className={`w-24 h-24 rounded-full flex items-center justify-center shadow-lg transition-all ${status === 'listening'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {status === 'processing' ? (
                <Loader2 size={34} className="animate-spin" />
              ) : status === 'listening' ? (
                <Square size={34} />
              ) : (
                <Mic size={38} />
              )}
            </button>

            {status === 'listening' && (
              <p className="text-sm text-[var(--text-secondary)]">
                Tap again to stop recording.
              </p>
            )}

            {(status === 'listening' ||
              status === 'processing' ||
              isSpeaking) && (
                <button
                  type="button"
                  onClick={stopEverything}
                  className="px-4 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                >
                  Stop
                </button>
              )}

            {status === 'done' && (
              <button
                type="button"
                onClick={() => {
                  setTranscript('')
                  setAnswer('')
                  setError('')
                  setTtsProvider('')
                  setSttModel('')
                  setStatus('idle')
                }}
                className="px-4 py-2 rounded-lg text-sm bg-[var(--bg-tertiary)] hover:bg-[var(--accent)] hover:text-white transition-colors"
              >
                Speak Again
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}