/* Студийная панель управления Telegram-каналами и ботом ("📡 Каналы") */

declare global {
  interface Window {
    __RPL_CHANNELS__?: {
      renderAdminChannelsTab: (ab: HTMLElement, ov: any, onRefreshAdmin: () => void) => Promise<void>;
    };
  }
}

type ChannelId = "matchtv" | "rpl" | "fnl" | "cup" | "national" | "personal_bot";
type PreviewKind = "poster" | "schedule" | "team_round" | "team_month" | "standings" | "national_extended" | "national_final";

interface ChannelsUiState {
  selectedChannel: ChannelId;
  comp: "rpl" | "fnl" | "cup" | "national";
  kind: PreviewKind;
  fixtureId: string;
  round: string;
  month: string;
  date: string;
  teamType: "main" | "u21";
  manualTargets: ChannelId[];
  useAutoTargets: boolean;
  previewData: any | null;
  previewLoading: boolean;
  previewError: string;
  midnightDate: string;
}

const CH_STATE: ChannelsUiState = {
  selectedChannel: "matchtv",
  comp: "rpl",
  kind: "poster",
  fixtureId: "",
  round: "",
  month: "",
  date: "",
  teamType: "main",
  manualTargets: [],
  useAutoTargets: true,
  previewData: null,
  previewLoading: false,
  previewError: "",
  midnightDate: "",
};

const RULE_LABELS: Array<{ key: string; title: string; desc: string; forChannels?: ChannelId[] }> = [
  { key: "schedule0001", title: "Расписание тура в 00:01 МСК", desc: "Карточка с временем матчей на день" },
  { key: "teamOfRound", title: "Сборная тура", desc: "Тактическое поле 4-3-3 + MVP и тренер сразу после тура", forChannels: ["matchtv", "rpl", "fnl", "cup", "personal_bot"] },
  { key: "teamOfMonth", title: "Сборная месяца", desc: "Итоги календарного месяца автоматически", forChannels: ["matchtv", "rpl", "fnl", "cup", "personal_bot"] },
  { key: "standingsAfterTour", title: "Турнирная таблица после тура", desc: "Обновлённая таблица сразу по окончании тура", forChannels: ["matchtv", "rpl", "fnl", "cup", "personal_bot"] },
  { key: "nationalExtended", title: "Расширенный состав сборной", desc: "Афиша + список вызова сразу при публикации", forChannels: ["matchtv", "national", "personal_bot"] },
  { key: "nationalFinal", title: "Итоговый вызов (кого вызвали)", desc: "Финальная заявка сборной сразу при публикации", forChannels: ["matchtv", "national", "personal_bot"] },
  { key: "liveMatchEvents", title: "Лайв-события матчей", desc: "Старт, голы, карточки, перерыв, итог и интервью", forChannels: ["matchtv", "rpl", "fnl", "cup", "national"] },
  { key: "transfersAndNews", title: "Трансферы, жеребьёвки и новости", desc: "Сделки клубов, вызовы и студийные эфиры", forChannels: ["matchtv", "rpl", "fnl", "cup"] },
];

const KIND_LABELS: Array<{ id: PreviewKind; label: string; comps?: string[] }> = [
  { id: "poster", label: "Афиша матча" },
  { id: "schedule", label: "Расписание дня / тура" },
  { id: "team_round", label: "Сборная тура", comps: ["rpl", "fnl", "cup"] },
  { id: "team_month", label: "Сборная месяца", comps: ["rpl", "fnl", "cup"] },
  { id: "standings", label: "Турнирная таблица", comps: ["rpl", "fnl", "cup"] },
  { id: "national_extended", label: "Расширенный состав", comps: ["national"] },
  { id: "national_final", label: "Кого вызвали (итоговый)", comps: ["national"] },
];

function escHtml(v: any): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMskTimeFromEpoch(ts: number): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("ru-RU", {
      timeZone: "Europe/Moscow",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return new Date(ts).toISOString();
  }
}

function ensureChannelsStyles() {
  if (typeof document === "undefined") return;
  let st = document.getElementById("rpl_channels_styles") as HTMLStyleElement | null;
  if (!st) {
    st = document.createElement("style");
    st.id = "rpl_channels_styles";
    document.head.appendChild(st);
  }
  st.textContent = `
    .chn-root{display:flex;flex-direction:column;gap:18px;font-variant-numeric:tabular-nums}
    .chn-hero{
      background:linear-gradient(135deg,#080d18 0%,#10192d 55%,#0b1322 100%);
      border:1px solid rgba(255,255,255,0.12);
      border-radius:16px;
      padding:22px 24px;
      color:#f8fafc;
      display:flex;
      flex-wrap:wrap;
      align-items:center;
      justify-content:space-between;
      gap:18px;
      position:relative;
      overflow:hidden;
    }
    .chn-hero::before{
      content:"";
      position:absolute;
      inset:0 0 auto 0;
      height:3px;
      background:linear-gradient(90deg,#dc2626 0%,#16a34a 25%,#2563eb 52%,#d97706 76%,#f8fafc 100%);
    }
    .chn-eyebrow{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px}
    .chn-hero-title{font:800 clamp(19px,2.2vw,24px)/1.18 Unbounded,sans-serif;color:#ffffff;margin:0 0 6px}
    .chn-hero-sub{font-size:13px;color:#cbd5e1;max-width:62ch;line-height:1.5}
    .chn-hero-right{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
    .chn-metric{
      background:rgba(255,255,255,0.06);
      border:1px solid rgba(255,255,255,0.12);
      border-radius:11px;
      padding:10px 14px;
      min-width:124px;
    }
    .chn-metric-lbl{font-size:11px;color:#94a3b8}
    .chn-metric-val{font:800 16px/1.2 Unbounded,sans-serif;color:#f8fafc;margin-top:4px}
    .chn-btn-studio{
      display:inline-flex;align-items:center;justify-content:center;gap:7px;
      padding:9px 15px;border-radius:10px;border:1px solid rgba(255,255,255,0.16);
      background:#16a34a;color:#fff;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;
      transition:background .15s,transform .12s;
    }
    .chn-btn-studio:hover{background:#15803d}
    .chn-btn-studio.dark{background:rgba(255,255,255,0.09);color:#f8fafc}
    .chn-btn-studio.dark:hover{background:rgba(255,255,255,0.16)}

    .chn-cards-grid{
      display:grid;
      grid-template-columns:repeat(6,minmax(0,1fr));
      gap:10px;
    }
    @media(max-width:1180px){.chn-cards-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:640px){.chn-cards-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}

    .chn-card{
      position:relative;
      text-align:left;
      background:#ffffff;
      border:1px solid var(--line);
      border-radius:13px;
      padding:14px 13px 13px;
      cursor:pointer;
      transition:border-color .15s,box-shadow .15s,transform .12s;
      display:flex;
      flex-direction:column;
      gap:6px;
      overflow:hidden;
    }
    .chn-card::before{
      content:"";
      position:absolute;
      top:0;left:0;right:0;height:3px;
      background:var(--chn-accent,#16a34a);
    }
    .chn-card:hover{border-color:#94a3b8;box-shadow:0 6px 18px -10px rgba(15,23,42,0.22)}
    .chn-card.on{border-color:#0f172a;border-width:2px;background:#f8fafc;box-shadow:0 10px 24px -12px rgba(15,23,42,0.28)}
    .chn-card-top{display:flex;align-items:center;justify-content:space-between;gap:6px}
    .chn-card-code{font:800 10.5px Unbounded,sans-serif;letter-spacing:.05em;color:#475569;text-transform:uppercase}
    .chn-status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
    .chn-card-name{font:700 14.5px/1.25 Unbounded,sans-serif;color:#0f172a;margin-top:2px}
    .chn-card-chat{font-size:12px;color:#475569;font-family:ui-monospace,Consolas,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .chn-card-meta{font-size:11.5px;color:#64748b;margin-top:auto;padding-top:4px;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;gap:6px}

    .chn-studio-split{
      display:grid;
      grid-template-columns:minmax(0,1fr) minmax(0,1.28fr);
      gap:16px;
      align-items:start;
    }
    @media(max-width:1020px){.chn-studio-split{grid-template-columns:minmax(0,1fr)}}

    .chn-panel{
      background:#ffffff;
      border:1px solid var(--line);
      border-radius:14px;
      padding:18px;
      display:flex;
      flex-direction:column;
      gap:14px;
    }
    .chn-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-bottom:10px;border-bottom:1px solid #f1f5f9}
    .chn-panel-title{font:700 15.5px Unbounded,sans-serif;color:#0f172a;margin:0}
    .chn-panel-sub{font-size:12px;color:#64748b;margin-top:2px}

    .chn-field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    @media(max-width:600px){.chn-field-grid{grid-template-columns:minmax(0,1fr)}}
    .chn-label{display:block;font-size:11.5px;font-weight:700;color:#475569;margin-bottom:5px}

    .chn-rules-list{display:flex;flex-direction:column;gap:6px}
    .chn-rule-row{
      display:flex;align-items:flex-start;gap:10px;
      padding:9px 11px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;cursor:pointer;
      transition:border-color .15s,background .15s;
    }
    .chn-rule-row:hover{border-color:#94a3b8;background:#ffffff}
    .chn-rule-row input{width:auto;margin:2px 0 0;flex-shrink:0}
    .chn-rule-name{font-size:13px;font-weight:700;color:#0f172a;line-height:1.25}
    .chn-rule-desc{font-size:11.5px;color:#64748b;margin-top:2px;line-height:1.3}

    .chn-comp-bar{display:flex;flex-wrap:wrap;gap:6px}
    .chn-comp-btn{
      padding:7px 13px;border-radius:9px;border:1px solid var(--line);background:#f8fafc;color:#334155;
      font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:all .15s;
    }
    .chn-comp-btn:hover{border-color:#64748b}
    .chn-comp-btn.on{background:#0f172a;color:#ffffff;border-color:#0f172a}

    .chn-kind-grid{display:flex;flex-wrap:wrap;gap:6px}
    .chn-kind-btn{
      padding:6px 11px;border-radius:8px;border:1px solid #e2e8f0;background:#ffffff;color:#334155;
      font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all .15s;
    }
    .chn-kind-btn:hover{background:#f1f5f9}
    .chn-kind-btn.on{background:#15803d;color:#ffffff;border-color:#15803d}

    .chn-tg-mockup{
      background:linear-gradient(180deg,#0c1421 0%,#09101a 100%);
      border:1px solid #1e293b;
      border-radius:14px;
      padding:14px;
      color:#e2e8f0;
      display:flex;
      flex-direction:column;
      gap:10px;
    }
    .chn-tg-topbar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.08)}
    .chn-tg-chan{display:flex;align-items:center;gap:9px}
    .chn-tg-ava{
      width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#dc2626,#991b1b);
      display:flex;align-items:center;justify-content:center;font:800 11px Unbounded,sans-serif;color:#fff;flex-shrink:0;
    }
    .chn-tg-bubble{
      background:#162032;
      border:1px solid rgba(255,255,255,0.09);
      border-radius:12px;
      overflow:hidden;
    }
    .chn-tg-img-wrap{
      background:#060911;
      display:flex;align-items:center;justify-content:center;
      min-height:220px;
      max-height:420px;
      overflow:hidden;
    }
    .chn-tg-img-wrap img{display:block;width:100%;height:auto;max-height:420px;object-fit:contain}
    .chn-tg-caption{
      padding:12px 14px;
      font-size:12.5px;
      line-height:1.52;
      color:#e2e8f0;
      white-space:pre-line;
      word-break:break-word;
      max-height:220px;
      overflow:auto;
    }
    .chn-tg-caption b{color:#ffffff}
    .chn-tg-caption i{color:#cbd5e1}

    .chn-midnight-grid{
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:10px;
    }
    @media(max-width:960px){.chn-midnight-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:520px){.chn-midnight-grid{grid-template-columns:minmax(0,1fr)}}
    .chn-mid-card{
      border:1px solid var(--line);
      border-radius:12px;
      padding:12px 13px;
      background:#f8fafc;
      display:flex;flex-direction:column;gap:8px;
    }
    .chn-mid-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
    .chn-mid-name{font:700 13.5px Unbounded,sans-serif;color:#0f172a}
    .chn-mid-cnt{font:800 15px Unbounded,sans-serif;color:#0f172a}
    .chn-mid-list{font-size:11.5px;color:#475569;line-height:1.45;display:flex;flex-direction:column;gap:2px}
  `;
}

async function renderAdminChannelsTab(ab: HTMLElement, _ov: any, onRefreshAdmin: () => void) {
  ensureChannelsStyles();
  const app = window.__RPL_APP__;
  if (!app) {
    ab.innerHTML = `<div class="panel">Инициализация интерфейса...</div>`;
    return;
  }
  const { api, act, toast } = app;

  ab.innerHTML = `<div class="panel" style="padding:28px;text-align:center;color:var(--muted)">Загрузка студии каналов...</div>`;
  let data: any;
  try {
    data = await api("/admin/channels");
  } catch (err: any) {
    ab.innerHTML = `<div class="panel">Ошибка загрузки каналов: ${escHtml(err?.message || err)}</div>`;
    return;
  }

  const mskNow = data.mskNow || { dateStr: new Date().toISOString().slice(0, 10), hour: 0, minute: 0 };
  if (!CH_STATE.date) CH_STATE.date = mskNow.dateStr;
  if (!CH_STATE.midnightDate) CH_STATE.midnightDate = mskNow.dateStr;

  const channels: any[] = data.channels || [];
  const botStats = data.personalBotStats || { totalUsers: 0, clubUsers: 0, activeUsers: 0 };
  const activeChannelCount = channels.filter((c) => c.id !== "personal_bot" && c.enabled && c.effectiveChatId && c.hasToken).length;
  const selCfg = channels.find((c) => c.id === CH_STATE.selectedChannel) || channels[0];
  const compOpts = data.availableOptions || {};

  const syncCompSelections = () => {
    if (CH_STATE.comp === "national") {
      if (!["poster", "schedule", "national_extended", "national_final"].includes(CH_STATE.kind)) {
        CH_STATE.kind = "national_final";
      }
      const nBlock = compOpts.national?.[CH_STATE.teamType] || { matches: [] };
      const mList = nBlock.matches || [];
      if (mList.length && !mList.some((x: any) => x.id === CH_STATE.fixtureId)) {
        CH_STATE.fixtureId = mList[0].id;
      }
    } else {
      if (CH_STATE.kind === "national_extended" || CH_STATE.kind === "national_final") {
        CH_STATE.kind = "poster";
      }
      const cBlock = compOpts[CH_STATE.comp] || { rounds: [], months: [], fixtures: [] };
      if (cBlock.fixtures?.length && !cBlock.fixtures.some((x: any) => x.id === CH_STATE.fixtureId)) {
        CH_STATE.fixtureId = cBlock.fixtures[0].id;
      }
      if (cBlock.rounds?.length && !cBlock.rounds.includes(CH_STATE.round)) {
        CH_STATE.round = cBlock.rounds[cBlock.rounds.length - 1];
      }
      if (cBlock.months?.length && !cBlock.months.some((x: any) => x.id === CH_STATE.month)) {
        CH_STATE.month = cBlock.months[cBlock.months.length - 1].id;
      }
    }
  };
  syncCompSelections();

  const drawShell = () => {
    const mskClock = `${String(mskNow.hour).padStart(2, "0")}:${String(mskNow.minute).padStart(2, "0")} МСК`;
    const isPersonalBot = selCfg?.id === "personal_bot";
    const visibleRules = RULE_LABELS.filter((r) => !r.forChannels || r.forChannels.includes(selCfg?.id));

    const curCompOpts = CH_STATE.comp === "national" ? (compOpts.national?.[CH_STATE.teamType] || {}) : (compOpts[CH_STATE.comp] || {});
    const allowedKinds = KIND_LABELS.filter((k) => !k.comps || k.comps.includes(CH_STATE.comp));

    let contextualControlsHtml = "";
    if (CH_STATE.kind === "poster") {
      const mList = curCompOpts.matches || curCompOpts.fixtures || [];
      contextualControlsHtml = `
        <div class="chn-field-grid">
          <div>
            <label class="chn-label">Матч для афиши</label>
            <select id="chn_fx_sel">
              ${mList.length ? mList.map((f: any) => `<option value="${escHtml(f.id)}" ${f.id === CH_STATE.fixtureId ? "selected" : ""}>${escHtml(f.label)}</option>`).join("") : `<option value="">Ближайший матч турнира</option>`}
            </select>
          </div>
          ${CH_STATE.comp === "national" ? `
            <div>
              <label class="chn-label">Команда сборной</label>
              <select id="chn_nt_type">
                <option value="main" ${CH_STATE.teamType === "main" ? "selected" : ""}>Основная сборная России</option>
                <option value="u21" ${CH_STATE.teamType === "u21" ? "selected" : ""}>Молодёжная сборная U21</option>
              </select>
            </div>
          ` : `
            <div>
              <label class="chn-label">Дата (МСК)</label>
              <input id="chn_date_inp" type="date" value="${escHtml(CH_STATE.date)}">
            </div>
          `}
        </div>
      `;
    } else if (CH_STATE.kind === "schedule") {
      contextualControlsHtml = `
        <div class="chn-field-grid">
          <div>
            <label class="chn-label">Дата игрового дня (МСК)</label>
            <input id="chn_date_inp" type="date" value="${escHtml(CH_STATE.date)}">
          </div>
          ${CH_STATE.comp !== "national" ? `
            <div>
              <label class="chn-label">Или выбрать тур (если на дату матчей нет)</label>
              <select id="chn_round_sel">
                <option value="">По дате / ближайший тур</option>
                ${(curCompOpts.rounds || []).map((r: string) => `<option value="${escHtml(r)}" ${r === CH_STATE.round ? "selected" : ""}>${escHtml(r)}</option>`).join("")}
              </select>
            </div>
          ` : ""}
        </div>
      `;
    } else if (CH_STATE.kind === "team_round") {
      const rounds = curCompOpts.rounds || [];
      contextualControlsHtml = `
        <div>
          <label class="chn-label">Завершённый тур</label>
          <select id="chn_round_sel">
            ${rounds.length ? rounds.map((r: string) => `<option value="${escHtml(r)}" ${r === CH_STATE.round ? "selected" : ""}>${escHtml(r)}</option>`).join("") : `<option value="">Последний тур</option>`}
          </select>
        </div>
      `;
    } else if (CH_STATE.kind === "team_month") {
      const months = curCompOpts.months || [];
      contextualControlsHtml = `
        <div>
          <label class="chn-label">Месяц сезона</label>
          <select id="chn_month_sel">
            ${months.length ? months.map((m: any) => `<option value="${escHtml(m.id)}" ${m.id === CH_STATE.month ? "selected" : ""}>${escHtml(m.label)}</option>`).join("") : `<option value="">Текущий месяц</option>`}
          </select>
        </div>
      `;
    } else if (CH_STATE.kind === "national_extended" || CH_STATE.kind === "national_final") {
      contextualControlsHtml = `
        <div class="chn-field-grid">
          <div>
            <label class="chn-label">Команда</label>
            <select id="chn_nt_type">
              <option value="main" ${CH_STATE.teamType === "main" ? "selected" : ""}>Основная сборная России (${compOpts.national?.main?.extendedCount || 0} / ${compOpts.national?.main?.finalCount || 0})</option>
              <option value="u21" ${CH_STATE.teamType === "u21" ? "selected" : ""}>Молодёжная U21 (${compOpts.national?.u21?.extendedCount || 0} / ${compOpts.national?.u21?.finalCount || 0})</option>
            </select>
          </div>
          <div>
            <label class="chn-label">Активный сбор</label>
            <input type="text" readonly value="${escHtml(compOpts.national?.[CH_STATE.teamType]?.title || "Текущий сбор")}">
          </div>
        </div>
      `;
    }

    const activeRoutedNames = (CH_STATE.previewData?.routedChannels || [])
      .map((id: ChannelId) => channels.find((c) => c.id === id)?.name || id);

    ab.innerHTML = `
      <div class="chn-root">
        <div class="chn-hero">
          <div>
            <div class="chn-eyebrow">ВЕЩАТЕЛЬНАЯ СТУДИЯ TELEGRAM · РПЛ / ФНЛ / КУБОК / СБОРНАЯ</div>
            <h2 class="chn-hero-title">Управление каналами и автопубликациями</h2>
            <div class="chn-hero-sub">
              <b>Матч ТВ</b> публикует эфир по всем турнирам. Профильные каналы <b>РПЛ</b>, <b>ФНЛ</b>, <b>Кубка России</b> и <b>Сборной России</b> получают только свой турнир. В <b>00:01 МСК</b> выходит расписание матчей дня, после туров — таблица и сборные, а составы сборной — сразу после публикации.
            </div>
          </div>
          <div class="chn-hero-right">
            <div class="chn-metric">
              <div class="chn-metric-lbl">Время эфира</div>
              <div class="chn-metric-val">${escHtml(mskClock)}</div>
            </div>
            <div class="chn-metric">
              <div class="chn-metric-lbl">Каналы в эфире</div>
              <div class="chn-metric-val">${activeChannelCount} / 5</div>
            </div>
            <div class="chn-metric">
              <div class="chn-metric-lbl">Личный бот</div>
              <div class="chn-metric-val">${botStats.activeUsers} чел.</div>
            </div>
            <button type="button" class="chn-btn-studio" id="chn_run_midnight_now">⚡ 00:01 рассылка сейчас</button>
            <button type="button" class="chn-btn-studio dark" id="chn_refresh_all">Обновить</button>
          </div>
        </div>

        <div class="chn-cards-grid">
          ${channels.map((c) => {
            const isBot = c.id === "personal_bot";
            const ready = isBot ? (c.enabled && c.hasToken) : (c.enabled && !!c.effectiveChatId && c.hasToken);
            const dotColor = !c.enabled ? "#94a3b8" : ready ? "#16a34a" : "#f59e0b";
            const activeRulesCnt = Object.values(c.rules || {}).filter(Boolean).length;
            const chatPreview = isBot
              ? (c.botUsername || "@RPLVIRT_bot")
              : (c.effectiveChatId || "Chat ID не задан");
            return `
              <button type="button" class="chn-card ${c.id === CH_STATE.selectedChannel ? "on" : ""}" data-chn-select="${escHtml(c.id)}" style="--chn-accent:${escHtml(c.accent)}">
                <div class="chn-card-top">
                  <span class="chn-card-code">${escHtml(c.badgeText)}</span>
                  <span class="chn-status-dot" style="background:${dotColor}" title="${ready ? "Готов к эфиру" : c.enabled ? "Требуется Chat ID / токен" : "Отключён"}"></span>
                </div>
                <div class="chn-card-name">${escHtml(c.name)}</div>
                <div class="chn-card-chat">${escHtml(chatPreview)}</div>
                <div class="chn-card-meta">
                  <span>${isBot ? `Пользователей: ${botStats.totalUsers}` : (c.usesGlobalChat ? "Общий чат" : c.effectiveChatId ? "Подключён" : "Настроить")}</span>
                  <span>Правил: ${activeRulesCnt}</span>
                </div>
              </button>
            `;
          }).join("")}
        </div>

        <div class="chn-studio-split">
          <!-- Левая колонка: Настройки выбранного канала -->
          <div class="chn-panel">
            <div class="chn-panel-head">
              <div>
                <h3 class="chn-panel-title">${escHtml(selCfg.name)}</h3>
                <div class="chn-panel-sub">${escHtml(selCfg.subtitle)}</div>
              </div>
              <label style="display:flex;align-items:center;gap:7px;font-size:13px;font-weight:700;cursor:pointer;margin:0;white-space:nowrap">
                <input type="checkbox" id="chn_cfg_enabled" ${selCfg.enabled ? "checked" : ""} style="width:auto;margin:0">
                Канал включён
              </label>
            </div>

            ${isPersonalBot ? `
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:11px;padding:12px 14px;display:flex;flex-direction:column;gap:8px">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
                  <div>
                    <div style="font:700 13.5px Unbounded,sans-serif;color:#14532d">Игровой Mini App бот</div>
                    <div style="font-size:12px;color:#166534;margin-top:2px">Подключено игроков: <b>${botStats.totalUsers}</b> · с клубом: <b>${botStats.clubUsers}</b> · активных: <b>${botStats.activeUsers}</b></div>
                  </div>
                  <button type="button" class="btn sm" id="chn_goto_bot_msg">✉️ Открыть рассылку в бот</button>
                </div>
              </div>
            ` : ""}

            <div class="chn-field-grid">
              <div>
                <label class="chn-label">${isPersonalBot ? "Username бота (@bot)" : "@username канала или Chat ID (-100...)"}</label>
                <input id="chn_cfg_chat" type="text" value="${escHtml(isPersonalBot ? (selCfg.botUsername || "@RPLVIRT_bot") : (selCfg.chatId || ""))}" placeholder="${isPersonalBot ? "@RPLVIRT_bot" : (selCfg.id === "matchtv" ? (data.globalConfig?.globalChat || "@matchtv_rpl") : `@${selCfg.id}_virt`)}">
                ${selCfg.id === "matchtv" && !selCfg.chatId && selCfg.effectiveChatId ? `<div class="small muted" style="margin-top:4px">Сейчас используется общий канал из Настроек: <b>${escHtml(selCfg.effectiveChatId)}</b></div>` : ""}
              </div>
              <div>
                <label class="chn-label">Отдельный токен бота (необязательно)</label>
                <div style="display:flex;gap:6px">
                  <input id="chn_cfg_token" type="password" value="${escHtml(selCfg.tokenMasked || "")}" placeholder="${data.globalConfig?.hasGlobalToken ? "Используется общий токен" : "123456:ABC..."}" autocomplete="new-password" style="flex:1">
                  ${selCfg.tokenMasked ? `<button type="button" class="btn alt sm" id="chn_cfg_clear_tok" title="Сбросить на общий токен">✕</button>` : ""}
                </div>
              </div>
            </div>

            <div>
              <div class="chn-label" style="margin-bottom:8px">${isPersonalBot ? "Автоматические рассылки игрокам в личный бот" : "Правила автоматических публикаций"}</div>
              <div class="chn-rules-list">
                ${visibleRules.map((r) => `
                  <label class="chn-rule-row">
                    <input type="checkbox" data-chn-rule="${escHtml(r.key)}" ${selCfg.rules?.[r.key] ? "checked" : ""}>
                    <div>
                      <div class="chn-rule-name">${escHtml(r.title)}</div>
                      <div class="chn-rule-desc">${escHtml(r.desc)}</div>
                    </div>
                  </label>
                `).join("")}
              </div>
            </div>

            <div class="row sp" style="flex-wrap:wrap;gap:8px;padding-top:6px;border-top:1px solid #f1f5f9">
              <button type="button" class="btn alt" id="chn_cfg_test">📡 Проверить связь</button>
              <button type="button" class="btn" id="chn_cfg_save">Сохранить настройки</button>
            </div>
          </div>

          <!-- Правая колонка: Студия графики, превью поста и ручная публикация -->
          <div class="chn-panel">
            <div class="chn-panel-head">
              <div>
                <h3 class="chn-panel-title">Студия афиш и предпросмотр поста</h3>
                <div class="chn-panel-sub">Генерация HD-постера и моментальная публикация в выбранные каналы</div>
              </div>
              <button type="button" class="btn alt sm" id="chn_reload_preview">↻ Обновить графику</button>
            </div>

            <div>
              <div class="chn-label">Турнир</div>
              <div class="chn-comp-bar">
                ${[
                  ["rpl", "РПЛ"],
                  ["fnl", "ФНЛ"],
                  ["cup", "Кубок России"],
                  ["national", "Сборная России"],
                ].map(([cid, cname]) => `<button type="button" class="chn-comp-btn ${CH_STATE.comp === cid ? "on" : ""}" data-chn-comp="${cid}">${cname}</button>`).join("")}
              </div>
            </div>

            <div>
              <div class="chn-label">Формат публикации</div>
              <div class="chn-kind-grid">
                ${allowedKinds.map((k) => `<button type="button" class="chn-kind-btn ${CH_STATE.kind === k.id ? "on" : ""}" data-chn-kind="${k.id}">${k.label}</button>`).join("")}
              </div>
            </div>

            ${contextualControlsHtml}

            <div class="chn-tg-mockup">
              <div class="chn-tg-topbar">
                <div class="chn-tg-chan">
                  <div class="chn-tg-ava" style="background:${escHtml(channels.find((c) => c.id === CH_STATE.comp || (CH_STATE.comp === "national" && c.id === "national"))?.accent || "#dc2626")}">ТВ</div>
                  <div>
                    <div style="font:700 13px Unbounded,sans-serif;color:#fff">${escHtml(CH_STATE.previewData?.title || "Предпросмотр поста")}</div>
                    <div style="font-size:11.5px;color:#94a3b8">${activeRoutedNames.length ? `Авто-эфир: ${escHtml(activeRoutedNames.join(" · "))}` : "Настройте каналы для авто-эфира"}</div>
                  </div>
                </div>
                ${CH_STATE.previewData?.imageDataUrl ? `<a class="btn alt sm" href="${CH_STATE.previewData.imageDataUrl}" download="broadcast_${CH_STATE.comp}_${CH_STATE.kind}.png" style="color:#fff;border-color:rgba(255,255,255,0.22);background:rgba(255,255,255,0.08)">Скачать PNG</a>` : ""}
              </div>

              <div class="chn-tg-bubble">
                <div class="chn-tg-img-wrap" id="chn_preview_img_box">
                  ${CH_STATE.previewLoading
                    ? `<div style="color:#94a3b8;font-size:13px;padding:40px">Рендер HD-афиши...</div>`
                    : CH_STATE.previewError
                      ? `<div style="color:#fca5a5;font-size:13px;padding:24px;text-align:center">${escHtml(CH_STATE.previewError)}</div>`
                      : CH_STATE.previewData?.imageDataUrl
                        ? `<img src="${CH_STATE.previewData.imageDataUrl}" alt="Broadcast Poster">`
                        : `<div style="color:#94a3b8;font-size:13px;padding:40px">Нажмите «Обновить графику»</div>`}
                </div>
                ${CH_STATE.previewData?.htmlText ? `<div class="chn-tg-caption">${CH_STATE.previewData.htmlText}</div>` : ""}
              </div>
            </div>

            <div style="display:flex;flex-direction:column;gap:8px;padding-top:4px;border-top:1px solid #f1f5f9">
              <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
                <label style="display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;cursor:pointer;margin:0">
                  <input type="checkbox" id="chn_pub_auto" ${CH_STATE.useAutoTargets ? "checked" : ""} style="width:auto;margin:0">
                  Авто-маршрутизация (Матч ТВ + профильный канал)
                </label>
                <button type="button" class="chn-btn-studio" id="chn_pub_now">📢 Опубликовать сейчас</button>
              </div>
              ${!CH_STATE.useAutoTargets ? `
                <div style="display:flex;flex-wrap:wrap;gap:8px;padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px">
                  ${channels.map((c) => `
                    <label style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;cursor:pointer;margin:0">
                      <input type="checkbox" data-chn-manual-target="${escHtml(c.id)}" ${CH_STATE.manualTargets.includes(c.id) ? "checked" : ""} style="width:auto;margin:0">
                      ${escHtml(c.name)}
                    </label>
                  `).join("")}
                </div>
              ` : ""}
            </div>
          </div>
        </div>

        <!-- Секция 00:01 МСК очереди -->
        <div class="chn-panel">
          <div class="chn-panel-head">
            <div>
              <h3 class="chn-panel-title">Очередь 00:01 МСК · Матчи на сегодня (${escHtml(mskNow.dateStr)})</h3>
              <div class="chn-panel-sub">Расписание матчей дня автоматически выходит в 00:01 МСК для РПЛ, ФНЛ, Кубка и Сборной</div>
            </div>
            <div class="row" style="gap:8px;flex-wrap:wrap">
              <input id="chn_mid_date" type="date" value="${escHtml(CH_STATE.midnightDate)}" style="width:auto">
              <button type="button" class="btn sm" id="chn_mid_dispatch_date">Отправить на выбранную дату</button>
            </div>
          </div>
          <div class="chn-midnight-grid">
            ${(data.nextMidnightPreview || []).map((item: any) => `
              <div class="chn-mid-card">
                <div class="chn-mid-top">
                  <span class="chn-mid-name">${escHtml(item.title)}</span>
                  <span class="chn-mid-cnt">${item.todayCount}</span>
                </div>
                <div style="font-size:11.5px;font-weight:700;color:${item.sentToday ? "#15803d" : item.todayCount ? "#b45309" : "#64748b"}">
                  ${item.sentToday ? "✓ Отправлено сегодня" : item.todayCount ? "Ожидает / готово к отправке" : "Матчей сегодня нет"}
                </div>
                <div class="chn-mid-list">
                  ${(item.matches || []).length
                    ? item.matches.map((m: any) => `<div><b>${escHtml(m.time)}</b> · ${escHtml(m.pair)}</div>`).join("")
                    : `<span class="muted">Свободный день в календаре</span>`}
                </div>
                ${item.todayCount > 0 ? `<button type="button" class="btn alt sm" data-chn-mid-comp="${escHtml(item.comp)}">Отправить ${escHtml(item.title)}</button>` : ""}
              </div>
            `).join("")}
          </div>
        </div>

        <!-- Журнал отправок -->
        <div class="chn-panel">
          <div class="chn-panel-head">
            <div>
              <h3 class="chn-panel-title">Журнал эфиров и доставок (${(data.logs || []).length})</h3>
              <div class="chn-panel-sub">История отправленных афиш, расписаний, таблиц и сообщений по каналам</div>
            </div>
            ${(data.logs || []).length ? `<button type="button" class="btn alt sm" id="chn_clear_logs">Очистить журнал</button>` : ""}
          </div>
          ${(data.logs || []).length ? `
            <div class="wrap">
              <table style="font-size:12.5px">
                <thead>
                  <tr>
                    <th class="l">Время (МСК)</th>
                    <th class="l">Канал</th>
                    <th class="l">Турнир</th>
                    <th class="l">Формат</th>
                    <th class="l">Статус</th>
                    <th class="l">Содержание</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.logs.map((l: any) => `
                    <tr>
                      <td class="l" style="white-space:nowrap">${escHtml(formatMskTimeFromEpoch(l.at))}</td>
                      <td class="l"><b>${escHtml(l.channelName || l.channelId)}</b></td>
                      <td class="l">${escHtml(String(l.comp || "").toUpperCase())}</td>
                      <td class="l" style="white-space:nowrap">${l.hasPhoto ? "🖼️ PNG + " : ""}${escHtml(l.kind)}</td>
                      <td class="l" style="white-space:nowrap;font-weight:700;color:${l.ok ? "#15803d" : "#dc2626"}">${l.ok ? "Доставлено" : `Ошибка: ${escHtml(l.error || "—")}`}</td>
                      <td class="l" style="max-width:380px">${escHtml(l.preview || "")}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          ` : `<div class="empty">Публикаций через каналы пока не было</div>`}
        </div>
      </div>
    `;

    bindEvents();
  };

  const loadPreview = async () => {
    CH_STATE.previewLoading = true;
    CH_STATE.previewError = "";
    drawShell();
    try {
      const qs = new URLSearchParams({
        kind: CH_STATE.kind,
        comp: CH_STATE.comp,
        teamType: CH_STATE.teamType,
        date: CH_STATE.date || mskNow.dateStr,
      });
      if (CH_STATE.fixtureId) qs.set("fixtureId", CH_STATE.fixtureId);
      if (CH_STATE.round) qs.set("round", CH_STATE.round);
      if (CH_STATE.month) qs.set("month", CH_STATE.month);
      const res = await api(`/admin/channels/preview?${qs.toString()}`);
      CH_STATE.previewData = res;
      CH_STATE.previewError = "";
    } catch (err: any) {
      CH_STATE.previewError = String(err?.message || err);
    } finally {
      CH_STATE.previewLoading = false;
      drawShell();
    }
  };

  function bindEvents() {
    ab.querySelectorAll<HTMLElement>("[data-chn-select]").forEach((btn) => {
      btn.onclick = () => {
        CH_STATE.selectedChannel = btn.dataset.chnSelect as ChannelId;
        renderAdminChannelsTab(ab, _ov, onRefreshAdmin);
      };
    });

    const gotoBot = ab.querySelector<HTMLButtonElement>("#chn_goto_bot_msg");
    if (gotoBot) {
      gotoBot.onclick = () => {
        const botTabBtn = document.querySelector<HTMLButtonElement>('[data-a="bot_msg"]');
        if (botTabBtn) botTabBtn.click();
      };
    }

    const refreshBtn = ab.querySelector<HTMLButtonElement>("#chn_refresh_all");
    if (refreshBtn) refreshBtn.onclick = () => renderAdminChannelsTab(ab, _ov, onRefreshAdmin);

    const clearTokBtn = ab.querySelector<HTMLButtonElement>("#chn_cfg_clear_tok");
    if (clearTokBtn) {
      clearTokBtn.onclick = async () => {
        const r = await act(() => api("/admin/channels/save", { id: selCfg.id, clearToken: true }), "Токен сброшен на общий");
        if (r) renderAdminChannelsTab(ab, _ov, onRefreshAdmin);
      };
    }

    const collectChannelPayload = () => {
      const enabled = !!(ab.querySelector<HTMLInputElement>("#chn_cfg_enabled")?.checked);
      const chatVal = String(ab.querySelector<HTMLInputElement>("#chn_cfg_chat")?.value || "").trim();
      const tokenVal = String(ab.querySelector<HTMLInputElement>("#chn_cfg_token")?.value || "").trim();
      const rules: Record<string, boolean> = {};
      ab.querySelectorAll<HTMLInputElement>("[data-chn-rule]").forEach((cb) => {
        const k = cb.dataset.chnRule;
        if (k) rules[k] = cb.checked;
      });
      const payload: any = { id: selCfg.id, enabled, rules };
      if (selCfg.id === "personal_bot") payload.botUsername = chatVal;
      else payload.chatId = chatVal;
      if (tokenVal && !tokenVal.includes("•")) payload.token = tokenVal;
      return payload;
    };

    const saveBtn = ab.querySelector<HTMLButtonElement>("#chn_cfg_save");
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const payload = collectChannelPayload();
        const r = await act(() => api("/admin/channels/save", payload), (d) => d?.message || "Сохранено");
        if (r) {
          await renderAdminChannelsTab(ab, _ov, onRefreshAdmin);
          onRefreshAdmin();
        }
      };
    }

    const testBtn = ab.querySelector<HTMLButtonElement>("#chn_cfg_test");
    if (testBtn) {
      testBtn.onclick = async () => {
        const chatVal = String(ab.querySelector<HTMLInputElement>("#chn_cfg_chat")?.value || "").trim();
        const tokenVal = String(ab.querySelector<HTMLInputElement>("#chn_cfg_token")?.value || "").trim();
        await act(
          () => api("/admin/channels/test", { id: selCfg.id, chatId: chatVal, token: tokenVal }),
          (d) => d?.message || "Проверка пройдена"
        );
        renderAdminChannelsTab(ab, _ov, onRefreshAdmin);
      };
    }

    ab.querySelectorAll<HTMLElement>("[data-chn-comp]").forEach((btn) => {
      btn.onclick = () => {
        CH_STATE.comp = btn.dataset.chnComp as any;
        syncCompSelections();
        loadPreview();
      };
    });

    ab.querySelectorAll<HTMLElement>("[data-chn-kind]").forEach((btn) => {
      btn.onclick = () => {
        CH_STATE.kind = btn.dataset.chnKind as PreviewKind;
        loadPreview();
      };
    });

    const fxSel = ab.querySelector<HTMLSelectElement>("#chn_fx_sel");
    if (fxSel) fxSel.onchange = () => { CH_STATE.fixtureId = fxSel.value; loadPreview(); };

    const ntSel = ab.querySelector<HTMLSelectElement>("#chn_nt_type");
    if (ntSel) ntSel.onchange = () => { CH_STATE.teamType = ntSel.value === "u21" ? "u21" : "main"; syncCompSelections(); loadPreview(); };

    const roundSel = ab.querySelector<HTMLSelectElement>("#chn_round_sel");
    if (roundSel) roundSel.onchange = () => { CH_STATE.round = roundSel.value; loadPreview(); };

    const monthSel = ab.querySelector<HTMLSelectElement>("#chn_month_sel");
    if (monthSel) monthSel.onchange = () => { CH_STATE.month = monthSel.value; loadPreview(); };

    const dateInp = ab.querySelector<HTMLInputElement>("#chn_date_inp");
    if (dateInp) dateInp.onchange = () => { CH_STATE.date = dateInp.value; loadPreview(); };

    const reloadBtn = ab.querySelector<HTMLButtonElement>("#chn_reload_preview");
    if (reloadBtn) reloadBtn.onclick = () => loadPreview();

    const autoCb = ab.querySelector<HTMLInputElement>("#chn_pub_auto");
    if (autoCb) {
      autoCb.onchange = () => {
        CH_STATE.useAutoTargets = autoCb.checked;
        drawShell();
      };
    }

    ab.querySelectorAll<HTMLInputElement>("[data-chn-manual-target]").forEach((cb) => {
      cb.onchange = () => {
        const id = cb.dataset.chnManualTarget as ChannelId;
        if (!id) return;
        if (cb.checked) {
          if (!CH_STATE.manualTargets.includes(id)) CH_STATE.manualTargets.push(id);
        } else {
          CH_STATE.manualTargets = CH_STATE.manualTargets.filter((x) => x !== id);
        }
      };
    });

    const pubNowBtn = ab.querySelector<HTMLButtonElement>("#chn_pub_now");
    if (pubNowBtn) {
      pubNowBtn.onclick = async () => {
        const body: any = {
          kind: CH_STATE.kind,
          comp: CH_STATE.comp,
          round: CH_STATE.round,
          month: CH_STATE.month,
          fixtureId: CH_STATE.fixtureId,
          date: CH_STATE.date || mskNow.dateStr,
          teamType: CH_STATE.teamType,
        };
        if (!CH_STATE.useAutoTargets) {
          if (!CH_STATE.manualTargets.length) return toast("Выберите хотя бы один канал для публикации", true);
          body.targets = CH_STATE.manualTargets;
        }
        const r = await act(() => api("/admin/channels/publish", body), (d) => d?.message || "Опубликовано");
        if (r) renderAdminChannelsTab(ab, _ov, onRefreshAdmin);
      };
    }

    const runMidNow = ab.querySelector<HTMLButtonElement>("#chn_run_midnight_now");
    if (runMidNow) {
      runMidNow.onclick = async () => {
        const r = await act(() => api("/admin/channels/run-midnight", { date: mskNow.dateStr, force: true }), (d) => d?.message || "Выполнено");
        if (r) renderAdminChannelsTab(ab, _ov, onRefreshAdmin);
      };
    }

    const midDateInp = ab.querySelector<HTMLInputElement>("#chn_mid_date");
    if (midDateInp) midDateInp.onchange = () => { CH_STATE.midnightDate = midDateInp.value; };

    const midDispatchBtn = ab.querySelector<HTMLButtonElement>("#chn_mid_dispatch_date");
    if (midDispatchBtn) {
      midDispatchBtn.onclick = async () => {
        const dStr = CH_STATE.midnightDate || mskNow.dateStr;
        const r = await act(() => api("/admin/channels/run-midnight", { date: dStr, force: true }), (d) => d?.message || "Выполнено");
        if (r) renderAdminChannelsTab(ab, _ov, onRefreshAdmin);
      };
    }

    ab.querySelectorAll<HTMLButtonElement>("[data-chn-mid-comp]").forEach((btn) => {
      btn.onclick = async () => {
        const c = btn.dataset.chnMidComp;
        const r = await act(() => api("/admin/channels/run-midnight", { date: mskNow.dateStr, comp: c, force: true }), (d) => d?.message || "Выполнено");
        if (r) renderAdminChannelsTab(ab, _ov, onRefreshAdmin);
      };
    });

    const clearLogsBtn = ab.querySelector<HTMLButtonElement>("#chn_clear_logs");
    if (clearLogsBtn) {
      clearLogsBtn.onclick = async () => {
        const r = await act(() => api("/admin/channels/clear-logs", {}), "Журнал очищен");
        if (r) renderAdminChannelsTab(ab, _ov, onRefreshAdmin);
      };
    }
  }

  drawShell();
  if (!CH_STATE.previewData && !CH_STATE.previewLoading) {
    void loadPreview();
  }
}

window.__RPL_CHANNELS__ = {
  renderAdminChannelsTab,
};
