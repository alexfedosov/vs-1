import { useEffect, useCallback, useRef, useState } from 'react';
import { AudioPlayer, AudioPlayerHandle } from './AudioPlayer';
import { preloadMultiple } from '../hooks/useBufferedAudio';
import type { TournamentState } from '../types';
import {
  getCurrentPairing,
  getCurrentPairingIndices,
  getProgress,
  isRoundComplete,
  isTournamentComplete,
  getUpcomingPairings,
} from '../lib/tournament';

interface BattleViewProps {
  tournament: TournamentState;
  onSelectWinner: (index: number) => void;
  onEliminateBoth: () => void;
  onNextRound: () => void;
  onViewResults: () => void;
  onSave: () => void;
  onReset: () => void;
}

export function BattleView({
  tournament,
  onSelectWinner,
  onEliminateBoth,
  onNextRound,
  onViewResults,
  onSave,
  onReset,
}: BattleViewProps) {
  const playerARef = useRef<AudioPlayerHandle>(null);
  const playerBRef = useRef<AudioPlayerHandle>(null);
  const [lastPlayed, setLastPlayed] = useState<'A' | 'B'>('A');

  const pairing = getCurrentPairing(tournament);
  const indices = getCurrentPairingIndices(tournament);
  const indicesRef = useRef(indices);
  indicesRef.current = indices;

  const progress = getProgress(tournament);
  const roundComplete = isRoundComplete(tournament);
  const tournamentComplete = isTournamentComplete(tournament);

  useEffect(() => {
    setLastPlayed('A');
  }, [tournament.current_comparison_index]);

  useEffect(() => {
    if (roundComplete || tournamentComplete) return;

    const upcoming = getUpcomingPairings(tournament, 3);
    const pathsToPreload = upcoming.flatMap(([a, b]) => [a.path, b.path]);

    if (pathsToPreload.length > 0) {
      preloadMultiple(pathsToPreload);
    }
  }, [tournament.current_comparison_index, tournament.current_round, roundComplete, tournamentComplete]);

  const playA = useCallback(() => {
    playerBRef.current?.stop();
    playerARef.current?.play();
    setLastPlayed('A');
  }, []);

  const playB = useCallback(() => {
    playerARef.current?.stop();
    playerBRef.current?.play();
    setLastPlayed('B');
  }, []);

  const selectWinner = useCallback((which: 'A' | 'B') => {
    const currentIndices = indicesRef.current;
    if (!currentIndices) return;
    playerARef.current?.stop();
    playerBRef.current?.stop();
    onSelectWinner(which === 'A' ? currentIndices[0] : currentIndices[1]);
  }, [onSelectWinner]);

  const handlePlayA = useCallback(() => {
    playerBRef.current?.stop();
    setLastPlayed('A');
  }, []);

  const handlePlayB = useCallback(() => {
    playerARef.current?.stop();
    setLastPlayed('B');
  }, []);

  const handleSelectA = useCallback(() => selectWinner('A'), [selectWinner]);
  const handleSelectB = useCallback(() => selectWinner('B'), [selectWinner]);

  const handleSkipBoth = useCallback(() => {
    playerARef.current?.stop();
    playerBRef.current?.stop();
    onEliminateBoth();
  }, [onEliminateBoth]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (roundComplete || !indices) return;

      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        playA();
      } else if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        playB();
      }
      else if (e.key === 'Enter' && lastPlayed) {
        e.preventDefault();
        selectWinner(lastPlayed);
      }
      else if (e.key === ' ') {
        e.preventDefault();
        playerARef.current?.stop();
        playerBRef.current?.stop();
      }
      else if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSave();
      }
      else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        onViewResults();
      }
      else if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        playerARef.current?.stop();
        playerBRef.current?.stop();
        onEliminateBoth();
      }
    },
    [roundComplete, indices, playA, playB, lastPlayed, selectWinner, onSave, onViewResults, onEliminateBoth]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (tournamentComplete) {
    return (
      <div className="battle-view">
        <div className="tournament-complete">
          <h2>Tournament Complete!</h2>
          <p>You've narrowed down to {tournament.samples.length} sample(s).</p>
          <button className="primary-button" onClick={onViewResults}>
            View Results
          </button>
        </div>
      </div>
    );
  }

  if (roundComplete) {
    const nextRoundSamples = Math.ceil(
      tournament.samples.length * tournament.advancement_threshold
    );

    return (
      <div className="battle-view">
        <div className="round-complete">
          <h2>Round {tournament.current_round} Complete!</h2>
          <p>
            {tournament.samples.length} samples will be reduced to ~{nextRoundSamples} in the next round.
          </p>
          <div className="round-actions">
            <button className="primary-button" onClick={onNextRound}>
              Start Round {tournament.current_round + 1}
            </button>
            <button className="secondary-button" onClick={onViewResults}>
              View Current Results
            </button>
            <button className="secondary-button" onClick={onSave}>
              Save Progress
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!pairing || !indices) {
    return <div className="battle-view">No comparisons available</div>;
  }

  const [sampleA, sampleB] = pairing;

  return (
    <div className="battle-view">
      <div className="progress-info">
        <div className="progress-stats">
          <span>Round {progress.currentRound}</span>
          <span>
            Comparison {progress.currentComparison} of {progress.totalComparisonsThisRound}
          </span>
          <span>{progress.samplesRemaining} samples remaining</span>
        </div>
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{ width: `${progress.percentComplete}%` }}
          />
        </div>
      </div>

      <div className="battle-arena">
        <AudioPlayer
          ref={playerARef}
          filePath={sampleA.path}
          label="A"
          playKey="Q"
          onPlay={handlePlayA}
          onSelect={handleSelectA}
          isSelected={lastPlayed === 'A'}
        />

        <div className="vs-divider">VS</div>

        <AudioPlayer
          ref={playerBRef}
          filePath={sampleB.path}
          label="B"
          playKey="W"
          onPlay={handlePlayB}
          onSelect={handleSelectB}
          isSelected={lastPlayed === 'B'}
        />
      </div>

      <div className="battle-hint">
        Q/W = Play | Enter = Select | X = Skip Both | Space = Stop | L = Leaderboard
        {lastPlayed && <span className="last-played"> (Ready to select {lastPlayed})</span>}
      </div>

      <div className="battle-actions">
        <button className="danger-button" onClick={handleSkipBoth}>
          Skip Both (X)
        </button>
        <button className="secondary-button" onClick={onViewResults}>
          Leaderboard (L)
        </button>
        <button className="secondary-button" onClick={onSave}>
          Save
        </button>
        <button className="danger-button" onClick={onReset}>
          Start Over
        </button>
      </div>
    </div>
  );
}
