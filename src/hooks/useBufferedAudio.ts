import { useRef, useState, useCallback, useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';

interface AudioCache {
  audio: HTMLAudioElement;
  loaded: boolean;
}

const audioCache = new Map<string, AudioCache>();
const loadingPromises = new Map<string, Promise<HTMLAudioElement>>();
const MAX_CACHE_SIZE = 20;
const cacheOrder: string[] = [];

function evictOldest() {
  while (cacheOrder.length > MAX_CACHE_SIZE) {
    const oldest = cacheOrder.shift();
    if (oldest) {
      const entry = audioCache.get(oldest);
      if (entry) {
        entry.audio.pause();
        entry.audio.src = '';
      }
      audioCache.delete(oldest);
      loadingPromises.delete(oldest);
    }
  }
}

export function preloadAudio(filePath: string): Promise<HTMLAudioElement> {
  const cached = audioCache.get(filePath);
  if (cached?.loaded) {
    return Promise.resolve(cached.audio);
  }

  const existing = loadingPromises.get(filePath);
  if (existing) {
    return existing;
  }

  const promise = new Promise<HTMLAudioElement>((resolve, reject) => {
    const audio = new Audio();
    const src = convertFileSrc(filePath);

    audioCache.set(filePath, { audio, loaded: false });
    cacheOrder.push(filePath);
    evictOldest();

    const handleLoaded = () => {
      const entry = audioCache.get(filePath);
      if (entry) {
        entry.loaded = true;
      }
      loadingPromises.delete(filePath);
      resolve(audio);
    };

    const handleError = () => {
      loadingPromises.delete(filePath);
      audioCache.delete(filePath);
      const idx = cacheOrder.indexOf(filePath);
      if (idx > -1) cacheOrder.splice(idx, 1);
      reject(new Error(audio.error?.message || 'Failed to load'));
    };

    audio.addEventListener('canplaythrough', handleLoaded, { once: true });
    audio.addEventListener('error', handleError, { once: true });

    audio.preload = 'auto';
    audio.src = src;
    audio.load();
  });

  loadingPromises.set(filePath, promise);
  return promise;
}

export function preloadMultiple(filePaths: string[]) {
  filePaths.forEach(path => {
    preloadAudio(path).catch(() => {});
  });
}

export function useBufferedAudio(filePath: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeUpdateRef = useRef<(() => void) | null>(null);
  const endedRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!filePath) {
      setIsLoaded(false);
      setIsPlaying(false);
      setError(null);
      setDuration(0);
      setCurrentTime(0);
      return;
    }

    const cached = audioCache.get(filePath);
    if (cached?.loaded) {
      audioRef.current = cached.audio;
      setDuration(cached.audio.duration);
      setIsLoaded(true);
      setError(null);
    } else {
      setIsLoaded(false);
    }

    preloadAudio(filePath)
      .then(audio => {
        audioRef.current = audio;
        setDuration(audio.duration);
        setIsLoaded(true);
        setError(null);
      })
      .catch(err => {
        setError(err.message);
        setIsLoaded(false);
      });

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        if (timeUpdateRef.current) {
          audioRef.current.removeEventListener('timeupdate', timeUpdateRef.current);
        }
        if (endedRef.current) {
          audioRef.current.removeEventListener('ended', endedRef.current);
        }
      }
      setIsPlaying(false);
      setCurrentTime(0);
    };
  }, [filePath]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isLoaded) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    timeUpdateRef.current = handleTimeUpdate;
    endedRef.current = handleEnded;

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [isLoaded]);

  const play = useCallback(() => {
    if (audioRef.current && isLoaded) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.error('Play error:', err);
      });
      setIsPlaying(true);
    }
  }, [isLoaded]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, []);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  return {
    isPlaying,
    isLoaded,
    duration,
    currentTime,
    error,
    play,
    pause,
    toggle,
    stop,
    seek,
  };
}
