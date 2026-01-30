export type ScoreCalibrationItem = {
  hn_id: number;
  global_score: number;
  hn_score: number | null;
  descendants: number | null;
};

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score));
}

function popularityScore(hnScore: number | null, descendants: number | null): number {
  const points = Math.max(0, hnScore ?? 0);
  const comments = Math.max(0, descendants ?? 0);
  const raw = Math.log1p(points) * 14 + Math.log1p(comments) * 11;
  return clampScore(raw);
}

function scoreStats(scores: number[]): { mean: number; std: number; uniqueCount: number } {
  if (!scores.length) return { mean: 0, std: 0, uniqueCount: 0 };
  const rounded = scores.map((s) => Math.round(s));
  const uniqueCount = new Set(rounded).size;
  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const variance =
    scores.reduce((sum, s) => sum + (s - mean) * (s - mean), 0) / scores.length;
  const std = Math.sqrt(variance);
  return { mean, std, uniqueCount };
}

export function shouldRecalibrateGlobalScores(items: ScoreCalibrationItem[]): boolean {
  if (items.length < 8) return false;
  const scores = items.map((i) => clampScore(i.global_score));
  const { std, uniqueCount } = scoreStats(scores);
  if (uniqueCount <= Math.max(3, Math.floor(items.length * 0.25))) return true;
  return std < 7;
}

export function recalibrateGlobalScores(
  items: ScoreCalibrationItem[],
  opts?: { minScore?: number; maxScore?: number }
): Map<number, number> {
  const minScore = opts?.minScore ?? 30;
  const maxScore = opts?.maxScore ?? 98;
  const n = items.length;
  const ranked = [...items].sort((a, b) => {
    const aLlm = clampScore(a.global_score);
    const bLlm = clampScore(b.global_score);
    const aPop = popularityScore(a.hn_score, a.descendants);
    const bPop = popularityScore(b.hn_score, b.descendants);
    const aKey = aLlm * 0.65 + aPop * 0.35;
    const bKey = bLlm * 0.65 + bPop * 0.35;
    if (bKey !== aKey) return bKey - aKey;
    return a.hn_id - b.hn_id;
  });

  const mapping = new Map<number, number>();
  for (let i = 0; i < ranked.length; i++) {
    const t = n === 1 ? 1 : 1 - i / (n - 1);
    const curved = Math.pow(t, 0.85);
    const score = Math.round(minScore + (maxScore - minScore) * curved);
    mapping.set(ranked[i].hn_id, clampScore(score));
  }
  return mapping;
}

