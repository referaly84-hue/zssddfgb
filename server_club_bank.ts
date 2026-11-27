import crypto from "crypto";
import type { Express } from "express";

export type BankCardTheme = "vlf";
export type BankCurrency = "EUR" | "RUB" | "USD";

export interface ClubBankGoal {
  id: string;
  title: string;
  targetAmount: number;
  savedAmount: number;
  icon: string;
  category: string;
  createdAt: string;
}

export interface ClubBankState {
  cardTheme: BankCardTheme;
  hideBalance: boolean;
  currency: BankCurrency;
  spendingLimits: {
    transfers: number;
    logistics: number;
    bonuses: number;
  };
  goals: ClubBankGoal[];
  notes: Record<string, string>;
}

export interface ClubBankContext {
  getDb: () => any;
  save: () => void;
  team: (id: string) => any;
  tn: (id: string) => string;
  compName: (id: string) => string;
  needClub: any;
  fail: (res: any, msg: string, status?: number) => void;
  uid: () => string;
  getSponsorsSummary: (tid: string) => any;
  getAwaySummary: (tid: string) => any;
  getFinesSummary: (tid: string) => any;
  getBonusesSummary: (tid: string) => any;
}

const VALID_THEMES = new Set<BankCardTheme>(["vlf"]);
const VALID_CURRENCIES = new Set<BankCurrency>(["EUR", "RUB", "USD"]);

export function ensureClubBankStore(db: any, teamId: string): ClubBankState {
  if (!db.clubBank || typeof db.clubBank !== "object") db.clubBank = {};
  let st = db.clubBank[teamId];
  if (!st || typeof st !== "object") {
    st = {
      cardTheme: "vlf",
      hideBalance: false,
      currency: "EUR",
      spendingLimits: {
        transfers: 10_000_000,
        logistics: 500_000,
        bonuses: 1_500_000,
      },
      goals: [],
      notes: {},
    };
    db.clubBank[teamId] = st;
  }
  if (!VALID_THEMES.has(st.cardTheme)) st.cardTheme = "vlf";
  if (!VALID_CURRENCIES.has(st.currency)) st.currency = "EUR";
  st.hideBalance = !!st.hideBalance;
  if (!st.spendingLimits || typeof st.spendingLimits !== "object") {
    st.spendingLimits = { transfers: 10_000_000, logistics: 500_000, bonuses: 1_500_000 };
  }
  st.spendingLimits.transfers = Math.max(0, Number(st.spendingLimits.transfers || 0));
  st.spendingLimits.logistics = Math.max(0, Number(st.spendingLimits.logistics || 0));
  st.spendingLimits.bonuses = Math.max(0, Number(st.spendingLimits.bonuses || 0));
  if (!Array.isArray(st.goals)) st.goals = [];
  if (!st.notes || typeof st.notes !== "object") st.notes = {};
  return st as ClubBankState;
}

export type TxCategoryKey =
  | "transfers"
  | "sponsors"
  | "prizes"
  | "bonuses"
  | "logistics"
  | "fines"
  | "staff"
  | "other";

const CATEGORY_META: Record<TxCategoryKey, { label: string; color: string; shortLabel: string }> = {
  transfers: { label: "Трансферы и контракты", shortLabel: "Трансферы", color: "#2563eb" },
  sponsors: { label: "Спонсоры и РФС", shortLabel: "Спонсоры", color: "#eab308" },
  prizes: { label: "Призовые турниров", shortLabel: "Призовые", color: "#16a34a" },
  bonuses: { label: "Премиальные за матчи", shortLabel: "Премии", color: "#0d9488" },
  logistics: { label: "Выездная логистика", shortLabel: "Логистика", color: "#7c3aed" },
  fines: { label: "КДК и дисциплина", shortLabel: "КДК", color: "#dc2626" },
  staff: { label: "Тренеры и штаб", shortLabel: "Штаб", color: "#ea580c" },
  other: { label: "Казначейство и прочее", shortLabel: "Казна", color: "#64748b" },
};

export function classifyTxCategory(h: any): TxCategoryKey {
  const t = String(h?.type || "").toLowerCase();
  const lbl = String(h?.typeLabel || "").toLowerCase();
  const desc = String(h?.description || "").toLowerCase();
  if (
    t.includes("transfer") ||
    t.includes("foreign_") ||
    t.includes("contract_termination") ||
    t.includes("loan") ||
    lbl.includes("трансфер") ||
    lbl.includes("аренда") ||
    lbl.includes("контракт")
  ) {
    return "transfers";
  }
  if (t.includes("sponsor") || t.includes("rfs_") || lbl.includes("спонсор") || lbl.includes("рфс")) {
    return "sponsors";
  }
  if (t.includes("prize") || lbl.includes("приз")) {
    return "prizes";
  }
  if (t.includes("match_bonus") || lbl.includes("преми")) {
    return "bonuses";
  }
  if (t.includes("logistics") || lbl.includes("логистик") || lbl.includes("выезд")) {
    return "logistics";
  }
  if (t.includes("kdk") || t.includes("fine") || lbl.includes("кдк") || lbl.includes("штраф")) {
    return "fines";
  }
  if (t.includes("coach") || t.includes("staff") || lbl.includes("тренер") || lbl.includes("штаб") || desc.includes("тренер")) {
    return "staff";
  }
  return "other";
}

function buildAccountDetails(teamObj: any, compTitle: string) {
  const seed = crypto.createHash("sha256").update(String(teamObj?.id || "club")).digest("hex");
  const digits = seed.replace(/[a-f]/g, (ch) => String(ch.charCodeAt(0) % 10));
  const accTail = digits.slice(0, 8).padEnd(8, "0");
  const innTail = digits.slice(8, 16).padEnd(8, "0");
  const cardLast4 = digits.slice(16, 20).padEnd(4, "4");
  const budget = Number(teamObj?.budget || 0);
  const comp = String(teamObj?.comp || "").toLowerCase();
  const tariff =
    budget >= 25_000_000 || comp === "rpl"
      ? "Премиум Клуб PRO"
      : budget >= 5_000_000
        ? "Бизнес Лига"
        : "Старт Клуб";

  return {
    accountNumber: `40702 810 4 000${accTail.slice(0, 4)} ${accTail.slice(4, 8)}`,
    bik: "044525974",
    correspondentAccount: "30101 810 1 4525 0000974",
    inn: `77${innTail}`,
    kpp: "770401001",
    bankName: "АО «Банк VLF»",
    cardLast4,
    cardHolder: String(teamObj?.name || "ФУТБОЛЬНЫЙ КЛУБ").toUpperCase(),
    leagueName: compTitle || comp.toUpperCase() || "Лига",
    tariff,
  };
}

export function buildClubBankSummary(ctx: ClubBankContext, teamId: string) {
  const db = ctx.getDb();
  const t = ctx.team(teamId);
  if (!t) return null;

  const pref = ensureClubBankStore(db, teamId);
  const allEntries = (Array.isArray(db.budgetHistory) ? db.budgetHistory : [])
    .filter((h: any) => h && h.teamId === teamId);

  const balance = Math.round(Number(t.budget || 0));
  const bonusesSummary = ctx.getBonusesSummary(teamId);
  const awaySummary = ctx.getAwaySummary(teamId);
  const finesSummary = ctx.getFinesSummary(teamId);
  const sponsorsSummary = ctx.getSponsorsSummary(teamId);

  const committedBonuses = Math.max(0, Math.round(Number(bonusesSummary?.committedTotal || 0)));
  const freeBeforeGoals = balance - committedBonuses;

  // Cap total allocated across goals safely if balance dropped
  let rawGoalSum = pref.goals.reduce((s, g) => s + Math.max(0, Number(g.savedAmount || 0)), 0);
  const maxGoalCap = Math.max(0, freeBeforeGoals);
  const goals = pref.goals.map((g) => {
    const saved = Math.max(0, Math.round(Number(g.savedAmount || 0)));
    return { ...g, savedAmount: saved };
  });
  if (rawGoalSum > maxGoalCap && rawGoalSum > 0) {
    const ratio = maxGoalCap / rawGoalSum;
    rawGoalSum = 0;
    for (const g of goals) {
      g.savedAmount = Math.floor(g.savedAmount * ratio);
      rawGoalSum += g.savedAmount;
    }
  }
  const totalReservedGoals = rawGoalSum;
  const spendableAfterGoals = freeBeforeGoals - totalReservedGoals;

  let totalInflow = 0;
  let totalOutflow = 0;
  let inflowCount = 0;
  let outflowCount = 0;

  const catTotals: Record<TxCategoryKey, { key: TxCategoryKey; label: string; shortLabel: string; color: string; inflow: number; outflow: number; count: number }> = {
    transfers: { key: "transfers", ...CATEGORY_META.transfers, inflow: 0, outflow: 0, count: 0 },
    sponsors: { key: "sponsors", ...CATEGORY_META.sponsors, inflow: 0, outflow: 0, count: 0 },
    prizes: { key: "prizes", ...CATEGORY_META.prizes, inflow: 0, outflow: 0, count: 0 },
    bonuses: { key: "bonuses", ...CATEGORY_META.bonuses, inflow: 0, outflow: 0, count: 0 },
    logistics: { key: "logistics", ...CATEGORY_META.logistics, inflow: 0, outflow: 0, count: 0 },
    fines: { key: "fines", ...CATEGORY_META.fines, inflow: 0, outflow: 0, count: 0 },
    staff: { key: "staff", ...CATEGORY_META.staff, inflow: 0, outflow: 0, count: 0 },
    other: { key: "other", ...CATEGORY_META.other, inflow: 0, outflow: 0, count: 0 },
  };

  const dayMap = new Map<string, { day: string; inflow: number; outflow: number }>();

  const enrichedHistory = [...allEntries]
    .reverse()
    .slice(0, 250)
    .map((h: any, idx: number) => {
      const amt = Math.round(Number(h.amount || 0));
      const cat = classifyTxCategory(h);
      const txId = String(h.id || `tx_${idx}_${h.date || ""}`);
      return {
        ...h,
        id: txId,
        amount: amt,
        category: cat,
        categoryLabel: CATEGORY_META[cat].label,
        categoryShort: CATEGORY_META[cat].shortLabel,
        categoryColor: CATEGORY_META[cat].color,
        note: pref.notes[txId] || "",
      };
    });

  for (const h of allEntries) {
    const amt = Math.round(Number(h.amount || 0));
    const cat = classifyTxCategory(h);
    catTotals[cat].count += 1;
    if (amt > 0) {
      totalInflow += amt;
      inflowCount += 1;
      catTotals[cat].inflow += amt;
    } else if (amt < 0) {
      const absAmt = Math.abs(amt);
      totalOutflow += absAmt;
      outflowCount += 1;
      catTotals[cat].outflow += absAmt;
    }
    const dayKey = h.date ? String(h.date).slice(0, 10) : "unknown";
    if (dayKey !== "unknown") {
      const dRec = dayMap.get(dayKey) || { day: dayKey, inflow: 0, outflow: 0 };
      if (amt > 0) dRec.inflow += amt;
      else if (amt < 0) dRec.outflow += Math.abs(amt);
      dayMap.set(dayKey, dRec);
    }
  }

  const timeline = [...dayMap.values()]
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-14);

  // Build upcoming commitments from real club state
  const upcomingCommitments: Array<{
    id: string;
    kind: "expense" | "income" | "reserve";
    title: string;
    subtitle: string;
    amount: number;
    actionTab: string;
    actionLabel: string;
  }> = [];

  if (bonusesSummary?.byFixtureId) {
    for (const [fid, rec] of Object.entries(bonusesSummary.byFixtureId) as [string, any][]) {
      const maxP = Math.round(Number(rec?.maxPotentialPayout || 0));
      if (maxP > 0) {
        upcomingCommitments.push({
          id: `bonus_${fid}`,
          kind: "reserve",
          title: `Премиальные на матч`,
          subtitle: rec?.shortSummary || "Резерв выплаты игрокам при выполнении условий",
          amount: maxP,
          actionTab: "matches",
          actionLabel: "К матчу",
        });
      }
    }
  }

  const unplannedAway = Array.isArray(awaySummary?.fixtures)
    ? awaySummary.fixtures.filter((f: any) => !f.organized)
    : [];
  for (const fx of unplannedAway.slice(0, 3)) {
    const estCost = Math.round(Number(fx.minCostEur || fx.estimatedCostEur || 18000));
    upcomingCommitments.push({
      id: `away_${fx.fixtureId}`,
      kind: "expense",
      title: `Неоформленный выезд: ${fx.oppName || fx.destCity || "Матч"}`,
      subtitle: `${fx.destCity || "Выезд"} · ${fx.distKm ? Math.round(fx.distKm) + " км" : "Требуется логистика"}`,
      amount: estCost,
      actionTab: "logistics",
      actionLabel: "Оформить",
    });
  }

  const pendingForeign = (Array.isArray(db.foreignOffers) ? db.foreignOffers : []).filter(
    (o: any) => o.clubId === teamId && o.status === "pending"
  );
  for (const fo of pendingForeign.slice(0, 2)) {
    const fee = Math.round(Number(fo.feeEuros || (Number(fo.feeAmount || 0) * 1_000_000) || 0));
    if (fee > 0) {
      upcomingCommitments.push({
        id: `fo_${fo.id}`,
        kind: "income",
        title: `Оффер из-за рубежа: ${fo.playerName}`,
        subtitle: `${fo.buyerClub || "Клуб"} (${fo.buyerCountry || "Европа"})`,
        amount: fee,
        actionTab: "foreign",
        actionLabel: "Рассмотреть",
      });
    }
  }

  const pendingIncomingTr = (Array.isArray(db.transfers) ? db.transfers : []).filter(
    (x: any) => x.from === teamId && x.status === "pending" && Number(x.fee || 0) > 0
  );
  for (const tr of pendingIncomingTr.slice(0, 2)) {
    upcomingCommitments.push({
      id: `tr_in_${tr.id}`,
      kind: "income",
      title: `Входящая заявка на трансфер`,
      subtitle: `${tr.playerName || "Игрок"} → ${ctx.tn(tr.to) || "Клуб"}`,
      amount: Math.round(Number(tr.fee || 0) * 1_000_000),
      actionTab: "transfers",
      actionLabel: "В трансферы",
    });
  }

  // Available sponsor income in current 24h cycle
  const sponsorAvailEur = (sponsorsSummary?.sponsors || []).reduce((sum: number, s: any) => {
    const leftViews = Math.max(0, Number(s.maxViews || 0) - Number(s.views || 0));
    return sum + leftViews * Number(s.rewardEur || 0);
  }, 0);
  const rfsAvailEur = sponsorsSummary?.rfsUnlocked
    ? Math.max(0, (Number(sponsorsSummary.rfsMaxViews || 30) - Number(sponsorsSummary.rfsExtraViews || 0)) * Number(sponsorsSummary.rfsRewardPerAd || 1000))
    : (!sponsorsSummary?.rfsClaimed ? 10000 : 0);

  if (sponsorAvailEur + rfsAvailEur > 0) {
    upcomingCommitments.push({
      id: "sponsors_cycle",
      kind: "income",
      title: "Доступно у спонсоров и РФС",
      subtitle: sponsorsSummary?.rfsUnlocked
        ? "Бонус РФС разблокирован · активны спонсорские контракты"
        : `Доступно в текущем 24ч цикле (прогресс РФС: ${sponsorsSummary?.totalViews || 0}/${sponsorsSummary?.totalRequired || 20})`,
      amount: Math.round(sponsorAvailEur + rfsAvailEur),
      actionTab: "sponsors",
      actionLabel: "Получить",
    });
  }

  // Real Financial Health Score (0..100)
  const fairPlayScore = Math.max(0, Math.min(100, Number(finesSummary?.fairPlayScore ?? 100)));
  const liquidityRatio = balance <= 0 ? 0 : Math.min(1, Math.max(0, freeBeforeGoals / Math.max(1, balance)));
  const liquidityPts = balance < 0 ? 5 : balance < 250_000 ? 18 : Math.round(18 + liquidityRatio * 22); // up to 40
  const flowPts =
    totalOutflow === 0
      ? 22
      : totalInflow >= totalOutflow
        ? 25
        : Math.max(8, Math.round(25 * (totalInflow / totalOutflow))); // up to 25
  const kdkPts = Math.round((fairPlayScore / 100) * 20); // up to 20
  const logisticsPts = unplannedAway.length === 0 ? 15 : Math.max(4, 15 - unplannedAway.length * 4); // up to 15
  const healthScore = Math.max(5, Math.min(100, liquidityPts + flowPts + kdkPts + logisticsPts));

  const healthLabel =
    healthScore >= 85
      ? "Отличная устойчивость"
      : healthScore >= 65
        ? "Стабильный баланс"
        : healthScore >= 45
          ? "Требуется внимание"
          : "Риск кассового разрыва";

  return {
    balance,
    committedBonuses,
    totalReservedGoals,
    freeBeforeGoals,
    spendableAfterGoals,
    preferences: {
      cardTheme: pref.cardTheme,
      hideBalance: pref.hideBalance,
      currency: pref.currency,
      spendingLimits: pref.spendingLimits,
    },
    goals,
    accountDetails: buildAccountDetails(t, ctx.compName(t.comp)),
    stats: {
      totalInflow,
      totalOutflow,
      netFlow: totalInflow - totalOutflow,
      inflowCount,
      outflowCount,
      totalCount: allEntries.length,
      byCategory: Object.values(catTotals),
      timeline,
    },
    sponsorPotential: {
      sponsorAvailEur: Math.round(sponsorAvailEur),
      rfsAvailEur: Math.round(rfsAvailEur),
      earnedCycleEur: Math.round(Number(sponsorsSummary?.earnedEurCycle || 0)),
      rfsEarnedEur: Math.round(Number(sponsorsSummary?.rfsEarnedEur || 0)),
    },
    upcomingCommitments,
    health: {
      score: healthScore,
      label: healthLabel,
      factors: [
        { label: "Свободная ликвидность", score: liquidityPts, max: 40, detail: balance < 0 ? "Отрицательный баланс" : `${Math.round(liquidityRatio * 100)}% без обременений` },
        { label: "Денежный поток", score: flowPts, max: 25, detail: totalInflow >= totalOutflow ? "Профицит поступлений" : "Расходы превышают доходы" },
        { label: "Индекс КДК и Фэйр-плэй", score: kdkPts, max: 20, detail: `${fairPlayScore} / 100 по лиге` },
        { label: "Готовность к выездам", score: logisticsPts, max: 15, detail: unplannedAway.length ? `Не оформлено выездов: ${unplannedAway.length}` : "Все выезды закрыты" },
      ],
    },
    history: enrichedHistory,
  };
}

export function registerClubBankRoutes(app: Express, ctx: ClubBankContext) {
  app.post("/api/club/bank/preferences", ctx.needClub, (req: any, res: any) => {
    try {
      const db = ctx.getDb();
      const st = ensureClubBankStore(db, req.tid);
      const { cardTheme, hideBalance, currency, spendingLimits } = req.body || {};

      if (cardTheme !== undefined) {
        st.cardTheme = "vlf";
      }
      if (hideBalance !== undefined) {
        st.hideBalance = !!hideBalance;
      }
      if (currency !== undefined) {
        if (!VALID_CURRENCIES.has(currency)) return ctx.fail(res, "Неподдерживаемая валюта");
        st.currency = currency;
      }
      if (spendingLimits && typeof spendingLimits === "object") {
        if (spendingLimits.transfers !== undefined) {
          st.spendingLimits.transfers = Math.max(0, Math.round(Number(spendingLimits.transfers) || 0));
        }
        if (spendingLimits.logistics !== undefined) {
          st.spendingLimits.logistics = Math.max(0, Math.round(Number(spendingLimits.logistics) || 0));
        }
        if (spendingLimits.bonuses !== undefined) {
          st.spendingLimits.bonuses = Math.max(0, Math.round(Number(spendingLimits.bonuses) || 0));
        }
      }

      ctx.save();
      res.json({ ok: 1, preferences: { cardTheme: st.cardTheme, hideBalance: st.hideBalance, currency: st.currency, spendingLimits: st.spendingLimits } });
    } catch (err: any) {
      ctx.fail(res, err?.message || "Ошибка сохранения настроек банка");
    }
  });

  app.post("/api/club/bank/goals/create", ctx.needClub, (req: any, res: any) => {
    try {
      const db = ctx.getDb();
      const st = ensureClubBankStore(db, req.tid);
      if (st.goals.length >= 8) return ctx.fail(res, "Максимум 8 активных финансовых целей");

      const title = String(req.body?.title || "").trim().slice(0, 60);
      const targetAmount = Math.round(Number(req.body?.targetAmount || 0));
      const initialReserve = Math.max(0, Math.round(Number(req.body?.initialReserve || 0)));
      const icon = String(req.body?.icon || "🎯").slice(0, 4);
      const category = String(req.body?.category || "Трансферный фонд").slice(0, 40);

      if (!title || title.length < 2) return ctx.fail(res, "Укажите название цели (минимум 2 символа)");
      if (!Number.isFinite(targetAmount) || targetAmount < 10_000) {
        return ctx.fail(res, "Минимальная сумма цели — €10 000");
      }

      const summary = buildClubBankSummary(ctx, req.tid);
      const spendable = Math.max(0, Number(summary?.spendableAfterGoals || 0));
      const alloc = Math.min(initialReserve, spendable, targetAmount);

      const goal: ClubBankGoal = {
        id: "goal_" + ctx.uid(),
        title,
        targetAmount,
        savedAmount: alloc,
        icon,
        category,
        createdAt: new Date().toISOString(),
      };
      st.goals.push(goal);
      ctx.save();
      res.json({ ok: 1, goal, bank: buildClubBankSummary(ctx, req.tid) });
    } catch (err: any) {
      ctx.fail(res, err?.message || "Не удалось создать финансовую цель");
    }
  });

  app.post("/api/club/bank/goals/allocate", ctx.needClub, (req: any, res: any) => {
    try {
      const db = ctx.getDb();
      const st = ensureClubBankStore(db, req.tid);
      const goalId = String(req.body?.goalId || "");
      const mode = req.body?.mode === "withdraw" ? "withdraw" : "deposit";
      const amount = Math.round(Number(req.body?.amount || 0));

      const goal = st.goals.find((g) => g.id === goalId);
      if (!goal) return ctx.fail(res, "Финансовая цель не найдена", 404);
      if (!Number.isFinite(amount) || amount <= 0) return ctx.fail(res, "Укажите сумму больше 0");

      const summary = buildClubBankSummary(ctx, req.tid);
      const spendable = Math.max(0, Number(summary?.spendableAfterGoals || 0));

      if (mode === "deposit") {
        if (spendable <= 0) return ctx.fail(res, "Нет свободного остатка для резервирования в цель");
        const addAmt = Math.min(amount, spendable);
        goal.savedAmount = Math.round(Number(goal.savedAmount || 0) + addAmt);
      } else {
        const curSaved = Math.max(0, Math.round(Number(goal.savedAmount || 0)));
        const subAmt = Math.min(amount, curSaved);
        goal.savedAmount = curSaved - subAmt;
      }

      ctx.save();
      res.json({ ok: 1, goal, bank: buildClubBankSummary(ctx, req.tid) });
    } catch (err: any) {
      ctx.fail(res, err?.message || "Ошибка операции с копилкой");
    }
  });

  app.post("/api/club/bank/goals/delete", ctx.needClub, (req: any, res: any) => {
    try {
      const db = ctx.getDb();
      const st = ensureClubBankStore(db, req.tid);
      const goalId = String(req.body?.goalId || "");
      const idx = st.goals.findIndex((g) => g.id === goalId);
      if (idx === -1) return ctx.fail(res, "Цель не найдена", 404);
      st.goals.splice(idx, 1);
      ctx.save();
      res.json({ ok: 1, bank: buildClubBankSummary(ctx, req.tid) });
    } catch (err: any) {
      ctx.fail(res, err?.message || "Не удалось удалить цель");
    }
  });

  app.post("/api/club/bank/tx-note", ctx.needClub, (req: any, res: any) => {
    try {
      const db = ctx.getDb();
      const st = ensureClubBankStore(db, req.tid);
      const txId = String(req.body?.txId || "").trim();
      const note = String(req.body?.note || "").trim().slice(0, 140);
      if (!txId) return ctx.fail(res, "Не указан идентификатор операции");
      if (note) st.notes[txId] = note;
      else delete st.notes[txId];
      ctx.save();
      res.json({ ok: 1, txId, note });
    } catch (err: any) {
      ctx.fail(res, err?.message || "Не удалось сохранить комментарий");
    }
  });
}
