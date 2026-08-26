import { OsuScoreData, Bounty } from '../types/bounty';
import { WORKER_API_URL } from '../config/api';

export function extractScoreId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  
  // Direct numeric ID
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  // URL formats:
  // https://osu.ppy.sh/scores/6821398994
  // https://osu.ppy.sh/scores/osu/6821398994
  const urlMatch = trimmed.match(/osu\.ppy\.sh\/scores\/(?:osu\/|taiko\/|fruits\/|mania\/)?(\d+)/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  // Generic digits extraction
  const genericMatch = trimmed.match(/(\d{6,14})/);
  if (genericMatch && genericMatch[1]) {
    return genericMatch[1];
  }

  return null;
}

export async function fetchScoreDetails(scoreIdOrUrl: string): Promise<OsuScoreData> {
  const scoreId = extractScoreId(scoreIdOrUrl);
  if (!scoreId) {
    throw new Error('Invalid score URL or ID format. Please paste a valid link like https://osu.ppy.sh/scores/6821398994');
  }

  const workerUrl = WORKER_API_URL || 'https://osu-beatmap-gacha-worker.afterlight0338.workers.dev';
  const targetUrl = `${workerUrl}/api/score?id=${scoreId}`;

  const res = await fetch(targetUrl, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    let errMsg = `Failed to fetch score #${scoreId} (HTTP ${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson.error) errMsg = errJson.error;
    } catch {
      // fallback to status
    }
    throw new Error(errMsg);
  }

  const json = await res.json();
  if (!json.success || !json.score) {
    throw new Error(json.error || 'Score data could not be parsed from osu!');
  }

  return json.score as OsuScoreData;
}

export interface ScoreVerificationResult {
  valid: boolean;
  error?: string;
  score?: OsuScoreData;
}

const RANK_HIERARCHY: Record<string, number> = {
  F: 0,
  D: 1,
  C: 2,
  B: 3,
  A: 4,
  S: 5,
  SH: 5,
  SS: 6,
  SSH: 6,
};

export function verifyScoreForBounty(
  score: OsuScoreData,
  bounty: Bounty,
  bountyStartedAt: number,
  currentOsuId?: number,
  currentUsername?: string,
  claimedScoreIds: Set<string | number> = new Set()
): ScoreVerificationResult {
  // 1. Check if score was already redeemed
  if (claimedScoreIds.has(score.id) || claimedScoreIds.has(String(score.id))) {
    return {
      valid: false,
      error: `Score #${score.id} has already been claimed for a previous bounty reward. Each score can only be submitted once!`,
      score,
    };
  }

  // 2. Check Player Identity
  if (currentOsuId && score.userId !== currentOsuId) {
    if (!currentUsername || score.username.toLowerCase() !== currentUsername.toLowerCase()) {
      return {
        valid: false,
        error: `Score belongs to player "${score.username}" (#${score.userId}), but you are currently logged in as "${currentUsername || currentOsuId}". You must submit your own score!`,
        score,
      };
    }
  }

  // 3. Check Beatmap Match
  if (Number(score.beatmapId) !== Number(bounty.beatmap.id)) {
    return {
      valid: false,
      error: `Score was set on beatmap #${score.beatmapId} ("${score.beatmapArtist} - ${score.beatmapTitle} [${score.beatmapVersion}]"), but this bounty is for beatmap #${bounty.beatmap.id} ("${bounty.beatmap.artist} - ${bounty.beatmap.title} [${bounty.beatmap.version}]")!`,
      score,
    };
  }

  // 4. Check Timestamp (Score must have ended AFTER the bounty was started)
  // Give 15-second grace window for local device clock slight variations
  const timeDifferenceMs = score.endedAt - bountyStartedAt;
  if (timeDifferenceMs < -15000) {
    const startedDate = new Date(bountyStartedAt).toLocaleTimeString();
    const scoreDate = new Date(score.endedAt).toLocaleTimeString();
    return {
      valid: false,
      error: `Timestamp mismatch: This score was set at ${scoreDate}, but you started this bounty later at ${startedDate}. You must play and set the score AFTER accepting the bounty!`,
      score,
    };
  }

  // 5. Check Pass
  if (!score.passed || score.rank === 'F') {
    return {
      valid: false,
      error: 'This score is a failed attempt (Fail / Rank F). You must pass the beatmap to complete the bounty!',
      score,
    };
  }

  // 6. Check Rank Requirement
  const reqRank = bounty.requirements.minRank;
  if (reqRank !== 'Pass') {
    const minWeight = RANK_HIERARCHY[reqRank] || 4;
    const scoreWeight = RANK_HIERARCHY[score.rank] || 0;
    if (scoreWeight < minWeight) {
      return {
        valid: false,
        error: `Required minimum Grade is ${reqRank}, but your score achieved Grade ${score.rank}.`,
        score,
      };
    }
  }

  // 7. Check Accuracy Requirement
  if (bounty.requirements.minAccuracy !== undefined && bounty.requirements.minAccuracy > 0) {
    if (score.accuracy < bounty.requirements.minAccuracy) {
      return {
        valid: false,
        error: `Required minimum accuracy is ${bounty.requirements.minAccuracy.toFixed(2)}%, but your score achieved ${score.accuracy.toFixed(2)}%.`,
        score,
      };
    }
  }

  // 8. Check Required Mods
  if (bounty.requirements.requiredMods && bounty.requirements.requiredMods.length > 0) {
    const missingMods = bounty.requirements.requiredMods.filter(
      (m) => !score.mods.includes(m.toUpperCase())
    );
    if (missingMods.length > 0) {
      return {
        valid: false,
        error: `Required mod(s) [${bounty.requirements.requiredMods.join(', ')}] were not used in this score. Your mods: [${score.mods.join(', ') || 'Nomod'}].`,
        score,
      };
    }
  }

  return {
    valid: true,
    score,
  };
}
