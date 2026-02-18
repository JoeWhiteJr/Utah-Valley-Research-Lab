import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, Loader2 } from 'lucide-react'
import { meetingsApi } from '../services/api'

export default function AudioPlayer({ src, meetingId, className = '' }) {
  const audioRef = useRef(null)
  const progressRef = useRef(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [blobUrl, setBlobUrl] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [isLoadingAudio, setIsLoadingAudio] = useState(false)

  // Fetch audio blob for authenticated playback
  useEffect(() => {
    if (!meetingId && !src) return
    if (src && !meetingId) {
      // Direct URL (e.g., blob URL already provided)
      setBlobUrl(src)
      return
    }

    let cancelled = false
    setIsLoadingAudio(true)
    setLoadError(false)

    meetingsApi.getAudio(meetingId)
      .then(({ data }) => {
        if (!cancelled) {
          setBlobUrl(URL.createObjectURL(data))
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAudio(false)
      })

    return () => {
      cancelled = true
    }
  }, [meetingId, src])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl && meetingId) {
        URL.revokeObjectURL(blobUrl)
      }
    }
  }, [blobUrl, meetingId])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
      setIsLoaded(true)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    const handleError = () => {
      setIsLoaded(false)
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [blobUrl])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  const [isDragging, setIsDragging] = useState(false)

  const seekToPosition = (clientX) => {
    const audio = audioRef.current
    const progress = progressRef.current
    if (!audio || !progress || !duration) return

    const rect = progress.getBoundingClientRect()
    const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const percent = clickX / rect.width
    const newTime = percent * duration

    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleProgressClick = (e) => {
    if (isDragging) return
    seekToPosition(e.clientX)
  }

  const handleMouseDown = (e) => {
    e.preventDefault()
    setIsDragging(true)
    seekToPosition(e.clientX)

    const handleMouseMove = (e) => seekToPosition(e.clientX)
    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleTouchStart = (e) => {
    setIsDragging(true)
    seekToPosition(e.touches[0].clientX)
  }

  const handleTouchMove = (e) => {
    if (isDragging) seekToPosition(e.touches[0].clientX)
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  const handleSpeedChange = (e) => {
    const rate = parseFloat(e.target.value)
    setPlaybackRate(rate)
    if (audioRef.current) {
      audioRef.current.playbackRate = rate
    }
  }

  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isMuted) {
      audio.volume = volume
      setIsMuted(false)
    } else {
      audio.volume = 0
      setIsMuted(true)
    }
  }

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
    if (audioRef.current) {
      audioRef.current.volume = newVolume
    }
  }

  // Format time as mm:ss
  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Calculate progress percentage
  const progressPercent = duration ? (currentTime / duration) * 100 : 0

  if (!src && !meetingId) {
    return null
  }

  if (isLoadingAudio) {
    return (
      <div className={`bg-gray-50 dark:bg-gray-800 rounded-lg p-3 flex items-center gap-2 text-sm text-text-secondary dark:text-gray-400 ${className}`}>
        <Loader2 size={16} className="animate-spin" />
        Loading audio...
      </div>
    )
  }

  if (loadError) {
    return (
      <div className={`bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm text-red-500 dark:text-red-400 ${className}`}>
        Failed to load audio
      </div>
    )
  }

  if (!blobUrl) {
    return null
  }

  return (
    <div className={`bg-gray-50 dark:bg-gray-800 rounded-lg p-3 ${className}`}>
      <audio ref={audioRef} src={blobUrl} preload="metadata" />

      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          disabled={!isLoaded}
          className={`
            flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full
            transition-colors
            ${isLoaded
              ? 'bg-primary-500 hover:bg-primary-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }
          `}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>

        {/* Progress Bar */}
        <div className="flex-1 flex items-center gap-2">
          <span className="text-xs text-text-secondary w-10 text-right">
            {formatTime(currentTime)}
          </span>

          <div
            ref={progressRef}
            onClick={handleProgressClick}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full cursor-pointer relative group select-none touch-none"
          >
            {/* Progress Fill */}
            <div
              className={`absolute top-0 left-0 h-full bg-primary-500 rounded-full ${isDragging ? '' : 'transition-all'}`}
              style={{ width: `${progressPercent}%` }}
            />
            {/* Hover/drag indicator */}
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-primary-600 rounded-full shadow-sm ${isDragging ? 'opacity-100 scale-110' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
              style={{ left: `calc(${progressPercent}% - 7px)` }}
            />
          </div>

          <span className="text-xs text-text-secondary w-10">
            {formatTime(duration)}
          </span>
        </div>

        {/* Speed Control */}
        <select
          value={playbackRate}
          onChange={handleSpeedChange}
          className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-text-secondary dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-300"
        >
          <option value={0.5}>0.5x</option>
          <option value={0.75}>0.75x</option>
          <option value={1}>1x</option>
          <option value={1.25}>1.25x</option>
          <option value={1.5}>1.5x</option>
          <option value={2}>2x</option>
        </select>

        {/* Volume Control */}
        <div className="flex items-center gap-1 group">
          <button
            onClick={toggleMute}
            className="p-1 text-text-secondary hover:text-text-primary transition-colors"
          >
            {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-16 h-1 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-3
              [&::-webkit-slider-thumb]:h-3
              [&::-webkit-slider-thumb]:bg-primary-500
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:cursor-pointer
            "
          />
        </div>
      </div>
    </div>
  )
}
