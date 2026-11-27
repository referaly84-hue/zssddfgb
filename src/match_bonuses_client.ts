/* Модуль предматчевых премиальных команде и индивидуальных премий игрокам */

declare global {
  interface Window {
    __RPL_BONUSES__?: {
      mountBonusEditor: (
        container: HTMLElement,
        opts: {
          fixture: any;
          clubData: any;
          players: any[];
          startersSet?: Set<string>;
          benchSet?: Set<string>;
          onChange?: () => void;
          onLockChange?: () => void;
        }
      ) => {
        getPayload: () => any;
        updateSets: (starters: string[], bench: string[]) => void;
        applyLockUi: () => void;
        isLocked: () => boolean;
      };
      openBonusModal: (opts: {
        fixture: any;
        clubData: any;
        withT: (o: any) => any;
        api: (url: string, body?: any) => Promise<any>;
        act: (fn: () => Promise<any>, msg?: string) => Promise<any>;
        toast: (msg: string, err?: any) => void;
        onSaved: () => void;
      }) => void;
      renderSettledBonusesHtml: (clubData: any, esc: (s: any) => string) => string;
    };
  }
}

function escHtml(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtEur(n: number): string {
  const v = Math.round(Number(n || 0));
  return v < 0 ? "-€" + Math.abs(v).toLocaleString("ru-RU") : "€" + v.toLocaleString("ru-RU");
}

function fmtCompactEur(n: number): string {
  const v = Math.round(Number(n || 0));
  if (v >= 1000000) {
    const m = v / 1000000;
    return `€${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (v >= 1000) return `€${Math.round(v / 1000)}k`;
  return `€${v}`;
}

function ensureBonusStyles() {
  if (typeof document === "undefined") return;
  let st = document.getElementById("rpl_bonuses_styles") as HTMLStyleElement | null;
  if (!st) {
    st = document.createElement("style");
    st.id = "rpl_bonuses_styles";
    document.head.appendChild(st);
  }
  st.textContent = `
    .mb-card{
      margin:14px 0;
      padding:14px 16px;
      border-radius:12px;
      border:1px solid #d7e3d9;
      background:linear-gradient(180deg,#fafdfb 0%,#f3f8f4 100%);
    }
    .mb-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
    .mb-title{font-weight:800;font-size:14px;color:var(--deep);display:flex;align-items:center;gap:7px}
    .mb-budget-pill{font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;background:#fff;border:1px solid var(--line);color:var(--ink);font-variant-numeric:tabular-nums}
    .mb-subcard{background:#fff;border:1px solid var(--line);border-radius:10px;padding:12px;margin-top:10px}
    .mb-presets{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
    .mb-chip{
      border:1px solid #cbd5e1;
      background:#f8fafc;
      color:#0f172a;
      border-radius:7px;
      padding:4px 9px;
      font-size:11.5px;
      font-weight:700;
      cursor:pointer;
      transition:all .12s;
    }
    .mb-chip:hover{border-color:var(--green);background:#eef7f0;color:var(--deep)}
    .mb-chip.on{background:var(--deep);border-color:var(--deep);color:#fff}
    .mb-player-row{
      display:flex;
      flex-direction:column;
      gap:8px;
      padding:10px;
      border:1px dashed #cbd5e1;
      border-radius:9px;
      background:#fcfefd;
      margin-top:8px;
    }
    .mb-player-grid{display:grid;grid-template-columns:1.25fr 1.1fr 0.75fr auto;gap:8px;align-items:center}
    @media(max-width:760px){.mb-player-grid{grid-template-columns:1fr}}
    .mb-summary{
      margin-top:12px;
      padding:10px 12px;
      border-radius:9px;
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:10px;
      flex-wrap:wrap;
      font-size:12.5px;
    }
    .mb-modal-backdrop{
      position:fixed;inset:0;background:rgba(15,23,42,.56);z-index:9999;
      display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;
    }
    .mb-modal{
      background:#fff;border-radius:14px;max-width:780px;width:100%;max-height:90vh;overflow-y:auto;
      padding:18px 20px;box-shadow:0 24px 60px rgba(0,0,0,.28);border:1px solid var(--line);
    }
    .mb-lock-banner{
      margin:8px 0 4px;
      padding:8px 12px;
      border-radius:8px;
      border:1px solid #fecaca;
      background:#fef2f2;
      color:#991b1b;
      font-size:12.5px;
      font-weight:600;
    }
  `;
}

const MATCH_BONUS_LOCK_BEFORE_MS = 10 * 60 * 1000;

function getClientBonusLockInfo(f: any, nowMs = Date.now()) {
  if (!f || (f.status && f.status !== "scheduled")) {
    return {
      locked: true,
      lockAt: f?.lineupLockAt ?? null,
      kickoffAt: f?.realStartAt ?? null,
      remainingToLockMs: 0,
    };
  }
  if (f?.hasRealSchedule === false) {
    return {
      locked: false,
      lockAt: null,
      kickoffAt: null,
      remainingToLockMs: Infinity,
    };
  }
  const hasExplicitDate = /^\d{4}-\d{2}-\d{2}$/.test(String(f.realDate || "").trim());
  if (!hasExplicitDate && !Number.isFinite(f?.lineupLockAt)) {
    return {
      locked: !!f?.lineupLocked,
      lockAt: null,
      kickoffAt: null,
      remainingToLockMs: Infinity,
    };
  }
  let kickoffAt: number | null = null;
  if (hasExplicitDate) {
    const rd = String(f.realDate).trim();
    const rt = String(f?.realTime || f?.time || "12:00").trim();
    const m = rt.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    const hhmmss = m ? `${m[1].padStart(2, "0")}:${m[2]}:${m[3] || "00"}` : "12:00:00";
    const parsed = Date.parse(`${rd}T${hhmmss}+03:00`);
    if (Number.isFinite(parsed)) kickoffAt = parsed;
  } else if (Number.isFinite(f?.realStartAt)) {
    kickoffAt = Number(f.realStartAt);
  }
  const lockAt = Number.isFinite(f?.lineupLockAt)
    ? Number(f.lineupLockAt)
    : kickoffAt !== null
      ? kickoffAt - MATCH_BONUS_LOCK_BEFORE_MS
      : null;
  if (lockAt === null) {
    return {
      locked: !!f?.lineupLocked,
      lockAt: null,
      kickoffAt,
      remainingToLockMs: Infinity,
    };
  }
  const locked = !!f?.lineupLocked || nowMs >= lockAt;
  return {
    locked,
    lockAt,
    kickoffAt,
    remainingToLockMs: Math.max(0, lockAt - nowMs),
  };
}

const DEFAULT_TEAM_CONDS = [
  { id: "win", label: "За победу в матче" },
  { id: "draw_or_win", label: "За не проигрыш (победа или ничья)" },
  { id: "win_2plus", label: "За уверенную победу (разница 2+ мяча)" },
  { id: "clean_sheet_win", label: "За «сухую» победу (0 пропущенных)" },
  { id: "score_2plus", label: "За 2+ забитых мяча командой" },
];

const DEFAULT_PLAYER_CONDS = [
  { id: "goal", label: "За забитый гол" },
  { id: "goal_or_assist", label: "За гол или голевую передачу" },
  { id: "assist", label: "За голевую передачу" },
  { id: "brace", label: "За дубль (2+ гола)" },
  { id: "clean_sheet", label: "За «сухой» матч (≥45 мин, 0 пропущенных)" },
  { id: "motm", label: "Лучший игрок матча (MOTM)" },
  { id: "high_rating", label: "Оценка за матч ≥ 7.5" },
  { id: "win_play", label: "За выход на поле в победном матче" },
];

function computeClientMotivationPreview(
  comp: string,
  teamEnabled: boolean,
  teamAmount: number,
  playerRows: Array<{ playerId: string; amount: number }>,
  startersSet?: Set<string>,
  benchSet?: Set<string>
) {
  const ref = comp === "rpl" || comp === "fnl" || comp === "cup" || comp === "supercup" ? 250000 : 35000;
  let teamMod = 0;
  if (teamEnabled && teamAmount > 0) {
    teamMod = Math.min(1.05, 0.22 + Math.log1p(teamAmount / ref) * 0.42);
  }
  let pMod = 0;
  const hasSets = startersSet && startersSet.size > 0;
  for (const r of playerRows) {
    if (!r.playerId || r.amount <= 0) continue;
    const w = !hasSets ? 1.0 : startersSet!.has(r.playerId) ? 1.0 : benchSet?.has(r.playerId) ? 0.45 : 0;
    if (w <= 0) continue;
    pMod += Math.min(0.22, 0.06 + Math.log1p(r.amount / (ref * 0.28)) * 0.08) * w;
  }
  pMod = Math.min(0.45, pMod);
  const totalMod = Math.min(1.35, teamMod + pMod);
  const pct = Math.min(100, Math.round((totalMod / 1.35) * 100));
  const label =
    pct >= 72
      ? "🔥 Запредельная мотивация"
      : pct >= 42
        ? "⚡ Высокая мотивация"
        : pct > 0
          ? "📈 Повышенный настрой"
          : "Стандартный настрой";
  return { pct, label, active: pct > 0 };
}

function mountBonusEditor(
  container: HTMLElement,
  opts: {
    fixture: any;
    clubData: any;
    players: any[];
    startersSet?: Set<string>;
    benchSet?: Set<string>;
    onChange?: () => void;
    onLockChange?: () => void;
  }
) {
  ensureBonusStyles();
  const f = opts.fixture;
  const isLocked = () => getClientBonusLockInfo(f).locked;
  const c = opts.clubData || {};
  const bonusMeta = c.matchBonuses || {};
  const existing = bonusMeta.byFixtureId?.[f.id] || null;
  const teamConds = bonusMeta.conditions?.team || DEFAULT_TEAM_CONDS;
  const playerConds = bonusMeta.conditions?.player || DEFAULT_PLAYER_CONDS;
  const comp = String(c.team?.comp || f.comp || "rpl");
  const isTopBonusComp = comp === "rpl" || comp === "fnl" || comp === "cup" || comp === "supercup";
  const presets = bonusMeta.presets || {
    teamPresets: isTopBonusComp ? [50000, 150000, 300000, 500000, 1000000] : [20000, 50000, 100000, 200000],
    playerPresets: isTopBonusComp ? [15000, 30000, 50000, 100000, 200000] : [5000, 15000, 25000, 50000],
    minTeam: isTopBonusComp ? 5000 : 1000,
    minPlayer: isTopBonusComp ? 1000 : 500,
  };

  const totalClubBudget = Math.max(0, Number(c.budget ?? c.team?.budget ?? 0));
  const totalCommittedAll = Number(bonusMeta.committedTotal || 0);
  const prevThisMatch = Number(existing?.maxPotentialPayout || 0);
  const committedOther = Math.max(0, totalCommittedAll - prevThisMatch);
  const availableBudget = Math.max(0, totalClubBudget - committedOther);

  let startersSet = opts.startersSet || new Set<string>();
  let benchSet = opts.benchSet || new Set<string>();

  const state = {
    teamEnabled: !!(existing?.teamBonus?.enabled && Number(existing?.teamBonus?.amount || 0) > 0),
    teamCondition: existing?.teamBonus?.condition || "win",
    teamAmount: Number(existing?.teamBonus?.amount || presets.teamPresets[1] || 150000),
    motivationNote: String(existing?.teamBonus?.motivationNote || ""),
    playerBonuses: Array.isArray(existing?.playerBonuses)
      ? existing.playerBonuses.map((x: any) => ({
          id: x.id || Math.random().toString(36).slice(2, 9),
          playerId: String(x.playerId || ""),
          condition: String(x.condition || "goal"),
          amount: Number(x.amount || presets.playerPresets[1] || 30000),
          note: String(x.note || ""),
        }))
      : [],
  };

  const playersSorted = [...(opts.players || [])].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "ru")
  );
  const playerById = new Map<string, any>();
  for (const p of playersSorted) playerById.set(p.id, p);

  const getPayload = () => ({
    teamBonus: {
      enabled: state.teamEnabled,
      condition: state.teamCondition,
      amount: state.teamEnabled ? Math.max(0, Math.round(Number(state.teamAmount || 0))) : 0,
      motivationNote: state.motivationNote.trim(),
    },
    playerBonuses: state.playerBonuses
      .filter((pb: any) => pb.playerId && Number(pb.amount || 0) > 0)
      .map((pb: any) => {
        const pObj = playerById.get(pb.playerId);
        return {
          id: pb.id,
          playerId: pb.playerId,
          playerName: pObj?.name || "",
          pos: pObj?.pos || "",
          condition: pb.condition,
          amount: Math.max(0, Math.round(Number(pb.amount || 0))),
          note: String(pb.note || "").trim(),
        };
      }),
  });

  const renderSummaryOnly = () => {
    const sumBox = container.querySelector("#mb_summary_box") as HTMLElement | null;
    if (!sumBox) return;
    const pSum = state.playerBonuses.reduce(
      (acc: number, x: any) => acc + (x.playerId ? Math.max(0, Math.round(Number(x.amount || 0))) : 0),
      0
    );
    const tSum = state.teamEnabled ? Math.max(0, Math.round(Number(state.teamAmount || 0))) : 0;
    const totalMax = tSum + pSum;
    const overBudget = totalMax > availableBudget;
    const mot = computeClientMotivationPreview(
      comp,
      state.teamEnabled,
      tSum,
      state.playerBonuses,
      startersSet,
      benchSet
    );

    sumBox.style.background = overBudget ? "#fef2f2" : mot.active ? "#eef7f0" : "#f8fafc";
    sumBox.style.border = overBudget
      ? "1px solid #fecaca"
      : mot.active
        ? "1px solid #bbf7d0"
        : "1px solid var(--line)";
    sumBox.style.color = overBudget ? "#991b1b" : mot.active ? "#166534" : "var(--muted)";

    sumBox.innerHTML = `
      <div>
        <b>Макс. выплата по этому матчу:</b> ${fmtEur(totalMax)}
        ${overBudget ? `<div style="font-size:11.5px;margin-top:2px;font-weight:700">⚠ Превышен доступный бюджет (${fmtEur(availableBudget)})! Уменьшите сумму премий.</div>` : `<div style="font-size:11.5px;margin-top:2px;opacity:.88">Деньги спишутся только после матча и только при выполнении условий.</div>`}
      </div>
      <div style="text-align:right">
        <span class="tag" style="font-weight:800;${mot.active ? "background:#fff;border-color:#86efac;color:#15803d" : ""}">${escHtml(mot.label)}${mot.active ? ` (${mot.pct}%)` : ""}</span>
      </div>
    `;
  };

  const render = () => {
    const tChips = (presets.teamPresets || [])
      .map(
        (v: number) =>
          `<button type="button" class="mb-chip mb-team-chip ${state.teamAmount === v ? "on" : ""}" data-val="${v}">${fmtCompactEur(v)}</button>`
      )
      .join("");

    const playerRowsHtml = state.playerBonuses
      .map((pb: any, idx: number) => {
        const pOpts = playersSorted
          .map((p) => {
            const stTag = startersSet.has(p.id) ? " [Старт]" : benchSet.has(p.id) ? " [Запас]" : "";
            const unavTag = p.available === false ? " [Недоступен]" : "";
            return `<option value="${escHtml(p.id)}" ${p.id === pb.playerId ? "selected" : ""}>${escHtml(p.pos || "?")} · ${escHtml(p.name)}${stTag}${unavTag}</option>`;
          })
          .join("");
        const cOpts = playerConds
          .map(
            (cd: any) =>
              `<option value="${escHtml(cd.id)}" ${cd.id === pb.condition ? "selected" : ""}>${escHtml(cd.label)}</option>`
          )
          .join("");
        const pChips = (presets.playerPresets || [])
          .map(
            (v: number) =>
              `<button type="button" class="mb-chip mb-p-chip ${pb.amount === v ? "on" : ""}" data-pidx="${idx}" data-val="${v}">${fmtCompactEur(v)}</button>`
          )
          .join("");
        return `
          <div class="mb-player-row" data-pidx="${idx}">
            <div class="mb-player-grid">
              <select class="mb-p-sel" data-pidx="${idx}">
                <option value="">— Выберите игрока —</option>
                ${pOpts}
              </select>
              <select class="mb-p-cond" data-pidx="${idx}">${cOpts}</select>
              <input type="number" min="${presets.minPlayer}" step="1000" class="mb-p-amt" data-pidx="${idx}" value="${pb.amount}" placeholder="Сумма €" style="font-weight:700">
              <button type="button" class="btn sm alt mb-p-del" data-pidx="${idx}" title="Удалить премию игроку" style="padding:5px 9px">✕</button>
            </div>
            <div class="mb-presets" style="align-items:center;justify-content:space-between;gap:8px">
              <div class="mb-presets" style="margin-top:0">${pChips}</div>
              <input type="text" class="mb-p-note" data-pidx="${idx}" value="${escHtml(pb.note || "")}" maxlength="200" placeholder="Личное напутствие игроку (необязательно, попадёт в установку)" style="flex:1;min-width:210px;font-size:12px;padding:5px 8px">
            </div>
          </div>
        `;
      })
      .join("");

    const canAddPlayer = state.playerBonuses.length < 6 && playersSorted.length > 0;

    container.innerHTML = `
      <div class="mb-card">
        <div class="mb-head">
          <div class="mb-title">💰 Премиальные команде и игрокам на матч</div>
          <div class="mb-budget-pill" title="Текущий баланс клуба за вычетом премиальных, обещанных на другие ближайшие матчи">
            Доступно: ${fmtEur(availableBudget)}${committedOther > 0 ? ` <span class="muted" style="font-weight:500">(резерв др. матчей: ${fmtEur(committedOther)})</span>` : ""}
          </div>
        </div>
        <div class="muted small" style="line-height:1.45">
          Обещанные премиальные передаются напрямую в сценарий матча (ИИ-промпт) и повышают боевую мотивацию команды и выбранных игроков. Средства списываются <b>только после финального свистка</b> и только если условие выполнено. <span id="mb_unlock_note">Настройка доступна не позднее чем за 10 минут до начала матча.</span>
        </div>
        <div id="mb_lock_banner" class="mb-lock-banner" style="display:none">🔒 До начала матча осталось менее 10 минут — настройка и изменение премиальных на матч уже закрыты.</div>

        <div class="mb-subcard">
          <label style="display:flex;align-items:center;gap:8px;margin:0;cursor:pointer;font-weight:700;font-size:13px">
            <input type="checkbox" id="mb_team_enabled" ${state.teamEnabled ? "checked" : ""} style="width:16px;height:16px;margin:0">
            <span>🏆 Обещать командные премиальные на весь состав</span>
          </label>
          <div id="mb_team_fields" style="margin-top:10px;${state.teamEnabled ? "" : "display:none"}">
            <div class="grid g2" style="gap:10px">
              <div>
                <label class="small" style="display:block;font-weight:600;margin-bottom:4px">Условие выплаты команде</label>
                <select id="mb_team_cond" style="width:100%">
                  ${teamConds.map((cd: any) => `<option value="${escHtml(cd.id)}" ${cd.id === state.teamCondition ? "selected" : ""}>${escHtml(cd.label)}</option>`).join("")}
                </select>
              </div>
              <div>
                <label class="small" style="display:block;font-weight:600;margin-bottom:4px">Сумма премии команде (€)</label>
                <input type="number" id="mb_team_amt" min="${presets.minTeam}" step="5000" value="${state.teamAmount}" style="width:100%;font-weight:800">
                <div class="mb-presets">${tChips}</div>
              </div>
            </div>
            <div style="margin-top:8px">
              <label class="small" style="display:block;font-weight:600;margin-bottom:4px">Слова руководства команде о премиальных (попадёт в промпт матча)</label>
              <input type="text" id="mb_team_note" value="${escHtml(state.motivationNote)}" maxlength="400" placeholder="Например: Ребята, заберём победу в дерби — двойная премия в раздевалке сразу после игры!" style="width:100%">
            </div>
          </div>
        </div>

        <div class="mb-subcard">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
            <div style="font-weight:700;font-size:13px">🎯 Индивидуальные премии игрокам (${state.playerBonuses.length}/6)</div>
            <button type="button" class="btn sm alt" id="mb_add_player" ${canAddPlayer ? "" : "disabled"} style="font-size:11.5px;padding:4px 10px">+ Добавить премию игроку</button>
          </div>
          <div class="muted small" style="margin-top:3px">Назначьте персональную мотивацию конкретным футболистам — за гол, ассист, сухой матч или звание лучшего игрока.</div>
          ${playerRowsHtml || `<div class="muted small" style="margin-top:8px;padding:8px 10px;background:#f8fafc;border-radius:7px">Индивидуальные премии пока не назначены.</div>`}
        </div>

        <div id="mb_summary_box" class="mb-summary"></div>
      </div>
    `;

    const applyLockUi = () => {
      const locked = isLocked();
      const banner = container.querySelector("#mb_lock_banner") as HTMLElement | null;
      if (banner) banner.style.display = locked ? "" : "none";
      const note = container.querySelector("#mb_unlock_note") as HTMLElement | null;
      if (note) note.style.display = locked ? "none" : "";
      if (!locked) return;
      container
        .querySelectorAll(
          "#mb_team_enabled, #mb_team_cond, #mb_team_amt, #mb_team_note, .mb-team-chip, #mb_add_player, .mb-p-sel, .mb-p-cond, .mb-p-amt, .mb-p-chip, .mb-p-note, .mb-p-del"
        )
        .forEach((el: any) => {
          el.disabled = true;
        });
    };

    const notifyChange = () => {
      renderSummaryOnly();
      if (opts.onChange) opts.onChange();
    };

    const chk = container.querySelector("#mb_team_enabled") as HTMLInputElement | null;
    chk?.addEventListener("change", () => {
      if (isLocked()) {
        chk.checked = state.teamEnabled;
        applyLockUi();
        return;
      }
      state.teamEnabled = !!chk.checked;
      const tf = container.querySelector("#mb_team_fields") as HTMLElement | null;
      if (tf) tf.style.display = state.teamEnabled ? "" : "none";
      notifyChange();
    });

    const tCond = container.querySelector("#mb_team_cond") as HTMLSelectElement | null;
    tCond?.addEventListener("change", () => {
      if (isLocked()) {
        tCond.value = state.teamCondition;
        applyLockUi();
        return;
      }
      state.teamCondition = tCond.value;
      notifyChange();
    });

    const tAmt = container.querySelector("#mb_team_amt") as HTMLInputElement | null;
    tAmt?.addEventListener("input", () => {
      if (isLocked()) {
        tAmt.value = String(state.teamAmount);
        applyLockUi();
        return;
      }
      state.teamAmount = Math.max(0, Math.round(Number(tAmt.value || 0)));
      container.querySelectorAll(".mb-team-chip").forEach((b: any) => {
        b.classList.toggle("on", Number(b.dataset.val) === state.teamAmount);
      });
      notifyChange();
    });

    container.querySelectorAll(".mb-team-chip").forEach((btn: any) => {
      btn.addEventListener("click", () => {
        if (isLocked()) {
          applyLockUi();
          return;
        }
        state.teamAmount = Number(btn.dataset.val || 0);
        if (!state.teamEnabled) {
          state.teamEnabled = true;
          render();
          notifyChange();
          return;
        }
        if (tAmt) tAmt.value = String(state.teamAmount);
        container.querySelectorAll(".mb-team-chip").forEach((b: any) => {
          b.classList.toggle("on", Number(b.dataset.val) === state.teamAmount);
        });
        notifyChange();
      });
    });

    const tNote = container.querySelector("#mb_team_note") as HTMLInputElement | null;
    tNote?.addEventListener("input", () => {
      if (isLocked()) {
        tNote.value = state.motivationNote;
        applyLockUi();
        return;
      }
      state.motivationNote = tNote.value;
      notifyChange();
    });

    container.querySelector("#mb_add_player")?.addEventListener("click", () => {
      if (isLocked()) {
        applyLockUi();
        return;
      }
      if (state.playerBonuses.length >= 6) return;
      const usedPids = new Set(state.playerBonuses.map((x: any) => x.playerId));
      const candidate =
        playersSorted.find((p) => startersSet.has(p.id) && !usedPids.has(p.id) && p.pos !== "ВР") ||
        playersSorted.find((p) => !usedPids.has(p.id) && p.pos !== "ВР") ||
        playersSorted[0];
      state.playerBonuses.push({
        id: Math.random().toString(36).slice(2, 9),
        playerId: candidate?.id || "",
        condition: candidate?.pos === "ВР" ? "clean_sheet" : "goal",
        amount: presets.playerPresets[1] || 30000,
        note: "",
      });
      render();
      notifyChange();
    });

    container.querySelectorAll(".mb-p-sel").forEach((sel: any) => {
      sel.addEventListener("change", () => {
        const idx = Number(sel.dataset.pidx);
        if (isLocked()) {
          if (state.playerBonuses[idx]) sel.value = state.playerBonuses[idx].playerId || "";
          applyLockUi();
          return;
        }
        if (state.playerBonuses[idx]) {
          state.playerBonuses[idx].playerId = sel.value;
          const pObj = playerById.get(sel.value);
          if (pObj?.pos === "ВР" && ["goal", "brace", "assist"].includes(state.playerBonuses[idx].condition)) {
            state.playerBonuses[idx].condition = "clean_sheet";
            render();
          }
        }
        notifyChange();
      });
    });

    container.querySelectorAll(".mb-p-cond").forEach((sel: any) => {
      sel.addEventListener("change", () => {
        const idx = Number(sel.dataset.pidx);
        if (isLocked()) {
          if (state.playerBonuses[idx]) sel.value = state.playerBonuses[idx].condition || "goal";
          applyLockUi();
          return;
        }
        if (state.playerBonuses[idx]) state.playerBonuses[idx].condition = sel.value;
        notifyChange();
      });
    });

    container.querySelectorAll(".mb-p-amt").forEach((inp: any) => {
      inp.addEventListener("input", () => {
        const idx = Number(inp.dataset.pidx);
        if (isLocked()) {
          if (state.playerBonuses[idx]) inp.value = String(state.playerBonuses[idx].amount || 0);
          applyLockUi();
          return;
        }
        const val = Math.max(0, Math.round(Number(inp.value || 0)));
        if (state.playerBonuses[idx]) state.playerBonuses[idx].amount = val;
        container.querySelectorAll(`.mb-p-chip[data-pidx="${idx}"]`).forEach((b: any) => {
          b.classList.toggle("on", Number(b.dataset.val) === val);
        });
        notifyChange();
      });
    });

    container.querySelectorAll(".mb-p-chip").forEach((btn: any) => {
      btn.addEventListener("click", () => {
        if (isLocked()) {
          applyLockUi();
          return;
        }
        const idx = Number(btn.dataset.pidx);
        const val = Number(btn.dataset.val || 0);
        if (state.playerBonuses[idx]) state.playerBonuses[idx].amount = val;
        const inp = container.querySelector(`.mb-p-amt[data-pidx="${idx}"]`) as HTMLInputElement | null;
        if (inp) inp.value = String(val);
        container.querySelectorAll(`.mb-p-chip[data-pidx="${idx}"]`).forEach((b: any) => {
          b.classList.toggle("on", Number(b.dataset.val) === val);
        });
        notifyChange();
      });
    });

    container.querySelectorAll(".mb-p-note").forEach((inp: any) => {
      inp.addEventListener("input", () => {
        const idx = Number(inp.dataset.pidx);
        if (isLocked()) {
          if (state.playerBonuses[idx]) inp.value = state.playerBonuses[idx].note || "";
          applyLockUi();
          return;
        }
        if (state.playerBonuses[idx]) state.playerBonuses[idx].note = inp.value;
        notifyChange();
      });
    });

    container.querySelectorAll(".mb-p-del").forEach((btn: any) => {
      btn.addEventListener("click", () => {
        if (isLocked()) {
          applyLockUi();
          return;
        }
        const idx = Number(btn.dataset.pidx);
        state.playerBonuses.splice(idx, 1);
        render();
        notifyChange();
      });
    });

    renderSummaryOnly();
    applyLockUi();
  };

  render();

  const initialLock = getClientBonusLockInfo(f);
  if (!initialLock.locked && Number.isFinite(initialLock.remainingToLockMs) && initialLock.remainingToLockMs <= 24 * 60 * 60 * 1000) {
    setTimeout(() => {
      if (container.isConnected) {
        const banner = container.querySelector("#mb_lock_banner") as HTMLElement | null;
        if (banner) banner.style.display = isLocked() ? "" : "none";
        const note = container.querySelector("#mb_unlock_note") as HTMLElement | null;
        if (note) note.style.display = isLocked() ? "none" : "";
        if (isLocked()) {
          container
            .querySelectorAll(
              "#mb_team_enabled, #mb_team_cond, #mb_team_amt, #mb_team_note, .mb-team-chip, #mb_add_player, .mb-p-sel, .mb-p-cond, .mb-p-amt, .mb-p-chip, .mb-p-note, .mb-p-del"
            )
            .forEach((el: any) => {
              el.disabled = true;
            });
          if (opts.onLockChange) opts.onLockChange();
        }
      }
    }, initialLock.remainingToLockMs + 250);
  }

  return {
    getPayload,
    updateSets: (nextStarters: string[], nextBench: string[]) => {
      startersSet = new Set(nextStarters || []);
      benchSet = new Set(nextBench || []);
      renderSummaryOnly();
    },
    applyLockUi: () => {
      if (isLocked()) {
        const banner = container.querySelector("#mb_lock_banner") as HTMLElement | null;
        if (banner) banner.style.display = "";
        const note = container.querySelector("#mb_unlock_note") as HTMLElement | null;
        if (note) note.style.display = "none";
        container
          .querySelectorAll(
            "#mb_team_enabled, #mb_team_cond, #mb_team_amt, #mb_team_note, .mb-team-chip, #mb_add_player, .mb-p-sel, .mb-p-cond, .mb-p-amt, .mb-p-chip, .mb-p-note, .mb-p-del"
          )
          .forEach((el: any) => {
            el.disabled = true;
          });
      }
    },
    isLocked,
  };
}

function openBonusModal(opts: {
  fixture: any;
  clubData: any;
  withT: (o: any) => any;
  api: (url: string, body?: any) => Promise<any>;
  act: (fn: () => Promise<any>, msg?: string) => Promise<any>;
  toast: (msg: string, err?: any) => void;
  onSaved: () => void;
}) {
  ensureBonusStyles();
  const f = opts.fixture;
  const c = opts.clubData;
  const existing = c.matchBonuses?.byFixtureId?.[f.id] || null;
  const players = [...(c.squad || []), ...(f.loanPool || [])];
  const stSet = new Set<string>(f.lineup?.starters || []);
  const bnSet = new Set<string>(f.lineup?.bench || []);

  const backdrop = document.createElement("div");
  backdrop.className = "mb-modal-backdrop";
  backdrop.innerHTML = `
    <div class="mb-modal">
      <div class="row sp" style="gap:10px;align-items:center;margin-bottom:8px">
        <div>
          <h3 style="margin:0">💰 Премиальные на матч: ${escHtml(f.label)}</h3>
          <div class="muted small" style="margin-top:2px">${f.home === c.team.id ? "Дома" : "В гостях"} против «${escHtml(f.opp)}»</div>
        </div>
        <button type="button" class="btn sm alt" id="mb_modal_close">✕</button>
      </div>
      <div id="mb_modal_body"></div>
      <div class="row" style="justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:12px">
        <div>
          ${existing ? `<button type="button" class="btn sm alt" id="mb_modal_clear" style="color:#991b1b;border-color:#fca5a5">Сбросить премиальные</button>` : ""}
        </div>
        <div class="row" style="gap:8px">
          <button type="button" class="btn alt" id="mb_modal_cancel">Отмена</button>
          <button type="button" class="btn" id="mb_modal_save">Сохранить премиальные</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const syncModalLock = () => {
    const locked = getClientBonusLockInfo(f).locked;
    const clearBtn = backdrop.querySelector("#mb_modal_clear") as HTMLButtonElement | null;
    const saveBtn = backdrop.querySelector("#mb_modal_save") as HTMLButtonElement | null;
    if (clearBtn) clearBtn.disabled = locked;
    if (saveBtn) {
      saveBtn.disabled = locked;
      saveBtn.textContent = locked ? "🔒 Правки закрыты (<10 мин)" : "Сохранить премиальные";
      saveBtn.title = locked ? "Редактирование премиальных закрыто менее чем за 10 минут до матча" : "";
    }
  };

  const editor = mountBonusEditor(backdrop.querySelector("#mb_modal_body") as HTMLElement, {
    fixture: f,
    clubData: c,
    players,
    startersSet: stSet,
    benchSet: bnSet,
    onLockChange: syncModalLock,
  });

  syncModalLock();

  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (ev) => {
    if (ev.target === backdrop) close();
  });
  backdrop.querySelector("#mb_modal_close")?.addEventListener("click", close);
  backdrop.querySelector("#mb_modal_cancel")?.addEventListener("click", close);

  backdrop.querySelector("#mb_modal_clear")?.addEventListener("click", async () => {
    if (getClientBonusLockInfo(f).locked) {
      syncModalLock();
      editor.applyLockUi();
      opts.toast("До начала матча осталось менее 10 минут — изменить премиальные на матч уже нельзя", 1);
      return;
    }
    const r = await opts.act(
      () => opts.api("/club/match-bonuses", opts.withT({ fid: f.id, clear: true })),
      "Премиальные отменены"
    );
    if (r) {
      close();
      opts.onSaved();
    }
  });

  backdrop.querySelector("#mb_modal_save")?.addEventListener("click", async () => {
    if (getClientBonusLockInfo(f).locked) {
      syncModalLock();
      editor.applyLockUi();
      opts.toast("До начала матча осталось менее 10 минут — изменить премиальные на матч уже нельзя", 1);
      return;
    }
    const payload = editor.getPayload();
    const r = await opts.act(
      () => opts.api("/club/match-bonuses", opts.withT({ fid: f.id, ...payload })),
      "Премиальные сохранены и добавлены в установку на матч"
    );
    if (r) {
      close();
      opts.onSaved();
    }
  });
}

function renderSettledBonusesHtml(clubData: any, esc: (s: any) => string): string {
  const settled = Array.isArray(clubData?.matchBonuses?.recentSettled) ? clubData.matchBonuses.recentSettled : [];
  if (!settled.length) return "";
  return `
    <div class="panel" style="margin-top:14px">
      <h3 style="margin:0 0 8px">💰 Итоги недавних премиальных</h3>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${settled
          .map((item: any) => {
            const paid = Number(item.totalPaid || 0);
            const pRes = Array.isArray(item.playerResults) ? item.playerResults : [];
            const parts: string[] = [];
            if (item.teamBonus?.enabled) {
              parts.push(
                item.teamBonusMet
                  ? `✅ Командная премия: ${fmtEur(item.teamBonusPaid)} (${esc(item.teamBonusReason)})`
                  : `— Командная премия не сработала (${esc(item.teamBonusReason)})`
              );
            }
            for (const pr of pRes) {
              parts.push(
                pr.met
                  ? `✅ ${esc(pr.playerName)}: ${fmtEur(pr.paid)} (${esc(pr.conditionLabel)} — ${esc(pr.reason)})`
                  : `— ${esc(pr.playerName)}: ${esc(pr.conditionLabel)} — ${esc(pr.reason)}`
              );
            }
            return `
              <div style="padding:9px 12px;border-radius:8px;border:1px solid ${paid > 0 ? "#bbf7d0" : "var(--line)"};background:${paid > 0 ? "#f0fdf4" : "#f8fafc"}">
                <div class="row sp" style="gap:8px;flex-wrap:wrap;margin-bottom:4px">
                  <b>${esc(item.matchLabel || "Матч")}</b>
                  <span class="tag" style="${paid > 0 ? "background:#dcfce7;color:#166534;border-color:#86efac;font-weight:800" : ""}">${paid > 0 ? `Выплачено: ${fmtEur(paid)}` : "Условия не выполнены (€0)"}</span>
                </div>
                <div class="small muted" style="line-height:1.45">${parts.join(" · ")}</div>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

if (typeof window !== "undefined") {
  window.__RPL_BONUSES__ = {
    mountBonusEditor,
    openBonusModal,
    renderSettledBonusesHtml,
  };
}

export {};
