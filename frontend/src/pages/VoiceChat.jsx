import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Loader2,
  Mic,
  PhoneOff,
  Volume2,
  AlertCircle,
  Cpu,
  User,
  Sparkles,
} from 'lucide-react'
import { chatAPI, voiceAPI } from '../services/api'

export default function VoiceChat({ user }) {
  const navigate = useNavigate()

  const [sessionActive, setSessionActive] = useState(false)
  const [status, setStatus] = useState('idle')
  const [turns, setTurns] = useState([])
  const [error, setError] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [chatId, setChatId] = useState(() => localStorage.getItem('voiceChatId') || '')
  const [modelStatus, setModelStatus] = useState(null)
  const [modelMessage, setModelMessage] = useState('')

  const streamRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const monitorFrameRef = useRef(null)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const audioRef = useRef(null)

  const sessionActiveRef = useRef(false)
  const isRecordingRef = useRef(false)
  const isSpeakingRef = useRef(false)
  const processingRef = useRef(false)
  const speechStartedRef = useRef(false)
  const silenceStartedAtRef = useRef(null)
  const turnStartAtRef = useRef(null)

  const volumeThresholdRef = useRef(0.065)
  const interruptThresholdRef = useRef(0.09)
  const interruptHoldMsRef = useRef(450)
  const silenceMsRef = useRef(1200)
  const maxTurnMsRef = useRef(22000)
  const interruptStartedAtRef = useRef(null)

  const checkVoiceModelStatus = useCallback(async () => {
    try {
      const response = await voiceAPI.status()
      const data = response.data || {}

      setModelStatus(data)

      if (data.silero_loaded && data.whisper_loaded && data.kokoro_loaded) {
        setModelMessage(
          `Voice models ready. VAD: Silero, STT: ${data.whisper_model}, TTS: Kokoro/gTTS.`
        )
      } else if (data.silero_loading || data.whisper_loading || data.kokoro_loading) {
        setModelMessage('Voice models are loading in the background...')
      } else if (data.silero_loaded && data.whisper_loaded) {
        setModelMessage(
          `Silero and Whisper ready. Kokoro loads when English TTS is needed.`
        )
      } else {
        setModelMessage('Voice models are not fully loaded yet. First run may take time.')
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

    const interval = setInterval(() => {
      checkVoiceModelStatus()
    }, 5000)

    return () => {
      clearInterval(interval)
      endVoiceSession(false)
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

  const getVolume = () => {
    const analyser = analyserRef.current
    if (!analyser) return 0

    const data = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(data)

    let sum = 0

    for (let i = 0; i < data.length; i++) {
      const value = (data[i] - 128) / 128
      sum += value * value
    }

    return Math.sqrt(sum / data.length)
  }

  const setupAudioMonitor = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })

    streamRef.current = stream

    const AudioContext = window.AudioContext || window.webkitAudioContext
    const audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()

    analyser.fftSize = 1024
    source.connect(analyser)

    audioContextRef.current = audioContext
    analyserRef.current = analyser
  }

  const startMonitoring = () => {
    const monitor = () => {
      if (!sessionActiveRef.current) return

      const volume = getVolume()
      const now = Date.now()
      const isUserSpeaking = volume > volumeThresholdRef.current

      if (isSpeakingRef.current) {
        const isStrongUserSpeech = volume > interruptThresholdRef.current

        if (isStrongUserSpeech) {
          if (!interruptStartedAtRef.current) {
            interruptStartedAtRef.current = now
          }

          if (now - interruptStartedAtRef.current >= interruptHoldMsRef.current) {
            stopAssistantAudio()
            interruptStartedAtRef.current = null
            startRecordingTurn()
          }
        } else {
          interruptStartedAtRef.current = null
        }
      }

      if (isRecordingRef.current) {
        if (isUserSpeaking) {
          speechStartedRef.current = true
          silenceStartedAtRef.current = null
        } else if (speechStartedRef.current) {
          if (!silenceStartedAtRef.current) {
            silenceStartedAtRef.current = now
          }

          if (now - silenceStartedAtRef.current >= silenceMsRef.current) {
            stopRecordingTurn()
          }
        }

        if (turnStartAtRef.current && now - turnStartAtRef.current >= maxTurnMsRef.current) {
          stopRecordingTurn()
        }
      }

      monitorFrameRef.current = requestAnimationFrame(monitor)
    }

    monitorFrameRef.current = requestAnimationFrame(monitor)
  }

  const stopMonitoring = () => {
    if (monitorFrameRef.current) {
      cancelAnimationFrame(monitorFrameRef.current)
      monitorFrameRef.current = null
    }
  }

  const startRecordingTurn = () => {
    if (!sessionActiveRef.current) return
    if (isRecordingRef.current) return
    if (processingRef.current) return
    if (isSpeakingRef.current) return

    const stream = streamRef.current

    if (!stream) return

    let options = {}

    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      options = { mimeType: 'audio/webm;codecs=opus' }
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
      options = { mimeType: 'audio/webm' }
    }

    const mediaRecorder = new MediaRecorder(stream, options)

    mediaRecorderRef.current = mediaRecorder
    chunksRef.current = []
    speechStartedRef.current = false
    silenceStartedAtRef.current = null
    turnStartAtRef.current = Date.now()

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data)
      }
    }

    mediaRecorder.onstop = async () => {
      isRecordingRef.current = false

      const mimeType = mediaRecorder.mimeType || 'audio/webm'
      const blob = new Blob(chunksRef.current, { type: mimeType })

      if (!sessionActiveRef.current) return

      if (blob.size === 0) {
        startRecordingTurn()
        return
      }

      await processAudioTurn(blob)

      if (sessionActiveRef.current && !isSpeakingRef.current && !processingRef.current) {
        startRecordingTurn()
      }
    }

    isRecordingRef.current = true
    setStatus('listening')
    mediaRecorder.start()
  }

  const stopRecordingTurn = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop()
    }
  }

  const stopAssistantAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }

    interruptStartedAtRef.current = null
    isSpeakingRef.current = false
    setIsSpeaking(false)

    if (sessionActiveRef.current) {
      setStatus('listening')
    }
  }

  const playBackendAudio = async (audioBase64, mimeType) => {
    if (!audioBase64 || !mimeType || !sessionActiveRef.current) return

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }

    const audioUrl = `data:${mimeType};base64,${audioBase64}`
    const audio = new Audio(audioUrl)

    audioRef.current = audio

    audio.onplay = () => {
      isSpeakingRef.current = true
      setIsSpeaking(true)
      setStatus('speaking')
    }

    audio.onended = () => {
      isSpeakingRef.current = false
      setIsSpeaking(false)

      if (sessionActiveRef.current) {
        setStatus('listening')
        startRecordingTurn()
      }
    }

    audio.onerror = () => {
      isSpeakingRef.current = false
      setIsSpeaking(false)

      if (sessionActiveRef.current) {
        setStatus('listening')
        startRecordingTurn()
      }
    }

    await audio.play()
  }

  const processAudioTurn = async (blob) => {
    if (processingRef.current) return

    processingRef.current = true
    setStatus('processing')
    setError('')

    try {
      const realChatId = await ensureVoiceChat()

      const formData = new FormData()
      formData.append('audio', blob, 'voice-turn.webm')
      formData.append('chat_id', realChatId)

      const response = await voiceAPI.transcribe(formData)
      const data = response.data || {}

      await checkVoiceModelStatus()

      if (data.no_speech) {
        processingRef.current = false

        if (sessionActiveRef.current) {
          setStatus('listening')
        }

        return
      }

      const userText = data.transcript || ''
      const assistantText = data.answer || ''

      if (data.chat_id) {
        setChatId(data.chat_id)
        localStorage.setItem('voiceChatId', data.chat_id)
      }

      if (userText || assistantText) {
        setTurns((prev) => [
          ...prev,
          {
            id: Date.now(),
            user: userText,
            assistant: assistantText,
            provider: data.provider || '',
            model: data.model || '',
            ttsProvider: data.tts_provider || '',
            language: data.language || '',
          },
        ])
      }

      processingRef.current = false

      if (sessionActiveRef.current && data.audio_base64 && data.audio_mime_type) {
        await playBackendAudio(data.audio_base64, data.audio_mime_type)
      } else if (sessionActiveRef.current) {
        setStatus('listening')
        startRecordingTurn()
      }
    } catch (err) {
      console.error('Voice processing failed:', err)

      const detail = err.response?.data?.detail

      const errorText =
        typeof detail === 'string'
          ? detail
          : detail
            ? JSON.stringify(detail, null, 2)
            : err.message || 'Voice processing failed.'

      setError(errorText)
      setStatus('error')
      processingRef.current = false
    }
  }

  const startVoiceSession = async () => {
    if (sessionActiveRef.current) return

    try {
      setError('')
      setTurns([])
      setStatus('preparing')
      setSessionActive(true)
      sessionActiveRef.current = true

      await ensureVoiceChat()
      await setupAudioMonitor()
      await checkVoiceModelStatus()

      setStatus('listening')
      startMonitoring()
      startRecordingTurn()
    } catch (err) {
      console.error('Failed to start voice session:', err)
      setError(err.message || 'Could not start voice session.')
      setStatus('error')
      sessionActiveRef.current = false
      setSessionActive(false)
    }
  }

  const endVoiceSession = (goBack = true) => {
    sessionActiveRef.current = false
    setSessionActive(false)

    stopMonitoring()
    stopAssistantAudio()

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      try {
        mediaRecorderRef.current.stop()
      } catch {
        // ignore
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => { })
      audioContextRef.current = null
    }

    analyserRef.current = null
    isRecordingRef.current = false
    processingRef.current = false
    speechStartedRef.current = false
    silenceStartedAtRef.current = null
    turnStartAtRef.current = null

    setIsSpeaking(false)
    setStatus('idle')

    if (goBack) {
      navigate('/')
    }
  }

  const statusText = {
    idle: 'Press the mic once to start a continuous voice chat.',
    preparing: 'Preparing microphone and voice models...',
    listening: 'Listening. Ask your question naturally.',
    processing: 'Thinking and generating response...',
    speaking: 'AI is speaking. Start talking to interrupt.',
    error: 'Something went wrong.',
  }[status]

  const sileroLoaded = Boolean(modelStatus?.silero_loaded)
  const whisperLoaded = Boolean(modelStatus?.whisper_loaded)
  const kokoroLoaded = Boolean(modelStatus?.kokoro_loaded)

  const StatusPill = ({ label, loaded }) => (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${loaded
        ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'
        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400'
        }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${loaded ? 'bg-green-500' : 'bg-yellow-500'
          }`}
      />
      {label}: {loaded ? 'loaded' : 'not loaded'}
    </span>
  )

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/80 backdrop-blur-sm px-4 sm:px-5 py-3.5 flex items-center justify-between sticky top-0 z-10">
        <button
          type="button"
          onClick={() => endVoiceSession(true)}
          className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] rounded-lg px-2 py-1 -ml-2"
        >
          <ArrowLeft size={18} />
          <span className="hidden sm:inline">Back to Chat</span>
        </button>

        <h1 className="text-sm font-semibold text-[var(--text-primary)]">Voice Chat</h1>

        <button
          type="button"
          onClick={() => endVoiceSession(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
        >
          <PhoneOff size={16} />
          <span className="hidden sm:inline">End</span>
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 sm:px-5 py-6 sm:py-8">
        <div className="w-full max-w-3xl">
          {/* Model status card */}
          <div className="mb-6 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 sm:p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)]">
                <Cpu size={16} />
              </span>
              <h2 className="font-semibold text-sm">Continuous voice chat</h2>
            </div>

            <p className="text-sm text-[var(--text-secondary)]">
              {modelMessage || 'Checking voice model status...'}
            </p>

            <div className="mt-3.5 flex flex-wrap gap-2">
              <StatusPill label="Silero" loaded={sileroLoaded} />
              <StatusPill label="Whisper" loaded={whisperLoaded} />
              <StatusPill label="Kokoro" loaded={kokoroLoaded} />
            </div>

            <p className="text-xs text-[var(--text-secondary)] mt-3.5 leading-relaxed">
              Backend VAD: Silero. STT: faster-whisper. LLM: Groq/Gemini Search. TTS: gTTS/Kokoro.
            </p>
          </div>

          {/* Mic orb */}
          <div className="text-center py-4">
            <div className="relative inline-flex items-center justify-center">
              {/* Pulsing rings when active */}
              {sessionActive && (
                <>
                  <span className="absolute inline-flex h-28 w-28 rounded-full bg-[var(--accent)]/20 animate-ping" />
                  <span
                    className={`absolute inline-flex rounded-full transition-all duration-500 ${isSpeaking
                      ? 'h-36 w-36 bg-[var(--accent)]/10'
                      : 'h-32 w-32 bg-[var(--accent)]/10'
                      }`}
                  />
                </>
              )}

              <button
                type="button"
                onClick={sessionActive ? () => endVoiceSession(false) : startVoiceSession}
                className={`relative w-28 h-28 rounded-full flex items-center justify-center shadow-lg transition-all focus:outline-none focus:ring-4 focus:ring-[var(--accent)]/30 ${sessionActive
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] hover:scale-105'
                  }`}
                aria-label={sessionActive ? 'End voice chat' : 'Start voice chat'}
              >
                {status === 'preparing' || status === 'processing' ? (
                  <Loader2 size={38} className="animate-spin" />
                ) : sessionActive ? (
                  <PhoneOff size={38} />
                ) : (
                  <Mic size={42} />
                )}
              </button>
            </div>

            <h2 className="text-2xl font-bold mt-6">
              {sessionActive ? 'Voice chat running' : 'Start voice chat'}
            </h2>

            <p className="text-[var(--text-secondary)] mt-2 max-w-md mx-auto">
              {statusText}
            </p>

            {isSpeaking && (
              <div className="mt-3 inline-flex items-center gap-2 text-sm text-[var(--accent)] bg-[var(--accent)]/10 px-3 py-1.5 rounded-full">
                <Volume2 size={16} />
                Speaking. You can interrupt by talking.
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-4">
              <div className="flex items-center gap-2 text-red-500 mb-2">
                <AlertCircle size={18} />
                <h3 className="font-semibold">Error</h3>
              </div>
              <p className="text-sm text-red-500 whitespace-pre-wrap break-words">{error}</p>
            </div>
          )}

          {/* Transcript */}
          <div className="mt-8 space-y-4">
            {turns.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center text-sm text-[var(--text-secondary)] border border-dashed border-[var(--border-color)] rounded-2xl p-10">
                <div className="w-12 h-12 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-3 text-[var(--accent)]">
                  <Sparkles size={22} />
                </div>
                Your voice conversation transcript will appear here.
              </div>
            ) : (
              turns.map((turn) => (
                <div
                  key={turn.id}
                  className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 sm:p-5 shadow-sm message-animate"
                >
                  {/* User */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-6 h-6 rounded-md bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-secondary)]">
                        <User size={13} />
                      </span>
                      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                        You said
                      </p>
                    </div>
                    <p className="text-[var(--text-primary)] pl-8">
                      {turn.user || 'Transcript unavailable.'}
                    </p>
                  </div>

                  {/* Assistant */}
                  <div className="pt-4 border-t border-[var(--border-color)]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-6 h-6 rounded-md bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)]">
                        <Sparkles size={13} />
                      </span>
                      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                        Assistant
                      </p>
                    </div>
                    <p className="text-[var(--text-primary)] whitespace-pre-wrap pl-8">
                      {turn.assistant || 'No answer returned.'}
                    </p>
                  </div>

                  {/* Meta */}
                  {(turn.provider || turn.model || turn.ttsProvider || turn.language) && (
                    <div className="mt-3.5 pl-8 flex flex-wrap gap-1.5">
                      {turn.provider && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                          {turn.provider}
                        </span>
                      )}
                      {turn.model && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                          {turn.model}
                        </span>
                      )}
                      {turn.ttsProvider && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                          TTS: {turn.ttsProvider}
                        </span>
                      )}
                      {turn.language && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                          {turn.language}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}