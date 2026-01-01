import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { scanDirectory, loadProgress, getLastSessionPath } from '../lib/storage';
import type { Sample, TournamentState } from '../types';

interface DirectoryPickerProps {
  onStartTournament: (samples: Sample[], directory: string, threshold: number) => void;
  onLoadSession: (state: TournamentState) => void;
}

export function DirectoryPicker({ onStartTournament, onLoadSession }: DirectoryPickerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ samples: Sample[]; directory: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(50);

  const lastSessionPath = getLastSessionPath();

  const handleSelectDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Audio Samples Directory',
      });

      if (!selected) return;

      setIsScanning(true);
      setError(null);

      const samples = await scanDirectory(selected as string);
      setScanResult({ samples, directory: selected as string });
    } catch (err) {
      setError(`Error scanning directory: ${err}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleLoadSession = async () => {
    try {
      const selected = await open({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        multiple: false,
        title: 'Load Session',
      });

      if (!selected) return;

      const state = await loadProgress(selected as string);
      onLoadSession(state);
    } catch (err) {
      setError(`Error loading session: ${err}`);
    }
  };

  const handleLoadLastSession = async () => {
    if (!lastSessionPath) return;

    try {
      const state = await loadProgress(lastSessionPath);
      onLoadSession(state);
    } catch (err) {
      setError(`Error loading last session: ${err}`);
    }
  };

  const handleStartTournament = () => {
    if (!scanResult) return;
    onStartTournament(scanResult.samples, scanResult.directory, threshold / 100);
  };

  return (
    <div className="directory-picker">
      <h1>VS-1</h1>
      <p className="subtitle">sample comparison tool</p>

      {error && <div className="error-message">{error}</div>}

      <div className="picker-actions">
        <button
          className="primary-button"
          onClick={handleSelectDirectory}
          disabled={isScanning}
        >
          {isScanning ? 'Scanning...' : 'Select Samples Directory'}
        </button>

        <button className="secondary-button" onClick={handleLoadSession}>
          Load Saved Session
        </button>

        {lastSessionPath && (
          <button className="secondary-button" onClick={handleLoadLastSession}>
            Resume Last Session
          </button>
        )}
      </div>

      {scanResult && (
        <div className="scan-result">
          <h3>Found {scanResult.samples.length} audio samples</h3>
          <p className="directory-path">{scanResult.directory}</p>

          <div className="threshold-setting">
            <label>
              Advancement threshold: {threshold}%
              <br />
              <small>Top {threshold}% of samples advance each round</small>
            </label>
            <input
              type="range"
              min="10"
              max="90"
              step="5"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </div>

          <button
            className="primary-button start-button"
            onClick={handleStartTournament}
            disabled={scanResult.samples.length < 2}
          >
            Start Tournament
          </button>

          {scanResult.samples.length < 2 && (
            <p className="warning">Need at least 2 samples to start</p>
          )}
        </div>
      )}
    </div>
  );
}
