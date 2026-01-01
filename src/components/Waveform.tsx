import { useRef, useEffect, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';

interface WaveformProps {
  filePath: string | null;
  progress: number;
  isPlaying: boolean;
}

const BAR_WIDTH = 2;
const BAR_GAP = 1;

const waveformCache = new Map<string, number[]>();

async function decodeAudioData(filePath: string): Promise<number[]> {
  const cached = waveformCache.get(filePath);
  if (cached) return cached;

  try {
    const src = convertFileSrc(filePath);
    const response = await fetch(src);
    const arrayBuffer = await response.arrayBuffer();

    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const rawData = audioBuffer.getChannelData(0);

    const samples = 100;
    const blockSize = Math.floor(rawData.length / samples);
    const peaks: number[] = [];

    for (let i = 0; i < samples; i++) {
      const start = i * blockSize;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[start + j] || 0);
      }
      peaks.push(sum / blockSize);
    }

    const max = Math.max(...peaks);
    const normalized = peaks.map(p => (max > 0 ? p / max : 0));

    waveformCache.set(filePath, normalized);
    await audioContext.close();

    return normalized;
  } catch (err) {
    console.error('Failed to decode audio:', err);
    return [];
  }
}

export function Waveform({ filePath, progress, isPlaying }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!filePath) {
      setPeaks([]);
      return;
    }

    setIsLoading(true);
    decodeAudioData(filePath)
      .then(setPeaks)
      .finally(() => setIsLoading(false));
  }, [filePath]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    if (peaks.length === 0) {
      const barCount = Math.floor(width / (BAR_WIDTH + BAR_GAP));
      ctx.fillStyle = '#222';
      for (let i = 0; i < barCount; i++) {
        const x = i * (BAR_WIDTH + BAR_GAP);
        const barHeight = 4 + Math.random() * 8;
        const y = (height - barHeight) / 2;
        ctx.fillRect(x, y, BAR_WIDTH, barHeight);
      }
      return;
    }

    const barCount = peaks.length;
    const totalWidth = barCount * (BAR_WIDTH + BAR_GAP);
    const scale = width / totalWidth;
    const progressX = progress * width;

    for (let i = 0; i < barCount; i++) {
      const x = i * (BAR_WIDTH + BAR_GAP) * scale;
      const barHeight = Math.max(2, peaks[i] * (height - 4));
      const y = (height - barHeight) / 2;

      if (x < progressX) {
        ctx.fillStyle = isPlaying ? '#00ff88' : '#ff6b35';
      } else {
        ctx.fillStyle = '#444';
      }

      ctx.fillRect(x, y, BAR_WIDTH * scale, barHeight);
    }
  }, [peaks, progress, isPlaying]);

  return (
    <div className="waveform-container">
      <canvas
        ref={canvasRef}
        className={`waveform ${isLoading ? 'loading' : ''}`}
      />
    </div>
  );
}
