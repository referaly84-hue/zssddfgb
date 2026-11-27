/* Настроение футболистов и личные разговоры с игроками (1 раз за ТО, Adsgram #61793 с кликом, пауза 3 мин) */

declare global {
  interface Window {
    __RPL_MORALE__?: {
      renderMoodBadgeHtml: (mood: any, opts?: { compact?: boolean; showSummary?: boolean }) => string;
      renderTalkButtonHtml: (player: any, clubData: any, opts?: { compact?: boolean }) => string;
      renderClubMoraleBannerHtml: (clubData: any) => string;
      openPlayerTalkModal: (opts: {
        player: any;
        teamId?: string;
        cooldown?: any;
        onDone?: (res?: any) => void;
      }) => void;
      bindCooldownTimers: (root: HTMLElement | Document, initialCooldown?: any) => () => void;
      syncGlobalCooldown: (cooldown: any) => void;
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

function ensureMoraleStyles() {
  if (typeof document === "undefined") return;
  let st = document.getElementById("rpl_morale_styles") as HTMLStyleElement | null;
  if (!st) {
    st = document.createElement("style");
    st.id = "rpl_morale_styles";
    document.head.appendChild(st);
  }
  st.textContent = `
    .pm-badge{
      display:inline-flex;align-items:center;gap:5px;
      padding:3px 8px;border-radius:6px;font-size:11.5px;font-weight:700;
      border:1px solid transparent;line-height:1.25;white-space:nowrap;
    }
    .pm-badge.ecstatic{background:#ecfdf5;color:#065f46;border-color:#6ee7b7}
    .pm-badge.positive{background:#f0fdf4;color:#15803d;border-color:#86efac}
    .pm-badge.calm{background:#f1f5f9;color:#334155;border-color:#cbd5e1}
    .pm-badge.warn{background:#fffbeb;color:#b45309;border-color:#fcd34d}
    .pm-badge.danger{background:#fef2f2;color:#b91c1c;border-color:#fca5a5}
    .pm-leave-note{font-size:10.5px;color:#b91c1c;font-weight:700;margin-top:2px;line-height:1.25}
    .pm-reason-sub{font-size:11px;color:var(--muted);margin-top:3px;line-height:1.3;max-width:230px;white-space:normal}
    .pm-banner{
      background:var(--panel);border:1px solid var(--line);border-radius:10px;
      padding:12px 14px;margin-bottom:12px;
      display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;
    }
    .pm-kpis{display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:12.5px}
    .pm-kpi{display:inline-flex;align-items:center;gap:5px;font-weight:600;color:var(--ink)}
    .pm-cd-box{
      font-size:12px;font-weight:700;padding:4px 10px;border-radius:6px;
      background:#f8fafc;border:1px solid var(--line);color:var(--deep);
      font-variant-numeric:tabular-nums;
    }
    .pm-cd-box.wait{background:#fffbeb;border-color:#fcd34d;color:#92400e}
    .pm-topics{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 10px}
    .pm-topic-btn{
      border:1px solid #cbd5e1;background:#f8fafc;color:#0f172a;border-radius:7px;
      padding:5px 10px;font-size:12px;font-weight:600;cursor:pointer;transition:all .12s;
    }
    .pm-topic-btn:hover{border-color:var(--green);background:#eef7f0}
    .pm-topic-btn.on{background:var(--deep);color:#fff;border-color:var(--deep)}
    .pm-reply-box{
      margin-top:12px;padding:12px 14px;border-radius:10px;
      background:#f0fdf4;border:1.5px solid #86efac;
    }
    .pm-reply-box.tense{background:#fef2f2;border-color:#fca5a5}
    .pm-reply-box.mixed{background:#fffbeb;border-color:#fcd34d}
    .pm-btn-talk{
      background:#eef7f0;color:#0d2f21;border:1px solid #86efac;
    }
    .pm-btn-talk:hover:not(:disabled){background:#dcfce7;border-color:#2f7d55}
    .pm-btn-talk.done{background:#f1f5f9;color:#64748b;border-color:#cbd5e1}
    .pm-btn-talk.wait{background:#fffbeb;color:#b45309;border-color:#fcd34d}
  `;
}

let GLOBAL_COOLDOWN_UNTIL = 0;

function syncGlobalCooldown(cooldown: any) {
  if (!cooldown) return;
  const rem = Number(cooldown.cooldownRemainingMs || 0);
  const nextAt = Number(cooldown.nextAvailableAt || 0);
  if (rem > 0) {
    GLOBAL_COOLDOWN_UNTIL = Math.max(GLOBAL_COOLDOWN_UNTIL, nextAt > Date.now() ? nextAt : Date.now() + rem);
  } else if (cooldown.cooldownRemainingMs === 0) {
    GLOBAL_COOLDOWN_UNTIL = 0;
  }
}

function getCooldownRemainingMs(localCooldown?: any): number {
  const now = Date.now();
  let until = GLOBAL_COOLDOWN_UNTIL;
  if (localCooldown) {
    const nextAt = Number(localCooldown.nextAvailableAt || 0);
    const rem = Number(localCooldown.cooldownRemainingMs || 0);
    if (rem > 0) {
      until = Math.max(until, nextAt > now ? nextAt : now + rem);
    }
  }
  return Math.max(0, until - now);
}

function fmtMmSs(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function renderMoodBadgeHtml(
  mood: any,
  opts?: { compact?: boolean; showSummary?: boolean }
): string {
  ensureMoraleStyles();
  if (!mood || !mood.code) {
    return '<span class="pm-badge calm">😌 Спокойное</span>';
  }
  const tone = escHtml(mood.tone || "calm");
  const emoji = escHtml(mood.emoji || "😌");
  const label = opts?.compact ? escHtml(mood.shortLabel || mood.label) : escHtml(mood.label || mood.shortLabel);
  const factorsArr = Array.isArray(mood.factors) ? mood.factors : [];
  const tip = [mood.summary || "", ...factorsArr].filter(Boolean).join(" • ");

  return `
    <div style="display:inline-flex;flex-direction:column;align-items:flex-start">
      <span class="pm-badge ${tone}" title="${escHtml(tip)}">${emoji} ${label}</span>
      ${mood.wantsToLeave ? '<div class="pm-leave-note">Хочет уйти из команды</div>' : ""}
      ${opts?.showSummary && mood.summary ? `<div class="pm-reason-sub">${escHtml(mood.summary)}</div>` : ""}
    </div>
  `;
}

export function renderTalkButtonHtml(
  player: any,
  clubData: any,
  opts?: { compact?: boolean }
): string {
  ensureMoraleStyles();
  const mood = player?.mood || {};
  syncGlobalCooldown(clubData?.playerTalkCooldown);
  const cdLeft = getCooldownRemainingMs(clubData?.playerTalkCooldown);

  if (mood.talkedInWindow) {
    return `<button type="button" class="btn sm pm-btn-talk done" disabled title="С этим игроком уже был разговор в текущее ТО (1 раз за ТО)">✓ Поговорили в ТО</button>`;
  }
  if (cdLeft > 0) {
    return `<button type="button" class="btn sm pm-btn-talk wait" data-player-talk="${escHtml(player.id)}" data-talk-cd="1" disabled title="Перерыв 3 минуты между вызовами рекламы (#61793)">⏳ ${fmtMmSs(cdLeft)}</button>`;
  }
  const txt = opts?.compact ? "💬 Поговорить" : "💬 Поговорить";
  return `<button type="button" class="btn sm pm-btn-talk" data-player-talk="${escHtml(player.id)}" title="Поговорить с игроком (1 раз за ТО · реклама #61793 с кликом · пауза 3 мин)">${txt}</button>`;
}

export function renderClubMoraleBannerHtml(clubData: any): string {
  ensureMoraleStyles();
  const roster = Array.isArray(clubData?.roster) ? clubData.roster : [];
  if (!roster.length) return "";
  syncGlobalCooldown(clubData?.playerTalkCooldown);
  const cdLeft = getCooldownRemainingMs(clubData?.playerTalkCooldown);

  let happy = 0;
  let calm = 0;
  let warnOrBad = 0;
  let conflictOrLeave = 0;
  let talkedCount = 0;

  for (const p of roster) {
    const m = p?.mood;
    if (!m) {
      calm += 1;
      continue;
    }
    if (m.talkedInWindow) talkedCount += 1;
    if (m.code === "ecstatic" || m.code === "happy" || m.code === "motivated") happy += 1;
    else if (m.code === "calm") calm += 1;
    else if (m.code === "coach_conflict" || m.code === "wants_leave") conflictOrLeave += 1;
    else warnOrBad += 1;
  }

  return `
    <div class="pm-banner">
      <div>
        <div style="font-weight:700;font-size:13.5px;color:var(--deep)">💭 Настроение раздевалки</div>
        <div class="pm-kpis" style="margin-top:4px">
          <span class="pm-kpi" style="color:#15803d">😊 Довольны / заряжены: <b>${happy}</b></span>
          <span class="pm-kpi" style="color:#475569">😌 Спокойны: <b>${calm}</b></span>
          ${warnOrBad ? `<span class="pm-kpi" style="color:#b45309">😕 Недовольны: <b>${warnOrBad}</b></span>` : ""}
          ${conflictOrLeave ? `<span class="pm-kpi" style="color:#b91c1c">⚡ Конфликт / хотят уйти: <b>${conflictOrLeave}</b></span>` : ""}
          <span class="muted small">Бесед в этом ТО: <b>${talkedCount}</b></span>
        </div>
      </div>
      <div class="pm-cd-box ${cdLeft > 0 ? "wait" : ""}" id="pm_global_cd_pill">
        ${cdLeft > 0 ? `⏳ Перерыв рекламы: ${fmtMmSs(cdLeft)}` : "✓ Разговор с игроком доступен (блок 61793 + клик)"}
      </div>
    </div>
  `;
}

export function bindCooldownTimers(
  root: HTMLElement | Document,
  initialCooldown?: any
): () => void {
  syncGlobalCooldown(initialCooldown);
  const tick = () => {
    const rem = getCooldownRemainingMs();
    const bannerPill = document.getElementById("pm_global_cd_pill");
    if (bannerPill) {
      if (rem > 0) {
        bannerPill.classList.add("wait");
        bannerPill.textContent = `⏳ Перерыв рекламы: ${fmtMmSs(rem)}`;
      } else {
        bannerPill.classList.remove("wait");
        bannerPill.textContent = "✓ Разговор с игроком доступен (блок 61793 + клик)";
      }
    }
    root.querySelectorAll<HTMLButtonElement>("button[data-player-talk]").forEach((btn) => {
      if (btn.classList.contains("done")) return;
      if (rem > 0) {
        btn.disabled = true;
        btn.classList.add("wait");
        btn.setAttribute("data-talk-cd", "1");
        btn.textContent = `⏳ ${fmtMmSs(rem)}`;
      } else if (btn.getAttribute("data-talk-cd") === "1") {
        btn.disabled = false;
        btn.classList.remove("wait");
        btn.removeAttribute("data-talk-cd");
        btn.textContent = "💬 Поговорить";
      }
    });
  };
  tick();
  const id = window.setInterval(tick, 1000);
  return () => window.clearInterval(id);
}

const TOPICS: Array<{ id: string; label: string; sample: string }> = [
  {
    id: "playing_time",
    label: "⏱️ Игровое время",
    sample: "Мы ценим твою работу на тренировках, ты обязательно получишь свои шансы на поле в ближайших турах.",
  },
  {
    id: "coach_conflict",
    label: "🤝 Уладить с тренером",
    sample: "Давай снимем напряжение с главным тренером — штаб рассчитывает на твою самоотдачу и профессионализм.",
  },
  {
    id: "keep_in_club",
    label: "🛡️ Убедить остаться",
    sample: "Ты важен для нашего проекта, мы не хотим тебя отпускать и готовы опираться на тебя в сезоне.",
  },
  {
    id: "table_ambitions",
    label: "📈 О положении в таблице",
    sample: "Турнирная ситуация непростая, но у нас сильный состав — вместе мы обязаны выправить результаты.",
  },
  {
    id: "tough_talk",
    label: "🔥 Жёсткий разговор",
    sample: "Хватит переживать, нужно собраться, доказать свой уровень на тренировках и биться за эмблему.",
  },
];

export function openPlayerTalkModal(opts: {
  player: any;
  teamId?: string;
  cooldown?: any;
  onDone?: (res?: any) => void;
}) {
  ensureMoraleStyles();
  const app = (window as any).__RPL_APP__;
  if (!app) return;
  const { api, toast, modal, e } = app;
  const p = opts.player;
  const tid = opts.teamId || p?.teamId || app.getClubTid?.() || "";
  if (!p?.id) return;

  syncGlobalCooldown(opts.cooldown);

  let selectedTopic = "playing_time";
  if (p.mood?.code === "coach_conflict") selectedTopic = "coach_conflict";
  else if (p.mood?.code === "wants_leave") selectedTopic = "keep_in_club";
  else if (p.mood?.code === "table_unhappy") selectedTopic = "table_ambitions";

  const initialSample = TOPICS.find((x) => x.id === selectedTopic)?.sample || TOPICS[0].sample;

  modal('<div class="muted" style="padding:18px 8px;text-align:center">⏳ Проверка доступности разговора с игроком…</div>', async (mEl: HTMLElement, close: () => void) => {
    const card = mEl.firstElementChild as HTMLElement | null;
    if (card) card.style.maxWidth = "600px";

    let status: any;
    try {
      const qs = new URLSearchParams({ playerId: p.id, ...(tid ? { teamId: tid } : {}) });
      status = await api(`/club/player-talk/status?${qs.toString()}`);
    } catch (err: any) {
      if (!mEl.isConnected) return;
      if (card) {
        card.innerHTML = `<div class="warn">${escHtml(err?.message || "Не удалось загрузить данные игрока")}</div>
          <div class="row" style="justify-content:flex-end;margin-top:12px"><button type="button" class="btn alt" id="pt_err_close">Закрыть</button></div>`;
        mEl.querySelector("#pt_err_close")?.addEventListener("click", close);
      }
      return;
    }
    if (!mEl.isConnected || !card) return;

    syncGlobalCooldown(status.cooldown);
    const mood = status.mood || p.mood || {};
    const factors = Array.isArray(mood.factors) ? mood.factors : [];
    const alreadyTalked = Boolean(status.alreadyTalkedInWindow);
    const talkRec = status.talkRecord || mood.lastTalk || null;

    let cdTimer: number | null = null;
    const stopTimer = () => {
      if (cdTimer !== null) {
        window.clearInterval(cdTimer);
        cdTimer = null;
      }
    };

    const renderBody = () => {
      const cdLeft = getCooldownRemainingMs(status.cooldown);
      card.innerHTML = `
        <div class="row sp" style="align-items:flex-start;gap:10px;margin-bottom:10px">
          <div>
            <h3 style="margin:0;font-size:18px">💬 Разговор с игроком: ${e(p.name)}</h3>
            <div class="small muted" style="margin-top:3px">${e(p.pos || "")}${p.age ? ` · ${p.age} лет` : ""}</div>
          </div>
          <button type="button" class="btn alt sm" id="pt_close_top">✕</button>
        </div>

        <div style="padding:12px;border-radius:10px;background:#f8fafc;border:1px solid var(--line);margin-bottom:12px">
          <div class="row sp" style="gap:8px;align-items:center;margin-bottom:6px">
            <span class="small muted" style="font-weight:700">Текущее настроение</span>
            ${renderMoodBadgeHtml(mood, { compact: false })}
          </div>
          ${mood.summary ? `<div style="font-size:13px;color:var(--ink);line-height:1.45">${e(mood.summary)}</div>` : ""}
          ${factors.length ? `<ul style="margin:8px 0 0;padding-left:18px;font-size:12px;color:var(--muted);line-height:1.45">${factors.map((f: string) => `<li>${e(f)}</li>`).join("")}</ul>` : ""}
        </div>

        ${
          alreadyTalked
            ? `
          <div class="pm-reply-box" style="margin-top:0">
            <div style="font-weight:700;font-size:13.5px;color:#065f46;margin-bottom:6px">✓ Вы уже поговорили с этим игроком в текущее трансферное окно</div>
            ${talkRec ? `
              <div class="small muted" style="margin-bottom:4px"><b>Ваши слова:</b> «${e(talkRec.message || "")}»</div>
              <div style="font-size:13px;color:#0f172a;line-height:1.45"><b>Ответ игрока:</b> «${e(talkRec.reply || "")}»</div>
              ${talkRec.outcomeLabel ? `<div class="small muted" style="margin-top:6px">Итог: <b>${e(talkRec.outcomeLabel)}</b></div>` : ""}
            ` : ""}
            <div class="small muted" style="margin-top:8px">Следующий разговор с ${e(p.name)} станет доступен после открытия следующего трансферного окна.</div>
          </div>
          <div class="row" style="justify-content:flex-end;margin-top:14px">
            <button type="button" class="btn" id="pt_close_btn">Закрыть</button>
          </div>
        `
            : `
          <div style="padding:10px 12px;border-radius:8px;background:#fffbeb;border:1px solid #fcd34d;font-size:12px;color:#92400e;line-height:1.45;margin-bottom:12px">
            <b>Условия беседы:</b> доступно <b>1 раз за ТО</b> для каждого игрока. Требуется просмотр рекламы Adsgram (блок <code>61793</code>) <b>обязательно с кликом по объявлению</b>. Перерыв между вызовами рекламы — <b>3 минуты</b>.
            <div id="pt_cd_note" style="margin-top:4px;font-weight:700;${cdLeft > 0 ? "" : "display:none"}">
              ⏳ До следующего вызова рекламы осталось: <span id="pt_cd_val">${fmtMmSs(cdLeft)}</span>
            </div>
          </div>

          <label style="margin:0 0 4px">Тема разговора</label>
          <div class="pm-topics" id="pt_topics">
            ${TOPICS.map(
              (t) => `<button type="button" class="pm-topic-btn ${selectedTopic === t.id ? "on" : ""}" data-topic="${escHtml(t.id)}">${e(t.label)}</button>`
            ).join("")}
          </div>

          <label for="pt_msg">Что сказать игроку</label>
          <textarea id="pt_msg" rows="3" maxlength="360" placeholder="Напишите личное обращение игроку…">${escHtml(initialSample)}</textarea>

          <div id="pt_result_area"></div>

          <div class="row sp" style="margin-top:14px;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn alt" id="pt_cancel">Отмена</button>
            <button type="button" class="btn" id="pt_submit" ${cdLeft > 0 ? "disabled" : ""}>
              ${cdLeft > 0 ? `⏳ Перерыв (${fmtMmSs(cdLeft)})` : "📺 Реклама #61793 (с кликом) и поговорить"}
            </button>
          </div>
        `
        }
      `;

      mEl.querySelector("#pt_close_top")?.addEventListener("click", () => {
        stopTimer();
        close();
      });
      mEl.querySelector("#pt_close_btn")?.addEventListener("click", () => {
        stopTimer();
        close();
      });
      mEl.querySelector("#pt_cancel")?.addEventListener("click", () => {
        stopTimer();
        close();
      });

      if (alreadyTalked) return;

      const msgEl = mEl.querySelector("#pt_msg") as HTMLTextAreaElement | null;
      mEl.querySelectorAll<HTMLButtonElement>("[data-topic]").forEach((btn) => {
        btn.onclick = () => {
          selectedTopic = btn.dataset.topic || "custom";
          mEl.querySelectorAll("[data-topic]").forEach((b) => b.classList.toggle("on", b === btn));
          const found = TOPICS.find((t) => t.id === selectedTopic);
          if (found && msgEl) {
            msgEl.value = found.sample;
          }
        };
      });

      const submitBtn = mEl.querySelector("#pt_submit") as HTMLButtonElement | null;
      const cdNote = mEl.querySelector("#pt_cd_note") as HTMLElement | null;
      const cdVal = mEl.querySelector("#pt_cd_val") as HTMLElement | null;

      stopTimer();
      cdTimer = window.setInterval(() => {
        if (!mEl.isConnected) {
          stopTimer();
          return;
        }
        const rem = getCooldownRemainingMs(status.cooldown);
        if (rem > 0) {
          if (cdNote) cdNote.style.display = "block";
          if (cdVal) cdVal.textContent = fmtMmSs(rem);
          if (submitBtn && !submitBtn.dataset.busy) {
            submitBtn.disabled = true;
            submitBtn.textContent = `⏳ Перерыв (${fmtMmSs(rem)})`;
          }
        } else {
          if (cdNote) cdNote.style.display = "none";
          if (submitBtn && !submitBtn.dataset.busy && !submitBtn.dataset.finished) {
            submitBtn.disabled = false;
            submitBtn.textContent = "📺 Реклама #61793 (с кликом) и поговорить";
          }
        }
      }, 1000);

      if (submitBtn) {
        submitBtn.onclick = async () => {
          const message = String(msgEl?.value || "").trim();
          if (message.length < 4) {
            return toast("Напишите хотя бы короткую фразу для игрока", true);
          }
          const remNow = getCooldownRemainingMs(status.cooldown);
          if (remNow > 0) {
            return toast(`Перерыв 3 минуты между вызовами рекламы: подождите ещё ${fmtMmSs(remNow)}`, true);
          }
          const ext = (window as any).__RPL_EXT__;
          if (!ext?.runAdsgramBlock) {
            return toast("Модуль рекламы Adsgram ещё не загружен", true);
          }

          submitBtn.disabled = true;
          submitBtn.dataset.busy = "1";
          submitBtn.textContent = "⏳ Показ рекламы #61793 (нужен клик)…";

          const adRes = await ext.runAdsgramBlock(
            "player_talk",
            `Разговор с игроком ${p.name}`,
            "Для разговора посмотрите рекламу (блок 61793) и обязательно кликните по объявлению",
            { teamId: tid, extraStartParams: { playerId: p.id } }
          );

          delete submitBtn.dataset.busy;

          if (adRes?.cooldown) {
            status.cooldown = adRes.cooldown;
            syncGlobalCooldown(adRes.cooldown);
          } else {
            // Sync refreshed cooldown if client hit no-click / skip lock
            try {
              const qs2 = new URLSearchParams({ playerId: p.id, ...(tid ? { teamId: tid } : {}) });
              const refreshed = await api(`/club/player-talk/status?${qs2.toString()}`);
              if (refreshed?.cooldown) {
                status.cooldown = refreshed.cooldown;
                syncGlobalCooldown(refreshed.cooldown);
              }
            } catch {}
          }

          if (!adRes || !adRes.adProof || !adRes.clicked) {
            const left = getCooldownRemainingMs(status.cooldown);
            submitBtn.disabled = left > 0;
            submitBtn.textContent = left > 0
              ? `⏳ Перерыв (${fmtMmSs(left)})`
              : "📺 Реклама #61793 (с кликом) и поговорить";
            return;
          }

          if (adRes.blockId && String(adRes.blockId) !== "61793") {
            toast("Неверный ID рекламного блока Adsgram (ожидается 61793)", true);
            submitBtn.disabled = false;
            submitBtn.textContent = "📺 Реклама #61793 (с кликом) и поговорить";
            return;
          }

          submitBtn.disabled = true;
          submitBtn.dataset.busy = "1";
          submitBtn.textContent = "💬 Отправка разговора игроку…";

          try {
            const resp = await api("/club/player-talk", {
              ...(tid ? { teamId: tid } : {}),
              playerId: p.id,
              topic: selectedTopic,
              message,
              adProof: adRes.adProof,
            });
            delete submitBtn.dataset.busy;
            submitBtn.dataset.finished = "1";

            if (resp?.cooldown) {
              status.cooldown = resp.cooldown;
              syncGlobalCooldown(resp.cooldown);
            }
            const resBox = mEl.querySelector("#pt_result_area") as HTMLElement | null;
            const outCls = resp?.outcomeType === "tense" ? "tense" : (resp?.outcomeType === "mixed" ? "mixed" : "");
            if (resBox) {
              resBox.innerHTML = `
                <div class="pm-reply-box ${outCls}">
                  <div style="font-weight:700;font-size:13.5px;margin-bottom:6px">${e(resp.outcomeLabel || "Разговор состоялся")}</div>
                  <div style="font-size:13.5px;color:#0f172a;line-height:1.5">«${e(resp.reply || "")}»</div>
                  <div class="row" style="gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap">
                    <span class="small muted">Настроение:</span>
                    ${renderMoodBadgeHtml(resp.moodBefore, { compact: true })}
                    <span class="small muted">→</span>
                    ${renderMoodBadgeHtml(resp.moodAfter, { compact: true })}
                  </div>
                </div>
              `;
            }
            submitBtn.style.display = "none";
            const cancelBtn = mEl.querySelector("#pt_cancel") as HTMLButtonElement | null;
            if (cancelBtn) {
              cancelBtn.className = "btn";
              cancelBtn.textContent = "Готово";
            }
            toast("Разговор с игроком завершён");
            if (typeof opts.onDone === "function") opts.onDone(resp);
          } catch (err: any) {
            delete submitBtn.dataset.busy;
            toast(err?.message || "Не удалось завершить разговор с игроком", true);
            const left = getCooldownRemainingMs(status.cooldown);
            submitBtn.disabled = left > 0;
            submitBtn.textContent = left > 0
              ? `⏳ Перерыв (${fmtMmSs(left)})`
              : "📺 Реклама #61793 (с кликом) и поговорить";
          }
        };
      }
    };

    renderBody();
  });
}

window.__RPL_MORALE__ = {
  renderMoodBadgeHtml,
  renderTalkButtonHtml,
  renderClubMoraleBannerHtml,
  openPlayerTalkModal,
  bindCooldownTimers,
  syncGlobalCooldown,
};
