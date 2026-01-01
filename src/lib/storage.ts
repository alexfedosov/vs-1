import { invoke } from '@tauri-apps/api/core';
import type { Sample, TournamentState } from '../types';

export async function scanDirectory(directory: string): Promise<Sample[]> {
  return invoke<Sample[]>('scan_directory', { directory });
}

export async function saveProgress(
  state: TournamentState,
  filePath: string
): Promise<void> {
  return invoke('save_progress', { state, filePath });
}

export async function loadProgress(filePath: string): Promise<TournamentState> {
  return invoke<TournamentState>('load_progress', { filePath });
}

export async function exportResults(
  samples: Sample[],
  filePath: string,
  minScore: number
): Promise<void> {
  return invoke('export_results', { samples, filePath, minScore });
}

export async function getAudioFileUrl(filePath: string): Promise<string> {
  return invoke<string>('get_audio_file_url', { filePath });
}

const LAST_SESSION_KEY = 'vs1_last_session_path';

export function getLastSessionPath(): string | null {
  return localStorage.getItem(LAST_SESSION_KEY);
}

export function setLastSessionPath(path: string): void {
  localStorage.setItem(LAST_SESSION_KEY, path);
}
