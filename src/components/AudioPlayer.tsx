import { useImperativeHandle, forwardRef } from 'react';
import { useBufferedAudio } from '../hooks/useBufferedAudio';
import { Waveform } from './Waveform';

export interface AudioPlayerHandle {
  play: () => void;
  stop: () => void;
  isPlaying: boolean;
}

interface AudioPlayerProps {
  filePath: string | null;
  label: string;
  onSelect?: () => void;
  onPlay?: () => void;
  isSelected?: boolean;
  playKey?: string;
  selectKey?: string;
}

export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(
  function AudioPlayer(
    { filePath, label, onSelect, onPlay, isSelected, playKey, selectKey },
    ref
  ) {
    const { isPlaying, isLoaded, duration, currentTime, play, stop } = useBufferedAudio(filePath);

    const filename = filePath?.split('/').pop() || 'No file';

    useImperativeHandle(ref, () => ({
      play: () => {
        if (isLoaded) {
          play();
          onPlay?.();
        }
      },
      stop,
      isPlaying,
    }), [isLoaded, play, stop, isPlaying, onPlay]);

    const handlePlay = () => {
      if (isLoaded) {
        play();
        onPlay?.();
      }
    };

    return (
      <div
        className={`audio-player ${isSelected ? 'selected' : ''} ${isPlaying ? 'playing' : ''} ${isLoaded ? 'ready' : 'loading'}`}
        onClick={onSelect}
      >
        <div className="player-header">
          <span className="player-label">{label}</span>
          {playKey && <span className="play-key">[{playKey}]</span>}
          {!isLoaded && <span className="loading-indicator">...</span>}
        </div>

        <div className="filename" title={filePath || ''}>
          {filename}
        </div>

        <div className="player-controls">
          <button
            className={`play-button ${isPlaying ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (isPlaying) {
                stop();
              } else {
                handlePlay();
              }
            }}
            disabled={!isLoaded}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          <button
            className="stop-button"
            onClick={(e) => {
              e.stopPropagation();
              stop();
            }}
            disabled={!isLoaded}
          >
            ⏹
          </button>
        </div>

        <Waveform
          filePath={filePath}
          progress={duration > 0 ? currentTime / duration : 0}
          isPlaying={isPlaying}
        />

        {onSelect && (
          <button className="select-button" onClick={onSelect}>
            Select {label} {selectKey && `[${selectKey}]`}
          </button>
        )}
      </div>
    );
  }
);
