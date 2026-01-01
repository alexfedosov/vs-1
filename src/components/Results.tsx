import { useState, useCallback } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { exportResults, saveProgress } from '../lib/storage';
import { getSortedResults } from '../lib/tournament';
import { Toast } from './Toast';
import { ScrollIndicator } from './ScrollIndicator';
import type { TournamentState } from '../types';

interface ResultsProps {
  tournament: TournamentState;
  onBack: () => void;
  onReset: () => void;
}

export function Results({ tournament, onBack, onReset }: ResultsProps) {
  const [exporting, setExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [minScoreFilter, setMinScoreFilter] = useState(0);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  const clearToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  const sortedSamples = getSortedResults(tournament);
  const maxScore = sortedSamples.length > 0 ? sortedSamples[0].score : 0;

  const filteredSamples = sortedSamples.filter(s => s.score >= minScoreFilter);

  const handleExportGood = async () => {
    try {
      const filePath = await save({
        filters: [{ name: 'Text', extensions: ['txt'] }],
        defaultPath: 'good_samples.txt',
        title: 'Export Good Samples',
      });

      if (!filePath) return;

      setExporting(true);
      await exportResults(sortedSamples, filePath, minScoreFilter);
      showToast(`Exported ${filteredSamples.length} samples`);
    } catch (err) {
      showToast(`Error exporting: ${err}`);
    } finally {
      setExporting(false);
    }
  };

  const handleSaveSession = async () => {
    try {
      const filePath = await save({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        defaultPath: 'vs1_session.json',
        title: 'Save Session',
      });

      if (!filePath) return;

      await saveProgress(tournament, filePath);
      showToast('Session saved');
    } catch (err) {
      showToast(`Error saving: ${err}`);
    }
  };

  const handleRevealInFinder = async (filePath: string) => {
    try {
      await invoke('reveal_in_finder', { filePath });
    } catch (err) {
      console.error('Reveal failed:', err);
    }
  };

  const handleCopyToClipboard = async (filePath: string) => {
    try {
      await invoke('copy_file_to_clipboard', { filePath });
      showToast('Copied to clipboard');
    } catch (err) {
      console.error('Copy failed:', err);
      showToast(`Copy failed: ${err}`);
    }
  };

  return (
    <div className="results-view">
      <h2>Leaderboard - Round {tournament.current_round}</h2>

      <div className="results-stats">
        <span>{sortedSamples.length} samples remaining</span>
        <span>Highest score: {maxScore}</span>
        <span className="drag-hint">Click to copy | Double-click to reveal</span>
      </div>

      <div className="filter-controls">
        <label>
          Minimum score to export: {minScoreFilter}
          <input
            type="range"
            min="0"
            max={maxScore}
            value={minScoreFilter}
            onChange={(e) => setMinScoreFilter(Number(e.target.value))}
          />
        </label>
        <span>{filteredSamples.length} samples match filter</span>
      </div>

      <div className="results-actions">
        <button className="primary-button" onClick={onBack}>
          Continue Tournament
        </button>
        <button className="secondary-button" onClick={handleExportGood} disabled={exporting}>
          Export List ({filteredSamples.length})
        </button>
        <button className="secondary-button" onClick={handleSaveSession}>
          Save Session
        </button>
        <button className="danger-button" onClick={onReset}>
          Start Over
        </button>
      </div>

      <div className="results-list">
        <ScrollIndicator>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Filename</th>
                <th>Score</th>
                <th>Comparisons</th>
                <th>Win Rate</th>
              </tr>
            </thead>
            <tbody>
              {sortedSamples.map((sample, index) => {
                const winRate = sample.comparisons > 0
                  ? ((sample.score / sample.comparisons) * 100).toFixed(1)
                  : '0.0';

                return (
                  <tr
                    key={sample.path}
                    className={`clickable-row ${sample.score >= minScoreFilter ? 'included' : 'excluded'}`}
                    onClick={() => handleCopyToClipboard(sample.path)}
                    onDoubleClick={() => handleRevealInFinder(sample.path)}
                    title="Click to copy, double-click to reveal in Finder"
                  >
                    <td>{index + 1}</td>
                    <td className="filename-cell">
                      {sample.filename}
                    </td>
                    <td>{sample.score}</td>
                    <td>{sample.comparisons}</td>
                    <td>{winRate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollIndicator>
      </div>

      <Toast message={toastMessage} onClose={clearToast} />
    </div>
  );
}
