import type { Express, Request, Response } from "express";
import {
  PLAYER_TALK_REQUIRED_BLOCK_ID,
  getPlayerTalkCooldownSummary,
  recordPlayerTalkAdCooldown,
  resolveActor,
  verifyAndConsumeAdProof,
} from "./server_ads_predictions.ts";

export type PlayerMoodCode =
  | "ecstatic"
  | "happy"
  | "motivated"
  | "calm"
  | "restless"
  | "table_unhappy"
  | "bad_mood"
  | "coach_conflict"
  | "wants_leave";

export type PlayerMoodTone = "ecstatic" | "positive" | "calm" | "warn" | "danger";

export type PlayerTalkTopic =
  | "playing_time"
  | "coach_conflict"
  | "keep_in_club"
  | "table_ambitions"
  | "tough_talk"
  | "custom";

export interface PlayerMoodSummary {
  code: PlayerMoodCode;
  label: string;
  shortLabel: string;
  emoji: string;
  tone: PlayerMoodTone;
  score: number; // 0..100
  wantsToLeave: boolean;
  summary: string;
  factors: string[];
  talkedInWindow: boolean;
  windowId: string;
  lastTalk: {
    at: string;
    topic: string;
    message: string;
    reply: string;
    outcomeLabel: string;
    moodBeforeLabel?: string;
    moodAfterLabel?: string;
  } | null;
}

export interface PlayerMoraleContext {
  getDb: () => any;
  save: () => void;
  S: () => string;
  team: (id: string) => any;
  tn: (id: string) => string;
  player: (id: string) => any;
  rosterOf: (tid: string) => any[];
  squadOf: (tid: string) => any[];
  table: (comp: string, beforeDate?: string) => any[];
  getCoachForTeam: (tid: string) => any;
  ageOfPlayer: (p: any) => number | null;
  isAvail: (p: any, date?: string, comp?: string | null) => boolean;
  getTransferWindowState: () => any;
  getMatch: (id: string) => any;
  needClub: (req: Request, res: Response, next: () => void) => void;
  fail: (res: Response, msg: string, code?: number) => void;
  cleanTxt: (v: any, max?: number) => string;
  compName: (id: string) => string;
  llm?: (sys: string, user: string, opts?: any) => Promise<string>;
  hasLlmKeys?: () => boolean;
  runWithAiCtx?: <T>(fn: () => Promise<T>) => Promise<T>;
}

const MOOD_META: Record<
  PlayerMoodCode,
  { label: string; shortLabel: string; emoji: string; tone: PlayerMoodTone }
> = {
  ecstatic: {
    label: "В восторге от игры в клубе",
    shortLabel: "В восторге",
    emoji: "🔥",
    tone: "ecstatic",
  },
  happy: {
    label: "Доволен в команде",
    shortLabel: "Доволен",
    emoji: "😊",
    tone: "positive",
  },
  motivated: {
    label: "Заряжен на борьбу",
    shortLabel: "Мотивирован",
    emoji: "💪",
    tone: "positive",
  },
  calm: {
    label: "Спокойное настроение",
    shortLabel: "Спокоен",
    emoji: "😌",
    tone: "calm",
  },
  restless: {
    label: "Не хватает игровой практики",
    shortLabel: "Мало играет",
    emoji: "😕",
    tone: "warn",
  },
  table_unhappy: {
    label: "Недоволен местом в таблице",
    shortLabel: "Недоволен таблицей",
    emoji: "📉",
    tone: "warn",
  },
  bad_mood: {
    label: "Плохое настроение в команде",
    shortLabel: "Плохое настроение",
    emoji: "😠",
    tone: "danger",
  },
  coach_conflict: {
    label: "Конфликт с тренером",
    shortLabel: "Конфликт с тренером",
    emoji: "⚡",
    tone: "danger",
  },
  wants_leave: {
    label: "Хочет уйти из команды",
    shortLabel: "Хочет уйти",
    emoji: "🚪",
    tone: "danger",
  },
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function stableHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 10000;
}

function getTransferWindowId(ctx: PlayerMoraleContext): string {
  const tw = ctx.getTransferWindowState?.();
  if (tw?.windowId) return String(tw.windowId);
  const db = ctx.getDb();
  const seq = Math.max(1, Number(db?.settings?.transferWindow?.windowSeq || 1));
  return `${ctx.S()}_w${seq}`;
}

export function ensureMoraleStores(db: any) {
  if (!db.playerMorale || typeof db.playerMorale !== "object" || Array.isArray(db.playerMorale)) {
    db.playerMorale = {};
  }
  if (!db.playerTalks || typeof db.playerTalks !== "object" || Array.isArray(db.playerTalks)) {
    db.playerTalks = {};
  }
}

export function hasTalkedToPlayerInWindow(
  db: any,
  teamId: string,
  playerId: string,
  windowId: string
): any | null {
  ensureMoraleStores(db);
  const winMap = db.playerTalks?.[windowId];
  if (!winMap || typeof winMap !== "object") return null;
  const key = `${teamId}:${playerId}`;
  return winMap[key] || null;
}

interface TeamContextSnapshot {
  season: string;
  teamId: string;
  teamName: string;
  comp: string;
  tablePos: number | null;
  tableTotal: number;
  points: number;
  playedLeague: number;
  recentForm: string;
  playedSeasonTotal: number;
  expectationMinPos: number;
  tableStandingMoodDelta: number;
  tableBadFlag: boolean;
  coachName: string;
  coachTemperament: string;
  coachStrict: boolean;
  statsByPid: Map<
    string,
    {
      games: number;
      starts: number;
      subIns: number;
      minutes: number;
      goals: number;
      assists: number;
      cleanSheets: number;
      ratingSum: number;
      ratingCount: number;
      recentStarts: number;
      recentAppearances: number;
      recentTeamMatches: number;
    }
  >;
  // Internal only: never leaked outside server calculation
  expectedStarterIds: Set<string>;
}

function buildTeamContextSnapshot(ctx: PlayerMoraleContext, teamId: string): TeamContextSnapshot {
  const db = ctx.getDb();
  const season = ctx.S();
  const t = ctx.team(teamId);
  const comp = String(t?.comp || "rpl");
  const rows = typeof ctx.table === "function" ? ctx.table(comp) : [];
  const row = Array.isArray(rows) ? rows.find((r: any) => r?.id === teamId) : null;
  const tablePos = row ? Number(row.pos || 0) : null;
  const tableTotal = Array.isArray(rows) && rows.length ? rows.length : 16;
  const playedLeague = row ? Number(row.p || 0) : 0;
  const points = row ? Number(row.pts || 0) : 0;
  const recentForm = String(row?.form || "");

  const roster = ctx.rosterOf(teamId);
  const budget = Number(t?.budget || 6_000_000);
  // Rough club ambition expectation (top-budget clubs expect top-5, mid-tier expect mid-table)
  const expectationMinPos =
    comp === "rpl" || comp === "fnl"
      ? budget >= 15_000_000
        ? 4
        : budget >= 8_500_000
          ? 7
          : budget >= 4_500_000
            ? 11
            : 13
      : Math.max(2, Math.round(tableTotal * 0.5));

  let tableStandingMoodDelta = 0;
  let tableBadFlag = false;
  if (tablePos && playedLeague >= 2) {
    const relRatio = tablePos / Math.max(1, tableTotal);
    if (tablePos <= 3) {
      tableStandingMoodDelta = 12;
    } else if (tablePos <= Math.max(5, expectationMinPos - 1)) {
      tableStandingMoodDelta = 6;
    } else if (tablePos >= tableTotal - 2 || relRatio >= 0.8) {
      tableStandingMoodDelta = -18;
      tableBadFlag = true;
    } else if (tablePos > expectationMinPos + 2) {
      tableStandingMoodDelta = -12;
      tableBadFlag = true;
    }
  }

  // Recent form wins/losses
  const fChars = recentForm.split("");
  const wins = fChars.filter((c) => c === "В").length;
  const losses = fChars.filter((c) => c === "П").length;
  if (fChars.length >= 3) {
    if (wins >= 4) tableStandingMoodDelta += 6;
    else if (losses >= 4) {
      tableStandingMoodDelta -= 8;
      tableBadFlag = true;
    } else if (wins >= 3) tableStandingMoodDelta += 3;
    else if (losses >= 3) tableStandingMoodDelta -= 4;
  }

  // Collect completed season matches for this team
  const teamDone = (Array.isArray(db.fixtures) ? db.fixtures : [])
    .filter(
      (f: any) =>
        f &&
        f.status === "done" &&
        (f.season || season) === season &&
        (f.home === teamId || f.away === teamId) &&
        !["friendly", "friendly_match", "national", "national_u21", "intra"].includes(String(f.comp || ""))
    )
    .sort(
      (a: any, b: any) =>
        String(a.date || "").localeCompare(String(b.date || "")) ||
        String(a.time || "").localeCompare(String(b.time || ""))
    );

  const statsByPid = new Map<string, any>();
  const ensureStat = (pid: string) => {
    let s = statsByPid.get(pid);
    if (!s) {
      s = {
        games: 0,
        starts: 0,
        subIns: 0,
        minutes: 0,
        goals: 0,
        assists: 0,
        cleanSheets: 0,
        ratingSum: 0,
        ratingCount: 0,
        recentStarts: 0,
        recentAppearances: 0,
        recentTeamMatches: 0,
      };
      statsByPid.set(pid, s);
    }
    return s;
  };

  const recentStartIndex = Math.max(0, teamDone.length - 4);
  for (let i = 0; i < teamDone.length; i++) {
    const f = teamDone[i];
    const isRecent = i >= recentStartIndex;
    const side = f.home === teamId ? "home" : "away";
    const mObj = ctx.getMatch?.(f.id);
    const startersArr =
      mObj?.ctx?.lineup?.[side]?.starters ||
      f.lineups?.[side]?.starters ||
      db.lineups?.[`${f.id}:${teamId}:${side}`]?.starters ||
      db.lineups?.[`${f.id}:${teamId}`]?.starters ||
      [];
    const startersSet = new Set(
      (Array.isArray(startersArr) ? startersArr : [])
        .map((x: any) => (typeof x === "string" ? x : x?.id))
        .filter(Boolean)
    );
    const stPlayers = f.st?.players || {};
    const ratingsArr = Array.isArray(mObj?.ratings) ? mObj.ratings : [];
    const ratingsByPid = new Map<string, number>();
    for (const r of ratingsArr) {
      const rpid = r?.playerId || r?.id;
      if (rpid && Number.isFinite(Number(r.rating))) ratingsByPid.set(rpid, Number(r.rating));
    }

    for (const p of roster) {
      if (isRecent) ensureStat(p.id).recentTeamMatches += 1;
      const ps = stPlayers[p.id];
      const inStarters = ps?.started === true || startersSet.has(p.id);
      const min = Number(ps?.min || 0);
      const subIn = !inStarters && (min > 0 || Number(ps?.g || 0) > 0 || Number(ps?.a || 0) > 0);
      if (!inStarters && !subIn) continue;
      const st = ensureStat(p.id);
      st.games += 1;
      if (inStarters) st.starts += 1;
      else st.subIns += 1;
      st.minutes += min;
      st.goals += Number(ps?.g || 0);
      st.assists += Number(ps?.a || 0);
      st.cleanSheets += Number(ps?.cs || 0);
      if (isRecent) {
        st.recentAppearances += 1;
        if (inStarters) st.recentStarts += 1;
      }
      const rat = ratingsByPid.get(p.id);
      if (rat !== undefined) {
        st.ratingSum += rat;
        st.ratingCount += 1;
      }
    }
  }

  // Internal determination of players who expect starting roles (NEVER returned to client!)
  const tacticStarters = new Set<string>(
    Array.isArray(db.tactics?.[teamId]?.starters) ? db.tactics[teamId].starters : []
  );
  const gks = roster
    .filter((p) => String(p.pos || "") === "ВР")
    .sort((a, b) => Number(b.ovr || b.rating || 65) - Number(a.ovr || a.rating || 65));
  const outfield = roster
    .filter((p) => String(p.pos || "") !== "ВР")
    .sort((a, b) => Number(b.ovr || b.rating || 65) - Number(a.ovr || a.rating || 65));

  const expectedStarterIds = new Set<string>();
  if (gks[0]) expectedStarterIds.add(gks[0].id);
  const topOutfieldThreshold =
    outfield.length >= 12 ? Number(outfield[11]?.ovr || outfield[11]?.rating || 70) : 68;

  for (let i = 0; i < outfield.length; i++) {
    const p = outfield[i];
    const ovr = Number(p.ovr || p.rating || 68);
    const pAge = ctx.ageOfPlayer(p) ?? 24;
    const st = statsByPid.get(p.id);
    const isTop12 = i < 12;
    const isNearTopRating = ovr >= topOutfieldThreshold && pAge >= 21;
    const isRegularStarterByHistory =
      st && teamDone.length >= 3 && st.starts / teamDone.length >= 0.55;
    const inSavedTacticXI = tacticStarters.has(p.id) && pAge >= 20;

    if (isTop12 || isNearTopRating || isRegularStarterByHistory || inSavedTacticXI) {
      expectedStarterIds.add(p.id);
    }
  }

  const coach = ctx.getCoachForTeam(teamId) || {};
  const coachTemperament = String(coach.temperament || "Уравновешенный");
  const coachStrict = /жёстк|жестк|требовател|эмоционал|импульсив|резк|строг/i.test(
    coachTemperament + " " + String(coach.styleTitle || "")
  );

  return {
    season,
    teamId,
    teamName: t?.name || ctx.tn(teamId),
    comp,
    tablePos,
    tableTotal,
    points,
    playedLeague,
    recentForm,
    playedSeasonTotal: teamDone.length,
    expectationMinPos,
    tableStandingMoodDelta,
    tableBadFlag,
    coachName: String(coach.name || "Главный тренер"),
    coachTemperament,
    coachStrict,
    statsByPid,
    expectedStarterIds,
  };
}

function isFieryCharacter(charTxt: string): boolean {
  return /вспыльч|дерзк|упрям|горды|эмоцион|амбициоз|принцип|характер|сложн|требов|резк|неуступ|горяч/i.test(
    charTxt
  );
}

export function computePlayerMood(
  ctx: PlayerMoraleContext,
  p: any,
  snap?: TeamContextSnapshot
): PlayerMoodSummary {
  const db = ctx.getDb();
  ensureMoraleStores(db);
  const tid = String(p?.teamId || "");
  const windowId = getTransferWindowId(ctx);
  if (!tid) {
    return {
      code: "calm",
      label: MOOD_META.calm.label,
      shortLabel: MOOD_META.calm.shortLabel,
      emoji: MOOD_META.calm.emoji,
      tone: MOOD_META.calm.tone,
      score: 60,
      wantsToLeave: false,
      summary: "Поддерживает форму в ожидании предложений от клубов.",
      factors: [],
      talkedInWindow: false,
      windowId,
      lastTalk: null,
    };
  }

  const teamSnap = snap || buildTeamContextSnapshot(ctx, tid);
  const st = teamSnap.statsByPid.get(p.id) || {
    games: 0,
    starts: 0,
    subIns: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    cleanSheets: 0,
    ratingSum: 0,
    ratingCount: 0,
    recentStarts: 0,
    recentAppearances: 0,
    recentTeamMatches: 0,
  };

  const saved = db.playerMorale[p.id] && typeof db.playerMorale[p.id] === "object"
    ? db.playerMorale[p.id]
    : {};
  const talkedRec = hasTalkedToPlayerInWindow(db, tid, p.id, windowId);

  const expectsRegularStart = teamSnap.expectedStarterIds.has(p.id);
  const teamMatches = teamSnap.playedSeasonTotal;
  const startRate = teamMatches > 0 ? st.starts / teamMatches : 0;
  const playRate = teamMatches > 0 ? st.games / teamMatches : 0;
  const avgRat = st.ratingCount > 0 ? st.ratingSum / st.ratingCount : null;
  const age = ctx.ageOfPlayer(p) ?? 24;
  const today = new Date().toISOString().slice(0, 10);
  const availableNow = ctx.isAvail(p, today, teamSnap.comp);
  const fiery = isFieryCharacter(String(p.character || ""));
  const h = stableHash(`${teamSnap.season}:${tid}:${p.id}`);

  let score = 62;
  const factors: string[] = [];

  // 1. Playing time impact — fundamentally different for starter-expectation vs reserve-expectation players!
  let lowMinutesConcern = false;
  let playingGreat = false;

  if (expectsRegularStart) {
    if (teamMatches === 0) {
      // Early / preseason baseline: starters usually positive or calm, small organic variance
      const preVar = (h % 19) - 6; // -6..+12
      score += 6 + preVar;
      factors.push("Готов к борьбе за место на поле со старта сезона");
    } else if (startRate >= 0.65 || (st.recentTeamMatches >= 2 && st.recentStarts >= st.recentTeamMatches - 1)) {
      playingGreat = true;
      score += 18;
      factors.push(`Регулярно выходит в старте (${st.starts} из ${teamMatches} матчей)`);
    } else if (startRate >= 0.45 || playRate >= 0.65) {
      score += 8;
      factors.push(`Получает стабильную практику (${st.games} матчей)`);
    } else if (!availableNow) {
      score -= 4;
      factors.push("Восстанавливается и стремится скорее вернуться в игру");
    } else {
      lowMinutesConcern = true;
      const missSeverity = teamMatches >= 4 ? -22 : -14;
      score += missSeverity;
      factors.push(`Ожидал больше выходов в старте (лишь ${st.starts} стартов из ${teamMatches})`);
    }
  } else {
    // Bench / reserve / rotation player: does NOT get offended if they aren't in starting XI every game!
    if (teamMatches === 0) {
      score += (h % 13) - 2; // 60..72 calm/motivated
      factors.push("Спокойно работает на тренировках и ждёт своего шанса");
    } else if (st.games > 0) {
      const subBoost = st.starts > 0 ? 14 : 9;
      score += subBoost;
      playingGreat = st.starts >= 2 || st.goals + st.assists >= 2;
      factors.push(
        st.starts > 0
          ? `Рад полученным шансам (${st.games} матчей, ${st.starts} в старте)`
          : `Ценит доверие при выходах на замену (${st.games} матчей)`
      );
    } else if (teamMatches >= 8 && age >= 24 && age <= 30 && availableNow) {
      // Only if a prime-age player gets literally ZERO minutes after 8+ matches might mild concern creep in
      score -= 7;
      factors.push("Пока обходится без игровой практики, но сохраняет профессионализм");
    } else {
      score += 4;
      factors.push("Без претензий к игровому времени, поддерживает команду");
    }
  }

  // 2. Personal performance
  if (avgRat !== null) {
    if (avgRat >= 7.3) {
      score += 7;
      factors.push(`В отличной форме (ср. оценка ${avgRat.toFixed(2)})`);
    } else if (avgRat < 6.15 && st.games >= 2) {
      score -= 6;
      factors.push(`Недоволен своей недавней игрой (оценка ${avgRat.toFixed(2)})`);
    }
  }
  if (st.goals + st.assists >= 3) {
    score += 5;
  }

  // 3. League table standing & recent club form
  score += teamSnap.tableStandingMoodDelta;
  if (teamSnap.tablePos && teamSnap.playedLeague >= 2) {
    if (teamSnap.tableStandingMoodDelta >= 8) {
      factors.push(`Воодушевлён борьбой клуба наверху таблицы (${teamSnap.tablePos}-е место)`);
    } else if (teamSnap.tableBadFlag) {
      factors.push(`Огорчён положением команды в таблице (${teamSnap.tablePos}-е место)`);
    }
  }

  // 4. Persistent morale adjustments & coach friction (saved in db.playerMorale[p.id])
  let coachFriction = clamp(Number(saved.coachFriction || 0), 0, 100);
  // Organic subtle coach friction when strict coach + fiery character + low minutes or slump (if not recently resolved by talk)
  const resolvedRecently =
    Number(saved.lastTalkResolvedCoachAt || 0) > 0 &&
    Date.now() - Number(saved.lastTalkResolvedCoachAt) < 14 * 24 * 60 * 60 * 1000;

  if (!saved.coachFrictionInitialized && !resolvedRecently) {
    const frictionSeed = h % 100;
    if (
      (fiery && teamSnap.coachStrict && (lowMinutesConcern || teamSnap.tableBadFlag)) ||
      (fiery && lowMinutesConcern && frictionSeed < 45) ||
      (teamSnap.coachStrict && teamSnap.tableBadFlag && expectsRegularStart && frictionSeed < 28)
    ) {
      coachFriction = Math.max(coachFriction, 48 + (frictionSeed % 28));
    } else if (fiery && frictionSeed < 9 && expectsRegularStart && !playingGreat) {
      coachFriction = Math.max(coachFriction, 42);
    }
  }

  // Organic subtle non-bench unhappiness on struggling clubs or restless stars so rosters feel varied
  if (!saved.talkDelta && !saved.customOverride) {
    if (h % 17 === 0 && fiery && !playingGreat && expectsRegularStart && !lowMinutesConcern) {
      score -= 10;
    } else if (h % 11 === 0 && !lowMinutesConcern && !teamSnap.tableBadFlag) {
      score += 6;
    }
  }

  const talkDelta = clamp(Number(saved.talkDelta || 0), -35, 35);
  const matchDelta = clamp(Number(saved.matchDelta || 0), -25, 25);
  const leaveBias = clamp(Number(saved.leaveBias || 0), -35, 45);

  score += talkDelta + matchDelta;
  if (coachFriction >= 45) score -= Math.round((coachFriction - 30) * 0.45);
  if (coachFriction >= 50) {
    factors.push(`Разногласия с тренером (${teamSnap.coachName})`);
  }

  score = clamp(Math.round(score), 5, 99);

  // Determine nuanced mood code (9 possible statuses!)
  let code: PlayerMoodCode;
  const leavePressure =
    (100 - score) * 0.55 +
    (coachFriction >= 60 ? 22 : coachFriction >= 45 ? 10 : 0) +
    (lowMinutesConcern ? 16 : 0) +
    (teamSnap.tableBadFlag && expectsRegularStart ? 10 : 0) +
    leaveBias;

  if (coachFriction >= 68 && leavePressure >= 66) {
    code = "wants_leave";
  } else if (leavePressure >= 68 && score <= 34) {
    code = "wants_leave";
  } else if (coachFriction >= 50) {
    code = "coach_conflict";
  } else if (score <= 34) {
    code = "bad_mood";
  } else if (teamSnap.tableBadFlag && score <= 50 && (!lowMinutesConcern || !expectsRegularStart)) {
    code = "table_unhappy";
  } else if (lowMinutesConcern && score <= 54) {
    code = "restless";
  } else if (score >= 82 && (playingGreat || teamSnap.tableStandingMoodDelta >= 6)) {
    code = "ecstatic";
  } else if (score >= 70) {
    code = "happy";
  } else if (score >= 60 && (playingGreat || st.games > 0 || h % 2 === 0)) {
    code = "motivated";
  } else {
    code = "calm";
  }

  // If coach_conflict or wants_leave was explicitly softened by talk, respect it cleanly
  if (saved.forcedMood && MOOD_META[saved.forcedMood as PlayerMoodCode]) {
    const sinceTalkMs = Date.now() - Number(saved.lastTalkAtMs || 0);
    if (sinceTalkMs < 20 * 60 * 1000 && talkDelta > 0) {
      // Keep talk outcome consistent right after conversation
      if (code === "wants_leave" && saved.forcedMood !== "wants_leave" && score >= 45) {
        code = saved.forcedMood as PlayerMoodCode;
      }
    }
  }

  const wantsToLeave = code === "wants_leave" || (code === "coach_conflict" && leavePressure >= 64);
  const meta = MOOD_META[code];

  let summary = "";
  if (saved.customNote) {
    summary = String(saved.customNote);
  } else if (code === "ecstatic") {
    summary = "Много играет, полностью доволен атмосферой в клубе и не помышляет об уходе.";
  } else if (code === "happy") {
    summary = "Доволен положением в команде, чувствует доверие и хочет продолжать здесь выступать.";
  } else if (code === "motivated") {
    summary = "Хороший рабочий настрой — выкладывается на тренировках и нацелен помочь клубу.";
  } else if (code === "calm") {
    summary = "Ровное рабочее настроение, никаких конфликтов или претензий к команде.";
  } else if (code === "restless") {
    summary = "Хочет чаще выходить в старте и переживает из-за нехватки игровых минут.";
  } else if (code === "table_unhappy") {
    summary = "Не нравится текущее положение команды в турнирной таблице и серия результатов.";
  } else if (code === "bad_mood") {
    summary = "Плохое настроение: не устраивает ситуация в команде, игровое время или результаты.";
  } else if (code === "coach_conflict") {
    summary = `Напряжённые отношения с главным тренером (${teamSnap.coachName}) из-за видения игры и роли.`;
  } else if (code === "wants_leave") {
    summary = "Недоволен ситуацией в клубе и всерьёз рассматривает вариант с уходом в другую команду.";
  }

  if (wantsToLeave && code !== "wants_leave" && !summary.includes("уход")) {
    summary += " Склоняется к смене клуба.";
  }

  return {
    code,
    label: meta.label,
    shortLabel: meta.shortLabel,
    emoji: meta.emoji,
    tone: meta.tone,
    score,
    wantsToLeave,
    summary,
    factors: factors.slice(0, 4),
    talkedInWindow: Boolean(talkedRec),
    windowId,
    lastTalk: talkedRec
      ? {
          at: talkedRec.at,
          topic: talkedRec.topicLabel || talkedRec.topic || "Разговор",
          message: talkedRec.message || "",
          reply: talkedRec.reply || "",
          outcomeLabel: talkedRec.outcomeLabel || "",
          moodBeforeLabel: talkedRec.moodBeforeLabel,
          moodAfterLabel: talkedRec.moodAfterLabel,
        }
      : null,
  };
}

export function buildClubMoraleMap(ctx: PlayerMoraleContext, teamId: string): Record<string, PlayerMoodSummary> {
  const snap = buildTeamContextSnapshot(ctx, teamId);
  const roster = ctx.rosterOf(teamId);
  const out: Record<string, PlayerMoodSummary> = {};
  for (const p of roster) {
    out[p.id] = computePlayerMood(ctx, p, snap);
  }
  return out;
}

export function updateMoraleAfterMatch(ctx: PlayerMoraleContext, f: any, m: any) {
  if (!f || ["friendly", "friendly_match", "national", "national_u21", "intra"].includes(String(f.comp || ""))) return;
  const db = ctx.getDb();
  ensureMoraleStores(db);
  for (const side of ["home", "away"] as const) {
    const tid = f[side];
    if (!tid) continue;
    const oppGoals = Number(side === "home" ? f.ag : f.hg) || 0;
    const ownGoals = Number(side === "home" ? f.hg : f.ag) || 0;
    const won = ownGoals > oppGoals;
    const lost = ownGoals < oppGoals;
    const snap = buildTeamContextSnapshot(ctx, tid);
    const starters = new Set<string>(m?.ctx?.lineup?.[side]?.starters || []);
    const bench = new Set<string>(m?.ctx?.lineup?.[side]?.bench || []);
    const stPlayers = f.st?.players || {};
    const ratingsMap = new Map<string, number>();
    for (const r of Array.isArray(m?.ratings) ? m.ratings : []) {
      const rpid = r?.playerId || r?.id;
      if (rpid && Number.isFinite(Number(r.rating))) ratingsMap.set(rpid, Number(r.rating));
    }

    for (const p of ctx.squadOf(tid)) {
      const ps = stPlayers[p.id];
      const min = Number(ps?.min || 0);
      const started = starters.has(p.id) || ps?.started === true;
      const onBench = bench.has(p.id);
      const expectsStart = snap.expectedStarterIds.has(p.id);
      const rec = (db.playerMorale[p.id] ||= {});
      let delta = Number(rec.matchDelta || 0);
      let friction = Number(rec.coachFriction || 0);

      if (started || min >= 45) {
        delta += won ? 3 : lost ? -2 : 1;
        const rat = ratingsMap.get(p.id);
        if (rat !== undefined && rat >= 7.6) delta += 2;
        if (Number(ps?.rc || 0) > 0) friction += 6;
      } else if (min > 0) {
        // Came off bench — happy for reserve, slightly mixed for core starter if happened repeatedly
        delta += expectsStart ? -1 : won ? 4 : 2;
      } else if (onBench && expectsStart && ctx.isAvail(p, f.date, f.comp)) {
        // Unused starter-tier player loses a bit of mood; bench-tier player does NOT!
        delta -= 4;
        if (lost) friction += 4;
      }

      // Natural slight decay of old grudge/boost over matches
      if (friction > 0 && started && won) friction = Math.max(0, friction - 4);
      rec.matchDelta = clamp(Math.round(delta * 0.9), -25, 25);
      if (friction > 0) {
        rec.coachFriction = clamp(friction, 0, 100);
        rec.coachFrictionInitialized = true;
      }
    }
  }
}

export function resetPlayerMoraleOnTransfer(db: any, playerId: string) {
  ensureMoraleStores(db);
  if (db.playerMorale[playerId]) {
    db.playerMorale[playerId] = {
      talkDelta: 8,
      matchDelta: 0,
      coachFriction: 0,
      coachFrictionInitialized: true,
      leaveBias: -15,
      customNote: "Свежий старт в новой команде — настроен показать себя.",
    };
  }
}

const TOPIC_LABELS: Record<PlayerTalkTopic, string> = {
  playing_time: "Игровое время и роль",
  coach_conflict: "Отношения с главным тренером",
  keep_in_club: "Будущее в клубе",
  table_ambitions: "Турнирная таблица и цели",
  tough_talk: "Жёсткий разговор о дисциплине",
  custom: "Личная беседа",
};

function evaluateConversationOutcome(
  topic: PlayerTalkTopic,
  message: string,
  mood: PlayerMoodSummary,
  p: any,
  snap: TeamContextSnapshot
): {
  talkDeltaAdd: number;
  coachFrictionDelta: number;
  leaveBiasDelta: number;
  outcomeType: "great" | "positive" | "mixed" | "tense";
  outcomeLabel: string;
} {
  const txt = message.toLowerCase();
  const isRude = /(уходи|проваливай|запас|сиди|слаб|бесполез|надоел|штраф|выгоню|молчи|не ной|без тебя)/.test(txt);
  const isSupportive = /(верим|ценим|шанс|помог|команд|важен|вместе|поддерж|поговори|исправ|довери|уваж|извин|ключев|остань|рассчитыв)/.test(txt);

  if (isRude) {
    return {
      talkDeltaAdd: -10,
      coachFrictionDelta: 14,
      leaveBiasDelta: 12,
      outcomeType: "tense",
      outcomeLabel: "Разговор вышел на повышенных тонах",
    };
  }

  let talkDeltaAdd = 10;
  let coachFrictionDelta = -10;
  let leaveBiasDelta = -10;

  if (topic === "coach_conflict") {
    coachFrictionDelta = mood.code === "coach_conflict" || mood.code === "wants_leave" ? -38 : -18;
    talkDeltaAdd = isSupportive ? 16 : 12;
    leaveBiasDelta = -14;
  } else if (topic === "keep_in_club") {
    leaveBiasDelta = -26;
    talkDeltaAdd = isSupportive ? 16 : 11;
    coachFrictionDelta = -18;
  } else if (topic === "playing_time") {
    talkDeltaAdd = mood.code === "restless" || mood.code === "bad_mood" ? 17 : 11;
    leaveBiasDelta = -14;
    coachFrictionDelta = -12;
  } else if (topic === "table_ambitions") {
    talkDeltaAdd = mood.code === "table_unhappy" || mood.code === "bad_mood" ? 15 : 10;
    leaveBiasDelta = -12;
    coachFrictionDelta = -8;
  } else if (topic === "tough_talk") {
    const fiery = isFieryCharacter(String(p.character || ""));
    if (fiery) {
      talkDeltaAdd = 4;
      coachFrictionDelta = 4;
      leaveBiasDelta = 2;
      return {
        talkDeltaAdd,
        coachFrictionDelta,
        leaveBiasDelta,
        outcomeType: "mixed",
        outcomeLabel: "Разговор получился непростым",
      };
    }
    talkDeltaAdd = 11;
    coachFrictionDelta = -8;
    leaveBiasDelta = -8;
  } else if (isSupportive) {
    talkDeltaAdd = 14;
    coachFrictionDelta = -22;
    leaveBiasDelta = -16;
  }

  if (isSupportive && talkDeltaAdd >= 14) {
    return {
      talkDeltaAdd,
      coachFrictionDelta,
      leaveBiasDelta,
      outcomeType: "great",
      outcomeLabel: "Беседа заметно подняла настрой",
    };
  }
  return {
    talkDeltaAdd,
    coachFrictionDelta,
    leaveBiasDelta,
    outcomeType: "positive",
    outcomeLabel: "Удалось найти общий язык",
  };
}

function buildFallbackTalkReply(
  p: any,
  mood: PlayerMoodSummary,
  topic: PlayerTalkTopic,
  message: string,
  outcomeType: "great" | "positive" | "mixed" | "tense",
  snap: TeamContextSnapshot
): string {
  const firstName = String(p.name || "Игрок").split(/\s+/)[0] || p.name;
  if (outcomeType === "tense") {
    if (mood.code === "wants_leave" || mood.code === "coach_conflict") {
      return `После таких слов только убеждаюсь, что дальше нам не по пути. Пусть агент и клуб решают вопрос с моим будущим, я своё сказал.`;
    }
    return `Жёсткий тон здесь ни к чему. Я работаю на поле, но после такого разговора осадок в раздевалке точно останется.`;
  }

  if (outcomeType === "mixed") {
    return `Понял позицию руководства, ${firstName} не из тех, кто прячется от ответственности. Докажу всё на тренировках, но и со стороны штаба жду честного отношения.`;
  }

  if (mood.code === "coach_conflict") {
    return `Хорошо, что поговорили напрямую. С ${snap.coachName} действительно накопилось недопонимание по паре игровых моментов, но ради команды готов перевернуть эту страницу и выкладываться на сто процентов.`;
  }
  if (mood.code === "wants_leave") {
    return `Честно — мысли об уходе были серьёзные, слишком многое давило в последнее время. Но я услышал вас, дам этому проекту ещё один полноценный шанс и сосредоточусь на ближайших матчах.`;
  }
  if (mood.code === "table_unhappy") {
    return `Больно видеть «${snap.teamName}» на ${snap.tablePos || "низком"} месте — мы способны на гораздо большее. Спасибо за откровенный разговор, надо всем вместе встряхнуться и набирать очки.`;
  }
  if (mood.code === "restless" || mood.code === "bad_mood") {
    return `Мне правда не хватало понимания, чего от меня ждут. Я готов терпеть и биться за место на поле, главное — чувствовать, что в меня действительно верят.`;
  }
  if (topic === "keep_in_club" || mood.code === "ecstatic" || mood.code === "happy") {
    return `У меня и мыслей нет никуда уходить — в «${snap.teamName}» мне комфортно, коллектив отличный. Спасибо за доверие, постараюсь отблагодарить результативной игрой!`;
  }
  return `Спасибо, что нашли время поговорить. Настрой боевой, готов помогать «${snap.teamName}» в каждом матче и выполнять задачи на сезон.`;
}

async function generatePlayerTalkReply(
  ctx: PlayerMoraleContext,
  p: any,
  moodBefore: PlayerMoodSummary,
  topic: PlayerTalkTopic,
  message: string,
  outcome: ReturnType<typeof evaluateConversationOutcome>,
  snap: TeamContextSnapshot
): Promise<string> {
  if (ctx.llm && ctx.hasLlmKeys?.() && ctx.runWithAiCtx) {
    try {
      const st = snap.statsByPid.get(p.id);
      const statsStr = st
        ? `Матчей в сезоне: ${st.games} (в старте ${st.starts}), минут: ${st.minutes}, голы+пас: ${st.goals}+${st.assists}.`
        : "В этом сезоне пока без официальных матчей.";
      const posStr = snap.tablePos
        ? `Клуб в таблице: ${snap.tablePos}-е место из ${snap.tableTotal} (${snap.points} очк., форма: ${snap.recentForm || "—"}).`
        : "Турнир только стартует.";
      const sys = `Ты — живой профессиональный футболист ${p.name} (${p.pos}, ${ctx.ageOfPlayer(p) || 24} лет, клуб «${snap.teamName}»).
Характер: ${p.character || "профессиональный, живой"}. Главный тренер: ${snap.coachName}.
Текущее настроение игрока до беседы: «${moodBefore.label}» (${moodBefore.summary}).
${statsStr}
${posStr}
К тебе обратился руководитель / тренерский представитель клуба по теме: «${TOPIC_LABELS[topic]}».
Ожидаемая реакция по тону беседы: ${outcome.outcomeLabel}.

Напиши живой, правдоподобный, естественный ответ футболиста от первого лица (2–3 предложения, до 340 символов).
НЕ упоминай слова «статусы», «уровень ожидания», «запасной/стартовый рейтинг», не используй канцелярит и кавычки вокруг всего ответа.`;

      const raw = await ctx.runWithAiCtx(() =>
        ctx.llm!(sys, `Слова представителя клуба: «${message}»`, {
          json: false,
          task: "player_morale_talk",
          temp: 0.9,
          max: 420,
        })
      );
      const cleaned = ctx.cleanTxt(String(raw || "").replace(/^["«]|["»]$/g, ""), 420);
      if (cleaned && cleaned.length >= 12) return cleaned;
    } catch {
      // fallback below
    }
  }
  return buildFallbackTalkReply(p, moodBefore, topic, message, outcome.outcomeType, snap);
}

export function registerPlayerMoraleRoutes(app: Express, ctx: PlayerMoraleContext) {
  app.get("/api/club/player-morale", ctx.needClub, (req: any, res) => {
    const db = ctx.getDb();
    const actor = resolveActor(req);
    const windowId = getTransferWindowId(ctx);
    const moods = buildClubMoraleMap(ctx, req.tid);
    const cooldown = getPlayerTalkCooldownSummary(db, actor.actorKey);
    res.json({
      ok: 1,
      windowId,
      requiredAdBlockId: PLAYER_TALK_REQUIRED_BLOCK_ID,
      cooldown,
      moods,
    });
  });

  app.get("/api/club/player-talk/status", ctx.needClub, (req: any, res) => {
    const db = ctx.getDb();
    const pid = String(req.query?.playerId || "").trim();
    const p = ctx.player(pid);
    if (!p || p.teamId !== req.tid) {
      return ctx.fail(res, "Игрок не найден в составе вашего клуба.", 404);
    }
    const actor = resolveActor(req);
    const windowId = getTransferWindowId(ctx);
    const talked = hasTalkedToPlayerInWindow(db, req.tid, pid, windowId);
    const cooldown = getPlayerTalkCooldownSummary(db, actor.actorKey);
    const mood = computePlayerMood(ctx, p);
    res.json({
      ok: 1,
      playerId: pid,
      windowId,
      canTalk: !talked && cooldown.cooldownRemainingMs <= 0,
      alreadyTalkedInWindow: Boolean(talked),
      talkRecord: talked,
      cooldown,
      requiredAdBlockId: PLAYER_TALK_REQUIRED_BLOCK_ID,
      mood,
    });
  });

  app.post("/api/club/player-talk", ctx.needClub, async (req: any, res) => {
    const db = ctx.getDb();
    ensureMoraleStores(db);
    const pid = String(req.body?.playerId || "").trim();
    const p = ctx.player(pid);
    if (!p || p.teamId !== req.tid) {
      return ctx.fail(res, "Игрок не найден в составе вашего клуба.", 404);
    }

    const windowId = getTransferWindowId(ctx);
    const existingTalk = hasTalkedToPlayerInWindow(db, req.tid, pid, windowId);
    if (existingTalk) {
      return ctx.fail(
        res,
        `Вы уже разговаривали с игроком ${p.name} в текущее трансферное окно. Повторная беседа будет доступна в следующем ТО.`
      );
    }

    const rawTopic = String(req.body?.topic || "custom").trim() as PlayerTalkTopic;
    const topic: PlayerTalkTopic = Object.prototype.hasOwnProperty.call(TOPIC_LABELS, rawTopic)
      ? rawTopic
      : "custom";
    const defaultMsgByTopic: Record<PlayerTalkTopic, string> = {
      playing_time: "Ценим твою работу на тренировках, обязательно получишь свой шанс на поле.",
      coach_conflict: "Давай снимем напряжение с главным тренером и сосредоточимся на общих целях.",
      keep_in_club: "Ты важен для проекта клуба, мы рассчитываем на тебя и хотим, чтобы ты остался.",
      table_ambitions: "Непростой отрезок в таблице, но мы верим в команду и вместе выправим ситуацию.",
      tough_talk: "От тебя ждём полной концентрации, дисциплины и максимальной самоотдачи.",
      custom: "Хочу лично обсудить твоё состояние и настрой на ближайшие матчи.",
    };
    const rawMsg = ctx.cleanTxt(req.body?.message || "", 360);
    const message = rawMsg.length >= 4 ? rawMsg : defaultMsgByTopic[topic];

    const actor = resolveActor(req);
    const adCheck = verifyAndConsumeAdProof(
      req.body?.adProof,
      "player_talk",
      actor.actorKey,
      true,
      req.me?.role,
      PLAYER_TALK_REQUIRED_BLOCK_ID
    );
    if (!adCheck.ok) {
      return ctx.fail(res, adCheck.error, 400);
    }
    recordPlayerTalkAdCooldown(db, actor.actorKey);

    const snap = buildTeamContextSnapshot(ctx, req.tid);
    const moodBefore = computePlayerMood(ctx, p, snap);
    const outcome = evaluateConversationOutcome(topic, message, moodBefore, p, snap);

    const rec = (db.playerMorale[pid] ||= {});
    const prevFriction = Number(
      rec.coachFrictionInitialized
        ? rec.coachFriction || 0
        : moodBefore.code === "coach_conflict"
          ? 60
          : moodBefore.code === "wants_leave"
            ? 50
            : 0
    );
    rec.coachFriction = clamp(prevFriction + outcome.coachFrictionDelta, 0, 100);
    rec.coachFrictionInitialized = true;
    rec.talkDelta = clamp(Number(rec.talkDelta || 0) + outcome.talkDeltaAdd, -35, 35);
    rec.leaveBias = clamp(Number(rec.leaveBias || 0) + outcome.leaveBiasDelta, -35, 45);
    rec.lastTalkAtMs = Date.now();
    if (outcome.coachFrictionDelta <= -20) {
      rec.lastTalkResolvedCoachAt = Date.now();
    }

    const reply = await generatePlayerTalkReply(ctx, p, moodBefore, topic, message, outcome, snap);

    if (outcome.outcomeType === "tense") {
      rec.customNote = "Напряжённый разговор с руководством — обстановка остаётся непростой.";
    } else if (moodBefore.code === "coach_conflict" && rec.coachFriction < 40) {
      rec.customNote = "После личной беседы конфликт с тренером пошёл на спад.";
    } else if (moodBefore.code === "wants_leave" && rec.leaveBias < 0) {
      rec.customNote = "После откровенного разговора согласился дать клубу шанс и остаться.";
    } else {
      rec.customNote = `После беседы: ${outcome.outcomeLabel.toLowerCase()}.`;
    }

    db.playerTalks[windowId] ||= {};
    const talkEntry = {
      id: "pt_" + Date.now() + "_" + stableHash(`${req.tid}:${pid}`),
      windowId,
      teamId: req.tid,
      playerId: pid,
      playerName: p.name,
      topic,
      topicLabel: TOPIC_LABELS[topic],
      message,
      reply,
      outcomeType: outcome.outcomeType,
      outcomeLabel: outcome.outcomeLabel,
      moodBeforeCode: moodBefore.code,
      moodBeforeLabel: moodBefore.shortLabel,
      moodAfterCode: "",
      moodAfterLabel: "",
      at: new Date().toISOString(),
    };
    db.playerTalks[windowId][`${req.tid}:${pid}`] = talkEntry;

    const moodAfter = computePlayerMood(ctx, p, snap);
    talkEntry.moodAfterCode = moodAfter.code;
    talkEntry.moodAfterLabel = moodAfter.shortLabel;

    ctx.save();
    const cooldownAfter = getPlayerTalkCooldownSummary(db, actor.actorKey);
    res.json({
      ok: 1,
      playerId: pid,
      playerName: p.name,
      windowId,
      reply,
      outcomeType: outcome.outcomeType,
      outcomeLabel: outcome.outcomeLabel,
      moodBefore,
      moodAfter,
      talkRecord: talkEntry,
      cooldown: cooldownAfter,
    });
  });
}
