export interface Sample {
  path: string;
  filename: string;
  score: number;
  comparisons: number;
}

export interface TournamentState {
  samples: Sample[];
  current_round: number;
  comparisons_this_round: [number, number][];
  current_comparison_index: number;
  advancement_threshold: number;
  source_directory: string;
}

export type AppView = 'home' | 'battle' | 'results';

export interface AppState {
  view: AppView;
  tournament: TournamentState | null;
  isLoading: boolean;
  error: string | null;
}
