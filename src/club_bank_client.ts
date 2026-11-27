/* Банковский модуль клуба VLF */

declare global {
  interface Window {
    __RPL_BANK__?: {
      renderClubBalanceTab: (
        cb: HTMLElement,
        clubData: any,
        onRefreshClub: () => void,
        onSwitchTab?: (tab: string) => void
      ) => Promise<void>;
    };
  }
}

type BankTheme = "vlf";
type BankCurrency = "EUR" | "RUB" | "USD";
type BankSubTab = "overview" | "analytics" | "goals" | "limits";

interface BankUiState {
  subTab: BankSubTab;
  search: string;
  direction: "all" | "in" | "out";
  category: string;
  chartMode: "outflow" | "inflow";
  period: "all" | "30d" | "7d";
  showDetails: boolean;
  localHideOverride: boolean | null;
  localCurrencyOverride: BankCurrency | null;
}

const UI_STATE: BankUiState = {
  subTab: "overview",
  search: "",
  direction: "all",
  category: "all",
  chartMode: "outflow",
  period: "all",
  showDetails: false,
  localHideOverride: null,
  localCurrencyOverride: null,
};

const CURRENCY_RATES: Record<BankCurrency, { rate: number; symbol: string; label: string }> = {
  EUR: { rate: 1, symbol: "€", label: "EUR (€)" },
  RUB: { rate: 105, symbol: "₽", label: "RUB (₽)" },
  USD: { rate: 1.08, symbol: "$", label: "USD ($)" },
};

const VLF_THEME = {
  name: "VLF",
  cardBg: "linear-gradient(135deg, #0b1813 0%, #113526 54%, #09130f 100%)",
  cardAccent: "#f0c419",
  cardText: "#ffffff",
  cardMuted: "rgba(226,242,233,0.72)",
  accentColor: "#1b5c3f",
  badgeBg: "#f0c419",
  badgeText: "#0b1813",
  bankLabel: "VLF Банк",
};

function ensureBankStyles() {
  if (typeof document === "undefined") return;
  let st = document.getElementById("rpl_bank_styles") as HTMLStyleElement | null;
  if (!st) {
    st = document.createElement("style");
    st.id = "rpl_bank_styles";
    document.head.appendChild(st);
  }
  st.textContent = `
    .cbk-wrap{display:flex;flex-direction:column;gap:16px;font-variant-numeric:tabular-nums}
    .cbk-topbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 16px}
    .cbk-topbar-left{display:flex;align-items:center;gap:12px;min-width:0}
    .cbk-club-mark{width:38px;height:38px;border-radius:10px;background:#f1f5f9;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;font:700 14px Unbounded,sans-serif;color:var(--deep)}
    .cbk-club-mark img{width:28px;height:28px;object-fit:contain}
    .cbk-title-main{font:700 15px Unbounded,sans-serif;color:var(--ink);line-height:1.2}
    .cbk-subtitle-line{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:2px}
    .cbk-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .cbk-seg{display:inline-flex;background:#f1f5f9;border:1px solid var(--line);border-radius:9px;padding:2px;gap:2px}
    .cbk-seg button{border:0;background:transparent;color:var(--muted);font-size:12px;font-weight:600;padding:5px 9px;border-radius:7px;cursor:pointer;white-space:nowrap;transition:all .15s}
    .cbk-seg button:hover{color:var(--ink)}
    .cbk-seg button.on{background:#fff;color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,0.08)}
    .cbk-icon-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:9px;border:1px solid var(--line);background:#fff;color:var(--ink);font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;min-height:34px;transition:background .15s,border-color .15s}
    .cbk-icon-btn:hover{background:#f8fafc;border-color:#94a3b8}

    .cbk-hero-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:16px;align-items:stretch}
    @media(max-width:900px){.cbk-hero-grid{grid-template-columns:minmax(0,1fr)}}

    .cbk-card-shell{display:flex;flex-direction:column;gap:12px;background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px}
    .cbk-plastic{position:relative;border-radius:16px;padding:20px 22px;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;min-height:206px;box-shadow:0 12px 28px -12px rgba(15,23,42,0.42)}
    .cbk-plastic::after{content:"";position:absolute;right:-40px;top:-40px;width:210px;height:210px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,0.14) 0%,rgba(255,255,255,0) 70%);pointer-events:none}
    .cbk-plastic-top{display:flex;align-items:center;justify-content:space-between;gap:12px;position:relative;z-index:1}
    .cbk-bank-brand{font:700 13px Unbounded,sans-serif;letter-spacing:.01em;display:flex;align-items:center;gap:8px}
    .cbk-tariff-txt{font-size:11.5px;font-weight:600;opacity:.82}
    .cbk-balance-block{margin:16px 0 14px;position:relative;z-index:1}
    .cbk-balance-caption{font-size:12px;opacity:.76;margin-bottom:4px;display:flex;align-items:center;gap:8px}
    .cbk-balance-amount{font:800 clamp(24px,3.1vw,34px)/1.12 Unbounded,sans-serif;letter-spacing:-0.02em;word-break:break-word}
    .cbk-balance-eq{font-size:12px;opacity:.76;margin-top:4px}
    .cbk-plastic-bot{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;position:relative;z-index:1;flex-wrap:wrap}
    .cbk-card-meta{display:flex;align-items:center;gap:10px;font-size:12px;letter-spacing:.04em}
    .cbk-chip{width:34px;height:24px;border-radius:5px;background:linear-gradient(135deg,#fde68a 0%,#d97706 100%);opacity:.92;position:relative;flex-shrink:0}
    .cbk-chip::before{content:"";position:absolute;inset:5px 7px;border:1px solid rgba(0,0,0,0.22);border-radius:2px}
    .cbk-card-btns{display:flex;gap:8px;flex-wrap:wrap}
    .cbk-card-action{border:1px solid rgba(255,255,255,0.26);background:rgba(255,255,255,0.12);color:#fff;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;backdrop-filter:blur(6px);white-space:nowrap;transition:background .15s}
    .cbk-card-action:hover{background:rgba(255,255,255,0.22)}

    .cbk-split-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    @media(max-width:560px){.cbk-split-strip{grid-template-columns:minmax(0,1fr)}}
    .cbk-split-item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px}
    .cbk-split-lbl{font-size:11.5px;color:var(--muted)}
    .cbk-split-val{font:700 14.5px Onest,sans-serif;color:var(--ink);margin-top:2px}

    .cbk-reqs{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    @media(max-width:560px){.cbk-reqs{grid-template-columns:minmax(0,1fr)}}
    .cbk-req-row{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px}
    .cbk-req-lbl{color:var(--muted);font-size:11px}
    .cbk-req-val{font-weight:700;color:var(--ink);font-family:ui-monospace,Consolas,monospace;font-size:12px}
    .cbk-copy-mini{border:1px solid var(--line);background:#fff;border-radius:6px;padding:3px 7px;font-size:11px;font-weight:600;cursor:pointer;color:var(--deep)}
    .cbk-copy-mini:hover{background:#eef7f0}

    .cbk-right-col{display:flex;flex-direction:column;gap:12px}
    .cbk-quick-panel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px;flex:1;display:flex;flex-direction:column;justify-content:space-between;gap:14px}
    .cbk-sec-title{font:700 14px Unbounded,sans-serif;color:var(--ink);margin:0}
    .cbk-quick-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    @media(max-width:480px){.cbk-quick-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    .cbk-qbtn{display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;gap:6px;padding:11px 12px;border-radius:12px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer;text-align:left;min-height:74px;transition:border-color .15s,background .15s,transform .12s}
    .cbk-qbtn:hover{border-color:var(--green);background:#f2f9f5;transform:translateY(-1px)}
    .cbk-qbtn-ico{width:28px;height:28px;border-radius:8px;background:#fff;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;font-size:15px}
    .cbk-qbtn-t{font-size:12.5px;font-weight:700;color:var(--ink);line-height:1.2}
    .cbk-qbtn-s{font-size:11px;color:var(--muted);line-height:1.2}

    .cbk-advice{border-radius:12px;padding:12px 14px;background:#f0fdf4;border:1px solid #bbf7d0;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .cbk-advice.warn{background:#fffbeb;border-color:#fde68a}
    .cbk-advice.danger{background:#fef2f2;border-color:#fecaca}

    .cbk-subtabs{display:flex;gap:6px;flex-wrap:wrap;background:#fff;border:1px solid var(--line);border-radius:12px;padding:6px}
    .cbk-subtabs button{border:0;background:transparent;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;white-space:nowrap;min-height:38px;transition:all .15s}
    .cbk-subtabs button:hover{color:var(--ink);background:#f8fafc}
    .cbk-subtabs button.on{background:var(--deep);color:#fff}

    .cbk-kpi-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    @media(max-width:780px){.cbk-kpi-3{grid-template-columns:minmax(0,1fr)}}
    .cbk-kpi-card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:6px}
    .cbk-kpi-head{display:flex;align-items:center;justify-content:space-between;font-size:12.5px;color:var(--muted);font-weight:600}
    .cbk-kpi-num{font:800 21px Unbounded,sans-serif;color:var(--ink);line-height:1.2}
    .cbk-kpi-sub{font-size:12px;color:var(--muted)}

    .cbk-mid-grid{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,0.92fr);gap:14px}
    @media(max-width:860px){.cbk-mid-grid{grid-template-columns:minmax(0,1fr)}}
    .cbk-box{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:14px}
    .cbk-box-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}

    .cbk-donut-wrap{display:flex;align-items:center;gap:18px;flex-wrap:wrap}
    .cbk-donut-svg-box{position:relative;width:168px;height:168px;flex-shrink:0;margin:0 auto}
    .cbk-donut-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;pointer-events:none;padding:16px}
    .cbk-donut-legend{flex:1;min-width:210px;display:flex;flex-direction:column;gap:7px}
    .cbk-cat-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;border-radius:8px;border:1px solid transparent;cursor:pointer;transition:background .15s,border-color .15s;background:transparent;width:100%;text-align:left}
    .cbk-cat-row:hover{background:#f8fafc}
    .cbk-cat-row.on{background:#f1f5f9;border-color:#cbd5e1}
    .cbk-cat-sw{width:10px;height:10px;border-radius:3px;flex-shrink:0}
    .cbk-cat-bar-track{height:4px;background:#e2e8f0;border-radius:99px;overflow:hidden;margin-top:3px}
    .cbk-cat-bar-fill{height:100%;border-radius:99px}

    .cbk-commit-list{display:flex;flex-direction:column;gap:8px}
    .cbk-commit-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:11px;border:1px solid #e2e8f0;background:#f8fafc}
    .cbk-commit-amt{font-weight:800;font-size:13.5px;white-space:nowrap}

    .cbk-feed-controls{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
    .cbk-search{flex:1;min-width:210px;height:38px;border-radius:10px;border:1px solid var(--line);padding:0 12px;font-size:13.5px;background:#fff}
    .cbk-filter-row{display:flex;gap:6px;flex-wrap:wrap}
    .cbk-fbtn{border:1px solid #e2e8f0;background:#f8fafc;color:var(--muted);padding:6px 11px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all .15s}
    .cbk-fbtn:hover{color:var(--ink);border-color:#cbd5e1}
    .cbk-fbtn.on{background:var(--deep);color:#fff;border-color:var(--deep)}

    .cbk-day-group{display:flex;flex-direction:column;gap:0}
    .cbk-day-hdr{font-size:12px;font-weight:700;color:var(--muted);padding:10px 4px 6px;border-bottom:1px solid #e2e8f0;margin-top:4px}
    .cbk-tx-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 8px;border-bottom:1px solid #f1f5f9;cursor:pointer;transition:background .12s;width:100%;text-align:left;background:transparent;border-left:0;border-right:0;border-top:0}
    .cbk-tx-row:hover{background:#f8fafc}
    .cbk-tx-ico{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;border:1px solid #e2e8f0;background:#fff}
    .cbk-tx-mid{flex:1;min-width:0}
    .cbk-tx-title{font-size:13.5px;font-weight:700;color:var(--ink);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .cbk-tx-desc{font-size:12px;color:var(--muted);margin-top:2px;line-height:1.35;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .cbk-tx-note{font-size:11.5px;color:#0f766e;margin-top:3px;font-weight:600}
    .cbk-tx-right{text-align:right;flex-shrink:0}
    .cbk-tx-amt{font-size:14.5px;font-weight:800;white-space:nowrap}
    .cbk-tx-after{font-size:11.5px;color:var(--muted);margin-top:2px;white-space:nowrap}

    .cbk-goals-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px}
    .cbk-goal-card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
    .cbk-goal-bar{height:8px;border-radius:99px;background:#e2e8f0;overflow:hidden}
    .cbk-goal-fill{height:100%;border-radius:99px;background:var(--green)}
    .cbk-goal-actions{display:flex;gap:6px;flex-wrap:wrap}

    .cbk-limit-row{display:flex;flex-direction:column;gap:6px;padding:12px;border-radius:12px;border:1px solid #e2e8f0;background:#f8fafc}
    .cbk-bar-chart{display:flex;align-items:flex-end;gap:8px;height:150px;padding:12px 6px 4px;border-bottom:1px solid var(--line);overflow-x:auto}
    .cbk-bar-col{flex:1;min-width:34px;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end}
    .cbk-bar-pair{display:flex;align-items:flex-end;gap:3px;height:110px;width:100%;justify-content:center}
    .cbk-bar-in{width:10px;background:#16a34a;border-radius:4px 4px 0 0;min-height:2px}
    .cbk-bar-out{width:10px;background:#dc2626;border-radius:4px 4px 0 0;min-height:2px}
    .cbk-bar-lbl{font-size:10px;color:var(--muted);white-space:nowrap}

    .cbk-receipt{display:flex;flex-direction:column;gap:12px}
    .cbk-receipt-hero{border-radius:12px;padding:16px;text-align:center;color:#fff}
    .cbk-receipt-grid{display:grid;grid-template-columns:1fr;gap:8px;border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:#f8fafc}
    .cbk-receipt-line{display:flex;justify-content:space-between;gap:12px;font-size:13px;border-bottom:1px dashed #cbd5e1;padding-bottom:6px}
    .cbk-receipt-line:last-child{border-bottom:0;padding-bottom:0}
  `;
}

function getTheme(_bank: any): BankTheme {
  return "vlf";
}

function getCurrency(bank: any): BankCurrency {
  const c = UI_STATE.localCurrencyOverride || bank?.preferences?.currency || "EUR";
  return CURRENCY_RATES[c as BankCurrency] ? (c as BankCurrency) : "EUR";
}

function isHidden(bank: any): boolean {
  if (UI_STATE.localHideOverride !== null) return UI_STATE.localHideOverride;
  return !!bank?.preferences?.hideBalance;
}

function fmtMoney(eurVal: number, currency: BankCurrency = "EUR", mask = false, withSign = false): string {
  if (mask) return "••••••";
  const cfg = CURRENCY_RATES[currency] || CURRENCY_RATES.EUR;
  const converted = Math.round(Number(eurVal || 0) * cfg.rate);
  const absStr = Math.abs(converted).toLocaleString("ru-RU");
  if (converted < 0) return `−${cfg.symbol}${absStr}`;
  if (withSign && converted > 0) return `+${cfg.symbol}${absStr}`;
  return `${cfg.symbol}${absStr}`;
}

function fmtCompact(eurVal: number, currency: BankCurrency = "EUR", mask = false): string {
  if (mask) return "••••";
  const cfg = CURRENCY_RATES[currency] || CURRENCY_RATES.EUR;
  const v = Number(eurVal || 0) * cfg.rate;
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}${cfg.symbol}${(abs / 1_000_000).toFixed(2).replace(/\.00$/, "")}M`;
  if (abs >= 10_000) return `${sign}${cfg.symbol}${Math.round(abs / 1000)}K`;
  return `${sign}${cfg.symbol}${Math.round(abs).toLocaleString("ru-RU")}`;
}

function catIcon(cat: string): string {
  switch (cat) {
    case "transfers":
      return "🔁";
    case "sponsors":
      return "🤝";
    case "prizes":
      return "🏆";
    case "bonuses":
      return "🎯";
    case "logistics":
      return "✈️";
    case "fines":
      return "⚖️";
    case "staff":
      return "👔";
    default:
      return "🏦";
  }
}

function dayGroupLabel(isoDate: string): string {
  if (!isoDate) return "Без даты";
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return "Прочие даты";
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const yest = new Date(now.getTime() - 86400_000).toISOString().slice(0, 10);
  const ds = d.toISOString().slice(0, 10);
  if (ds === todayStr) return "Сегодня";
  if (ds === yest) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function buildFallbackBank(c: any) {
  const history = Array.isArray(c?.budgetHistory) ? c.budgetHistory : [];
  const balance = Math.round(Number(c?.budget || 0));
  const committed = Math.max(0, Math.round(Number(c?.matchBonuses?.committedTotal || 0)));
  return {
    balance,
    committedBonuses: committed,
    totalReservedGoals: 0,
    freeBeforeGoals: balance - committed,
    spendableAfterGoals: balance - committed,
    preferences: { cardTheme: "vlf", hideBalance: false, currency: "EUR", spendingLimits: { transfers: 10_000_000, logistics: 500_000, bonuses: 1_500_000 } },
    goals: [],
    accountDetails: {
      accountNumber: "40702 810 4 0001 0042817",
      bik: "044525974",
      correspondentAccount: "30101 810 1 4525 0000974",
      inn: "7704123456",
      kpp: "770401001",
      bankName: "АО «Банк VLF»",
      cardLast4: "4821",
      cardHolder: String(c?.team?.name || "КЛУБ").toUpperCase(),
      leagueName: String(c?.team?.comp || "РПЛ").toUpperCase(),
      tariff: "Премиум Клуб",
    },
    stats: {
      totalInflow: history.filter((h: any) => Number(h.amount || 0) > 0).reduce((s: number, h: any) => s + Number(h.amount || 0), 0),
      totalOutflow: history.filter((h: any) => Number(h.amount || 0) < 0).reduce((s: number, h: any) => s + Math.abs(Number(h.amount || 0)), 0),
      netFlow: 0,
      inflowCount: history.filter((h: any) => Number(h.amount || 0) > 0).length,
      outflowCount: history.filter((h: any) => Number(h.amount || 0) < 0).length,
      totalCount: history.length,
      byCategory: [],
      timeline: [],
    },
    sponsorPotential: { sponsorAvailEur: 0, rfsAvailEur: 0, earnedCycleEur: 0, rfsEarnedEur: 0 },
    upcomingCommitments: [],
    health: { score: 80, label: "Стабильный баланс", factors: [] },
    history,
  };
}

function buildDonutSvg(items: Array<{ key: string; label: string; color: string; value: number }>, total: number, activeCat: string, mask: boolean, currency: BankCurrency) {
  const r = 64;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const nonZero = items.filter((x) => x.value > 0);
  if (!nonZero.length || total <= 0) {
    return `
      <div class="cbk-donut-svg-box">
        <svg viewBox="0 0 168 168" width="168" height="168" aria-label="Нет данных для диаграммы">
          <circle cx="84" cy="84" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="20" />
        </svg>
        <div class="cbk-donut-center">
          <div style="font-size:11px;color:var(--muted)">Нет операций</div>
          <div style="font:700 14px Unbounded,sans-serif;color:var(--ink)">${fmtCompact(0, currency, mask)}</div>
        </div>
      </div>
    `;
  }

  const slices = nonZero.map((it) => {
    const pct = it.value / total;
    const dash = Math.max(2, pct * c);
    const gap = Math.max(0, c - dash);
    const curOff = offset;
    offset += pct * c;
    const isSel = activeCat === it.key;
    const opacity = activeCat !== "all" && !isSel ? 0.35 : 1;
    return `<circle cx="84" cy="84" r="${r}" fill="none" stroke="${it.color}" stroke-width="${isSel ? 24 : 20}" stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}" stroke-dashoffset="${(-curOff).toFixed(2)}" transform="rotate(-90 84 84)" style="opacity:${opacity};transition:opacity .15s,stroke-width .15s;cursor:pointer" data-donut-cat="${it.key}" />`;
  });

  return `
    <div class="cbk-donut-svg-box">
      <svg viewBox="0 0 168 168" width="168" height="168" role="img" aria-label="Структура операций по категориям">
        <circle cx="84" cy="84" r="${r}" fill="none" stroke="#f1f5f9" stroke-width="20" />
        ${slices.join("")}
      </svg>
      <div class="cbk-donut-center">
        <div style="font-size:11px;color:var(--muted)">Итого</div>
        <div style="font:700 14px Unbounded,sans-serif;color:var(--ink)">${fmtCompact(total, currency, mask)}</div>
      </div>
    </div>
  `;
}

function downloadCsvStatement(teamNameStr: string, history: any[], currency: BankCurrency) {
  const escCsv = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const cfg = CURRENCY_RATES[currency];
  const header = ["Дата", "ID", "Категория", "Тип операции", `Сумма (${currency})`, `Баланс после (${currency})`, "Описание", "Комментарий"].map(escCsv).join(";");
  const rows = history.map((h: any) => {
    const dt = h.date ? new Date(h.date).toLocaleString("ru-RU") : "";
    const amt = Math.round(Number(h.amount || 0) * cfg.rate);
    const bal = Math.round(Number(h.newBudget || 0) * cfg.rate);
    return [dt, h.id || "", h.categoryLabel || h.category || "", h.typeLabel || h.type || "", amt, bal, h.description || "", h.note || ""].map(escCsv).join(";");
  });
  const csv = "\uFEFF" + [header, ...rows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `statement_${teamNameStr.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadReceiptHtml(tx: any, teamNameStr: string, bankName: string, accountNumber: string, currency: BankCurrency) {
  const app = window.__RPL_APP__;
  const e = app?.e || ((s: any) => String(s ?? ""));
  const dt = tx.date ? new Date(tx.date).toLocaleString("ru-RU") : "—";
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Квитанция ${e(tx.id)}</title>
  <style>body{font-family:system-ui,-apple-system,sans-serif;background:#f1f5f9;padding:32px;color:#0f172a}.card{max-width:520px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:14px;padding:24px}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #e2e8f0;font-size:14px}.amt{font-size:28px;font-weight:800;margin:12px 0}</style>
  </head><body><div class="card">
  <div style="font-weight:800;font-size:16px">${e(bankName)}</div>
  <div style="color:#64748b;font-size:12px;margin-top:2px">Официальная банковская квитанция · Исполнено</div>
  <div class="amt">${e(fmtMoney(tx.amount, currency, false, true))}</div>
  <div class="row"><span>Клуб-владелец счёта</span><b>${e(teamNameStr)}</b></div>
  <div class="row"><span>Расчётный счёт</span><b>${e(accountNumber)}</b></div>
  <div class="row"><span>Номер проводки</span><b>${e(tx.id)}</b></div>
  <div class="row"><span>Дата и время</span><b>${e(dt)}</b></div>
  <div class="row"><span>Категория</span><b>${e(tx.categoryLabel || tx.typeLabel || "Операция")}</b></div>
  <div class="row"><span>Тип</span><b>${e(tx.typeLabel || tx.type || "—")}</b></div>
  <div class="row"><span>Баланс до</span><b>${e(fmtMoney(tx.prevBudget ?? 0, currency, false))}</b></div>
  <div class="row"><span>Баланс после</span><b>${e(fmtMoney(tx.newBudget ?? 0, currency, false))}</b></div>
  <div style="margin-top:14px;font-size:13px;color:#334155"><b>Назначение платежа:</b><br>${e(tx.description || "—")}</div>
  ${tx.note ? `<div style="margin-top:10px;font-size:13px;color:#0f766e"><b>Комментарий клуба:</b> ${e(tx.note)}</div>` : ""}
  </div></body></html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `receipt_${String(tx.id || "op").slice(0, 14)}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function renderClubBalanceTab(
  cb: HTMLElement,
  clubData: any,
  onRefreshClub: () => void,
  onSwitchTab?: (tab: string) => void
) {
  ensureBankStyles();
  const app = window.__RPL_APP__ as any;
  const e = app?.e || ((s: any) => String(s ?? "").replace(/[&<>"']/g, (m: string) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m] || m)));
  const toast = app?.toast || (() => {});
  const api = (app?.api || (async () => { throw new Error("API не готов"); })) as (path: string, body?: any) => Promise<any>;
  const act = (app?.act || (async (fn: () => Promise<any>, ok?: any) => {
    try {
      const r = await fn();
      if (ok) toast(typeof ok === "function" ? ok(r) : ok);
      return r;
    } catch (err: any) {
      toast(err?.message || "Ошибка", true);
    }
  })) as (fn: () => Promise<any>, ok?: string | ((r: any) => string)) => Promise<any>;
  const modal = app?.modal;
  const teamId = clubData?.team?.id || app?.getClubTid?.() || "";
  const withT = (o: Record<string, any>) => (teamId ? { ...o, teamId } : o);

  const bank = clubData?.bank || buildFallbackBank(clubData);
  const theme = VLF_THEME;
  const currency = getCurrency(bank);
  const mask = isHidden(bank);
  const history: any[] = Array.isArray(bank.history) ? bank.history : [];
  const acc = bank.accountDetails || {};
  const stats = bank.stats || {};
  const health = bank.health || { score: 80, label: "Стабильно", factors: [] };
  const goals: any[] = Array.isArray(bank.goals) ? bank.goals : [];
  const limits = bank.preferences?.spendingLimits || { transfers: 10_000_000, logistics: 500_000, bonuses: 1_500_000 };

  const filterCutoffMs =
    UI_STATE.period === "7d"
      ? Date.now() - 7 * 86400_000
      : UI_STATE.period === "30d"
        ? Date.now() - 30 * 86400_000
        : 0;

  const periodHistory = filterCutoffMs
    ? history.filter((h) => {
        const ms = h.date ? new Date(h.date).getTime() : 0;
        return !ms || ms >= filterCutoffMs;
      })
    : history;

  // Build category totals for the active period + chartMode
  const catMap = new Map<string, { key: string; label: string; color: string; value: number; count: number }>();
  const defaultCats: Array<[string, string, string]> = [
    ["transfers", "Трансферы и контракты", "#2563eb"],
    ["sponsors", "Спонсоры и РФС", "#eab308"],
    ["prizes", "Призовые турниров", "#16a34a"],
    ["bonuses", "Премиальные за матчи", "#0d9488"],
    ["logistics", "Выездная логистика", "#7c3aed"],
    ["fines", "КДК и дисциплина", "#dc2626"],
    ["staff", "Тренеры и штаб", "#ea580c"],
    ["other", "Казначейство и прочее", "#64748b"],
  ];
  for (const [k, l, col] of defaultCats) {
    catMap.set(k, { key: k, label: l, color: col, value: 0, count: 0 });
  }
  for (const h of periodHistory) {
    const amt = Number(h.amount || 0);
    const k = h.category || "other";
    const entry = catMap.get(k) || { key: k, label: h.categoryLabel || "Прочее", color: "#64748b", value: 0, count: 0 };
    if (UI_STATE.chartMode === "outflow" && amt < 0) {
      entry.value += Math.abs(amt);
      entry.count += 1;
    } else if (UI_STATE.chartMode === "inflow" && amt > 0) {
      entry.value += amt;
      entry.count += 1;
    }
    catMap.set(k, entry);
  }
  const chartItems = [...catMap.values()].sort((a, b) => b.value - a.value);
  const chartTotal = chartItems.reduce((s, x) => s + x.value, 0);

  // Filtered transactions for Feed
  const searchLow = UI_STATE.search.trim().toLowerCase();
  const filteredTx = periodHistory.filter((h) => {
    const amt = Number(h.amount || 0);
    if (UI_STATE.direction === "in" && amt <= 0) return false;
    if (UI_STATE.direction === "out" && amt >= 0) return false;
    if (UI_STATE.category !== "all" && (h.category || "other") !== UI_STATE.category) return false;
    if (searchLow) {
      const hay = `${h.typeLabel || ""} ${h.description || ""} ${h.categoryLabel || ""} ${h.playerName || ""} ${h.note || ""}`.toLowerCase();
      if (!hay.includes(searchLow)) return false;
    }
    return true;
  });

  // Group filtered transactions by day
  const txGroups: Array<{ label: string; items: any[] }> = [];
  const txGroupMap = new Map<string, any[]>();
  for (const h of filteredTx) {
    const lbl = dayGroupLabel(h.date);
    if (!txGroupMap.has(lbl)) txGroupMap.set(lbl, []);
    txGroupMap.get(lbl)!.push(h);
  }
  for (const [label, items] of txGroupMap.entries()) txGroups.push({ label, items });

  const sponsorLeftTotal = (bank.sponsorPotential?.sponsorAvailEur || 0) + (bank.sponsorPotential?.rfsAvailEur || 0);
  const unplannedAwayCount = Number(clubData?.awayLogistics?.unplannedCount || 0);
  const isNeg = Number(bank.balance || 0) < 0;

  let adviceClass = "";
  let adviceTitle = "Спонсорский резерв готов";
  let adviceSub = sponsorLeftTotal > 0
    ? `В этом 24ч цикле доступно до ${fmtMoney(sponsorLeftTotal, currency, mask)} от партнёров и РФС.`
    : "Все доступные рекламные контракты в текущем цикле уже получены.";
  let adviceBtnTab = sponsorLeftTotal > 0 ? "sponsors" : "";
  let adviceBtnText = "К спонсорам";

  if (isNeg) {
    adviceClass = "danger";
    adviceTitle = "Отрицательный баланс счёта";
    adviceSub = "Рекомендуется срочно пополнить казну через спонсоров или рассмотреть входящие предложения по игрокам.";
    adviceBtnTab = "sponsors";
    adviceBtnText = "Пополнить";
  } else if (unplannedAwayCount > 0) {
    adviceClass = "warn";
    adviceTitle = `Неоформленные выезды (${unplannedAwayCount})`;
    adviceSub = "Спланируйте перелёт и отель заранее, чтобы избежать лишних трат перед матчем.";
    adviceBtnTab = "logistics";
    adviceBtnText = "Оформить выезд";
  }

  // Category spend vs limits
  const catSpendMap: Record<string, number> = {};
  for (const catObj of stats.byCategory || []) {
    catSpendMap[catObj.key] = Number(catObj.outflow || 0);
  }

  const teamInitials = String(clubData?.team?.name || "КЛ").slice(0, 2).toUpperCase();
  const teamLogoUrl = clubData?.team?.logo || app?.teamLogo?.(teamId) || "";

  // Render main HTML
  cb.innerHTML = `
    <div class="cbk-wrap">
      <!-- TOP BAR -->
      <div class="cbk-topbar">
        <div class="cbk-topbar-left">
          <div class="cbk-club-mark">
            ${teamLogoUrl ? `<img src="${e(teamLogoUrl)}" alt="" onerror="this.style.display='none'">` : e(teamInitials)}
          </div>
          <div>
            <div class="cbk-title-main">${e(theme.bankLabel)} · ${e(clubData?.team?.name || "Клуб")}</div>
            <div class="cbk-subtitle-line">
              <span>Р/С ${e(acc.accountNumber || "40702 810 ...")}</span>
              <span>·</span>
              <span>${e(acc.tariff || "Премиум Клуб")}</span>
              <span>·</span>
              <span>Индекс здоровья: <b>${health.score}/100</b></span>
            </div>
          </div>
        </div>
        <div class="cbk-controls">
          <div class="cbk-seg" role="group" aria-label="Валюта">
            ${(["EUR", "RUB", "USD"] as BankCurrency[])
              .map((cur) => `<button type="button" data-bank-cur="${cur}" class="${currency === cur ? "on" : ""}">${CURRENCY_RATES[cur].symbol}</button>`)
              .join("")}
          </div>
          <button type="button" class="cbk-icon-btn" id="cbk_toggle_hide">${mask ? "👁 Показать" : "🙈 Скрыть"}</button>
          <button type="button" class="cbk-icon-btn" id="cbk_export_csv">⬇ Выписка CSV</button>
        </div>
      </div>

      <!-- HERO 2-COL -->
      <div class="cbk-hero-grid">
        <div class="cbk-card-shell">
          <div class="cbk-plastic" style="background:${theme.cardBg};color:${theme.cardText}">
            <div class="cbk-plastic-top">
              <div class="cbk-bank-brand">
                <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${theme.cardAccent}"></span>
                <span>${e(theme.bankLabel)}</span>
              </div>
              <span class="cbk-tariff-txt">${e(acc.leagueName || "ЛИГА")} · ${e(acc.tariff || "PRO")}</span>
            </div>

            <div class="cbk-balance-block">
              <div class="cbk-balance-caption">
                <span>Расчётный счёт клуба</span>
                ${isNeg ? `<span style="background:#ef4444;color:#fff;padding:1px 7px;border-radius:6px;font-size:11px;font-weight:700">Овердрафт</span>` : ""}
              </div>
              <div class="cbk-balance-amount">${e(fmtMoney(bank.balance, currency, mask))}</div>
              <div class="cbk-balance-eq">
                ${mask ? "Баланс скрыт" : currency === "EUR"
                  ? `≈ ${e(fmtMoney(bank.balance, "RUB", false))} · ${e(fmtMoney(bank.balance, "USD", false))}`
                  : `Базовая валюта клуба: ${e(fmtMoney(bank.balance, "EUR", false))}`}
              </div>
            </div>

            <div class="cbk-plastic-bot">
              <div class="cbk-card-meta">
                <div class="cbk-chip" aria-hidden="true"></div>
                <div>
                  <div style="font-family:ui-monospace,Consolas,monospace;font-weight:700">•••• ${e(acc.cardLast4 || "4821")}</div>
                  <div style="font-size:10.5px;color:${theme.cardMuted}">${e(acc.cardHolder || "CLUB ACCOUNT")}</div>
                </div>
              </div>
              <div class="cbk-card-btns">
                <button type="button" class="cbk-card-action" id="cbk_btn_reqs">${UI_STATE.showDetails ? "Скрыть реквизиты" : "Реквизиты"}</button>
                <button type="button" class="cbk-card-action" style="background:${theme.badgeBg};color:${theme.badgeText};border-color:transparent" id="cbk_btn_topup">+ Пополнить</button>
              </div>
            </div>
          </div>

          <div class="cbk-split-strip">
            <div class="cbk-split-item">
              <div class="cbk-split-lbl">Свободно к тратам</div>
              <div class="cbk-split-val" style="color:${bank.spendableAfterGoals < 0 ? "#b91c1c" : "#15803d"}">${e(fmtMoney(bank.spendableAfterGoals, currency, mask))}</div>
            </div>
            <div class="cbk-split-item">
              <div class="cbk-split-lbl">Резерв на премии</div>
              <div class="cbk-split-val">${e(fmtMoney(bank.committedBonuses, currency, mask))}</div>
            </div>
            <div class="cbk-split-item">
              <div class="cbk-split-lbl">Отложено в копилки</div>
              <div class="cbk-split-val">${e(fmtMoney(bank.totalReservedGoals, currency, mask))}</div>
            </div>
          </div>

          ${UI_STATE.showDetails ? `
            <div class="cbk-reqs">
              <div class="cbk-req-row">
                <div><div class="cbk-req-lbl">Расчётный счёт</div><div class="cbk-req-val">${e(acc.accountNumber)}</div></div>
                <button type="button" class="cbk-copy-mini" data-copy-txt="${e(acc.accountNumber)}">Копия</button>
              </div>
              <div class="cbk-req-row">
                <div><div class="cbk-req-lbl">БИК банка</div><div class="cbk-req-val">${e(acc.bik)}</div></div>
                <button type="button" class="cbk-copy-mini" data-copy-txt="${e(acc.bik)}">Копия</button>
              </div>
              <div class="cbk-req-row">
                <div><div class="cbk-req-lbl">ИНН / КПП</div><div class="cbk-req-val">${e(acc.inn)} / ${e(acc.kpp)}</div></div>
                <button type="button" class="cbk-copy-mini" data-copy-txt="${e(acc.inn)}">Копия</button>
              </div>
              <div class="cbk-req-row">
                <div><div class="cbk-req-lbl">Корр. счёт</div><div class="cbk-req-val">${e(acc.correspondentAccount)}</div></div>
                <button type="button" class="cbk-copy-mini" data-copy-txt="${e(acc.correspondentAccount)}">Копия</button>
              </div>
            </div>
          ` : ""}
        </div>

        <div class="cbk-right-col">
          <div class="cbk-quick-panel">
            <div class="cbk-box-head">
              <h3 class="cbk-sec-title">Быстрые действия</h3>
              <span class="small muted">В 1 клик</span>
            </div>
            <div class="cbk-quick-grid">
              <button type="button" class="cbk-qbtn" data-quick-tab="sponsors">
                <div class="cbk-qbtn-ico">🤝</div>
                <div>
                  <div class="cbk-qbtn-t">Спонсоры</div>
                  <div class="cbk-qbtn-s">${sponsorLeftTotal > 0 ? `+${fmtCompact(sponsorLeftTotal, currency, mask)}` : "Контракты РФС"}</div>
                </div>
              </button>
              <button type="button" class="cbk-qbtn" id="cbk_quick_goal">
                <div class="cbk-qbtn-ico">🐷</div>
                <div>
                  <div class="cbk-qbtn-t">Новая цель</div>
                  <div class="cbk-qbtn-s">${goals.length ? `Целей: ${goals.length}` : "Создать копилку"}</div>
                </div>
              </button>
              <button type="button" class="cbk-qbtn" data-quick-tab="logistics">
                <div class="cbk-qbtn-ico">✈️</div>
                <div>
                  <div class="cbk-qbtn-t">Выезды</div>
                  <div class="cbk-qbtn-s">${unplannedAwayCount > 0 ? `Ждут: ${unplannedAwayCount}` : "Все оформлены"}</div>
                </div>
              </button>
              <button type="button" class="cbk-qbtn" data-quick-tab="matches">
                <div class="cbk-qbtn-ico">🎯</div>
                <div>
                  <div class="cbk-qbtn-t">Премиальные</div>
                  <div class="cbk-qbtn-s">${bank.committedBonuses > 0 ? fmtCompact(bank.committedBonuses, currency, mask) : "Мотивация"}</div>
                </div>
              </button>
              <button type="button" class="cbk-qbtn" data-quick-tab="fines">
                <div class="cbk-qbtn-ico">⚖️</div>
                <div>
                  <div class="cbk-qbtn-t">Штрафы КДК</div>
                  <div class="cbk-qbtn-s">${(clubData?.finesSummary?.finesCount || 0) > 0 ? `Штрафов: ${clubData.finesSummary.finesCount}` : "Нарушений нет"}</div>
                </div>
              </button>
              <button type="button" class="cbk-qbtn" id="cbk_quick_calc">
                <div class="cbk-qbtn-ico">💱</div>
                <div>
                  <div class="cbk-qbtn-t">Конвертер</div>
                  <div class="cbk-qbtn-s">€ / ₽ / $ курс</div>
                </div>
              </button>
            </div>

            <div class="cbk-advice ${adviceClass}">
              <div style="flex:1;min-width:180px">
                <div style="font-size:13px;font-weight:700;color:var(--ink)">${e(adviceTitle)}</div>
                <div style="font-size:12px;color:var(--muted);margin-top:2px;line-height:1.35">${e(adviceSub)}</div>
              </div>
              ${adviceBtnTab ? `<button type="button" class="btn sm" data-quick-tab="${adviceBtnTab}">${e(adviceBtnText)}</button>` : ""}
            </div>
          </div>
        </div>
      </div>

      <!-- SUB-NAV -->
      <div class="cbk-subtabs" role="tablist">
        <button type="button" data-subtab="overview" class="${UI_STATE.subTab === "overview" ? "on" : ""}">Обзор и операции</button>
        <button type="button" data-subtab="analytics" class="${UI_STATE.subTab === "analytics" ? "on" : ""}">Аналитика потока</button>
        <button type="button" data-subtab="goals" class="${UI_STATE.subTab === "goals" ? "on" : ""}">Копилки и цели (${goals.length})</button>
        <button type="button" data-subtab="limits" class="${UI_STATE.subTab === "limits" ? "on" : ""}">Лимиты и здоровье</button>
      </div>

      <!-- SUBTAB CONTENT -->
      ${UI_STATE.subTab === "overview" ? renderOverviewHtml() : ""}
      ${UI_STATE.subTab === "analytics" ? renderAnalyticsHtml() : ""}
      ${UI_STATE.subTab === "goals" ? renderGoalsHtml() : ""}
      ${UI_STATE.subTab === "limits" ? renderLimitsHtml() : ""}
    </div>
  `;

  function renderOverviewHtml() {
    const netPos = Number(stats.netFlow || 0) >= 0;
    const topExpenseCat = [...(stats.byCategory || [])].sort((a: any, b: any) => (b.outflow || 0) - (a.outflow || 0))[0];
    return `
      <div class="cbk-kpi-3">
        <div class="cbk-kpi-card">
          <div class="cbk-kpi-head"><span>Поступления за сезон</span><span>${stats.inflowCount || 0} оп.</span></div>
          <div class="cbk-kpi-num" style="color:#15803d">${e(fmtMoney(stats.totalInflow || 0, currency, mask, true))}</div>
          <div class="cbk-kpi-sub">Спонсоры, трансферы, призовые и возвраты</div>
        </div>
        <div class="cbk-kpi-card">
          <div class="cbk-kpi-head"><span>Расходы за сезон</span><span>${stats.outflowCount || 0} оп.</span></div>
          <div class="cbk-kpi-num" style="color:#b91c1c">${e(fmtMoney(-(stats.totalOutflow || 0), currency, mask))}</div>
          <div class="cbk-kpi-sub">${topExpenseCat && topExpenseCat.outflow > 0 ? `Главная статья: ${e(topExpenseCat.shortLabel)}` : "Крупных списаний ещё нет"}</div>
        </div>
        <div class="cbk-kpi-card">
          <div class="cbk-kpi-head"><span>Чистый денежный поток</span><span>${health.score}/100</span></div>
          <div class="cbk-kpi-num" style="color:${netPos ? "#15803d" : "#b91c1c"}">${e(fmtMoney(stats.netFlow || 0, currency, mask, true))}</div>
          <div class="cbk-kpi-sub">${e(health.label)}</div>
        </div>
      </div>

      <div class="cbk-mid-grid">
        <div class="cbk-box">
          <div class="cbk-box-head">
            <h3 class="cbk-sec-title">Аналитика по категориям</h3>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <div class="cbk-seg">
                <button type="button" data-chart-mode="outflow" class="${UI_STATE.chartMode === "outflow" ? "on" : ""}">Расходы</button>
                <button type="button" data-chart-mode="inflow" class="${UI_STATE.chartMode === "inflow" ? "on" : ""}">Доходы</button>
              </div>
              <div class="cbk-seg">
                <button type="button" data-period="all" class="${UI_STATE.period === "all" ? "on" : ""}">Сезон</button>
                <button type="button" data-period="30d" class="${UI_STATE.period === "30d" ? "on" : ""}">30 дн</button>
                <button type="button" data-period="7d" class="${UI_STATE.period === "7d" ? "on" : ""}">7 дн</button>
              </div>
            </div>
          </div>

          <div class="cbk-donut-wrap">
            ${buildDonutSvg(chartItems, chartTotal, UI_STATE.category, mask, currency)}
            <div class="cbk-donut-legend">
              ${chartItems.filter((x) => x.value > 0).length
                ? chartItems
                    .filter((x) => x.value > 0)
                    .map((it) => {
                      const pct = chartTotal > 0 ? Math.round((it.value / chartTotal) * 100) : 0;
                      const isSel = UI_STATE.category === it.key;
                      return `
                        <button type="button" class="cbk-cat-row ${isSel ? "on" : ""}" data-cat-filter="${it.key}">
                          <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
                            <span class="cbk-cat-sw" style="background:${it.color}"></span>
                            <div style="flex:1;min-width:0">
                              <div style="font-size:12.5px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e(it.label)}</div>
                              <div class="cbk-cat-bar-track"><div class="cbk-cat-bar-fill" style="width:${pct}%;background:${it.color}"></div></div>
                            </div>
                          </div>
                          <div style="text-align:right;flex-shrink:0">
                            <div style="font-size:12.5px;font-weight:700;color:var(--ink)">${e(fmtCompact(it.value, currency, mask))}</div>
                            <div style="font-size:11px;color:var(--muted)">${pct}%</div>
                          </div>
                        </button>
                      `;
                    })
                    .join("")
                : `<div class="muted small">За выбранный период ${UI_STATE.chartMode === "outflow" ? "расходов" : "поступлений"} не найдено.</div>`}
              ${UI_STATE.category !== "all" ? `<button type="button" class="cbk-fbtn" data-cat-filter="all" style="align-self:flex-start;margin-top:4px">Сбросить фильтр категории</button>` : ""}
            </div>
          </div>
        </div>

        <div class="cbk-box">
          <div class="cbk-box-head">
            <h3 class="cbk-sec-title">Календарь обязательств и планов</h3>
            <span class="small muted">${(bank.upcomingCommitments || []).length} активн.</span>
          </div>
          ${(bank.upcomingCommitments || []).length
            ? `<div class="cbk-commit-list">
                ${bank.upcomingCommitments
                  .map((cm: any) => {
                    const isInc = cm.kind === "income";
                    const isRes = cm.kind === "reserve";
                    const color = isInc ? "#15803d" : isRes ? "#b45309" : "#b91c1c";
                    const prefix = isInc ? "+" : isRes ? "🔒 " : "−";
                    return `
                      <div class="cbk-commit-item">
                        <div style="flex:1;min-width:0">
                          <div style="font-size:13px;font-weight:700;color:var(--ink)">${e(cm.title)}</div>
                          <div style="font-size:11.5px;color:var(--muted);margin-top:2px;line-height:1.35">${e(cm.subtitle)}</div>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
                          <span class="cbk-commit-amt" style="color:${color}">${prefix}${e(fmtCompact(cm.amount, currency, mask))}</span>
                          <button type="button" class="btn sm alt" data-quick-tab="${e(cm.actionTab)}">${e(cm.actionLabel)}</button>
                        </div>
                      </div>
                    `;
                  })
                  .join("")}
              </div>`
            : `<div class="empty">Нет незавершённых финансовых обязательств и заявок.</div>`}
        </div>
      </div>

      <!-- TRANSACTION FEED -->
      <div class="cbk-box">
        <div class="cbk-box-head">
          <div>
            <h3 class="cbk-sec-title">Лента операций</h3>
            <div class="small muted">Нажмите на любую операцию, чтобы открыть банковскую квитанцию и добавить заметку</div>
          </div>
          <span class="small muted">Показано: ${filteredTx.length} из ${history.length}</span>
        </div>

        <div class="cbk-feed-controls">
          <input type="search" id="cbk_search_inp" class="cbk-search" value="${e(UI_STATE.search)}" placeholder="Поиск по игроку, клубу, описанию или заметке..." />
          <div class="cbk-seg">
            <button type="button" data-dir="all" class="${UI_STATE.direction === "all" ? "on" : ""}">Все</button>
            <button type="button" data-dir="in" class="${UI_STATE.direction === "in" ? "on" : ""}">Поступления</button>
            <button type="button" data-dir="out" class="${UI_STATE.direction === "out" ? "on" : ""}">Расходы</button>
          </div>
        </div>

        <div class="cbk-filter-row">
          <button type="button" class="cbk-fbtn ${UI_STATE.category === "all" ? "on" : ""}" data-cat-filter="all">Все категории</button>
          ${defaultCats
            .map(([k]) => {
              const short = k === "transfers" ? "Трансферы" : k === "sponsors" ? "Спонсоры" : k === "prizes" ? "Призовые" : k === "bonuses" ? "Премии" : k === "logistics" ? "Логистика" : k === "fines" ? "КДК" : k === "staff" ? "Штаб" : "Казна";
              return `<button type="button" class="cbk-fbtn ${UI_STATE.category === k ? "on" : ""}" data-cat-filter="${k}">${short}</button>`;
            })
            .join("")}
        </div>

        ${txGroups.length
          ? txGroups
              .map(
                (grp) => `
              <div class="cbk-day-group">
                <div class="cbk-day-hdr">${e(grp.label)}</div>
                ${grp.items
                  .map((tx: any) => {
                    const amt = Number(tx.amount || 0);
                    const timeStr = tx.date ? new Date(tx.date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "";
                    return `
                      <button type="button" class="cbk-tx-row" data-tx-open="${e(tx.id)}">
                        <div class="cbk-tx-ico">${catIcon(tx.category)}</div>
                        <div class="cbk-tx-mid">
                          <div class="cbk-tx-title">
                            <span>${e(tx.typeLabel || tx.categoryLabel || "Операция")}</span>
                            ${timeStr ? `<span class="small muted" style="font-weight:500">${timeStr}</span>` : ""}
                          </div>
                          <div class="cbk-tx-desc">${e(tx.description || "—")}</div>
                          ${tx.note ? `<div class="cbk-tx-note">📝 ${e(tx.note)}</div>` : ""}
                        </div>
                        <div class="cbk-tx-right">
                          <div class="cbk-tx-amt" style="color:${amt < 0 ? "#b91c1c" : "#15803d"}">${e(fmtMoney(amt, currency, mask, true))}</div>
                          <div class="cbk-tx-after">Остаток: ${e(fmtMoney(tx.newBudget ?? 0, currency, mask))}</div>
                        </div>
                      </button>
                    `;
                  })
                  .join("")}
              </div>
            `
              )
              .join("")
          : `<div class="empty">По заданным фильтрам операций не найдено</div>`}
      </div>
    `;
  }

  function renderAnalyticsHtml() {
    const timeline: Array<{ day: string; inflow: number; outflow: number }> = Array.isArray(stats.timeline) ? stats.timeline : [];
    const maxDayVal = Math.max(1, ...timeline.map((d) => Math.max(d.inflow || 0, d.outflow || 0)));
    const topIn = [...history].filter((h) => Number(h.amount || 0) > 0).sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5);
    const topOut = [...history].filter((h) => Number(h.amount || 0) < 0).sort((a, b) => Number(a.amount) - Number(b.amount)).slice(0, 5);

    return `
      <div class="cbk-box">
        <div class="cbk-box-head">
          <h3 class="cbk-sec-title">Динамика поступлений и расходов (последние активные дни)</h3>
          <div style="display:flex;gap:12px;font-size:12px;color:var(--muted)">
            <span><b style="color:#16a34a">■</b> Поступления</span>
            <span><b style="color:#dc2626">■</b> Расходы</span>
          </div>
        </div>
        ${timeline.length
          ? `<div class="cbk-bar-chart">
              ${timeline
                .map((d) => {
                  const hIn = Math.round(((d.inflow || 0) / maxDayVal) * 100);
                  const hOut = Math.round(((d.outflow || 0) / maxDayVal) * 100);
                  const shortD = d.day.slice(5).split("-").reverse().join(".");
                  return `
                    <div class="cbk-bar-col" title="${e(d.day)}: +${fmtCompact(d.inflow, currency, mask)} / −${fmtCompact(d.outflow, currency, mask)}">
                      <div class="cbk-bar-pair">
                        <div class="cbk-bar-in" style="height:${d.inflow > 0 ? Math.max(6, hIn) : 2}%"></div>
                        <div class="cbk-bar-out" style="height:${d.outflow > 0 ? Math.max(6, hOut) : 2}%"></div>
                      </div>
                      <div class="cbk-bar-lbl">${e(shortD)}</div>
                    </div>
                  `;
                })
                .join("")}
            </div>`
          : `<div class="empty">Недостаточно данных для построения графика динамики</div>`}
      </div>

      <div class="cbk-box">
        <h3 class="cbk-sec-title">Сводка по всем категориям бюджета</h3>
        <div class="wrap">
          <table>
            <thead>
              <tr>
                <th class="l">Категория</th>
                <th>Операций</th>
                <th>Поступления</th>
                <th>Расходы</th>
                <th>Сальдо</th>
              </tr>
            </thead>
            <tbody>
              ${(stats.byCategory || [])
                .map((cRow: any) => {
                  const net = Number(cRow.inflow || 0) - Number(cRow.outflow || 0);
                  return `
                    <tr>
                      <td class="l"><b>${catIcon(cRow.key)} ${e(cRow.label)}</b></td>
                      <td>${cRow.count || 0}</td>
                      <td style="color:#15803d;font-weight:700">${cRow.inflow ? e(fmtMoney(cRow.inflow, currency, mask, true)) : "—"}</td>
                      <td style="color:#b91c1c;font-weight:700">${cRow.outflow ? e(fmtMoney(-cRow.outflow, currency, mask)) : "—"}</td>
                      <td style="font-weight:800;color:${net < 0 ? "#b91c1c" : net > 0 ? "#15803d" : "var(--muted)"}">${e(fmtMoney(net, currency, mask, true))}</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="cbk-mid-grid">
        <div class="cbk-box">
          <h3 class="cbk-sec-title">Крупнейшие поступления</h3>
          ${topIn.length
            ? topIn
                .map(
                  (tx) => `
                <div class="cbk-commit-item" style="cursor:pointer" data-tx-open="${e(tx.id)}">
                  <div style="flex:1;min-width:0">
                    <div style="font-size:13px;font-weight:700">${e(tx.typeLabel || "Поступление")}</div>
                    <div class="small muted">${e(tx.description || "—")}</div>
                  </div>
                  <div style="font-weight:800;color:#15803d;white-space:nowrap">${e(fmtMoney(tx.amount, currency, mask, true))}</div>
                </div>
              `
                )
                .join("")
            : `<div class="muted small">Крупных поступлений пока нет</div>`}
        </div>
        <div class="cbk-box">
          <h3 class="cbk-sec-title">Крупнейшие расходы</h3>
          ${topOut.length
            ? topOut
                .map(
                  (tx) => `
                <div class="cbk-commit-item" style="cursor:pointer" data-tx-open="${e(tx.id)}">
                  <div style="flex:1;min-width:0">
                    <div style="font-size:13px;font-weight:700">${e(tx.typeLabel || "Списание")}</div>
                    <div class="small muted">${e(tx.description || "—")}</div>
                  </div>
                  <div style="font-weight:800;color:#b91c1c;white-space:nowrap">${e(fmtMoney(tx.amount, currency, mask))}</div>
                </div>
              `
                )
                .join("")
            : `<div class="muted small">Крупных списаний пока нет</div>`}
        </div>
      </div>
    `;
  }

  function renderGoalsHtml() {
    return `
      <div class="cbk-box">
        <div class="cbk-box-head">
          <div>
            <h3 class="cbk-sec-title">Копилки и целевые резервы клуба</h3>
            <div class="small muted">Откладывайте средства из свободного остатка под трансферы, сборы и премии. Деньги остаются на балансе клуба, но защищены от случайных трат.</div>
          </div>
          <button type="button" class="btn sm" id="cbk_btn_new_goal">+ Создать цель</button>
        </div>

        <div class="cbk-split-strip">
          <div class="cbk-split-item">
            <div class="cbk-split-lbl">Доступно для распределения</div>
            <div class="cbk-split-val" style="color:#15803d">${e(fmtMoney(Math.max(0, bank.spendableAfterGoals), currency, mask))}</div>
          </div>
          <div class="cbk-split-item">
            <div class="cbk-split-lbl">Всего в копилках</div>
            <div class="cbk-split-val">${e(fmtMoney(bank.totalReservedGoals, currency, mask))}</div>
          </div>
          <div class="cbk-split-item">
            <div class="cbk-split-lbl">Активных целей</div>
            <div class="cbk-split-val">${goals.length} / 8</div>
          </div>
        </div>

        ${goals.length
          ? `<div class="cbk-goals-grid">
              ${goals
                .map((g) => {
                  const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100)) : 0;
                  const left = Math.max(0, g.targetAmount - g.savedAmount);
                  return `
                    <div class="cbk-goal-card">
                      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                        <div style="display:flex;align-items:center;gap:8px">
                          <span style="font-size:22px">${e(g.icon || "🎯")}</span>
                          <div>
                            <div style="font-weight:700;font-size:14px;color:var(--ink)">${e(g.title)}</div>
                            <div class="small muted">${e(g.category || "Резерв")}</div>
                          </div>
                        </div>
                        <span style="font-weight:800;font-size:13px;color:var(--deep)">${pct}%</span>
                      </div>

                      <div>
                        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px">
                          <b>${e(fmtMoney(g.savedAmount, currency, mask))}</b>
                          <span class="muted">из ${e(fmtMoney(g.targetAmount, currency, mask))}</span>
                        </div>
                        <div class="cbk-goal-bar"><div class="cbk-goal-fill" style="width:${pct}%"></div></div>
                        <div class="small muted" style="margin-top:4px">${left > 0 ? `Осталось накопить: ${e(fmtMoney(left, currency, mask))}` : "Цель полностью собрана!"}</div>
                      </div>

                      <div class="cbk-goal-actions">
                        <button type="button" class="btn sm" data-goal-op="deposit" data-goal-id="${e(g.id)}">+ Пополнить</button>
                        <button type="button" class="btn sm alt" data-goal-op="withdraw" data-goal-id="${e(g.id)}" ${g.savedAmount <= 0 ? "disabled" : ""}>Снять</button>
                        <button type="button" class="btn sm alt" data-goal-del="${e(g.id)}" style="margin-left:auto;color:#b91c1c">Удалить</button>
                      </div>
                    </div>
                  `;
                })
                .join("")}
            </div>`
          : `<div class="empty">У клуба пока нет финансовых целей. Нажмите «+ Создать цель» или выберите готовый шаблон ниже.</div>`}

        <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:4px">
          <button type="button" class="cbk-fbtn" data-preset-goal="Трансферный фонд|3000000|⚽">+ Шаблон: Трансферный фонд (€3M)</button>
          <button type="button" class="cbk-fbtn" data-preset-goal="Резерв на выезды|250000|✈️">+ Шаблон: Резерв на выезды (€250K)</button>
          <button type="button" class="cbk-fbtn" data-preset-goal="Премиальный фонд плей-офф|600000|🏆">+ Шаблон: Премии плей-офф (€600K)</button>
        </div>
      </div>
    `;
  }

  function renderLimitsHtml() {
    const trSpent = catSpendMap.transfers || 0;
    const logSpent = catSpendMap.logistics || 0;
    const bonSpent = catSpendMap.bonuses || 0;
    const limitItem = (key: string, label: string, spent: number, lim: number) => {
      const pct = lim > 0 ? Math.min(100, Math.round((spent / lim) * 100)) : 0;
      const over = lim > 0 && spent > lim;
      return `
        <div class="cbk-limit-row">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
            <div>
              <div style="font-weight:700;font-size:13.5px">${label}</div>
              <div class="small muted">Потрачено: <b>${e(fmtMoney(spent, currency, mask))}</b> · Лимит: <b>${e(fmtMoney(lim, currency, mask))}</b></div>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <input type="number" min="0" step="10000" data-limit-inp="${key}" value="${lim}" style="width:140px;padding:6px 10px;border-radius:8px;border:1px solid var(--line);font-size:13px" aria-label="Лимит € для ${label}" />
              <span class="small muted">€</span>
            </div>
          </div>
          <div class="cbk-goal-bar"><div class="cbk-goal-fill" style="width:${pct}%;background:${over ? "#dc2626" : pct > 80 ? "#d97706" : "#16a34a"}"></div></div>
          <div class="small" style="color:${over ? "#b91c1c" : "var(--muted)"}">${over ? `Превышение лимита на ${e(fmtMoney(spent - lim, currency, mask))}` : `Использовано ${pct}% от установленного порога`}</div>
        </div>
      `;
    };

    return `
      <div class="cbk-mid-grid">
        <div class="cbk-box">
          <div class="cbk-box-head">
            <h3 class="cbk-sec-title">Лимиты расходов (контроль бюджета)</h3>
            <button type="button" class="btn sm" id="cbk_save_limits">Сохранить лимиты</button>
          </div>
          ${limitItem("transfers", "Трансферы и расторжения контрактов", trSpent, limits.transfers)}
          ${limitItem("logistics", "Выездная логистика", logSpent, limits.logistics)}
          ${limitItem("bonuses", "Выплата матчевых премий", bonSpent, limits.bonuses)}
        </div>

        <div class="cbk-box">
          <div class="cbk-box-head">
            <h3 class="cbk-sec-title">Аудит финансового здоровья</h3>
            <span style="font:800 18px Unbounded,sans-serif;color:${health.score >= 70 ? "#15803d" : health.score >= 45 ? "#b45309" : "#b91c1c"}">${health.score}/100</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${(health.factors || [])
              .map((f: any) => {
                const pct = f.max > 0 ? Math.round((f.score / f.max) * 100) : 0;
                return `
                  <div class="cbk-limit-row">
                    <div style="display:flex;justify-content:space-between;font-size:13px">
                      <b>${e(f.label)}</b>
                      <span><b>${f.score}</b> / ${f.max}</span>
                    </div>
                    <div class="cbk-goal-bar"><div class="cbk-goal-fill" style="width:${pct}%"></div></div>
                    <div class="small muted">${e(f.detail)}</div>
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>
      </div>
    `;
  }

  // ---- WIRE EVENT HANDLERS ----
  async function savePref(patch: Record<string, any>) {
    if (!api) return;
    try {
      await api("/club/bank/preferences", withT(patch));
    } catch (err: any) {
      toast(err?.message || "Не удалось сохранить настройку", true);
    }
  }

  cb.querySelectorAll("[data-bank-cur]").forEach((btn) => {
    (btn as HTMLElement).onclick = async () => {
      const cur = (btn as HTMLElement).dataset.bankCur as BankCurrency;
      UI_STATE.localCurrencyOverride = cur;
      renderClubBalanceTab(cb, clubData, onRefreshClub, onSwitchTab);
      await savePref({ currency: cur });
    };
  });

  const hideBtn = cb.querySelector("#cbk_toggle_hide") as HTMLElement | null;
  if (hideBtn) {
    hideBtn.onclick = async () => {
      const next = !mask;
      UI_STATE.localHideOverride = next;
      renderClubBalanceTab(cb, clubData, onRefreshClub, onSwitchTab);
      await savePref({ hideBalance: next });
    };
  }

  const csvBtn = cb.querySelector("#cbk_export_csv") as HTMLElement | null;
  if (csvBtn) {
    csvBtn.onclick = () => {
      downloadCsvStatement(clubData?.team?.name || "club", history, currency);
      toast("Банковская выписка CSV скачана");
    };
  }

  const reqBtn = cb.querySelector("#cbk_btn_reqs") as HTMLElement | null;
  if (reqBtn) {
    reqBtn.onclick = () => {
      UI_STATE.showDetails = !UI_STATE.showDetails;
      renderClubBalanceTab(cb, clubData, onRefreshClub, onSwitchTab);
    };
  }

  const topupBtn = cb.querySelector("#cbk_btn_topup") as HTMLElement | null;
  if (topupBtn) {
    topupBtn.onclick = () => onSwitchTab?.("sponsors");
  }

  cb.querySelectorAll("[data-copy-txt]").forEach((btn) => {
    (btn as HTMLElement).onclick = async () => {
      const txt = (btn as HTMLElement).dataset.copyTxt || "";
      try {
        await navigator.clipboard.writeText(txt);
        toast("Реквизит скопирован");
      } catch {
        toast("Скопируйте значение вручную: " + txt);
      }
    };
  });

  cb.querySelectorAll("[data-quick-tab]").forEach((btn) => {
    (btn as HTMLElement).onclick = () => {
      const target = (btn as HTMLElement).dataset.quickTab;
      if (target && onSwitchTab) onSwitchTab(target);
    };
  });

  cb.querySelectorAll("[data-subtab]").forEach((btn) => {
    (btn as HTMLElement).onclick = () => {
      UI_STATE.subTab = ((btn as HTMLElement).dataset.subtab as BankSubTab) || "overview";
      renderClubBalanceTab(cb, clubData, onRefreshClub, onSwitchTab);
    };
  });

  cb.querySelectorAll("[data-chart-mode]").forEach((btn) => {
    (btn as HTMLElement).onclick = () => {
      UI_STATE.chartMode = ((btn as HTMLElement).dataset.chartMode as "outflow" | "inflow") || "outflow";
      renderClubBalanceTab(cb, clubData, onRefreshClub, onSwitchTab);
    };
  });

  cb.querySelectorAll("[data-period]").forEach((btn) => {
    (btn as HTMLElement).onclick = () => {
      UI_STATE.period = ((btn as HTMLElement).dataset.period as "all" | "30d" | "7d") || "all";
      renderClubBalanceTab(cb, clubData, onRefreshClub, onSwitchTab);
    };
  });

  cb.querySelectorAll("[data-dir]").forEach((btn) => {
    (btn as HTMLElement).onclick = () => {
      UI_STATE.direction = ((btn as HTMLElement).dataset.dir as "all" | "in" | "out") || "all";
      renderClubBalanceTab(cb, clubData, onRefreshClub, onSwitchTab);
    };
  });

  cb.querySelectorAll("[data-cat-filter], [data-donut-cat]").forEach((btn) => {
    (btn as HTMLElement).onclick = () => {
      const k = (btn as HTMLElement).dataset.catFilter || (btn as HTMLElement).dataset.donutCat || "all";
      UI_STATE.category = UI_STATE.category === k && k !== "all" ? "all" : k;
      renderClubBalanceTab(cb, clubData, onRefreshClub, onSwitchTab);
    };
  });

  const searchInp = cb.querySelector("#cbk_search_inp") as HTMLInputElement | null;
  if (searchInp) {
    searchInp.oninput = () => {
      const pos = searchInp.selectionStart ?? searchInp.value.length;
      UI_STATE.search = searchInp.value;
      renderClubBalanceTab(cb, clubData, onRefreshClub, onSwitchTab);
      const nextInp = cb.querySelector("#cbk_search_inp") as HTMLInputElement | null;
      if (nextInp) {
        nextInp.focus();
        try {
          nextInp.setSelectionRange(pos, pos);
        } catch {}
      }
    };
  }

  // Open Receipt Modal on TX click
  cb.querySelectorAll("[data-tx-open]").forEach((row) => {
    (row as HTMLElement).onclick = () => {
      const id = (row as HTMLElement).dataset.txOpen;
      const tx = history.find((h) => String(h.id) === String(id));
      if (!tx || !modal) return;
      const amt = Number(tx.amount || 0);
      const dt = tx.date ? new Date(tx.date).toLocaleString("ru-RU") : "—";
      modal(
        `
        <div class="cbk-receipt">
          <div class="cbk-receipt-hero" style="background:${theme.cardBg}">
            <div style="font-size:12px;opacity:.8">${e(theme.bankLabel)} · Квитанция по операции</div>
            <div style="font:800 26px Unbounded,sans-serif;margin:8px 0 4px">${e(fmtMoney(amt, currency, false, true))}</div>
            <div style="font-size:12px;opacity:.85">${currency !== "EUR" ? `Базовая сумма: ${e(fmtMoney(amt, "EUR", false, true))} · ` : ""}Статус: Исполнено</div>
          </div>
          <div class="cbk-receipt-grid">
            <div class="cbk-receipt-line"><span class="muted">Дата и время</span><b>${e(dt)}</b></div>
            <div class="cbk-receipt-line"><span class="muted">Категория</span><b>${e(tx.categoryLabel || "Операция")}</b></div>
            <div class="cbk-receipt-line"><span class="muted">Тип проводки</span><b>${e(tx.typeLabel || tx.type || "—")}</b></div>
            <div class="cbk-receipt-line"><span class="muted">Баланс до</span><b>${e(fmtMoney(tx.prevBudget ?? 0, currency, false))}</b></div>
            <div class="cbk-receipt-line"><span class="muted">Баланс после</span><b>${e(fmtMoney(tx.newBudget ?? 0, currency, false))}</b></div>
            <div class="cbk-receipt-line"><span class="muted">Номер проводки</span><span style="font-family:monospace">${e(tx.id)}</span></div>
          </div>
          <div>
            <div class="small muted" style="margin-bottom:4px">Назначение операции</div>
            <div style="font-size:13px;line-height:1.45;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px">${e(tx.description || "—")}</div>
          </div>
          <div>
            <label class="small" style="display:block;font-weight:600;margin-bottom:4px">Комментарий клуба (сохраняется на сервере)</label>
            <div style="display:flex;gap:8px">
              <input id="cbk_tx_note_inp" value="${e(tx.note || "")}" placeholder="Например: согласовано советом директоров" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid var(--line)" />
              <button type="button" class="btn sm" id="cbk_tx_note_save">Сохранить</button>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;gap:8px;margin-top:4px">
            <button type="button" class="btn sm alt" id="cbk_tx_dl">⬇ Скачать чек (.html)</button>
            <button type="button" class="btn sm alt" id="cbk_tx_close">Закрыть</button>
          </div>
        </div>
      `,
        (m: HTMLElement, close: () => void) => {
          const closeBtn = m.querySelector("#cbk_tx_close") as HTMLElement | null;
          if (closeBtn) closeBtn.onclick = close;
          const dlBtn = m.querySelector("#cbk_tx_dl") as HTMLElement | null;
          if (dlBtn) {
            dlBtn.onclick = () => {
              downloadReceiptHtml(tx, clubData?.team?.name || "Клуб", theme.bankLabel, acc.accountNumber || "", currency);
              toast("Квитанция скачана");
            };
          }
          const saveNoteBtn = m.querySelector("#cbk_tx_note_save") as HTMLElement | null;
          if (saveNoteBtn) {
            saveNoteBtn.onclick = async () => {
              const val = (m.querySelector("#cbk_tx_note_inp") as HTMLInputElement | null)?.value || "";
              const r = await act(() => api("/club/bank/tx-note", withT({ txId: tx.id, note: val })), "Комментарий сохранён");
              if (r) {
                tx.note = r.note;
                close();
                renderClubBalanceTab(cb, clubData, onRefreshClub, onSwitchTab);
              }
            };
          }
        }
      );
    };
  });

  // Goal Creation Modal
  const openCreateGoalModal = (prefillTitle = "", prefillTarget = 1_000_000, prefillIcon = "🎯") => {
    if (!modal) return;
    modal(
      `
      <div style="display:flex;flex-direction:column;gap:12px">
        <h3 style="margin:0;font:700 17px Unbounded,sans-serif">Новая финансовая цель (копилка)</h3>
        <div class="small muted">Средства резервируются внутри расчётного счёта клуба. Свободно к распределению: <b>${e(fmtMoney(Math.max(0, bank.spendableAfterGoals), "EUR", false))}</b></div>
        <label style="display:block">
          <div class="small" style="font-weight:600;margin-bottom:4px">Название цели</div>
          <input id="cbk_g_title" value="${e(prefillTitle)}" placeholder="Например: Летний трансфер нападающего" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--line)" />
        </label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <label>
            <div class="small" style="font-weight:600;margin-bottom:4px">Целевая сумма (€)</div>
            <input id="cbk_g_target" type="number" min="10000" step="10000" value="${prefillTarget}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--line)" />
          </label>
          <label>
            <div class="small" style="font-weight:600;margin-bottom:4px">Отложить сразу (€)</div>
            <input id="cbk_g_init" type="number" min="0" step="10000" value="0" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--line)" />
          </label>
        </div>
        <div style="display:grid;grid-template-columns:100px 1fr;gap:10px">
          <label>
            <div class="small" style="font-weight:600;margin-bottom:4px">Значок</div>
            <select id="cbk_g_icon" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--line)">
              ${["🎯", "⚽", "✈️", "🏆", "🛡️", "🏟️", "💎"].map((ic) => `<option value="${ic}" ${ic === prefillIcon ? "selected" : ""}>${ic}</option>`).join("")}
            </select>
          </label>
          <label>
            <div class="small" style="font-weight:600;margin-bottom:4px">Категория фонда</div>
            <select id="cbk_g_cat" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--line)">
              <option value="Трансферный фонд">Трансферный фонд</option>
              <option value="Выезды и сборы">Выезды и сборы</option>
              <option value="Премиальный резерв">Премиальный резерв</option>
              <option value="Стабилизационный сейф">Стабилизационный сейф</option>
            </select>
          </label>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px">
          <button type="button" class="btn sm alt" id="cbk_g_cancel">Отмена</button>
          <button type="button" class="btn sm" id="cbk_g_submit">Создать копилку</button>
        </div>
      </div>
    `,
      (m: HTMLElement, close: () => void) => {
        (m.querySelector("#cbk_g_cancel") as HTMLElement).onclick = close;
        (m.querySelector("#cbk_g_submit") as HTMLElement).onclick = async () => {
          const title = (m.querySelector("#cbk_g_title") as HTMLInputElement).value;
          const targetAmount = Number((m.querySelector("#cbk_g_target") as HTMLInputElement).value);
          const initialReserve = Number((m.querySelector("#cbk_g_init") as HTMLInputElement).value);
          const icon = (m.querySelector("#cbk_g_icon") as HTMLSelectElement).value;
          const category = (m.querySelector("#cbk_g_cat") as HTMLSelectElement).value;
          const r = await act(() => api("/club/bank/goals/create", withT({ title, targetAmount, initialReserve, icon, category })), "Финансовая цель создана");
          if (r?.bank) {
            clubData.bank = r.bank;
            UI_STATE.subTab = "goals";
            close();
            renderClubBalanceTab(cb, clubData, onRefreshClub, onSwitchTab);
          }
        };
      }
    );
  };

  const quickGoalBtn = cb.querySelector("#cbk_quick_goal") as HTMLElement | null;
  if (quickGoalBtn) quickGoalBtn.onclick = () => openCreateGoalModal();

  const newGoalBtn = cb.querySelector("#cbk_btn_new_goal") as HTMLElement | null;
  if (newGoalBtn) newGoalBtn.onclick = () => openCreateGoalModal();

  cb.querySelectorAll("[data-preset-goal]").forEach((btn) => {
    (btn as HTMLElement).onclick = () => {
      const [t, amt, ic] = ((btn as HTMLElement).dataset.presetGoal || "").split("|");
      openCreateGoalModal(t, Number(amt || 500_000), ic || "🎯");
    };
  });

  // Goal Deposit / Withdraw
  cb.querySelectorAll("[data-goal-op]").forEach((btn) => {
    (btn as HTMLElement).onclick = () => {
      const goalId = (btn as HTMLElement).dataset.goalId || "";
      const mode = ((btn as HTMLElement).dataset.goalOp === "withdraw" ? "withdraw" : "deposit") as "deposit" | "withdraw";
      const goal = goals.find((g) => g.id === goalId);
      if (!goal || !modal) return;
      const maxAvail = mode === "deposit" ? Math.max(0, bank.spendableAfterGoals) : goal.savedAmount;
      const suggest = Math.min(maxAvail, mode === "deposit" ? Math.max(10000, Math.min(250_000, goal.targetAmount - goal.savedAmount || maxAvail)) : goal.savedAmount);
      modal(
        `
        <div style="display:flex;flex-direction:column;gap:12px">
          <h3 style="margin:0;font:700 16px Unbounded,sans-serif">${mode === "deposit" ? "Пополнить копилку" : "Вернуть средства на счёт"}</h3>
          <div class="small muted">Цель: <b>${e(goal.title)}</b> · Доступно: <b>${e(fmtMoney(maxAvail, "EUR", false))}</b></div>
          <label>
            <div class="small" style="font-weight:600;margin-bottom:4px">Сумма (€)</div>
            <input id="cbk_alloc_amt" type="number" min="1000" step="10000" value="${suggest}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--line)" />
          </label>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${[50_000, 250_000, 1_000_000].map((v) => `<button type="button" class="cbk-fbtn" data-alloc-q="${Math.min(v, maxAvail)}">+€${(Math.min(v, maxAvail) / 1000).toFixed(0)}K</button>`).join("")}
            <button type="button" class="cbk-fbtn" data-alloc-q="${maxAvail}">Максимум</button>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px">
            <button type="button" class="btn sm alt" id="cbk_alloc_cancel">Отмена</button>
            <button type="button" class="btn sm" id="cbk_alloc_ok">${mode === "deposit" ? "Перевести в цель" : "Вернуть на баланс"}</button>
          </div>
        </div>
      `,
        (m: HTMLElement, close: () => void) => {
          m.querySelectorAll("[data-alloc-q]").forEach((qb) => {
            (qb as HTMLElement).onclick = () => {
              (m.querySelector("#cbk_alloc_amt") as HTMLInputElement).value = (qb as HTMLElement).dataset.allocQ || "0";
            };
          });
          (m.querySelector("#cbk_alloc_cancel") as HTMLElement).onclick = close;
          (m.querySelector("#cbk_alloc_ok") as HTMLElement).onclick = async () => {
            const amount = Number((m.querySelector("#cbk_alloc_amt") as HTMLInputElement).value);
            const r = await act(() => api("/club/bank/goals/allocate", withT({ goalId, mode, amount })), mode === "deposit" ? "Средства зарезервированы" : "Средства возвращены в свободный остаток");
            if (r?.bank) {
              clubData.bank = r.bank;
              close();
              renderClubBalanceTab(cb, clubData, onRefreshClub, onSwitchTab);
            }
          };
        }
      );
    };
  });

  cb.querySelectorAll("[data-goal-del]").forEach((btn) => {
    (btn as HTMLElement).onclick = async () => {
      const goalId = (btn as HTMLElement).dataset.goalDel || "";
      const r = await act(() => api("/club/bank/goals/delete", withT({ goalId })), "Цель закрыта, резерв освобождён");
      if (r?.bank) {
        clubData.bank = r.bank;
        renderClubBalanceTab(cb, clubData, onRefreshClub, onSwitchTab);
      }
    };
  });

  // Save Limits
  const saveLimitsBtn = cb.querySelector("#cbk_save_limits") as HTMLElement | null;
  if (saveLimitsBtn) {
    saveLimitsBtn.onclick = async () => {
      const transfers = Number((cb.querySelector('[data-limit-inp="transfers"]') as HTMLInputElement | null)?.value || 0);
      const logistics = Number((cb.querySelector('[data-limit-inp="logistics"]') as HTMLInputElement | null)?.value || 0);
      const bonuses = Number((cb.querySelector('[data-limit-inp="bonuses"]') as HTMLInputElement | null)?.value || 0);
      const r = await act(() => api("/club/bank/preferences", withT({ spendingLimits: { transfers, logistics, bonuses } })), "Лимиты расходов обновлены");
      if (r?.preferences) {
        bank.preferences = r.preferences;
        renderClubBalanceTab(cb, clubData, onRefreshClub, onSwitchTab);
      }
    };
  }

  // Currency Converter Modal
  const calcBtn = cb.querySelector("#cbk_quick_calc") as HTMLElement | null;
  if (calcBtn && modal) {
    calcBtn.onclick = () => {
      modal(
        `
        <div style="display:flex;flex-direction:column;gap:12px">
          <h3 style="margin:0;font:700 16px Unbounded,sans-serif">Валютный калькулятор VLF</h3>
          <div class="small muted">Курсы расчёта: <b>1 € = 105 ₽ = 1.08 $</b>. Свободный остаток клуба: <b>${e(fmtMoney(bank.spendableAfterGoals, "EUR", false))}</b></div>
          <label>
            <div class="small" style="font-weight:600;margin-bottom:4px">Сумма в евро (€)</div>
            <input id="cbk_conv_eur" type="number" value="1000000" step="50000" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--line)" />
          </label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <label>
              <div class="small" style="font-weight:600;margin-bottom:4px">В рублях (₽)</div>
              <input id="cbk_conv_rub" type="number" value="105000000" step="100000" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--line)" />
            </label>
            <label>
              <div class="small" style="font-weight:600;margin-bottom:4px">В долларах ($)</div>
              <input id="cbk_conv_usd" type="number" value="1080000" step="50000" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--line)" />
            </label>
          </div>
          <div id="cbk_conv_share" class="small" style="padding:10px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0"></div>
          <div style="display:flex;justify-content:flex-end">
            <button type="button" class="btn sm alt" id="cbk_conv_close">Закрыть</button>
          </div>
        </div>
      `,
        (m: HTMLElement, close: () => void) => {
          const eurEl = m.querySelector("#cbk_conv_eur") as HTMLInputElement;
          const rubEl = m.querySelector("#cbk_conv_rub") as HTMLInputElement;
          const usdEl = m.querySelector("#cbk_conv_usd") as HTMLInputElement;
          const shareEl = m.querySelector("#cbk_conv_share") as HTMLElement;
          const updShare = (eurVal: number) => {
            const avail = Math.max(0, Number(bank.spendableAfterGoals || 0));
            if (avail <= 0) {
              shareEl.textContent = "На счёте нет свободного остатка для покрытия этой суммы.";
            } else {
              const pct = ((eurVal / avail) * 100).toFixed(1);
              shareEl.innerHTML = `Эта сумма составляет <b>${pct}%</b> от свободного остатка клуба (${e(fmtMoney(avail, "EUR", false))}).`;
            }
          };
          updShare(1_000_000);
          eurEl.oninput = () => {
            const v = Number(eurEl.value || 0);
            rubEl.value = String(Math.round(v * 105));
            usdEl.value = String(Math.round(v * 1.08));
            updShare(v);
          };
          rubEl.oninput = () => {
            const eurV = Number(rubEl.value || 0) / 105;
            eurEl.value = String(Math.round(eurV));
            usdEl.value = String(Math.round(eurV * 1.08));
            updShare(eurV);
          };
          usdEl.oninput = () => {
            const eurV = Number(usdEl.value || 0) / 1.08;
            eurEl.value = String(Math.round(eurV));
            rubEl.value = String(Math.round(eurV * 105));
            updShare(eurV);
          };
          (m.querySelector("#cbk_conv_close") as HTMLElement).onclick = close;
        }
      );
    };
  }
}

window.__RPL_BANK__ = {
  renderClubBalanceTab,
};
export { renderClubBalanceTab };
