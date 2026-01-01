import { useState, useCallback, useRef, useEffect } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { DirectoryPicker } from './components/DirectoryPicker';
import { BattleView } from './components/BattleView';
import { Results } from './components/Results';
import { saveProgress, setLastSessionPath } from './lib/storage';
import {
  createTournament,
  recordComparison,
  advanceToNextRound,
  eliminateBoth,
} from './lib/tournament';
import type { Sample, TournamentState, AppView } from './types';
import './App.css';

function App() {
  const [view, setView] = useState<AppView>('home');
  const [tournament, setTournament] = useState<TournamentState | null>(null);
  const tournamentRef = useRef<TournamentState | null>(null);

  useEffect(() => {
    tournamentRef.current = tournament;
  }, [tournament]);

  const handleStartTournament = useCallback(
    (samples: Sample[], directory: string, threshold: number) => {
      const newTournament = createTournament(samples, directory, threshold);
      setTournament(newTournament);
      setView('battle');
    },
    []
  );

  const handleLoadSession = useCallback((state: TournamentState) => {
    setTournament(state);
    setView('battle');
  }, []);

  const handleSelectWinner = useCallback((winnerIndex: number) => {
    setTournament(prev => {
      if (!prev) return prev;
      return recordComparison(prev, winnerIndex);
    });
  }, []);

  const handleEliminateBoth = useCallback(() => {
    setTournament(prev => {
      if (!prev) return prev;
      return eliminateBoth(prev);
    });
  }, []);

  const handleNextRound = useCallback(() => {
    setTournament(prev => {
      if (!prev) return prev;
      return advanceToNextRound(prev);
    });
  }, []);

  const handleViewResults = useCallback(() => {
    setView('results');
  }, []);

  const handleBackToBattle = useCallback(() => {
    setView('battle');
  }, []);

  const handleReset = useCallback(() => {
    setTournament(null);
    setView('home');
  }, []);

  const handleSave = useCallback(async () => {
    const currentTournament = tournamentRef.current;
    if (!currentTournament) return;

    try {
      const filePath = await save({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        defaultPath: 'vs1_session.json',
        title: 'Save Progress',
      });

      if (filePath) {
        await saveProgress(currentTournament, filePath);
        setLastSessionPath(filePath);
      }
    } catch (err) {
      console.error('Error saving:', err);
    }
  }, []);

  return (
    <div className="app">
      {view === 'home' && (
        <DirectoryPicker
          onStartTournament={handleStartTournament}
          onLoadSession={handleLoadSession}
        />
      )}

      {view === 'battle' && tournament && (
        <BattleView
          tournament={tournament}
          onSelectWinner={handleSelectWinner}
          onEliminateBoth={handleEliminateBoth}
          onNextRound={handleNextRound}
          onViewResults={handleViewResults}
          onSave={handleSave}
          onReset={handleReset}
        />
      )}

      {view === 'results' && tournament && (
        <Results
          tournament={tournament}
          onBack={handleBackToBattle}
          onReset={handleReset}
        />
      )}
    </div>
  );
}

export default App;
