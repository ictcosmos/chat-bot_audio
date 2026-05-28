import React, { useState, useRef, useCallback } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { voiceAPI } from '../services/api'

export default function VoiceButton({ onVoiceResult, chatId }) {
  const [isRecording, setIsRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

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
      setIsRecording(true)
    } catch (err) {
      console.error('Failed to start recording:', err)
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [])

  const processAudio = async (blob) => {
    setProcessing(true)
    try {
      const formData = new FormData()
      formData.append('audio', blob, 'recording.webm')
      formData.append('chat_id', chatId || '')

      const response = await voiceAPI.transcribe(formData)
      if (onVoiceResult) {
        onVoiceResult(response.data)
      }
    } catch (err) {
      console.error('Voice processing failed:', err)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <button
      onMouseDown={startRecording}
      onMouseUp={stopRecording}
      onMouseLeave={isRecording ? stopRecording : undefined}
      onTouchStart={startRecording}
      onTouchEnd={stopRecording}
      disabled={processing}
      className={`p-3 rounded-full transition-all ${
        isRecording
          ? 'bg-red-500 text-white scale-110 shadow-lg shadow-red-500/30'
          : processing
          ? 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
          : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--accent)] hover:text-white'
      }`}
      title={isRecording ? 'Release to send' : 'Hold to record'}
    >
      {processing ? <Loader2 size={20} className="animate-spin" /> : isRecording ? <Square size={20} /> : <Mic size={20} />}
    </button>
  )
}
