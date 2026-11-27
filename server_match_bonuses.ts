import type { Express, Response } from "express";

export type TeamBonusCondition =
  | "win"
  | "draw_or_win"
  | "win_2plus"
  | "clean_sheet_win"
  | "score_2plus";

export type PlayerBonusCondition =
  | "goal"
  | "goal_or_assist"
  | "assist"
  | "brace"
  | "clean_sheet"
  | "motm"
  | "high_rating"
  | "win_play";

export interface TeamBonusConfig {
  enabled: boolean;
  condition: TeamBonusCondition;
  amount: number;
  motivationNote?: string;
}

export interface PlayerBonusItem {
  id: string;
  playerId: string;
  playerName: string;
  pos: string;
  condition: PlayerBonusCondition;
  amount: number;
  note?: string;
}

export interface SettledPlayerBonusResult {
  id: string;
  playerId: string;
  playerName: string;
  pos: string;
  condition: PlayerBonusCondition;
  conditionLabel: string;
  amount: number;
  met: boolean;
  paid: number;
  reason: string;
}

export interface MatchBonusRecord {
  key: string;
  fixtureId: string;
  teamId: string;
  season: string;
  teamBonus: TeamBonusConfig;
  playerBonuses: PlayerBonusItem[];
  maxPotentialPayout: number;
  updatedAt: string;
  byAdmin?: boolean;
  settled?: boolean;
  settledAt?: string;
  fixtureScore?: string;
  teamBonusMet?: boolean;
  teamBonusPaid?: number;
  teamBonusReason?: string;
  playerResults?: SettledPlayerBonusResult[];
  totalPaid?: number;
}

export interface MatchBonusContext {
  getDb: () => any;
  save: () => void;
  S: () => string;
  team: (id: string) => any;
  tn: (id: string) => string;
  player: (id: string) => any;
  squadOf: (tid: string) => any[];
  loanPoolFor: (tid: string, f: any) => any[];
  fx: (id: string) => any;
  realAt: (f: any) => Date;
  isIntraSquad: (f: any) => boolean;
  compName: (id: string) => string;
  needClub: any;
  fail: (res: Response, msg: string, code?: number) => void;
  uid: () => string;
  tg: (text: string) => void;
}

export const MATCH_BONUS_LOCK_BEFORE_MS = 10 * 60 * 1000;

export function getMatchBonusLockInfo(ctx: MatchBonusContext, f: any, nowMs = Date.now()) {
  if (!f || f.status !== "scheduled") {
    const kMs = f && ctx.realAt ? ctx.realAt(f).getTime() : NaN;
    const kickoffAt = Number.isFinite(kMs) ? kMs : null;
    const lockAt = kickoffAt !== null ? kickoffAt - MATCH_BONUS_LOCK_BEFORE_MS : null;
    return { kickoffAt, lockAt, locked: true, reason: "status" as const, remainingMs: 0 };
  }
  const hasExplicitDate = /^\d{4}-\d{2}-\d{2}$/.test(String(f.realDate || "").trim());
  if (!hasExplicitDate || !ctx.realAt) {
    return { kickoffAt: null as number | null, lockAt: null as number | null, locked: false, reason: null, remainingMs: Infinity };
  }
  const kickoffMs = ctx.realAt(f).getTime();
  if (!Number.isFinite(kickoffMs)) {
    return { kickoffAt: null as number | null, lockAt: null as number | null, locked: false, reason: null, remainingMs: Infinity };
  }
  const lockAt = kickoffMs - MATCH_BONUS_LOCK_BEFORE_MS;
  const remainingMs = Math.max(0, lockAt - nowMs);
  const locked = nowMs >= lockAt;
  return {
    kickoffAt: kickoffMs,
    lockAt,
    locked,
    reason: locked ? ("time" as const) : null,
    remainingMs,
  };
}

export const TEAM_BONUS_CONDITIONS: Array<{
  id: TeamBonusCondition;
  label: string;
  shortLabel: string;
  promptRule: string;
  styleBias: "balanced" | "attack" | "defense";
}> = [
  {
    id: "win",
    label: "За победу в матче",
    shortLabel: "Победа",
    promptRule: "Команда бьётся за победу до финального свистка, высокий настрой и заряженность на три очка / проход.",
    styleBias: "balanced",
  },
  {
    id: "draw_or_win",
    label: "За не проигрыш (победа или ничья)",
    shortLabel: "Не проиграть",
    promptRule: "Максимальная игровая дисциплина, борьба за каждый мяч и очки — команда не отдаст матч без боя.",
    styleBias: "defense",
  },
  {
    id: "win_2plus",
    label: "За уверенную победу (разница 2+ мяча)",
    shortLabel: "Победа 2+",
    promptRule: "Команда не останавливается при минимальном перевесе 1:0, а агрессивно дожимает соперника ради разницы минимум в два мяча.",
    styleBias: "attack",
  },
  {
    id: "clean_sheet_win",
    label: "За «сухую» победу (0 пропущенных)",
    shortLabel: "Сухая победа",
    promptRule: "Предельная концентрация в обороне и у вратаря, при этом команда нацелена забить победный мяч и не пропустить ни одного.",
    styleBias: "defense",
  },
  {
    id: "score_2plus",
    label: "За 2+ забитых мяча командой",
    shortLabel: "2+ гола",
    promptRule: "Смелая игра в атаке, активные подключения и нацеленность на минимум два забитых гола.",
    styleBias: "attack",
  },
];

export const PLAYER_BONUS_CONDITIONS: Array<{
  id: PlayerBonusCondition;
  label: string;
  shortLabel: string;
  promptHint: string;
  styleBias: "attack" | "defense" | "balanced";
}> = [
  {
    id: "goal",
    label: "За забитый гол",
    shortLabel: "Гол",
    promptHint: "особенно голоден до гола, чаще открывается под удар и берёт инициативу в завершении",
    styleBias: "attack",
  },
  {
    id: "goal_or_assist",
    label: "За гол или голевую передачу",
    shortLabel: "Гол + пас",
    promptHint: "заряжен на результативное действие (гол или ассист), активно ищет обострение у чужой штрафной",
    styleBias: "attack",
  },
  {
    id: "assist",
    label: "За голевую передачу",
    shortLabel: "Ассист",
    promptHint: "целенаправленно ищет партнёров проникающими пасами, кроссами и острыми передачами",
    styleBias: "attack",
  },
  {
    id: "brace",
    label: "За дубль (2+ гола)",
    shortLabel: "Дубль",
    promptHint: "предельно нацелен на ворота и не сбавляет оборотов даже после первого гола",
    styleBias: "attack",
  },
  {
    id: "clean_sheet",
    label: "За «сухой» матч (≥45 мин, 0 пропущенных)",
    shortLabel: "На ноль",
    promptHint: "максимально собран в обороне/воротах, играет надёжно в отборах, перехватах и на ленточке",
    styleBias: "defense",
  },
  {
    id: "motm",
    label: "Лучший игрок матча (MOTM)",
    shortLabel: "Лучший игрок",
    promptHint: "ведёт игру команды, стремится забрать главную роль и стать лучшим на поле",
    styleBias: "balanced",
  },
  {
    id: "high_rating",
    label: "Оценка за матч ≥ 7.5",
    shortLabel: "Оценка ≥ 7.5",
    promptHint: "выкладывается в каждом единоборстве ради высокого качества действий и высокой оценки",
    styleBias: "balanced",
  },
  {
    id: "win_play",
    label: "За выход на поле в победном матче",
    shortLabel: "Вклад в победу",
    promptHint: "работает на команду с повышенной самоотдачей ради победы",
    styleBias: "balanced",
  },
];

function fmtEuro(n: number): string {
  const v = Math.round(Number(n || 0));
  return v < 0 ? "-€" + Math.abs(v).toLocaleString("ru-RU") : "€" + v.toLocaleString("ru-RU");
}

function ensureBonusesDb(db: any) {
  if (!db.matchBonuses || typeof db.matchBonuses !== "object" || Array.isArray(db.matchBonuses)) {
    db.matchBonuses = {};
  }
  if (!Array.isArray(db.budgetHistory)) db.budgetHistory = [];
  if (!Array.isArray(db.clubNotifications)) db.clubNotifications = [];
}

function leagueScaleRef(comp?: string): number {
  const c = String(comp || "rpl");
  if (c === "rpl" || c === "fnl" || c === "cup" || c === "supercup") return 250000;
  return 35000;
}

export function getBonusPresetsForTeam(comp?: string) {
  const c = String(comp || "rpl");
  if (c === "rpl" || c === "fnl" || c === "cup" || c === "supercup") {
    return {
      teamPresets: [50000, 150000, 300000, 500000, 1000000],
      playerPresets: [15000, 30000, 50000, 100000, 200000],
      minTeam: 5000,
      minPlayer: 1000,
    };
  }
  return {
    teamPresets: [10000, 25000, 50000, 100000, 150000],
    playerPresets: [3000, 7500, 15000, 30000, 50000],
    minTeam: 1000,
    minPlayer: 500,
  };
}

export function teamBonusConditionMeta(cond: string) {
  return TEAM_BONUS_CONDITIONS.find((c) => c.id === cond) || TEAM_BONUS_CONDITIONS[0];
}

export function playerBonusConditionMeta(cond: string) {
  return PLAYER_BONUS_CONDITIONS.find((c) => c.id === cond) || PLAYER_BONUS_CONDITIONS[0];
}

export function bonusKey(fixtureId: string, teamId: string): string {
  return `${fixtureId}:${teamId}`;
}

export function getMatchBonusRecord(ctx: MatchBonusContext, fixtureId: string, teamId: string): MatchBonusRecord | null {
  const db = ctx.getDb();
  ensureBonusesDb(db);
  const rec = db.matchBonuses[bonusKey(fixtureId, teamId)];
  return rec && typeof rec === "object" ? rec : null;
}

export function getCommittedBonusTotal(ctx: MatchBonusContext, teamId: string, excludeFixtureId?: string): number {
  const db = ctx.getDb();
  ensureBonusesDb(db);
  let sum = 0;
  for (const rec of Object.values(db.matchBonuses) as MatchBonusRecord[]) {
    if (!rec || rec.teamId !== teamId || rec.settled) continue;
    if (excludeFixtureId && rec.fixtureId === excludeFixtureId) continue;
    const f = ctx.fx(rec.fixtureId);
    if (!f || f.status !== "scheduled") continue;
    sum += Math.max(0, Number(rec.maxPotentialPayout || 0));
  }
  return sum;
}

export function computeRecordMaxPayout(teamBonus: TeamBonusConfig, playerBonuses: PlayerBonusItem[]): number {
  const tAmt = teamBonus?.enabled ? Math.max(0, Math.round(Number(teamBonus.amount || 0))) : 0;
  const pAmt = (playerBonuses || []).reduce((acc, it) => acc + Math.max(0, Math.round(Number(it.amount || 0))), 0);
  return tAmt + pAmt;
}

export function buildMatchBonusImpact(ctx: MatchBonusContext, f: any, tid: string, lineupObj?: any) {
  const empty = {
    hasBonus: false,
    teamBonus: null as TeamBonusConfig | null,
    playerBonuses: [] as Array<PlayerBonusItem & { status: "starter" | "bench" | "out"; conditionLabel: string; promptHint: string }>,
    playerBonusesByPid: {} as Record<string, Array<PlayerBonusItem & { conditionLabel: string }>>,
    motivationScore: 0,
    motivationLevel: "none" as "none" | "moderate" | "high" | "extreme",
    motivationLabel: "Стандартный настрой",
    powerMod: 0,
    attackMod: 0,
    defenseMod: 0,
    maxPotentialPayout: 0,
    promptSummary: "",
    shortSummary: "",
  };
  if (!f || !tid || ctx.isIntraSquad(f)) return empty;
  const rec = getMatchBonusRecord(ctx, f.id, tid);
  if (!rec) return empty;

  const teamObj = ctx.team(tid);
  const comp = String(teamObj?.comp || f.comp || "rpl");
  const ref = leagueScaleRef(comp);

  const startersSet = new Set<string>(Array.isArray(lineupObj?.starters) ? lineupObj.starters : []);
  const benchSet = new Set<string>(Array.isArray(lineupObj?.bench) ? lineupObj.bench : []);
  const hasLineupInfo = startersSet.size > 0 || benchSet.size > 0;

  const tb = rec.teamBonus?.enabled && Number(rec.teamBonus.amount || 0) > 0 ? rec.teamBonus : null;
  const rawPlayers = Array.isArray(rec.playerBonuses) ? rec.playerBonuses : [];

  const enrichedPlayers = rawPlayers
    .filter((pb) => pb && pb.playerId && Number(pb.amount || 0) > 0)
    .map((pb) => {
      const pObj = ctx.player(pb.playerId);
      const status: "starter" | "bench" | "out" = !hasLineupInfo
        ? "starter"
        : startersSet.has(pb.playerId)
          ? "starter"
          : benchSet.has(pb.playerId)
            ? "bench"
            : "out";
      const meta = playerBonusConditionMeta(pb.condition);
      return {
        ...pb,
        playerName: pObj?.name || pb.playerName || pb.playerId,
        pos: pObj?.pos || pb.pos || "",
        status,
        conditionLabel: meta.label,
        promptHint: meta.promptHint,
      };
    });

  if (!tb && enrichedPlayers.length === 0) return empty;

  let teamPowerMod = 0;
  let attackMod = 0;
  let defenseMod = 0;

  if (tb) {
    const ratio = tb.amount / ref;
    teamPowerMod = Math.min(1.05, 0.22 + Math.log1p(ratio) * 0.42);
    const meta = teamBonusConditionMeta(tb.condition);
    if (meta.styleBias === "attack") attackMod += Math.min(0.12, 0.04 + Math.log1p(ratio) * 0.035);
    else if (meta.styleBias === "defense") defenseMod += Math.min(0.12, 0.04 + Math.log1p(ratio) * 0.035);
    else {
      attackMod += 0.025;
      defenseMod += 0.025;
    }
  }

  let playersPowerMod = 0;
  const byPid: Record<string, Array<PlayerBonusItem & { conditionLabel: string }>> = {};
  for (const pb of enrichedPlayers) {
    if (!byPid[pb.playerId]) byPid[pb.playerId] = [];
    byPid[pb.playerId].push({ ...pb, conditionLabel: pb.conditionLabel });
    if (pb.status === "out") continue;
    const weight = pb.status === "starter" ? 1.0 : 0.45;
    const pRatio = pb.amount / (ref * 0.28);
    const pMod = Math.min(0.22, 0.06 + Math.log1p(pRatio) * 0.08) * weight;
    playersPowerMod += pMod;
    const meta = playerBonusConditionMeta(pb.condition);
    if (meta.styleBias === "attack") attackMod += 0.025 * weight;
    else if (meta.styleBias === "defense") defenseMod += 0.025 * weight;
  }
  playersPowerMod = Math.min(0.45, playersPowerMod);

  const powerMod = +Math.min(1.35, teamPowerMod + playersPowerMod).toFixed(2);
  const motivationScore = Math.min(100, Math.round((powerMod / 1.35) * 100));
  const motivationLevel: "none" | "moderate" | "high" | "extreme" =
    motivationScore >= 72 ? "extreme" : motivationScore >= 42 ? "high" : motivationScore > 0 ? "moderate" : "none";
  const motivationLabel =
    motivationLevel === "extreme"
      ? "Запредельная мотивация"
      : motivationLevel === "high"
        ? "Высокая мотивация"
        : motivationLevel === "moderate"
          ? "Повышенный настрой"
          : "Стандартный настрой";

  const teamName = ctx.tn(tid);
  const promptLines: string[] = [];
  if (tb) {
    const meta = teamBonusConditionMeta(tb.condition);
    const notePart = tb.motivationNote?.trim() ? ` Обращение руководства к команде: «${tb.motivationNote.trim()}».` : "";
    promptLines.push(
      `КОМАНДНЫЕ ПРЕМИАЛЬНЫЕ (${teamName}): обещана премия ${fmtEuro(tb.amount)} при условии «${meta.label}». ${meta.promptRule}${notePart}`
    );
  }
  const activePlayerBonuses = enrichedPlayers.filter((pb) => pb.status !== "out");
  if (activePlayerBonuses.length) {
    const listStr = activePlayerBonuses
      .map((pb) => {
        const stTag = hasLineupInfo ? (pb.status === "starter" ? "в старте" : "в запасе") : "";
        const noteTag = pb.note?.trim() ? ` (личное напутствие: «${pb.note.trim()}»)` : "";
        return `${pb.playerName}${pb.pos ? ` (${pb.pos})` : ""}${stTag ? ` [${stTag}]` : ""} — ${fmtEuro(pb.amount)} (${pb.conditionLabel}; ${pb.promptHint})${noteTag}`;
      })
      .join("; ");
    promptLines.push(`ИНДИВИДУАЛЬНЫЕ ПРЕМИИ ИГРОКАМ (${teamName}): ${listStr}.`);
  }

  const shortParts: string[] = [];
  if (tb) {
    shortParts.push(`Команде ${fmtEuro(tb.amount)} (${teamBonusConditionMeta(tb.condition).shortLabel})`);
  }
  if (enrichedPlayers.length) {
    const pSum = enrichedPlayers.reduce((a, b) => a + b.amount, 0);
    shortParts.push(`Игрокам: ${enrichedPlayers.length} (${fmtEuro(pSum)})`);
  }

  return {
    hasBonus: true,
    teamBonus: tb,
    playerBonuses: enrichedPlayers,
    playerBonusesByPid: byPid,
    motivationScore,
    motivationLevel,
    motivationLabel,
    powerMod,
    attackMod: +attackMod.toFixed(3),
    defenseMod: +defenseMod.toFixed(3),
    maxPotentialPayout: computeRecordMaxPayout(tb || { enabled: false, condition: "win", amount: 0 }, enrichedPlayers),
    promptSummary: promptLines.join(" "),
    shortSummary: shortParts.join(" + "),
  };
}

export function saveMatchBonusRecord(
  ctx: MatchBonusContext,
  fixtureId: string,
  teamId: string,
  payload: any,
  opts?: { byAdmin?: boolean }
): { ok: true; record: MatchBonusRecord | null; maxPotentialPayout: number } | { ok: false; error: string } {
  const db = ctx.getDb();
  ensureBonusesDb(db);
  const f = ctx.fx(fixtureId);
  if (!f || (f.home !== teamId && f.away !== teamId)) {
    return { ok: false, error: "Матч вашего клуба не найден" };
  }
  if (f.status !== "scheduled") {
    return { ok: false, error: "Матч уже начался или завершён — изменить премиальные нельзя" };
  }
  if (getMatchBonusLockInfo(ctx, f).locked) {
    return { ok: false, error: "До начала матча осталось менее 10 минут — изменить премиальные на матч уже нельзя" };
  }
  if (ctx.isIntraSquad(f)) {
    return { ok: false, error: "Для внутрикомандного спарринга премиальные не назначаются" };
  }
  const t = ctx.team(teamId);
  if (!t) return { ok: false, error: "Клуб не найден" };

  const key = bonusKey(fixtureId, teamId);
  const existing = db.matchBonuses[key];
  if (existing?.settled) {
    return { ok: false, error: "Премиальные по этому матчу уже рассчитаны" };
  }

  if (payload?.clear) {
    delete db.matchBonuses[key];
    ctx.save();
    return { ok: true, record: null, maxPotentialPayout: 0 };
  }

  const presets = getBonusPresetsForTeam(t.comp || f.comp);
  const rawTb = payload?.teamBonus || {};
  const tbEnabled = !!rawTb.enabled && Number(rawTb.amount || 0) > 0;
  const tbCondValid = TEAM_BONUS_CONDITIONS.some((c) => c.id === rawTb.condition)
    ? (rawTb.condition as TeamBonusCondition)
    : "win";
  const tbAmount = tbEnabled ? Math.round(Number(rawTb.amount || 0)) : 0;
  if (tbEnabled) {
    if (!Number.isFinite(tbAmount) || tbAmount < presets.minTeam) {
      return { ok: false, error: `Минимальная командная премия для вашей лиги: ${fmtEuro(presets.minTeam)}` };
    }
    if (tbAmount > 100000000) {
      return { ok: false, error: "Слишком большая сумма командной премии (максимум €100 000 000)" };
    }
  }
  const teamBonus: TeamBonusConfig = {
    enabled: tbEnabled,
    condition: tbCondValid,
    amount: tbAmount,
    motivationNote: String(rawTb.motivationNote || "").trim().slice(0, 400),
  };

  const validPlayerIds = new Set<string>([
    ...ctx.squadOf(teamId).map((p) => p.id),
    ...ctx.loanPoolFor(teamId, f).map((x) => x.p.id),
  ]);
  const rawPlayers = Array.isArray(payload?.playerBonuses) ? payload.playerBonuses : [];
  const playerBonuses: PlayerBonusItem[] = [];
  const seenPairs = new Set<string>();

  for (const item of rawPlayers) {
    if (!item || !item.playerId) continue;
    const pid = String(item.playerId);
    if (!validPlayerIds.has(pid)) continue;
    const cond: PlayerBonusCondition = PLAYER_BONUS_CONDITIONS.some((c) => c.id === item.condition)
      ? item.condition
      : "goal";
    const pairKey = `${pid}:${cond}`;
    if (seenPairs.has(pairKey)) continue;
    const amt = Math.round(Number(item.amount || 0));
    if (!Number.isFinite(amt) || amt <= 0) continue;
    if (amt < presets.minPlayer) {
      return { ok: false, error: `Минимальная индивидуальная премия для вашей лиги: ${fmtEuro(presets.minPlayer)}` };
    }
    if (amt > 50000000) {
      return { ok: false, error: "Слишком большая сумма индивидуальной премии (максимум €50 000 000)" };
    }
    const pObj = ctx.player(pid);
    seenPairs.add(pairKey);
    playerBonuses.push({
      id: String(item.id || "").trim() || ctx.uid(),
      playerId: pid,
      playerName: pObj?.name || String(item.playerName || pid),
      pos: pObj?.pos || String(item.pos || ""),
      condition: cond,
      amount: amt,
      note: String(item.note || "").trim().slice(0, 200),
    });
    if (playerBonuses.length >= 6) break;
  }

  if (!teamBonus.enabled && playerBonuses.length === 0) {
    delete db.matchBonuses[key];
    ctx.save();
    return { ok: true, record: null, maxPotentialPayout: 0 };
  }

  const maxPotentialPayout = computeRecordMaxPayout(teamBonus, playerBonuses);
  const currentBudget = Math.max(0, Number(t.budget || 0));
  const committedOther = getCommittedBonusTotal(ctx, teamId, fixtureId);
  const availableBudget = Math.max(0, currentBudget - committedOther);
  if (maxPotentialPayout > availableBudget) {
    const otherNote = committedOther > 0 ? ` (уже зарезервировано на другие ближайшие матчи: ${fmtEuro(committedOther)})` : "";
    return {
      ok: false,
      error: `Недостаточно средств в бюджете клуба: доступно ${fmtEuro(availableBudget)}${otherNote}, а сумма обещанных премиальных — ${fmtEuro(maxPotentialPayout)}.`,
    };
  }

  const record: MatchBonusRecord = {
    key,
    fixtureId,
    teamId,
    season: f.season || ctx.S(),
    teamBonus,
    playerBonuses,
    maxPotentialPayout,
    updatedAt: new Date().toISOString(),
    byAdmin: !!opts?.byAdmin,
    settled: false,
  };
  db.matchBonuses[key] = record;
  ctx.save();
  return { ok: true, record, maxPotentialPayout };
}

export function settleMatchBonuses(ctx: MatchBonusContext, f: any, m: any) {
  if (!f || ctx.isIntraSquad(f)) return;
  const db = ctx.getDb();
  ensureBonusesDb(db);

  const hg = Number(f.hg ?? 0);
  const ag = Number(f.ag ?? 0);
  const scoreStr = `${hg}:${ag}${f.pen ? ` (пен. ${f.pen.h}:${f.pen.a})` : ""}`;
  const ratingsArr: any[] = Array.isArray(m?.ratings) ? m.ratings : [];
  const ratingByPid = new Map<string, number>();
  for (const r of ratingsArr) {
    const pid = r?.playerId || r?.id;
    const val = Number(r?.rating);
    if (pid && Number.isFinite(val)) ratingByPid.set(pid, val);
  }
  const motmPid = m?.motm?.pid || f?.motm?.pid || null;

  for (const side of ["home", "away"] as const) {
    const tid = f[side];
    if (!tid) continue;
    const key = bonusKey(f.id, tid);
    const rec: MatchBonusRecord | undefined = db.matchBonuses[key];
    if (!rec || rec.settled) continue;

    const t = ctx.team(tid);
    if (!t) continue;
    const oppId = side === "home" ? f.away : f.home;
    const oppName = ctx.tn(oppId) || "Соперник";
    const matchLabel = `${ctx.tn(f.home)} ${scoreStr} ${ctx.tn(f.away)}`;

    const myGoals = side === "home" ? hg : ag;
    const oppGoals = side === "home" ? ag : hg;
    const wonInGame = myGoals > oppGoals;
    const wonByPen = myGoals === oppGoals && f.pen?.w === side;
    const wonMatch = wonInGame || wonByPen;
    const notLost = myGoals >= oppGoals || wonByPen;

    let teamBonusMet = false;
    let teamBonusPaid = 0;
    let teamBonusReason = "";

    if (rec.teamBonus?.enabled && rec.teamBonus.amount > 0) {
      const cond = rec.teamBonus.condition;
      if (cond === "win") {
        teamBonusMet = wonMatch;
        teamBonusReason = wonMatch ? `Победа над «${oppName}» (${scoreStr})` : `Условие победы не выполнено (${scoreStr})`;
      } else if (cond === "draw_or_win") {
        teamBonusMet = notLost;
        teamBonusReason = notLost ? `Команда не проиграла «${oppName}» (${scoreStr})` : `Команда уступила (${scoreStr})`;
      } else if (cond === "win_2plus") {
        teamBonusMet = myGoals - oppGoals >= 2;
        teamBonusReason = teamBonusMet ? `Уверенная победа с разницей 2+ (${scoreStr})` : `Разница меньше 2 мячей (${scoreStr})`;
      } else if (cond === "clean_sheet_win") {
        teamBonusMet = wonInGame && oppGoals === 0;
        teamBonusReason = teamBonusMet ? `«Сухая» победа над «${oppName}» (${scoreStr})` : `Условие сухой победы не выполнено (${scoreStr})`;
      } else if (cond === "score_2plus") {
        teamBonusMet = myGoals >= 2;
        teamBonusReason = teamBonusMet ? `Команда забила ${myGoals} мяч(а) (${scoreStr})` : `Забито меньше 2 мячей (${scoreStr})`;
      }
      if (teamBonusMet) {
        teamBonusPaid = Math.round(Number(rec.teamBonus.amount || 0));
      }
    }

    const playerResults: SettledPlayerBonusResult[] = [];
    const statsPlayers = f?.st?.players || {};
    for (const pb of rec.playerBonuses || []) {
      const ps = statsPlayers[pb.playerId];
      const playedMin = Number(ps?.min || 0);
      const participated = !!ps && (playedMin > 0 || !!ps.started);
      const goals = Number(ps?.g || 0);
      const assists = Number(ps?.a || 0);
      const rating = ratingByPid.get(pb.playerId) || 0;
      const condMeta = playerBonusConditionMeta(pb.condition);

      let met = false;
      let reason = "";
      if (!participated) {
        met = false;
        reason = "Не вышел на поле в этом матче";
      } else if (pb.condition === "goal") {
        met = goals >= 1;
        reason = met ? `Забил гол (${goals})` : "Не забил гол";
      } else if (pb.condition === "brace") {
        met = goals >= 2;
        reason = met ? `Оформил дубль / больше (${goals} гола)` : `Голов: ${goals} (нужно 2+)`;
      } else if (pb.condition === "assist") {
        met = assists >= 1;
        reason = met ? `Отдал голевую передачу (${assists})` : "Без голевых передач";
      } else if (pb.condition === "goal_or_assist") {
        met = goals + assists >= 1;
        reason = met ? `Гол+пас: ${goals}+${assists}` : "Без результативных действий";
      } else if (pb.condition === "clean_sheet") {
        met = playedMin >= 45 && oppGoals === 0;
        reason = met
          ? `Сыграл ${playedMin}' на ноль`
          : oppGoals > 0
            ? `Команда пропустила (${oppGoals})`
            : `Сыграл меньше 45 минут (${playedMin}')`;
      } else if (pb.condition === "motm") {
        met = motmPid === pb.playerId;
        reason = met ? "Признан лучшим игроком матча (MOTM)" : "Не стал лучшим игроком матча";
      } else if (pb.condition === "high_rating") {
        met = rating >= 7.5;
        reason = met ? `Оценка за матч: ${rating.toFixed(1)}` : `Оценка ${rating ? rating.toFixed(1) : "—"} (нужно ≥ 7.5)`;
      } else if (pb.condition === "win_play") {
        met = wonMatch;
        reason = met ? `Сыграл в победном матче (${scoreStr})` : `Матч не выигран (${scoreStr})`;
      }

      const paid = met ? Math.round(Number(pb.amount || 0)) : 0;
      playerResults.push({
        id: pb.id,
        playerId: pb.playerId,
        playerName: ctx.player(pb.playerId)?.name || pb.playerName,
        pos: ctx.player(pb.playerId)?.pos || pb.pos,
        condition: pb.condition,
        conditionLabel: condMeta.label,
        amount: Math.round(Number(pb.amount || 0)),
        met,
        paid,
        reason,
      });
    }

    const totalPlayersPaid = playerResults.reduce((acc, r) => acc + r.paid, 0);
    const totalPaid = teamBonusPaid + totalPlayersPaid;
    const nowIso = new Date().toISOString();

    rec.settled = true;
    rec.settledAt = nowIso;
    rec.fixtureScore = scoreStr;
    rec.teamBonusMet = teamBonusMet;
    rec.teamBonusPaid = teamBonusPaid;
    rec.teamBonusReason = teamBonusReason;
    rec.playerResults = playerResults;
    rec.totalPaid = totalPaid;

    if (totalPaid > 0) {
      let runningBudget = Number(t.budget || 0);
      if (teamBonusPaid > 0) {
        const prevB = runningBudget;
        runningBudget = prevB - teamBonusPaid;
        t.budget = runningBudget;
        db.budgetHistory.push({
          id: ctx.uid(),
          teamId: t.id,
          teamName: t.name,
          amount: -teamBonusPaid,
          prevBudget: prevB,
          newBudget: runningBudget,
          type: "match_bonus_team",
          typeLabel: "Премия команде за матч",
          description: `Командные премиальные за матч ${matchLabel} (${teamBonusConditionMeta(rec.teamBonus.condition).label}): −${fmtEuro(teamBonusPaid)}`,
          fixtureId: f.id,
          date: nowIso,
        });
      }
      for (const pr of playerResults) {
        if (pr.paid <= 0) continue;
        const prevB = runningBudget;
        runningBudget = prevB - pr.paid;
        t.budget = runningBudget;
        db.budgetHistory.push({
          id: ctx.uid(),
          teamId: t.id,
          teamName: t.name,
          amount: -pr.paid,
          prevBudget: prevB,
          newBudget: runningBudget,
          type: "match_bonus_player",
          typeLabel: "Личная премия игроку",
          description: `Премия игроку ${pr.playerName} за матч ${matchLabel} (${pr.conditionLabel} — ${pr.reason}): −${fmtEuro(pr.paid)}`,
          fixtureId: f.id,
          playerId: pr.playerId,
          playerName: pr.playerName,
          date: nowIso,
        });
      }

      const paidParts: string[] = [];
      if (teamBonusPaid > 0) paidParts.push(`команде ${fmtEuro(teamBonusPaid)} (${teamBonusConditionMeta(rec.teamBonus.condition).shortLabel})`);
      const paidPlayers = playerResults.filter((x) => x.paid > 0);
      if (paidPlayers.length) {
        paidParts.push(paidPlayers.map((x) => `${x.playerName}: ${fmtEuro(x.paid)} (${x.conditionLabel})`).join(", "));
      }

      db.clubNotifications.unshift({
        id: ctx.uid(),
        teamId: t.id,
        type: "match_bonus",
        subtype: "paid",
        title: `🏆 Выплачены премиальные за матч ${matchLabel}`,
        message: `Условия выполнены! Выплачено: ${paidParts.join("; ")}. Итого списано ${fmtEuro(totalPaid)}. Баланс клуба: ${fmtEuro(t.budget)}.`,
        amount: -totalPaid,
        formattedAmount: `-${fmtEuro(totalPaid)}`,
        prevBudget: Number(t.budget || 0) + totalPaid,
        newBudget: t.budget,
        formattedNewBudget: fmtEuro(t.budget),
        fixtureId: f.id,
        createdAt: Date.now(),
        date: nowIso,
        read: false,
      });

      if (db.clubNotifications.length > 500) db.clubNotifications.length = 500;
      ctx.tg(`💰 Премиальные «${t.name}» за матч ${matchLabel}: выплачено ${fmtEuro(totalPaid)} (${paidParts.join("; ")}).`);
    } else {
      db.clubNotifications.unshift({
        id: ctx.uid(),
        teamId: t.id,
        type: "match_bonus",
        subtype: "unmet",
        title: `ℹ️ Премиальные по матчу ${matchLabel} не сработали`,
        message: `Обещанные условия премирования не были выполнены — списание с бюджета не производилось. Баланс: ${fmtEuro(t.budget)}.`,
        amount: 0,
        fixtureId: f.id,
        createdAt: Date.now(),
        date: nowIso,
        read: false,
      });
      if (db.clubNotifications.length > 500) db.clubNotifications.length = 500;
    }
  }
}

export function getClubMatchBonusesSummary(ctx: MatchBonusContext, tid: string) {
  const db = ctx.getDb();
  ensureBonusesDb(db);
  const t = ctx.team(tid);
  const presets = getBonusPresetsForTeam(t?.comp);
  const byFixtureId: Record<string, any> = {};
  const recentSettled: any[] = [];
  let committedTotal = 0;

  for (const rec of Object.values(db.matchBonuses) as MatchBonusRecord[]) {
    if (!rec || rec.teamId !== tid) continue;
    const f = ctx.fx(rec.fixtureId);
    if (!rec.settled && f && f.status === "scheduled") {
      const impact = buildMatchBonusImpact(ctx, f, tid);
      const lockInfo = getMatchBonusLockInfo(ctx, f);
      byFixtureId[rec.fixtureId] = {
        ...rec,
        motivationScore: impact.motivationScore,
        motivationLevel: impact.motivationLevel,
        motivationLabel: impact.motivationLabel,
        shortSummary: impact.shortSummary,
        bonusLockAt: lockInfo.lockAt,
        bonusLocked: lockInfo.locked,
      };
      committedTotal += Math.max(0, Number(rec.maxPotentialPayout || 0));
    } else if (rec.settled) {
      const oppName = f ? ctx.tn(f.home === tid ? f.away : f.home) : "";
      recentSettled.push({
        ...rec,
        oppName,
        matchLabel: f ? `${ctx.tn(f.home)} ${rec.fixtureScore || `${f.hg ?? 0}:${f.ag ?? 0}`} ${ctx.tn(f.away)}` : "",
        compLabel: f ? ctx.compName(f.comp) : "",
      });
    }
  }

  recentSettled.sort((a, b) => String(b.settledAt || "").localeCompare(String(a.settledAt || "")));

  return {
    conditions: {
      team: TEAM_BONUS_CONDITIONS,
      player: PLAYER_BONUS_CONDITIONS,
    },
    presets,
    budget: Number(t?.budget || 0),
    committedTotal,
    byFixtureId,
    recentSettled: recentSettled.slice(0, 8),
  };
}

export function registerMatchBonusesRoutes(app: Express, ctx: MatchBonusContext) {
  app.get("/api/club/match-bonuses", ctx.needClub, (req: any, res: Response) => {
    res.json({
      ok: 1,
      ...getClubMatchBonusesSummary(ctx, req.tid),
    });
  });

  app.post("/api/club/match-bonuses", ctx.needClub, (req: any, res: Response) => {
    const fid = String(req.body?.fid || "").trim();
    if (!fid) return ctx.fail(res, "Не указан матч");
    const result = saveMatchBonusRecord(ctx, fid, req.tid, req.body, { byAdmin: req.me?.role === "admin" });
    if (!result.ok) return ctx.fail(res, (result as { ok: false; error: string }).error);
    const summary = getClubMatchBonusesSummary(ctx, req.tid);
    res.json({
      ok: 1,
      record: result.record,
      maxPotentialPayout: result.maxPotentialPayout,
      ...summary,
    });
  });
}
