import type { Sample, TournamentState } from '../types';

export function createTournament(
  samples: Sample[],
  sourceDirectory: string,
  advancementThreshold: number = 0.5
): TournamentState {
  const state: TournamentState = {
    samples: samples.map(s => ({ ...s, score: 0, comparisons: 0 })),
    current_round: 1,
    comparisons_this_round: [],
    current_comparison_index: 0,
    advancement_threshold: advancementThreshold,
    source_directory: sourceDirectory,
  };

  state.comparisons_this_round = generatePairings(state.samples);
  return state;
}

export function generatePairings(samples: Sample[]): [number, number][] {
  if (samples.length < 2) return [];

  const indexed = samples.map((s, i) => ({ sample: s, index: i }));
  indexed.sort((a, b) => b.sample.score - a.sample.score);

  const pairings: [number, number][] = [];
  const used = new Set<number>();

  for (let i = 0; i < indexed.length - 1; i++) {
    if (used.has(indexed[i].index)) continue;

    for (let j = i + 1; j < indexed.length; j++) {
      if (used.has(indexed[j].index)) continue;

      pairings.push([indexed[i].index, indexed[j].index]);
      used.add(indexed[i].index);
      used.add(indexed[j].index);
      break;
    }
  }

  return shuffleArray(pairings);
}

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function recordComparison(
  state: TournamentState,
  winnerIndex: number
): TournamentState {
  const newState = { ...state, samples: [...state.samples] };

  newState.samples[winnerIndex] = {
    ...newState.samples[winnerIndex],
    score: newState.samples[winnerIndex].score + 1,
    comparisons: newState.samples[winnerIndex].comparisons + 1,
  };

  const currentPairing = state.comparisons_this_round[state.current_comparison_index];
  const loserIndex = currentPairing[0] === winnerIndex ? currentPairing[1] : currentPairing[0];
  newState.samples[loserIndex] = {
    ...newState.samples[loserIndex],
    comparisons: newState.samples[loserIndex].comparisons + 1,
  };

  newState.current_comparison_index = state.current_comparison_index + 1;

  return newState;
}

export function eliminateBoth(state: TournamentState): TournamentState {
  const currentPairing = state.comparisons_this_round[state.current_comparison_index];
  if (!currentPairing) return state;

  const [indexA, indexB] = currentPairing;

  const newSamples = state.samples.map((sample, i) => {
    if (i === indexA || i === indexB) {
      return { ...sample, score: -1000, comparisons: sample.comparisons + 1 };
    }
    return sample;
  });

  const newComparisons = state.comparisons_this_round.filter((pair, idx) => {
    if (idx <= state.current_comparison_index) return true;
    return !pair.includes(indexA) && !pair.includes(indexB);
  });

  return {
    ...state,
    samples: newSamples,
    comparisons_this_round: newComparisons,
    current_comparison_index: state.current_comparison_index + 1,
  };
}

export function isRoundComplete(state: TournamentState): boolean {
  return state.current_comparison_index >= state.comparisons_this_round.length;
}

export function advanceToNextRound(state: TournamentState): TournamentState {
  const sortedSamples = [...state.samples].sort((a, b) => b.score - a.score);

  const keepCount = Math.max(
    2,
    Math.ceil(sortedSamples.length * state.advancement_threshold)
  );

  const advancingSamples = sortedSamples.slice(0, keepCount);

  const newState: TournamentState = {
    ...state,
    samples: advancingSamples,
    current_round: state.current_round + 1,
    current_comparison_index: 0,
    comparisons_this_round: generatePairings(advancingSamples),
  };

  return newState;
}

export function getCurrentPairing(state: TournamentState): [Sample, Sample] | null {
  if (state.current_comparison_index >= state.comparisons_this_round.length) {
    return null;
  }

  const [indexA, indexB] = state.comparisons_this_round[state.current_comparison_index];
  return [state.samples[indexA], state.samples[indexB]];
}

export function getCurrentPairingIndices(state: TournamentState): [number, number] | null {
  if (state.current_comparison_index >= state.comparisons_this_round.length) {
    return null;
  }
  return state.comparisons_this_round[state.current_comparison_index];
}

export function isTournamentComplete(state: TournamentState): boolean {
  return state.samples.length <= 1 ||
    (isRoundComplete(state) && state.comparisons_this_round.length === 0);
}

export function getProgress(state: TournamentState): {
  currentComparison: number;
  totalComparisonsThisRound: number;
  currentRound: number;
  samplesRemaining: number;
  percentComplete: number;
} {
  const totalComparisonsThisRound = state.comparisons_this_round.length;
  const percentComplete = totalComparisonsThisRound > 0
    ? (state.current_comparison_index / totalComparisonsThisRound) * 100
    : 100;

  const activeSamples = state.samples.filter(s => s.score > -1000).length;

  return {
    currentComparison: Math.min(state.current_comparison_index + 1, totalComparisonsThisRound),
    totalComparisonsThisRound,
    currentRound: state.current_round,
    samplesRemaining: activeSamples,
    percentComplete,
  };
}

export function getSortedResults(state: TournamentState): Sample[] {
  return [...state.samples]
    .filter(s => s.score > -1000)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aRate = a.comparisons > 0 ? a.score / a.comparisons : 0;
      const bRate = b.comparisons > 0 ? b.score / b.comparisons : 0;
      return bRate - aRate;
    });
}

export function getUpcomingPairings(state: TournamentState, count: number = 2): [Sample, Sample][] {
  const pairings: [Sample, Sample][] = [];
  const startIndex = state.current_comparison_index;

  for (let i = 0; i < count && startIndex + i < state.comparisons_this_round.length; i++) {
    const [indexA, indexB] = state.comparisons_this_round[startIndex + i];
    pairings.push([state.samples[indexA], state.samples[indexB]]);
  }

  return pairings;
}
