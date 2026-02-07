import { useState, useRef, useCallback } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'

export default function AudioRecorder({ onRecordingComplete, disabled }) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const startTimeRef = useRef(null)

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
      })

      chunksRef.current = []
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        setIsProcessing(true)
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000)
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' })

        stream.getTracks().forEach(track => track.stop())

        onRecordingComplete(file, duration)
        setIsProcessing(false)
        setRecordingTime(0)
      }

      mediaRecorder.start(250)
      startTimeRef.current = Date.now()
      setIsRecording(true)

      timerRef.current = setInterval(() => {
        setRecordingTime(Math.round((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
    } catch {
      alert('Could not access microphone. Please check your browser permissions.')
    }
  }, [onRecordingComplete])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (isProcessing) {
    return (
      <div className="flex items-center gap-2 text-text-secondary">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-xs">Processing...</span>
      </div>
    )
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs font-medium text-red-600">{formatTime(recordingTime)}</span>
        <button
          onClick={stopRecording}
          className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
          title="Stop recording"
        >
          <Square size={16} />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={startRecording}
      disabled={disabled}
      className="p-2.5 rounded-xl text-text-secondary hover:text-primary-600 hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      title="Record audio message"
    >
      <Mic size={18} />
    </button>
  )
}
