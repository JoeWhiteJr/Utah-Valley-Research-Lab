import { useState, useRef, useEffect } from 'react'
import { Mic, Square, Play, Pause, Trash2, Check } from 'lucide-react'
import Button from './Button'

export default function AudioRecorder({ onSave, onCancel }) {
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const streamRef = useRef(null)

  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState(null)

  const audioPreviewRef = useRef(null)
  const timerRef = useRef(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [audioUrl])

  const startRecording = async () => {
    try {
      setError(null)
      audioChunksRef.current = []

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start(1000) // Collect data every second
      setIsRecording(true)

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

    } catch (err) {
      console.error('Error accessing microphone:', err)
      setError('Unable to access microphone. Please check permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)

      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume()
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1)
        }, 1000)
      } else {
        mediaRecorderRef.current.pause()
        if (timerRef.current) {
          clearInterval(timerRef.current)
        }
      }
      setIsPaused(!isPaused)
    }
  }

  const discardRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
    setAudioBlob(null)
    setAudioUrl(null)
    setRecordingTime(0)
    setIsPlaying(false)
  }

  const handleSave = () => {
    if (audioBlob && onSave) {
      // Create a File from the Blob with a proper name
      const file = new File([audioBlob], `recording-${Date.now()}.webm`, {
        type: 'audio/webm'
      })
      onSave(file)
    }
  }

  const togglePreviewPlay = () => {
    const audio = audioPreviewRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  useEffect(() => {
    const audio = audioPreviewRef.current
    if (!audio) return

    const handleEnded = () => setIsPlaying(false)
    audio.addEventListener('ended', handleEnded)

    return () => audio.removeEventListener('ended', handleEnded)
  }, [audioUrl])

  // Format time as mm:ss
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {!audioBlob ? (
        // Recording state
        <div className="flex flex-col items-center gap-4 py-6">
          {/* Recording indicator */}
          <div className={`
            relative w-24 h-24 rounded-full flex items-center justify-center
            ${isRecording ? 'bg-red-100' : 'bg-gray-100'}
          `}>
            {isRecording && (
              <div className="absolute inset-0 rounded-full bg-red-200 animate-ping opacity-50" />
            )}
            <div className={`
              relative w-16 h-16 rounded-full flex items-center justify-center
              ${isRecording ? 'bg-red-500' : 'bg-gray-300'}
            `}>
              <Mic size={28} className="text-white" />
            </div>
          </div>

          {/* Timer */}
          <div className="text-2xl font-mono text-text-primary">
            {formatTime(recordingTime)}
          </div>

          {/* Recording controls */}
          <div className="flex items-center gap-3">
            {!isRecording ? (
              <Button onClick={startRecording}>
                <Mic size={18} />
                Start Recording
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={pauseRecording}
                  title={isPaused ? 'Resume' : 'Pause'}
                >
                  {isPaused ? <Play size={18} /> : <Pause size={18} />}
                </Button>
                <Button
                  variant="danger"
                  onClick={stopRecording}
                >
                  <Square size={18} />
                  Stop
                </Button>
              </>
            )}
          </div>

          {isRecording && (
            <p className="text-sm text-text-secondary">
              {isPaused ? 'Recording paused' : 'Recording in progress...'}
            </p>
          )}
        </div>
      ) : (
        // Preview state
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-4 py-4">
            <audio ref={audioPreviewRef} src={audioUrl} preload="metadata" />

            <button
              onClick={togglePreviewPlay}
              className="w-14 h-14 rounded-full bg-primary-500 hover:bg-primary-600 text-white flex items-center justify-center transition-colors"
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
            </button>

            <div className="text-lg font-mono text-text-primary">
              {formatTime(recordingTime)}
            </div>
          </div>

          <div className="flex justify-center gap-3">
            <Button
              variant="secondary"
              onClick={discardRecording}
            >
              <Trash2 size={18} />
              Discard
            </Button>
            <Button onClick={handleSave}>
              <Check size={18} />
              Use Recording
            </Button>
          </div>

          {onCancel && (
            <div className="text-center">
              <button
                onClick={onCancel}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel and close
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
