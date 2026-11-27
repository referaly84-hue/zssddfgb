import type { Express, Response } from "express";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

function ensureSharpFontconfig() {
  try {
    const baseDir = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.join(baseDir, "fonts"),
      path.resolve(process.cwd(), "fonts"),
    ];
    const fontsDir = candidates.find((d) => fs.existsSync(d) && fs.statSync(d).isDirectory());
    if (!fontsDir) return;

    const xmlEsc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const cacheDir = path.join(os.tmpdir(), "virtrpl_fc_cache");
    fs.mkdirSync(cacheDir, { recursive: true });
    const confPath = path.join(os.tmpdir(), "virtrpl_fonts.conf");
    const confXml = [
      `<?xml version="1.0"?>`,
      `<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">`,
      `<fontconfig>`,
      `  <dir>${xmlEsc(fontsDir)}</dir>`,
      `  <dir>/usr/share/fonts</dir>`,
      `  <cachedir>${xmlEsc(cacheDir)}</cachedir>`,
      `  <match target="pattern">`,
      `    <test qual="any" name="family"><string>Noto Sans Display</string></test>`,
      `    <edit name="family" mode="prepend" binding="strong"><string>Liberation Sans</string></edit>`,
      `  </match>`,
      `  <match target="pattern">`,
      `    <test qual="any" name="family"><string>Noto Sans</string></test>`,
      `    <edit name="family" mode="prepend" binding="strong"><string>Liberation Sans</string></edit>`,
      `  </match>`,
      `  <alias>`,
      `    <family>sans-serif</family>`,
      `    <prefer><family>Liberation Sans</family></prefer>`,
      `  </alias>`,
      `  <alias>`,
      `    <family>monospace</family>`,
      `    <prefer><family>JetBrains Mono</family></prefer>`,
      `  </alias>`,
      `</fontconfig>`,
    ].join("\n");
    fs.writeFileSync(confPath, confXml, "utf8");
    process.env.FONTCONFIG_FILE = confPath;
    process.env.FONTCONFIG_PATH = os.tmpdir();
  } catch {
    /* fallback to system fontconfig if available */
  }
}

type SharpFn = (typeof import("sharp"))["default"];
let _sharpFn: SharpFn | null = null;
async function getSharp(): Promise<SharpFn> {
  if (!_sharpFn) {
    ensureSharpFontconfig();
    const mod = await import("sharp");
    _sharpFn = mod.default;
  }
  return _sharpFn;
}

export type ChannelId = "matchtv" | "rpl" | "fnl" | "cup" | "national" | "personal_bot";

export type ChannelRuleKey =
  | "schedule0001"
  | "posters0001"
  | "teamOfRound"
  | "teamOfMonth"
  | "standingsAfterTour"
  | "nationalExtended"
  | "nationalFinal"
  | "liveMatchEvents"
  | "transfersAndNews";

export type ChannelPublishKind =
  | "poster"
  | "schedule"
  | "team_round"
  | "team_month"
  | "standings"
  | "national_extended"
  | "national_final";

export interface ChannelRules {
  schedule0001?: boolean;
  posters0001?: boolean;
  teamOfRound?: boolean;
  teamOfMonth?: boolean;
  standingsAfterTour?: boolean;
  nationalExtended?: boolean;
  nationalFinal?: boolean;
  liveMatchEvents?: boolean;
  transfersAndNews?: boolean;
}

export interface ChannelConfig {
  id: ChannelId;
  name: string;
  subtitle: string;
  badgeText: string;
  accent: string;
  chatId: string;
  botUsername?: string;
  enabled: boolean;
  rules: ChannelRules;
}

export interface ChannelDispatchLog {
  id: string;
  at: number;
  iso: string;
  channelId: ChannelId;
  channelName: string;
  comp: string;
  kind: string;
  hasPhoto: boolean;
  ok: boolean;
  error?: string;
  preview: string;
}

export interface ChannelsServerContext {
  getDb: () => any;
  save: () => void;
  S: () => string;
  admin: any;
  fail: (res: Response, msg: string, code?: number) => void;
  uid: () => string;
  esc: (s: any) => string;
  team: (id: string) => any;
  tn: (id: string) => string;
  teamLogo: (id: string) => string;
  pubTeam: (t: any) => any;
  getTeamColors: (name: string) => { primary: string; secondary: string };
  compOf: (id: string) => any;
  compName: (f: any) => string;
  roundLabel: (f: any) => string;
  seasonFx: () => any[];
  table: (comp: string, beforeDate?: string) => any[];
  recalculateCupGroups: (cupState: any, fixtures: any[]) => void;
  buildTeamOfRound: (round: string, comp: string, fixtures: any[], matchesMap: Record<string, any>, teamsMap: Record<string, any>) => any;
  buildTeamOfMonth: (month: string, comp: string, fixtures: any[], matchesMap: Record<string, any>, teamsMap: Record<string, any>, isSeason?: boolean) => any;
  ensureMatches: (ids: string[]) => Promise<void>;
  getMatch: (id: string) => any;
  formatAwardMonthLabelRu: (ym: string) => string;
  ensureNationalTeam: (teamType?: "main" | "u21") => any;
  enrichNationalBreak: (brk: any, teamType?: "main" | "u21") => any;
  buildNationalSquadTelegramMessages: (enriched: any, teamType: "main" | "u21", mode: "extended" | "final" | "both") => string[];
  buildTelegramRecipientsList: () => any[];
  sendTelegramDirectMessage: (token: string, chatId: string, text: string, parseMode?: "HTML" | "plain") => Promise<{ ok: boolean; error?: string; blocked?: boolean; rawError?: string }>;
  normalizeTgChat: (raw: any) => string;
  getGlobalTgToken: () => string;
  getGlobalTgChat: () => string;
  readSecretsFile: () => Record<string, any>;
  saveSecretsFile: (updates: Record<string, any>) => boolean;
  nowMskParts: () => { dateStr: string; hour: number; minute: number };
  ruDateStr: (dateStr: string) => string;
  splitTgText: (text: string, maxLen?: number) => string[];
  rootDir: string;
}

export const CHANNEL_ORDER: ChannelId[] = [
  "matchtv",
  "rpl",
  "fnl",
  "cup",
  "national",
  "personal_bot",
];

const DAILY_COMPS = ["rpl", "fnl", "cup", "national"] as const;
const AWARD_COMPS = ["rpl", "fnl", "cup"] as const;

const DEFAULT_CHANNEL_SPECS: Record<ChannelId, Omit<ChannelConfig, "chatId">> = {
  matchtv: {
    id: "matchtv",
    name: "Матч ТВ",
    subtitle: "Федеральный эфир · все турниры, события, таблицы и сборная",
    badgeText: "МАТЧ ТВ",
    accent: "#dc2626",
    enabled: true,
    rules: {
      schedule0001: true,
      posters0001: false,
      teamOfRound: true,
      teamOfMonth: true,
      standingsAfterTour: true,
      nationalExtended: true,
      nationalFinal: true,
      liveMatchEvents: true,
      transfersAndNews: true,
    },
  },
  rpl: {
    id: "rpl",
    name: "РПЛ",
    subtitle: "Российская Премьер-Лига · расписание, афиши, таблицы и сборные туров",
    badgeText: "РПЛ",
    accent: "#16a34a",
    enabled: true,
    rules: {
      schedule0001: true,
      posters0001: false,
      teamOfRound: true,
      teamOfMonth: true,
      standingsAfterTour: true,
      liveMatchEvents: true,
      transfersAndNews: true,
    },
  },
  fnl: {
    id: "fnl",
    name: "ФНЛ",
    subtitle: "Первая Лига · расписание, афиши, таблицы и лучшие игроки",
    badgeText: "ФНЛ",
    accent: "#2563eb",
    enabled: true,
    rules: {
      schedule0001: true,
      posters0001: false,
      teamOfRound: true,
      teamOfMonth: true,
      standingsAfterTour: true,
      liveMatchEvents: true,
      transfersAndNews: true,
    },
  },
  cup: {
    id: "cup",
    name: "Кубок России",
    subtitle: "FONBET Кубок России · Путь РПЛ, Путь Регионов, группы и плей-офф",
    badgeText: "КУБОК РОССИИ",
    accent: "#d97706",
    enabled: true,
    rules: {
      schedule0001: true,
      posters0001: false,
      teamOfRound: true,
      teamOfMonth: true,
      standingsAfterTour: true,
      liveMatchEvents: true,
      transfersAndNews: true,
    },
  },
  national: {
    id: "national",
    name: "Сборная России",
    subtitle: "Основная и молодёжная U21 · списки вызова, афиши и матчи",
    badgeText: "СБОРНАЯ РОССИИ",
    accent: "#1d4ed8",
    enabled: true,
    rules: {
      schedule0001: true,
      posters0001: false,
      nationalExtended: true,
      nationalFinal: true,
      liveMatchEvents: true,
    },
  },
  personal_bot: {
    id: "personal_bot",
    name: "Личный бот",
    subtitle: "Игровой Telegram Mini App · вход клубов и персональные рассылки",
    badgeText: "ЛИЧНЫЙ БОТ",
    accent: "#0f766e",
    botUsername: "@RPLVIRT_bot",
    enabled: true,
    rules: {
      schedule0001: false,
      posters0001: false,
      teamOfRound: false,
      teamOfMonth: false,
      standingsAfterTour: false,
      nationalExtended: false,
      nationalFinal: false,
    },
  },
};

const COMP_META: Record<string, { title: string; short: string; primary: string; secondary: string; channelId: ChannelId | null }> = {
  rpl: { title: "МИР РПЛ", short: "РПЛ", primary: "#15803d", secondary: "#eab308", channelId: "rpl" },
  fnl: { title: "ЛУЧШАЯ ЛИГА МИРА · ФНЛ", short: "ФНЛ", primary: "#1d4ed8", secondary: "#38bdf8", channelId: "fnl" },
  cup: { title: "FONBET КУБОК РОССИИ", short: "Кубок России", primary: "#b45309", secondary: "#ef4444", channelId: "cup" },
  national: { title: "СБОРНАЯ РОССИИ", short: "Сборная России", primary: "#1e3a8a", secondary: "#dc2626", channelId: "national" },
  supercup: { title: "OLIMPBET СУПЕРКУБОК РОССИИ", short: "Суперкубок", primary: "#7c3aed", secondary: "#f59e0b", channelId: null },
  playoff: { title: "СТЫКОВЫЕ МАТЧИ РПЛ / ФНЛ", short: "Стыки", primary: "#0f766e", secondary: "#f59e0b", channelId: null },
  playoff_rpl_fnl: { title: "СТЫКОВЫЕ МАТЧИ РПЛ / ФНЛ", short: "Стыки", primary: "#0f766e", secondary: "#f59e0b", channelId: null },
};

function svgEsc(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncText(s: any, max = 24): string {
  const str = String(s ?? "").trim();
  if (str.length <= max) return str;
  return str.slice(0, max - 1).trimEnd() + "…";
}

function clubInitials(name: string): string {
  const clean = String(name || "ФК").replace(/[«»"']/g, "").trim();
  const words = clean.split(/[\s-]+/).filter((w) => w && !/^(фк|пфк|цск|ск)$/i.test(w));
  const pick = words.length ? words : clean.split(/[\s-]+/).filter(Boolean);
  if (pick.length >= 2) return (pick[0][0] + pick[1][0]).toUpperCase();
  return clean.slice(0, 3).toUpperCase() || "ФК";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function createChannelsController(ctx: ChannelsServerContext) {
  const logoDataCache = new Map<string, string>();
  const dispatchQueue: Array<{
    channelId: ChannelId;
    comp: string;
    kind: string;
    text: string;
    photoBuffer?: Buffer;
    caption?: string;
    tries: number;
  }> = [];
  let pumpRunning = false;
  let sentTimestamps: number[] = [];
  const channelCooldownUntil = new Map<string, number>();

  function getChannelSpecs(): Record<ChannelId, ChannelConfig> {
    const db = ctx.getDb();
    db.settings ||= {};
    db.settings.tgChannels ||= {};
    const out: any = {};
    let dirty = false;
    for (const id of CHANNEL_ORDER) {
      const def = DEFAULT_CHANNEL_SPECS[id];
      const saved = db.settings.tgChannels[id];
      if (!saved || typeof saved !== "object") {
        db.settings.tgChannels[id] = {
          id,
          name: def.name,
          subtitle: def.subtitle,
          chatId: "",
          botUsername: def.botUsername || "",
          enabled: def.enabled,
          rules: { ...def.rules },
        };
        dirty = true;
      }
      const cur = db.settings.tgChannels[id];
      out[id] = {
        id,
        name: String(cur.name || def.name),
        subtitle: String(cur.subtitle || def.subtitle),
        badgeText: def.badgeText,
        accent: def.accent,
        chatId: ctx.normalizeTgChat(cur.chatId || ""),
        botUsername: String(cur.botUsername || def.botUsername || "@RPLVIRT_bot"),
        enabled: cur.enabled !== false,
        rules: { ...def.rules, ...(cur.rules && typeof cur.rules === "object" ? cur.rules : {}) },
      };
    }
    if (dirty) ctx.save();
    return out;
  }

  function resolveChannelCredentials(channelId: ChannelId): { token: string; chatId: string; usesGlobalToken: boolean; usesGlobalChat: boolean } {
    const sec = ctx.readSecretsFile() || {};
    const tokenMap = sec.tgChannelTokens && typeof sec.tgChannelTokens === "object" ? sec.tgChannelTokens : {};
    const customToken = String(tokenMap[channelId] || "").trim();
    const globalToken = ctx.getGlobalTgToken();
    const token = customToken && !customToken.includes("•") ? customToken : globalToken;

    const specs = getChannelSpecs();
    const cfg = specs[channelId];
    let chatId = cfg?.chatId || "";
    let usesGlobalChat = false;
    if (channelId === "matchtv" && !chatId) {
      chatId = ctx.getGlobalTgChat();
      usesGlobalChat = !!chatId;
    }
    return {
      token,
      chatId,
      usesGlobalToken: !(customToken && !customToken.includes("•")),
      usesGlobalChat,
    };
  }

  function appendDispatchLog(entry: Omit<ChannelDispatchLog, "id" | "at" | "iso">) {
    try {
      const db = ctx.getDb();
      if (!db?.settings) return;
      db.settings.tgChannelLogs ||= [];
      const row: ChannelDispatchLog = {
        id: ctx.uid(),
        at: Date.now(),
        iso: new Date().toISOString(),
        ...entry,
      };
      db.settings.tgChannelLogs.unshift(row);
      if (db.settings.tgChannelLogs.length > 100) db.settings.tgChannelLogs.length = 100;
      ctx.save();
    } catch {
      /* ignore */
    }
  }

  async function resolveLogoDataUri(rawLogoPath: string, name: string, colors?: { primary?: string; secondary?: string }): Promise<string> {
    const fallbackSvg = () => {
      const p1 = colors?.primary || "#1e293b";
      const p2 = colors?.secondary || "#f8fafc";
      const ini = svgEsc(clubInitials(name));
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${p1}"/><stop offset="100%" stop-color="#0f172a"/></linearGradient></defs>
        <path d="M48 6 L84 18 V48 C84 70 67 84 48 90 C29 84 12 70 12 48 V18 Z" fill="url(#g)" stroke="${p2}" stroke-width="3.5"/>
        <text x="48" y="57" text-anchor="middle" fill="#ffffff" font-family="'Noto Sans Display','Noto Sans',sans-serif" font-weight="800" font-size="26">${ini}</text>
      </svg>`;
      return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    };

    const p = String(rawLogoPath || "").trim();
    if (!p) return fallbackSvg();
    if (p.startsWith("data:image/png;base64,") || p.startsWith("data:image/jpeg;base64,")) return p;

    const cacheKey = `${p}::${name}`;
    const cached = logoDataCache.get(cacheKey);
    if (cached) return cached;

    try {
      let buf: Buffer | null = null;
      if (p.startsWith("data:image/svg+xml")) {
        const idx = p.indexOf(",");
        if (idx > 0) {
          const meta = p.slice(0, idx);
          const body = p.slice(idx + 1);
          buf = meta.includes(";base64") ? Buffer.from(body, "base64") : Buffer.from(decodeURIComponent(body), "utf8");
        }
      } else if (!/^https?:\/\//i.test(p)) {
        const cleanRel = p.replace(/^\/+/, "");
        const candidates = [
          path.join(ctx.rootDir, "public", cleanRel),
          path.join(ctx.rootDir, cleanRel),
        ];
        for (const fp of candidates) {
          if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
            buf = fs.readFileSync(fp);
            break;
          }
        }
      }
      if (buf && buf.length > 0) {
        const sharp = await getSharp();
        const pngBuf = await sharp(buf, { density: 192 })
          .resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png({ compressionLevel: 9 })
          .toBuffer();
        const uri = `data:image/png;base64,${pngBuf.toString("base64")}`;
        logoDataCache.set(cacheKey, uri);
        return uri;
      }
    } catch {
      /* fallback below */
    }
    const fb = fallbackSvg();
    logoDataCache.set(cacheKey, fb);
    return fb;
  }

  function mapCompetitionToChannel(comp: string): ChannelId | null {
    const c = String(comp || "").toLowerCase();
    if (c === "rpl") return "rpl";
    if (c === "fnl") return "fnl";
    if (c === "cup" || c === "cup_rpl" || c === "cup_regions") return "cup";
    if (c === "national" || c === "national_u21") return "national";
    return null;
  }

  function isNationalFixture(f: any): boolean {
    if (!f) return false;
    const c = String(f.comp || "").toLowerCase();
    if (c === "national" || c === "national_u21") return true;
    if (f.nationalType) return true;
    if (f.home === "tm_nt_main" || f.away === "tm_nt_main" || f.home === "tm_nt_u21" || f.away === "tm_nt_u21") return true;
    return false;
  }

  function normalizeFixtureCompKey(f: any): string {
    if (isNationalFixture(f)) return "national";
    const c = String(f?.comp || "").toLowerCase();
    if (c === "cup_rpl" || c === "cup_regions") return "cup";
    return c || "rpl";
  }

  /* ────────────── Сбор данных для графики и текстов ────────────── */

  function collectDailyItemsForComp(comp: string, dateStr: string): any[] {
    const db = ctx.getDb();
    const out: any[] = [];
    const seenPairKeys = new Set<string>();

    if (comp === "national") {
      // 1. Матчи из db.nationalTeam / db.nationalTeamU21
      for (const tt of ["main", "u21"] as const) {
        const nt = ctx.ensureNationalTeam(tt);
        const enriched = ctx.enrichNationalBreak(nt.current, tt);
        for (const m of enriched.matches || []) {
          const rDate = String(m.realDate || m.date || "").slice(0, 10);
          if (rDate !== dateStr) continue;
          const isHome = m.home !== false;
          const ruName = tt === "u21" ? "Россия U21" : "Россия";
          const ruLogo = m.russiaLogo || "/assets/aistudio/russia_russia-national-team.football-logos.cc_2a5e3ddc.svg";
          const oppName = String(m.opponent || "Соперник");
          const oppTeam = (db.teams || []).find((t: any) => String(t.name || "").toLowerCase() === oppName.toLowerCase());
          const oppLogo = oppTeam ? ctx.teamLogo(oppTeam.id) : (m.opponentLogo || "");
          const time = String(m.realTime || m.time || "19:00").slice(0, 5);
          const pairKey = `${dateStr}::${time}::${isHome ? ruName : oppName}::${isHome ? oppName : ruName}`;
          seenPairKeys.add(pairKey);
          out.push({
            id: m.fixtureId || `nt_${tt}_${m.id}`,
            comp: "national",
            teamType: tt,
            homeId: isHome ? (tt === "u21" ? "tm_nt_u21" : "tm_nt_main") : (oppTeam?.id || oppName),
            awayId: isHome ? (oppTeam?.id || oppName) : (tt === "u21" ? "tm_nt_u21" : "tm_nt_main"),
            homeName: isHome ? ruName : oppName,
            awayName: isHome ? oppName : ruName,
            homeLogo: isHome ? ruLogo : oppLogo,
            awayLogo: isHome ? oppLogo : ruLogo,
            homeColors: isHome ? { primary: "#1d4ed8", secondary: "#dc2626" } : ctx.getTeamColors(oppName),
            awayColors: isHome ? ctx.getTeamColors(oppName) : { primary: "#1d4ed8", secondary: "#dc2626" },
            realDate: rDate,
            realTime: time,
            roundLabel: tt === "u21" ? "Сборная U21 · Товарищеский матч" : "Сборная России · Товарищеский матч",
            stadium: m.stadium || (isHome ? "ВТБ Арена / Газпром Арена" : "Выездной стадион"),
            city: m.city || (isHome ? "Москва" : ""),
            status: m.status || "scheduled",
            hg: m.hg,
            ag: m.ag,
          });
        }
      }
      // 2. Матчи из db.fixtures (с участием сборной)
      for (const f of db.fixtures || []) {
        if (!f || f.status === "cancelled") continue;
        if (!isNationalFixture(f)) continue;
        const rDate = String(f.realDate || f.date || "").slice(0, 10);
        if (rDate !== dateStr) continue;
        const hName = ctx.tn(f.home);
        const aName = ctx.tn(f.away);
        const time = String(f.realTime || f.time || "19:00").slice(0, 5);
        const pairKey = `${dateStr}::${time}::${hName}::${aName}`;
        if (seenPairKeys.has(pairKey)) continue;
        seenPairKeys.add(pairKey);
        const hTeam = ctx.team(f.home);
        const aTeam = ctx.team(f.away);
        out.push({
          id: f.id,
          comp: "national",
          homeId: f.home,
          awayId: f.away,
          homeName: hName,
          awayName: aName,
          homeLogo: ctx.teamLogo(f.home),
          awayLogo: ctx.teamLogo(f.away),
          homeColors: ctx.getTeamColors(hName),
          awayColors: ctx.getTeamColors(aName),
          realDate: rDate,
          realTime: time,
          roundLabel: ctx.roundLabel(f) || "Матч сборной России",
          stadium: hTeam?.stadium || aTeam?.stadium || "",
          city: hTeam?.city || aTeam?.city || "",
          status: f.status,
          hg: f.hg,
          ag: f.ag,
          pen: f.pen,
        });
      }
    } else {
      for (const f of db.fixtures || []) {
        if (!f || f.status === "cancelled") continue;
        if (normalizeFixtureCompKey(f) !== comp) continue;
        const rDate = String(f.realDate || f.date || "").slice(0, 10);
        if (rDate !== dateStr) continue;
        const hName = ctx.tn(f.home);
        const aName = ctx.tn(f.away);
        const hTeam = ctx.team(f.home);
        out.push({
          id: f.id,
          comp,
          homeId: f.home,
          awayId: f.away,
          homeName: hName,
          awayName: aName,
          homeLogo: ctx.teamLogo(f.home),
          awayLogo: ctx.teamLogo(f.away),
          homeColors: ctx.getTeamColors(hName),
          awayColors: ctx.getTeamColors(aName),
          realDate: rDate,
          realTime: String(f.realTime || f.time || "12:00").slice(0, 5),
          roundLabel: ctx.roundLabel(f),
          stadium: f.stadium || hTeam?.stadium || "",
          city: f.city || hTeam?.city || "",
          status: f.status,
          hg: f.hg,
          ag: f.ag,
          pen: f.pen,
        });
      }
    }
    return out.sort((a, b) => String(a.realTime).localeCompare(String(b.realTime)) || String(a.homeName).localeCompare(String(b.homeName), "ru"));
  }

  function fixtureToPosterData(f: any): any {
    const db = ctx.getDb();
    if (!f) return null;
    if (f.homeName && f.awayName) return f; // уже нормализовано
    const comp = normalizeFixtureCompKey(f);
    const hName = ctx.tn(f.home);
    const aName = ctx.tn(f.away);
    const hTeam = ctx.team(f.home);
    const aTeam = ctx.team(f.away);
    return {
      id: f.id,
      comp,
      homeId: f.home,
      awayId: f.away,
      homeName: hName,
      awayName: aName,
      homeLogo: ctx.teamLogo(f.home),
      awayLogo: ctx.teamLogo(f.away),
      homeColors: ctx.getTeamColors(hName),
      awayColors: ctx.getTeamColors(aName),
      realDate: String(f.realDate || f.date || ctx.nowMskParts().dateStr).slice(0, 10),
      realTime: String(f.realTime || f.time || "19:00").slice(0, 5),
      roundLabel: ctx.roundLabel(f),
      stadium: f.stadium || hTeam?.stadium || aTeam?.stadium || "Центральный стадион",
      city: f.city || hTeam?.city || "",
      status: f.status,
      hg: f.hg,
      ag: f.ag,
      pen: f.pen,
    };
  }

  /* ────────────── SVG → PNG Бродкаст-генератор ────────────── */

  async function renderMatchPosterPng(posterData: any): Promise<{ buffer: Buffer; svg: string }> {
    const meta = COMP_META[posterData.comp] || COMP_META.rpl;
    const [hUri, aUri] = await Promise.all([
      resolveLogoDataUri(posterData.homeLogo, posterData.homeName, posterData.homeColors),
      resolveLogoDataUri(posterData.awayLogo, posterData.awayName, posterData.awayColors),
    ]);
    const hc = posterData.homeColors?.primary || "#16a34a";
    const ac = posterData.awayColors?.primary || "#2563eb";
    const hName = truncText(posterData.homeName, 19);
    const aName = truncText(posterData.awayName, 19);
    const rDateRu = ctx.ruDateStr(posterData.realDate || "");
    const rTime = String(posterData.realTime || "19:00").slice(0, 5);
    const isDone = posterData.status === "done";
    const centerMain = isDone ? `${posterData.hg ?? 0}:${posterData.ag ?? 0}` : "VS";
    const venueLine = [posterData.stadium, posterData.city].filter(Boolean).join(" · ") || "Прямая трансляция";

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#070b14"/>
          <stop offset="50%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#060911"/>
        </linearGradient>
        <radialGradient id="glowL" cx="0.22" cy="0.52" r="0.45">
          <stop offset="0%" stop-color="${hc}" stop-opacity="0.48"/>
          <stop offset="100%" stop-color="${hc}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="glowR" cx="0.78" cy="0.52" r="0.45">
          <stop offset="0%" stop-color="${ac}" stop-opacity="0.48"/>
          <stop offset="100%" stop-color="${ac}" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="accentBar" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${meta.primary}"/>
          <stop offset="100%" stop-color="${meta.secondary}"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="675" fill="url(#bg)"/>
      <rect width="1200" height="675" fill="url(#glowL)"/>
      <rect width="1200" height="675" fill="url(#glowR)"/>
      <path d="M0 540 L1200 410 L1200 675 L0 675 Z" fill="#ffffff" fill-opacity="0.025"/>
      <circle cx="600" cy="340" r="245" fill="none" stroke="#ffffff" stroke-opacity="0.06" stroke-width="1.5"/>
      <line x1="600" y1="95" x2="600" y2="585" stroke="#ffffff" stroke-opacity="0.06" stroke-width="1.5"/>
      <rect x="0" y="0" width="1200" height="6" fill="url(#accentBar)"/>

      <!-- Header -->
      <rect x="48" y="34" width="320" height="40" rx="6" fill="url(#accentBar)"/>
      <text x="64" y="60" fill="#ffffff" font-family="'Noto Sans Display','Noto Sans',sans-serif" font-weight="800" font-size="16" letter-spacing="1.2">${svgEsc(meta.title)}</text>
      <text x="390" y="60" fill="#cbd5e1" font-family="'Noto Sans',sans-serif" font-weight="600" font-size="18">${svgEsc(truncText(posterData.roundLabel, 36))}</text>
      <text x="1152" y="60" text-anchor="end" fill="#f8fafc" font-family="'JetBrains Mono','Noto Sans',monospace" font-weight="700" font-size="17">${svgEsc(rDateRu)} · ${svgEsc(rTime)} МСК</text>
      <line x1="48" y1="94" x2="1152" y2="94" stroke="#ffffff" stroke-opacity="0.12" stroke-width="1"/>

      <!-- Home Pedestal -->
      <rect x="82" y="148" width="360" height="360" rx="22" fill="#0b1220" fill-opacity="0.72" stroke="${hc}" stroke-opacity="0.55" stroke-width="2"/>
      <circle cx="262" cy="288" r="102" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.12" stroke-width="1.5"/>
      <image href="${hUri}" x="182" y="208" width="160" height="160" preserveAspectRatio="xMidYMid meet"/>
      <text x="262" y="446" text-anchor="middle" fill="#ffffff" font-family="'Noto Sans Display','Noto Sans',sans-serif" font-weight="800" font-size="30">${svgEsc(hName)}</text>
      <text x="262" y="478" text-anchor="middle" fill="#94a3b8" font-family="'Noto Sans',sans-serif" font-weight="600" font-size="15">ХОЗЯЕВА ПОЛЯ</text>

      <!-- Away Pedestal -->
      <rect x="758" y="148" width="360" height="360" rx="22" fill="#0b1220" fill-opacity="0.72" stroke="${ac}" stroke-opacity="0.55" stroke-width="2"/>
      <circle cx="938" cy="288" r="102" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.12" stroke-width="1.5"/>
      <image href="${aUri}" x="858" y="208" width="160" height="160" preserveAspectRatio="xMidYMid meet"/>
      <text x="938" y="446" text-anchor="middle" fill="#ffffff" font-family="'Noto Sans Display','Noto Sans',sans-serif" font-weight="800" font-size="30">${svgEsc(aName)}</text>
      <text x="938" y="478" text-anchor="middle" fill="#94a3b8" font-family="'Noto Sans',sans-serif" font-weight="600" font-size="15">ГОСТИ</text>

      <!-- Center VS / Clock -->
      <rect x="496" y="216" width="208" height="44" rx="8" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.18"/>
      <text x="600" y="244" text-anchor="middle" fill="#facc15" font-family="'Noto Sans Display','Noto Sans',sans-serif" font-weight="800" font-size="16" letter-spacing="1.4">${isDone ? "ИТОГОВЫЙ СЧЁТ" : "АФИША МАТЧА"}</text>
      <text x="600" y="346" text-anchor="middle" fill="#ffffff" font-family="'Noto Sans Display','Noto Sans',sans-serif" font-weight="900" font-size="78" letter-spacing="2">${svgEsc(centerMain)}</text>
      <rect x="496" y="382" width="208" height="58" rx="10" fill="url(#accentBar)"/>
      <text x="600" y="418" text-anchor="middle" fill="#ffffff" font-family="'JetBrains Mono','Noto Sans',monospace" font-weight="800" font-size="24">${svgEsc(rTime)} МСК</text>

      <!-- Footer -->
      <rect x="48" y="556" width="1104" height="72" rx="14" fill="#0b1220" fill-opacity="0.88" stroke="#ffffff" stroke-opacity="0.14"/>
      <circle cx="86" cy="592" r="5" fill="${meta.secondary}"/>
      <text x="102" y="599" fill="#e2e8f0" font-family="'Noto Sans',sans-serif" font-weight="600" font-size="20">${svgEsc(truncText(venueLine, 55))}</text>
      <text x="1120" y="599" text-anchor="end" fill="#94a3b8" font-family="'Noto Sans Display','Noto Sans',sans-serif" font-weight="700" font-size="17">ВИРТ РПЛ · ПРЯМОЙ ЭФИР</text>
    </svg>`;

    const sharp = await getSharp();
    const buffer = await sharp(Buffer.from(svg), { density: 144 }).png({ compressionLevel: 9 }).toBuffer();
    return { buffer, svg };
  }

  async function renderScheduleCardPng(comp: string, title: string, subtitle: string, items: any[]): Promise<{ buffer: Buffer; svg: string }> {
    const meta = COMP_META[comp] || COMP_META.rpl;
    const rows = items.slice(0, 12);
    const twoCols = rows.length > 6;
    const rowCount = twoCols ? Math.ceil(rows.length / 2) : Math.max(1, rows.length);
    const rowH = 92;
    const headerH = 148;
    const footerH = 68;
    const height = headerH + rowCount * rowH + footerH + 24;

    const logos = await Promise.all(
      rows.map(async (it) => ({
        h: await resolveLogoDataUri(it.homeLogo, it.homeName, it.homeColors),
        a: await resolveLogoDataUri(it.awayLogo, it.awayName, it.awayColors),
      }))
    );

    const rowMarkup = rows.map((it, idx) => {
      const col = twoCols ? Math.floor(idx / rowCount) : 0;
      const rIdx = twoCols ? idx % rowCount : idx;
      const x = twoCols ? (col === 0 ? 48 : 616) : 48;
      const w = twoCols ? 536 : 1104;
      const y = headerH + rIdx * rowH;
      const l = logos[idx];
      const timeStr = String(it.realTime || "19:00").slice(0, 5);
      const scoreOrVs = it.status === "done" ? `${it.hg ?? 0}:${it.ag ?? 0}` : "—";
      const hName = truncText(it.homeName, twoCols ? 13 : 22);
      const aName = truncText(it.awayName, twoCols ? 13 : 22);
      const midX = x + w / 2;
      return `
        <g>
          <rect x="${x}" y="${y}" width="${w}" height="78" rx="12" fill="#0f172a" fill-opacity="0.88" stroke="#ffffff" stroke-opacity="0.12"/>
          <rect x="${x + 14}" y="${y + 18}" width="78" height="42" rx="8" fill="${meta.primary}" fill-opacity="0.9"/>
          <text x="${x + 53}" y="${y + 45}" text-anchor="middle" fill="#ffffff" font-family="'JetBrains Mono','Noto Sans',monospace" font-weight="800" font-size="16">${svgEsc(timeStr)}</text>
          ${twoCols ? `
            <image href="${l.h}" x="${x + 104}" y="${y + 19}" width="40" height="40"/>
            <text x="${x + 152}" y="${y + 45}" fill="#f8fafc" font-family="'Noto Sans',sans-serif" font-weight="700" font-size="16">${svgEsc(hName)}</text>
            <text x="${x + w - 152}" y="${y + 45}" text-anchor="end" fill="#f8fafc" font-family="'Noto Sans',sans-serif" font-weight="700" font-size="16">${svgEsc(aName)}</text>
            <image href="${l.a}" x="${x + w - 144}" y="${y + 19}" width="40" height="40"/>
            <text x="${midX + 36}" y="${y + 45}" text-anchor="middle" fill="#94a3b8" font-family="'Noto Sans Display',sans-serif" font-weight="800" font-size="15">${svgEsc(scoreOrVs)}</text>
          ` : `
            <text x="${midX - 88}" y="${y + 45}" text-anchor="end" fill="#f8fafc" font-family="'Noto Sans',sans-serif" font-weight="700" font-size="21">${svgEsc(hName)}</text>
            <image href="${l.h}" x="${midX - 76}" y="${y + 15}" width="48" height="48"/>
            <rect x="${midX - 20}" y="${y + 21}" width="56" height="36" rx="8" fill="#1e293b"/>
            <text x="${midX + 8}" y="${y + 45}" text-anchor="middle" fill="#facc15" font-family="'JetBrains Mono','Noto Sans',monospace" font-weight="800" font-size="18">${svgEsc(scoreOrVs)}</text>
            <image href="${l.a}" x="${midX + 44}" y="${y + 15}" width="48" height="48"/>
            <text x="${midX + 104}" y="${y + 45}" fill="#f8fafc" font-family="'Noto Sans',sans-serif" font-weight="700" font-size="21">${svgEsc(aName)}</text>
            <text x="${x + w - 20}" y="${y + 44}" text-anchor="end" fill="#94a3b8" font-family="'Noto Sans',sans-serif" font-weight="500" font-size="14">${svgEsc(truncText(it.roundLabel || "", 24))}</text>
          `}
        </g>
      `;
    }).join("");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}">
      <defs>
        <linearGradient id="sbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#070b14"/><stop offset="100%" stop-color="#111827"/></linearGradient>
        <linearGradient id="sbar" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${meta.primary}"/><stop offset="100%" stop-color="${meta.secondary}"/></linearGradient>
      </defs>
      <rect width="1200" height="${height}" fill="url(#sbg)"/>
      <rect x="0" y="0" width="1200" height="6" fill="url(#sbar)"/>
      <rect x="48" y="34" width="290" height="34" rx="6" fill="url(#sbar)"/>
      <text x="64" y="57" fill="#ffffff" font-family="'Noto Sans Display','Noto Sans',sans-serif" font-weight="800" font-size="15">${svgEsc(meta.title)}</text>
      <text x="48" y="106" fill="#ffffff" font-family="'Noto Sans Display','Noto Sans',sans-serif" font-weight="900" font-size="34">${svgEsc(truncText(title, 42))}</text>
      <text x="1152" y="104" text-anchor="end" fill="#94a3b8" font-family="'Noto Sans',sans-serif" font-weight="600" font-size="18">${svgEsc(subtitle)} · ВРЕМЯ МСК</text>
      ${rows.length ? rowMarkup : `<text x="600" y="${headerH + 55}" text-anchor="middle" fill="#94a3b8" font-family="'Noto Sans',sans-serif" font-size="22">На выбранную дату матчей не запланировано</text>`}
      <text x="48" y="${height - 28}" fill="#64748b" font-family="'Noto Sans',sans-serif" font-weight="600" font-size="15">Матчей в карточке: ${items.length} · Вирт РПЛ Бродкаст</text>
      <text x="1152" y="${height - 28}" text-anchor="end" fill="#94a3b8" font-family="'Noto Sans Display','Noto Sans',sans-serif" font-weight="700" font-size="15">ОФИЦИАЛЬНОЕ РАСПИСАНИЕ</text>
    </svg>`;

    const sharp = await getSharp();
    const buffer = await sharp(Buffer.from(svg), { density: 144 }).png({ compressionLevel: 9 }).toBuffer();
    return { buffer, svg };
  }

  async function renderBestTeamPitchPng(title: string, subtitle: string, awardData: any, comp: string): Promise<{ buffer: Buffer; svg: string }> {
    const meta = COMP_META[comp] || COMP_META.rpl;
    const starters: any[] = Array.isArray(awardData?.starters) ? awardData.starters : [];

    // Группируем по линиям для отрисовки на тактическом поле
    const gk = starters.filter((p) => String(p.pos || "") === "ВР");
    const defs = starters.filter((p) => ["ЦЗ", "ЛЗ", "ПЗ", "ЛФЗ", "ПФЗ", "ЗАЩ"].includes(String(p.pos || "")));
    const fwds = starters.filter((p) => ["ЦФ", "ЛВ", "ПВ", "СТ", "НАП"].includes(String(p.pos || "")));
    const usedSet = new Set([...gk, ...defs, ...fwds]);
    const mids = starters.filter((p) => !usedSet.has(p));

    const pitchRows = [
      { y: 205, list: fwds },
      { y: 375, list: mids },
      { y: 545, list: defs },
      { y: 715, list: gk },
    ].filter((r) => r.list.length > 0);

    const allWithLogos = await Promise.all(
      starters.map(async (p) => ({
        p,
        logoUri: await resolveLogoDataUri(p.teamLogo || "", p.team || "Клуб", ctx.getTeamColors(p.team || "")),
      }))
    );
    const logoByPid = new Map(allWithLogos.map((x) => [x.p.pid || x.p.playerId || x.p.name, x.logoUri]));

    const bp = awardData?.bestPlayer;
    const coach = awardData?.coachOfRound || awardData?.coachOfMonth;
    const bpLogo = bp ? await resolveLogoDataUri(bp.teamLogo || "", bp.team || "", ctx.getTeamColors(bp.team || "")) : "";
    const coachLogo = coach ? await resolveLogoDataUri(coach.teamLogo || "", coach.teamName || "", ctx.getTeamColors(coach.teamName || "")) : "";

    const pitchNodes = pitchRows.map((row) => {
      const n = row.list.length;
      const pitchLeft = 72;
      const pitchW = 700;
      const step = pitchW / (n + 1);
      return row.list.map((pl, idx) => {
        const cx = Math.round(pitchLeft + step * (idx + 1));
        const cy = row.y;
        const uri = logoByPid.get(pl.pid || pl.playerId || pl.name) || "";
        const sur = truncText(String(pl.name || "Игрок").split(" ").slice(-1)[0] || pl.name, 14);
        const rat = Number(pl.rating || pl.avgRating || 7.5).toFixed(1);
        return `
          <g>
            <circle cx="${cx}" cy="${cy}" r="33" fill="#09111a" stroke="#facc15" stroke-width="2.5"/>
            <image href="${uri}" x="${cx - 21}" y="${cy - 21}" width="42" height="42"/>
            <rect x="${cx + 12}" y="${cy - 34}" width="40" height="22" rx="6" fill="#facc15"/>
            <text x="${cx + 32}" y="${cy - 18}" text-anchor="middle" fill="#09111a" font-family="'JetBrains Mono',monospace" font-weight="800" font-size="13">${svgEsc(rat)}</text>
            <rect x="${cx - 60}" y="${cy + 36}" width="120" height="24" rx="5" fill="#09111a" fill-opacity="0.92"/>
            <text x="${cx}" y="${cy + 53}" text-anchor="middle" fill="#ffffff" font-family="'Noto Sans',sans-serif" font-weight="800" font-size="13.5">${svgEsc(sur)}</text>
            <text x="${cx}" y="${cy + 75}" text-anchor="middle" fill="#bbf7d0" font-family="'Noto Sans',sans-serif" font-weight="600" font-size="11">${svgEsc(pl.pos)}${pl.stat ? ` · ${svgEsc(truncText(pl.stat, 12))}` : ""}</text>
          </g>
        `;
      }).join("");
    }).join("");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="860" viewBox="0 0 1200 860">
      <defs>
        <linearGradient id="abg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#070b14"/><stop offset="100%" stop-color="#0d1726"/></linearGradient>
        <linearGradient id="turf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0e4429"/><stop offset="100%" stop-color="#082e1c"/></linearGradient>
        <linearGradient id="abar" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${meta.primary}"/><stop offset="100%" stop-color="${meta.secondary}"/></linearGradient>
      </defs>
      <rect width="1200" height="860" fill="url(#abg)"/>
      <rect x="0" y="0" width="1200" height="6" fill="url(#abar)"/>

      <!-- Header -->
      <rect x="48" y="30" width="280" height="34" rx="6" fill="url(#abar)"/>
      <text x="64" y="52" fill="#ffffff" font-family="'Noto Sans Display',sans-serif" font-weight="800" font-size="15">${svgEsc(meta.title)}</text>
      <text x="48" y="102" fill="#ffffff" font-family="'Noto Sans Display',sans-serif" font-weight="900" font-size="34">${svgEsc(title)}</text>
      <text x="1152" y="98" text-anchor="end" fill="#cbd5e1" font-family="'Noto Sans',sans-serif" font-weight="700" font-size="20">${svgEsc(subtitle)} · ${svgEsc(awardData?.formation || "4-3-3")}</text>

      <!-- Pitch -->
      <rect x="48" y="128" width="748" height="684" rx="18" fill="url(#turf)" stroke="#34d399" stroke-opacity="0.35" stroke-width="2"/>
      <rect x="72" y="148" width="700" height="644" rx="6" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="2"/>
      <line x1="72" y1="470" x2="772" y2="470" stroke="#ffffff" stroke-opacity="0.22" stroke-width="2"/>
      <circle cx="422" cy="470" r="78" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="2"/>
      <rect x="262" y="148" width="320" height="106" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="2"/>
      <rect x="262" y="686" width="320" height="106" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="2"/>
      ${pitchNodes}

      <!-- Studio Sidebar -->
      <rect x="822" y="128" width="330" height="330" rx="16" fill="#0f172a" stroke="#facc15" stroke-opacity="0.45" stroke-width="2"/>
      <text x="848" y="166" fill="#facc15" font-family="'Noto Sans Display',sans-serif" font-weight="800" font-size="15" letter-spacing="1">ЛУЧШИЙ ИГРОК</text>
      ${bp ? `
        <image href="${bpLogo}" x="848" y="190" width="72" height="72"/>
        <rect x="1032" y="196" width="94" height="54" rx="10" fill="#facc15"/>
        <text x="1079" y="233" text-anchor="middle" fill="#09111a" font-family="'JetBrains Mono',monospace" font-weight="900" font-size="28">${svgEsc(Number(bp.rating || bp.avgRating || 8).toFixed(1))}</text>
        <text x="848" y="302" fill="#ffffff" font-family="'Noto Sans Display',sans-serif" font-weight="800" font-size="24">${svgEsc(truncText(bp.name, 20))}</text>
        <text x="848" y="332" fill="#94a3b8" font-family="'Noto Sans',sans-serif" font-weight="600" font-size="16">${svgEsc(bp.pos)} · ${svgEsc(truncText(bp.team, 22))}</text>
        <text x="848" y="370" fill="#34d399" font-family="'Noto Sans',sans-serif" font-weight="700" font-size="16">${svgEsc(truncText(bp.stat || "MVP", 32))}</text>
        <text x="848" y="408" fill="#cbd5e1" font-family="'Noto Sans',sans-serif" font-size="13">${svgEsc(truncText(bp.reason || "", 42))}</text>
      ` : `<text x="848" y="230" fill="#94a3b8" font-family="'Noto Sans',sans-serif" font-size="16">Данные формируются</text>`}

      <rect x="822" y="482" width="330" height="330" rx="16" fill="#0f172a" stroke="#38bdf8" stroke-opacity="0.35" stroke-width="2"/>
      <text x="848" y="520" fill="#38bdf8" font-family="'Noto Sans Display',sans-serif" font-weight="800" font-size="15" letter-spacing="1">${svgEsc((coach?.title || "ТРЕНЕР").toUpperCase())}</text>
      ${coach ? `
        <image href="${coachLogo}" x="848" y="544" width="68" height="68"/>
        <text x="848" y="652" fill="#ffffff" font-family="'Noto Sans Display',sans-serif" font-weight="800" font-size="23">${svgEsc(truncText(coach.coach?.name || "Главный тренер", 22))}</text>
        <text x="848" y="684" fill="#94a3b8" font-family="'Noto Sans',sans-serif" font-weight="700" font-size="17">«${svgEsc(truncText(coach.teamName || "", 24))}»</text>
        <text x="848" y="732" fill="#cbd5e1" font-family="'Noto Sans',sans-serif" font-size="14">${svgEsc(truncText(coach.reason || "", 42))}</text>
      ` : `<text x="848" y="584" fill="#94a3b8" font-family="'Noto Sans',sans-serif" font-size="16">Данные формируются</text>`}
    </svg>`;

    const sharp = await getSharp();
    const buffer = await sharp(Buffer.from(svg), { density: 144 }).png({ compressionLevel: 9 }).toBuffer();
    return { buffer, svg };
  }

  async function renderStandingsPosterPng(comp: string, title: string, subtitle: string): Promise<{ buffer: Buffer; svg: string }> {
    const db = ctx.getDb();
    const meta = COMP_META[comp] || COMP_META.rpl;

    if (comp === "cup") {
      if (db.cupState2026) ctx.recalculateCupGroups(db.cupState2026, ctx.seasonFx());
      const groupsObj = db.cupState2026?.rplGroups || {};
      const groupKeys = ["A", "B", "C", "D"].filter((k) => groupsObj[k]?.table?.length);
      if (groupKeys.length) {
        const allLogos = new Map<string, string>();
        for (const gk of groupKeys) {
          for (const r of groupsObj[gk].table || []) {
            allLogos.set(r.id, await resolveLogoDataUri(r.logo || ctx.teamLogo(r.id), r.name, ctx.getTeamColors(r.name)));
          }
        }
        const cardMarkup = groupKeys.map((gk, idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const gx = col === 0 ? 48 : 616;
          const gy = 148 + row * 316;
          const tbl: any[] = groupsObj[gk].table || [];
          const rowsSvg = tbl.slice(0, 4).map((r, ri) => {
            const ry = gy + 74 + ri * 56;
            const zoneClr = ri < 2 ? "#22c55e" : ri === 2 ? "#f59e0b" : "#ef4444";
            const uri = allLogos.get(r.id) || "";
            return `
              <rect x="${gx + 14}" y="${ry}" width="508" height="48" rx="8" fill="#131d31"/>
              <rect x="${gx + 14}" y="${ry}" width="6" height="48" rx="3" fill="${zoneClr}"/>
              <text x="${gx + 34}" y="${ry + 30}" fill="#94a3b8" font-family="'JetBrains Mono',monospace" font-weight="800" font-size="16">${ri + 1}</text>
              <image href="${uri}" x="${gx + 54}" y="${ry + 8}" width="32" height="32"/>
              <text x="${gx + 96}" y="${ry + 30}" fill="#f8fafc" font-family="'Noto Sans',sans-serif" font-weight="700" font-size="17">${svgEsc(truncText(r.name, 19))}</text>
              <text x="${gx + 368}" y="${ry + 30}" text-anchor="end" fill="#94a3b8" font-family="'JetBrains Mono',monospace" font-size="15">${r.p}и</text>
              <text x="${gx + 432}" y="${ry + 30}" text-anchor="end" fill="#cbd5e1" font-family="'JetBrains Mono',monospace" font-size="15">${r.gf}-${r.ga}</text>
              <text x="${gx + 502}" y="${ry + 30}" text-anchor="end" fill="#facc15" font-family="'JetBrains Mono',monospace" font-weight="900" font-size="19">${r.pts}</text>
            `;
          }).join("");
          return `
            <g>
              <rect x="${gx}" y="${gy}" width="536" height="296" rx="16" fill="#0b1220" stroke="#ffffff" stroke-opacity="0.14"/>
              <text x="${gx + 22}" y="${gy + 42}" fill="#ffffff" font-family="'Noto Sans Display',sans-serif" font-weight="800" font-size="22">ГРУППА ${svgEsc(gk)}</text>
              <text x="${gx + 514}" y="${gy + 40}" text-anchor="end" fill="#64748b" font-family="'JetBrains Mono',monospace" font-size="13">И · МЯЧИ · О</text>
              ${rowsSvg}
            </g>
          `;
        }).join("");

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="835" viewBox="0 0 1200 835">
          <defs><linearGradient id="cbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#070b14"/><stop offset="100%" stop-color="#111827"/></linearGradient>
          <linearGradient id="cbar" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${meta.primary}"/><stop offset="100%" stop-color="${meta.secondary}"/></linearGradient></defs>
          <rect width="1200" height="835" fill="url(#cbg)"/>
          <rect x="0" y="0" width="1200" height="6" fill="url(#cbar)"/>
          <rect x="48" y="30" width="310" height="34" rx="6" fill="url(#cbar)"/>
          <text x="64" y="52" fill="#ffffff" font-family="'Noto Sans Display',sans-serif" font-weight="800" font-size="15">${svgEsc(meta.title)}</text>
          <text x="48" y="106" fill="#ffffff" font-family="'Noto Sans Display',sans-serif" font-weight="900" font-size="34">${svgEsc(title)}</text>
          <text x="1152" y="102" text-anchor="end" fill="#94a3b8" font-family="'Noto Sans',sans-serif" font-weight="600" font-size="19">${svgEsc(subtitle)}</text>
          ${cardMarkup}
          <circle cx="54" cy="800" r="6" fill="#22c55e"/>
          <text x="68" y="805" fill="#94a3b8" font-family="'Noto Sans',sans-serif" font-size="14">1–2 место: 1/8 Пути РПЛ</text>
          <circle cx="290" cy="800" r="6" fill="#f59e0b"/>
          <text x="304" y="805" fill="#94a3b8" font-family="'Noto Sans',sans-serif" font-size="14">3 место: Путь регионов</text>
          <circle cx="520" cy="800" r="6" fill="#ef4444"/>
          <text x="534" y="805" fill="#94a3b8" font-family="'Noto Sans',sans-serif" font-size="14">4 место: Вылет</text>
        </svg>`;
        const sharp = await getSharp();
        const buffer = await sharp(Buffer.from(svg), { density: 144 }).png({ compressionLevel: 9 }).toBuffer();
        return { buffer, svg };
      }
    }

    const rows = ctx.table(comp).slice(0, 20);
    const logos = await Promise.all(rows.map((r) => resolveLogoDataUri(r.logo || ctx.teamLogo(r.id), r.name, r.colors)));
    const rowH = 44;
    const headerH = 176;
    const height = headerH + Math.max(1, rows.length) * rowH + 64;

    const rowsSvg = rows.map((r, i) => {
      const y = headerH + i * rowH;
      let zColor = "#334155";
      if (comp === "rpl") {
        if (r.pos === 1) zColor = "#eab308";
        else if (r.pos <= 3) zColor = "#22c55e";
        else if (r.pos === 13 || r.pos === 14) zColor = "#f97316";
        else if (r.pos >= 15) zColor = "#ef4444";
      } else if (comp === "fnl") {
        if (r.pos <= 2) zColor = "#22c55e";
        else if (r.pos <= 4) zColor = "#38bdf8";
        else if (r.pos >= rows.length - 2) zColor = "#ef4444";
      }
      const gd = Number(r.gd ?? (r.gf - r.ga));
      const gdTxt = gd > 0 ? `+${gd}` : `${gd}`;
      const formArr = String(r.form || "").slice(-5).split("");
      const formDots = formArr.map((ch, fi) => {
        const fc = ch === "В" ? "#22c55e" : ch === "Н" ? "#f59e0b" : "#ef4444";
        return `<circle cx="${994 + fi * 18}" cy="${y + 20}" r="6" fill="${fc}"/>`;
      }).join("");
      return `
        <rect x="48" y="${y}" width="1104" height="39" rx="7" fill="${i % 2 === 0 ? "#0f172a" : "#0b1220"}"/>
        <rect x="48" y="${y}" width="6" height="39" rx="3" fill="${zColor}"/>
        <text x="76" y="${y + 26}" text-anchor="middle" fill="#cbd5e1" font-family="'JetBrains Mono',monospace" font-weight="800" font-size="15">${r.pos}</text>
        <image href="${logos[i]}" x="98" y="${y + 5}" width="29" height="29"/>
        <text x="140" y="${y + 25}" fill="#ffffff" font-family="'Noto Sans',sans-serif" font-weight="700" font-size="16">${svgEsc(truncText(r.name, 26))}</text>
        <text x="530" y="${y + 25}" text-anchor="middle" fill="#cbd5e1" font-family="'JetBrains Mono',monospace" font-size="15">${r.p}</text>
        <text x="595" y="${y + 25}" text-anchor="middle" fill="#cbd5e1" font-family="'JetBrains Mono',monospace" font-size="15">${r.w}</text>
        <text x="655" y="${y + 25}" text-anchor="middle" fill="#cbd5e1" font-family="'JetBrains Mono',monospace" font-size="15">${r.d}</text>
        <text x="715" y="${y + 25}" text-anchor="middle" fill="#cbd5e1" font-family="'JetBrains Mono',monospace" font-size="15">${r.l}</text>
        <text x="795" y="${y + 25}" text-anchor="middle" fill="#94a3b8" font-family="'JetBrains Mono',monospace" font-size="15">${r.gf}-${r.ga}</text>
        <text x="868" y="${y + 25}" text-anchor="middle" fill="${gd > 0 ? "#4ade80" : gd < 0 ? "#f87171" : "#94a3b8"}" font-family="'JetBrains Mono',monospace" font-size="15">${gdTxt}</text>
        <text x="938" y="${y + 26}" text-anchor="middle" fill="#facc15" font-family="'JetBrains Mono',monospace" font-weight="900" font-size="18">${r.pts}</text>
        ${formDots}
      `;
    }).join("");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}">
      <defs><linearGradient id="tbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#070b14"/><stop offset="100%" stop-color="#111827"/></linearGradient>
      <linearGradient id="tbar" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${meta.primary}"/><stop offset="100%" stop-color="${meta.secondary}"/></linearGradient></defs>
      <rect width="1200" height="${height}" fill="url(#tbg)"/>
      <rect x="0" y="0" width="1200" height="6" fill="url(#tbar)"/>
      <rect x="48" y="28" width="290" height="32" rx="6" fill="url(#tbar)"/>
      <text x="64" y="49" fill="#ffffff" font-family="'Noto Sans Display',sans-serif" font-weight="800" font-size="14">${svgEsc(meta.title)}</text>
      <text x="48" y="100" fill="#ffffff" font-family="'Noto Sans Display',sans-serif" font-weight="900" font-size="33">${svgEsc(title)}</text>
      <text x="1152" y="96" text-anchor="end" fill="#94a3b8" font-family="'Noto Sans',sans-serif" font-weight="600" font-size="18">${svgEsc(subtitle)}</text>
      <text x="76" y="154" text-anchor="middle" fill="#64748b" font-family="'Noto Sans',sans-serif" font-weight="700" font-size="13">#</text>
      <text x="140" y="154" fill="#64748b" font-family="'Noto Sans',sans-serif" font-weight="700" font-size="13">КОМАНДА</text>
      <text x="530" y="154" text-anchor="middle" fill="#64748b" font-family="'Noto Sans',sans-serif" font-weight="700" font-size="13">И</text>
      <text x="595" y="154" text-anchor="middle" fill="#64748b" font-family="'Noto Sans',sans-serif" font-weight="700" font-size="13">В</text>
      <text x="655" y="154" text-anchor="middle" fill="#64748b" font-family="'Noto Sans',sans-serif" font-weight="700" font-size="13">Н</text>
      <text x="715" y="154" text-anchor="middle" fill="#64748b" font-family="'Noto Sans',sans-serif" font-weight="700" font-size="13">П</text>
      <text x="795" y="154" text-anchor="middle" fill="#64748b" font-family="'Noto Sans',sans-serif" font-weight="700" font-size="13">МЯЧИ</text>
      <text x="868" y="154" text-anchor="middle" fill="#64748b" font-family="'Noto Sans',sans-serif" font-weight="700" font-size="13">±</text>
      <text x="938" y="154" text-anchor="middle" fill="#facc15" font-family="'Noto Sans',sans-serif" font-weight="800" font-size="13">О</text>
      <text x="1030" y="154" text-anchor="middle" fill="#64748b" font-family="'Noto Sans',sans-serif" font-weight="700" font-size="13">ФОРМА</text>
      ${rowsSvg}
      <text x="48" y="${height - 22}" fill="#64748b" font-family="'Noto Sans',sans-serif" font-size="13">Сезон ${svgEsc(ctx.S())} · Обновлено автоматически сразу после завершения тура</text>
    </svg>`;

    const sharp = await getSharp();
    const buffer = await sharp(Buffer.from(svg), { density: 144 }).png({ compressionLevel: 9 }).toBuffer();
    return { buffer, svg };
  }

  async function renderNationalSquadPosterPng(enriched: any, teamType: "main" | "u21", mode: "extended" | "final"): Promise<{ buffer: Buffer; svg: string }> {
    const isU21 = teamType === "u21";
    const list: any[] = mode === "final" ? (enriched.finalPlayers || []) : (enriched.extendedPlayers || []);
    const rfLogo = await resolveLogoDataUri("/assets/aistudio/russia_russia-national-team.football-logos.cc_2a5e3ddc.svg", "Россия", { primary: "#1d4ed8", secondary: "#dc2626" });

    const groups = [
      { title: "ВРАТАРИ", accent: "#facc15", poses: new Set(["ВР"]) },
      { title: "ЗАЩИТНИКИ", accent: "#38bdf8", poses: new Set(["ЛЗ", "ЛФЗ", "ЦЗ", "ПЗ", "ПФЗ", "ЗАЩ"]) },
      { title: "ПОЛУЗАЩИТНИКИ", accent: "#34d399", poses: new Set(["ОП", "ЛП", "ЦП", "ПП", "АП"]) },
      { title: "НАПАДАЮЩИЕ", accent: "#f87171", poses: new Set(["ЛВ", "ЦФ", "СТ", "ПВ", "НАП"]) },
    ];
    const used = new Set<string>();
    const cols = groups.map((g) => {
      const items = list.filter((p) => g.poses.has(String(p.pos || "")));
      items.forEach((p) => used.add(String(p.id)));
      return { ...g, items };
    });
    const extra = list.filter((p) => !used.has(String(p.id)));
    if (extra.length) cols[2].items.push(...extra);

    const maxItems = Math.max(4, ...cols.map((c) => c.items.length));
    const itemH = 44;
    const headerH = 160;
    const footerH = 88;
    const height = headerH + 64 + maxItems * itemH + footerH;

    const logoMap = new Map<string, string>();
    await Promise.all(
      list.slice(0, 60).map(async (p) => {
        const key = String(p.teamLogo || p.teamName || p.id);
        if (!logoMap.has(key)) {
          logoMap.set(key, await resolveLogoDataUri(p.teamLogo || "", p.teamName || "Клуб", ctx.getTeamColors(p.teamName || "")));
        }
      })
    );

    const colSvg = cols.map((col, ci) => {
      const x = 44 + ci * 282;
      const w = 266;
      const rows = col.items.slice(0, 18).map((p, pi) => {
        const py = headerH + 54 + pi * itemH;
        const lUri = logoMap.get(String(p.teamLogo || p.teamName || p.id)) || "";
        return `
          <rect x="${x + 10}" y="${py}" width="${w - 20}" height="38" rx="7" fill="#111a2c"/>
          <image href="${lUri}" x="${x + 17}" y="${py + 6}" width="26" height="26"/>
          <text x="${x + 50}" y="${py + 18}" fill="#ffffff" font-family="'Noto Sans',sans-serif" font-weight="700" font-size="13.5">${svgEsc(truncText(p.name, 19))}</text>
          <text x="${x + 50}" y="${py + 32}" fill="#94a3b8" font-family="'Noto Sans',sans-serif" font-size="11">${svgEsc(p.pos)} · ${svgEsc(truncText(p.teamName || "", 18))}</text>
        `;
      }).join("");
      return `
        <rect x="${x}" y="${headerH}" width="${w}" height="${maxItems * itemH + 68}" rx="14" fill="#0b1220" stroke="${col.accent}" stroke-opacity="0.32" stroke-width="1.5"/>
        <text x="${x + 16}" y="${headerH + 34}" fill="${col.accent}" font-family="'Noto Sans Display',sans-serif" font-weight="800" font-size="15">${svgEsc(col.title)} (${col.items.length})</text>
        ${rows || `<text x="${x + 16}" y="${headerH + 74}" fill="#64748b" font-family="'Noto Sans',sans-serif" font-size="13">Нет игроков</text>`}
      `;
    }).join("");

    const matchesText = (enriched.matches || []).slice(0, 3).map((m: any) => {
      const pair = m.home !== false ? `${isU21 ? "Россия U21" : "Россия"} — ${m.opponent}` : `${m.opponent} — ${isU21 ? "Россия U21" : "Россия"}`;
      return `${pair} (${ctx.ruDateStr(m.gameDate || m.date || "")})`;
    }).join("   ·   ");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}">
      <defs><linearGradient id="nbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#070b14"/><stop offset="100%" stop-color="#111827"/></linearGradient></defs>
      <rect width="1200" height="${height}" fill="url(#nbg)"/>
      <rect x="0" y="0" width="400" height="7" fill="#ffffff"/>
      <rect x="400" y="0" width="400" height="7" fill="#0039a6"/>
      <rect x="800" y="0" width="400" height="7" fill="#d52b1e"/>
      <image href="${rfLogo}" x="44" y="34" width="84" height="84"/>
      <text x="148" y="64" fill="#38bdf8" font-family="'Noto Sans Display',sans-serif" font-weight="800" font-size="16" letter-spacing="1.2">${mode === "final" ? "ИТОГОВЫЙ ВЫЗОВ · КОГО ВЫЗВАЛИ" : "РАСШИРЕННЫЙ СОСТАВ СБОРНОЙ"}</text>
      <text x="148" y="106" fill="#ffffff" font-family="'Noto Sans Display',sans-serif" font-weight="900" font-size="34">${isU21 ? "МОЛОДЁЖНАЯ СБОРНАЯ РОССИИ U21" : "НАЦИОНАЛЬНАЯ СБОРНАЯ РОССИИ"}</text>
      <text x="1156" y="72" text-anchor="end" fill="#cbd5e1" font-family="'Noto Sans',sans-serif" font-weight="700" font-size="18">${svgEsc(truncText(enriched.title || "Сбор", 36))}</text>
      <text x="1156" y="102" text-anchor="end" fill="#facc15" font-family="'JetBrains Mono',monospace" font-weight="800" font-size="19">ИГРОКОВ: ${list.length}</text>
      ${colSvg}
      <text x="44" y="${height - 28}" fill="#94a3b8" font-family="'Noto Sans',sans-serif" font-weight="600" font-size="14">${matchesText ? `Матчи: ${svgEsc(truncText(matchesText, 95))}` : "Российский Футбольный Союз · Официальная заявка"}</text>
    </svg>`;

    const sharp = await getSharp();
    const buffer = await sharp(Buffer.from(svg), { density: 144 }).png({ compressionLevel: 9 }).toBuffer();
    return { buffer, svg };
  }

  /* ────────────── Построители HTML-постов и пакетов ────────────── */

  function buildScheduleHtmlText(comp: string, dateOrRoundTitle: string, items: any[]): string {
    const meta = COMP_META[comp] || COMP_META.rpl;
    const siteUrl = String(ctx.getDb()?.settings?.siteUrl || "").trim().replace(/\/+$/, "");
    const lines = [
      `📅 <b>${ctx.esc(meta.title)} · ${ctx.esc(dateOrRoundTitle)}</b>`,
      "",
    ];
    if (!items.length) {
      lines.push("На выбранный день официальных матчей не запланировано.");
    } else {
      for (const it of items) {
        const tm = ctx.esc(String(it.realTime || "19:00").slice(0, 5));
        const stStr = it.status === "done" ? ` — <b>${it.hg ?? 0}:${it.ag ?? 0}</b>` : it.status === "live" ? " — 🔴 LIVE" : "";
        const venue = it.stadium ? ` <i>(${ctx.esc(it.stadium)})</i>` : "";
        lines.push(`⏰ <b>${tm} МСК</b> · ${ctx.esc(it.homeName)} — ${ctx.esc(it.awayName)}${stStr}${venue}`);
      }
    }
    if (siteUrl) lines.push("", `🌐 Прямые трансляции и составы: ${ctx.esc(siteUrl)}`);
    return lines.join("\n").trim();
  }

  function buildPosterHtmlText(posterData: any): string {
    const meta = COMP_META[posterData.comp] || COMP_META.rpl;
    const siteUrl = String(ctx.getDb()?.settings?.siteUrl || "").trim().replace(/\/+$/, "");
    const lines = [
      `🔥 <b>АФИША МАТЧА · ${ctx.esc(meta.title)}</b>`,
      `🏟 <b>${ctx.esc(posterData.homeName)} — ${ctx.esc(posterData.awayName)}</b>`,
      `🏆 ${ctx.esc(posterData.roundLabel || "")}`,
      `⏰ Начало: <b>${ctx.esc(ctx.ruDateStr(posterData.realDate))} в ${ctx.esc(posterData.realTime)} МСК</b>`,
    ];
    if (posterData.stadium || posterData.city) {
      lines.push(`📍 ${ctx.esc([posterData.stadium, posterData.city].filter(Boolean).join(", "))}`);
    }
    if (siteUrl && posterData.id && !String(posterData.id).startsWith("nt_")) {
      lines.push("", `📺 Матч-центр: ${ctx.esc(siteUrl)}/#/match/${ctx.esc(posterData.id)}`);
    }
    return lines.join("\n");
  }

  function buildStandingsHtmlText(comp: string, title: string): string {
    const db = ctx.getDb();
    const meta = COMP_META[comp] || COMP_META.rpl;
    const siteUrl = String(db?.settings?.siteUrl || "").trim().replace(/\/+$/, "");
    const lines: string[] = [`📊 <b>${ctx.esc(meta.title)} · ${ctx.esc(title)}</b>`, ""];

    if (comp === "cup" && db.cupState2026?.rplGroups) {
      ctx.recalculateCupGroups(db.cupState2026, ctx.seasonFx());
      for (const gk of ["A", "B", "C", "D"]) {
        const g = db.cupState2026.rplGroups[gk];
        if (!g?.table?.length) continue;
        lines.push(`<b>Группа ${gk}:</b>`);
        g.table.forEach((r: any, idx: number) => {
          lines.push(`${idx + 1}. ${ctx.esc(r.name)} — <b>${r.pts} очк.</b> (${r.p}и, ${r.gf}-${r.ga})`);
        });
        lines.push("");
      }
    } else {
      const rows = ctx.table(comp);
      for (const r of rows.slice(0, 18)) {
        const gd = Number(r.gd ?? (r.gf - r.ga));
        lines.push(`${r.pos}. ${ctx.esc(r.name)} — <b>${r.pts}</b> очк. (${r.p}и, ${gd >= 0 ? "+" : ""}${gd})`);
      }
    }
    if (siteUrl) lines.push("", `🌐 Полная таблица: ${ctx.esc(siteUrl)}/#/table`);
    return lines.join("\n").trim();
  }

  function buildTeamAwardHtmlText(comp: string, isMonth: boolean, label: string, awards: any): string {
    const meta = COMP_META[comp] || COMP_META.rpl;
    const siteUrl = String(ctx.getDb()?.settings?.siteUrl || "").trim().replace(/\/+$/, "");
    const lines: string[] = [
      `🏆 <b>${isMonth ? "СБОРНАЯ МЕСЯЦА" : "СБОРНАЯ ТУРА"} · ${ctx.esc(meta.title)} · ${ctx.esc(label)}</b>`,
      "",
    ];
    if (awards?.bestPlayer) {
      const bp = awards.bestPlayer;
      lines.push(`⭐ <b>Лучший игрок:</b> ${ctx.esc(bp.name)} (${ctx.esc(bp.pos)}, «${ctx.esc(bp.team)}») — <b>${bp.rating || bp.avgRating}</b>${bp.stat ? ` · ${ctx.esc(bp.stat)}` : ""}`);
    }
    const coach = awards?.coachOfRound || awards?.coachOfMonth;
    if (coach) {
      lines.push(`👔 <b>${ctx.esc(coach.title || "Тренер")}:</b> ${ctx.esc(coach.coach?.name || "Тренер")} («${ctx.esc(coach.teamName)}»)${coach.reason ? ` — ${ctx.esc(coach.reason)}` : ""}`);
    }
    if (awards?.starters?.length) {
      lines.push("", `📋 <b>Символическая сборная (${ctx.esc(awards.formation || "4-3-3")}):</b>`);
      for (const pl of awards.starters) {
        lines.push(`• <b>${ctx.esc(pl.pos)}</b> ${ctx.esc(pl.name)} («${ctx.esc(pl.team)}») — <b>${pl.rating || pl.avgRating}</b>${pl.stat ? ` (${ctx.esc(pl.stat)})` : ""}`);
      }
    }
    if (siteUrl) lines.push("", `🌐 Все награды: ${ctx.esc(siteUrl)}/#/awards`);
    return lines.join("\n").trim();
  }

  /* ────────────── Отправка в Telegram ────────────── */

  async function sendTelegramPhotoDirect(token: string, chatId: string, photoBuffer: Buffer, captionHtml: string): Promise<{ ok: boolean; status: number; error?: string; blocked?: boolean; retryAfter?: number }> {
    const cleanCaption = captionHtml.length > 1000 ? captionHtml.slice(0, 995) + "…" : captionHtml;
    const sendAttempt = async (withHtml: boolean) => {
      const form = new FormData();
      form.append("chat_id", chatId);
      form.append("photo", new Blob([new Uint8Array(photoBuffer)], { type: "image/png" }), "broadcast.png");
      if (cleanCaption) {
        form.append("caption", withHtml ? cleanCaption : cleanCaption.replace(/<[^>]+>/g, ""));
        if (withHtml) form.append("parse_mode", "HTML");
      }
      const resp = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(20_000),
      });
      const data = await resp.json().catch(() => ({}));
      return { resp, data };
    };

    try {
      let { resp, data } = await sendAttempt(true);
      if (!resp.ok && String(data?.description || "").includes("can't parse entities")) {
        ({ resp, data } = await sendAttempt(false));
      }
      if (resp.ok && data?.ok) return { ok: true, status: 200 };
      const desc = String(data?.description || `HTTP ${resp.status}`);
      const retryAfter = resp.status === 429 ? Math.max(1, Number(data?.parameters?.retry_after || 5)) : undefined;
      const blocked = resp.status === 403 || /blocked|deactivated|chat not found/i.test(desc);
      return { ok: false, status: resp.status, error: desc, blocked, retryAfter };
    } catch (e: any) {
      return { ok: false, status: 0, error: e?.message || "Сетевая ошибка" };
    }
  }

  async function deliverNowToChannel(
    channelId: ChannelId,
    payload: { comp: string; kind: string; text: string; photoBuffer?: Buffer; caption?: string }
  ): Promise<{ channelId: ChannelId; channelName: string; ok: boolean; sentCount?: number; error?: string }> {
    const specs = getChannelSpecs();
    const cfg = specs[channelId];
    if (!cfg) return { channelId, channelName: channelId, ok: false, error: "Канал не найден" };

    if (channelId === "personal_bot") {
      const token = resolveChannelCredentials("personal_bot").token;
      if (!token) return { channelId, channelName: cfg.name, ok: false, error: "Токен бота не настроен" };
      const recipients = ctx.buildTelegramRecipientsList().filter((r) => !r.blockedBot);
      if (!recipients.length) return { channelId, channelName: cfg.name, ok: false, error: "Нет активных пользователей бота" };
      let sent = 0;
      let lastErr = "";
      for (let i = 0; i < recipients.length; i++) {
        const rec = recipients[i];
        let ok = false;
        if (payload.photoBuffer) {
          const r = await sendTelegramPhotoDirect(token, rec.tgId, payload.photoBuffer, payload.caption || payload.text);
          ok = r.ok;
          if (!r.ok && r.blocked && ctx.getDb().telegramUsers?.[`tg_${rec.tgId}`]) {
            ctx.getDb().telegramUsers[`tg_${rec.tgId}`].blockedBot = true;
          }
          if (!r.ok) lastErr = r.error || "";
        } else {
          const r = await ctx.sendTelegramDirectMessage(token, rec.tgId, payload.text, "HTML");
          ok = r.ok;
          if (!r.ok && r.blocked && ctx.getDb().telegramUsers?.[`tg_${rec.tgId}`]) {
            ctx.getDb().telegramUsers[`tg_${rec.tgId}`].blockedBot = true;
          }
          if (!r.ok) lastErr = r.error || "";
        }
        if (ok) sent++;
        if (i < recipients.length - 1) await sleep(45);
      }
      appendDispatchLog({
        channelId,
        channelName: cfg.name,
        comp: payload.comp,
        kind: payload.kind,
        hasPhoto: !!payload.photoBuffer,
        ok: sent > 0,
        error: sent === 0 ? (lastErr || "Не удалось доставить пользователям") : undefined,
        preview: `${payload.text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 110)} (${sent}/${recipients.length})`,
      });
      return { channelId, channelName: cfg.name, ok: sent > 0, sentCount: sent, error: sent === 0 ? lastErr : undefined };
    }

    const creds = resolveChannelCredentials(channelId);
    if (!creds.token) return { channelId, channelName: cfg.name, ok: false, error: "Токен бота не задан" };
    if (!creds.chatId) return { channelId, channelName: cfg.name, ok: false, error: "Не указан @канал или Chat ID" };

    let ok = false;
    let errMsg = "";
    if (payload.photoBuffer) {
      const cap = payload.caption || payload.text;
      const pr = await sendTelegramPhotoDirect(creds.token, creds.chatId, payload.photoBuffer, cap);
      if (pr.ok) {
        ok = true;
        // Если полный текст длиннее лимита подписи Telegram (1000 символов) — досылаем продолжение текстом
        if (payload.text.length > 980) {
          await ctx.sendTelegramDirectMessage(creds.token, creds.chatId, payload.text, "HTML");
        }
      } else {
        errMsg = pr.error || "Ошибка sendPhoto";
        const tr = await ctx.sendTelegramDirectMessage(creds.token, creds.chatId, payload.text, "HTML");
        if (tr.ok) {
          ok = true;
          errMsg = "";
        } else {
          errMsg = tr.error || errMsg;
        }
      }
    } else {
      const tr = await ctx.sendTelegramDirectMessage(creds.token, creds.chatId, payload.text, "HTML");
      ok = tr.ok;
      if (!tr.ok) errMsg = tr.error || "Ошибка доставки";
    }

    appendDispatchLog({
      channelId,
      channelName: cfg.name,
      comp: payload.comp,
      kind: payload.kind,
      hasPhoto: !!payload.photoBuffer,
      ok,
      error: ok ? undefined : errMsg,
      preview: payload.text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120),
    });

    return { channelId, channelName: cfg.name, ok, error: ok ? undefined : errMsg };
  }

  function resolveAutoChannels(comp: string, ruleKey: ChannelRuleKey, extraComps: string[] = []): ChannelId[] {
    const specs = getChannelSpecs();
    const targets: ChannelId[] = [];
    const consider = (cid: ChannelId | null) => {
      if (!cid || targets.includes(cid)) return;
      const cfg = specs[cid];
      if (!cfg || !cfg.enabled) return;
      if (!cfg.rules?.[ruleKey]) return;
      if (cid !== "personal_bot") {
        const creds = resolveChannelCredentials(cid);
        if (!creds.token || !creds.chatId) return;
      } else {
        // Личный бот не рассылает минутные лайв-события в ЛС
        if (ruleKey === "liveMatchEvents" || ruleKey === "transfersAndNews") return;
        const creds = resolveChannelCredentials("personal_bot");
        if (!creds.token) return;
      }
      targets.push(cid);
    };

    // 1. Матч ТВ получает ВСЁ
    consider("matchtv");
    // 2. Профильный канал турнира
    consider(mapCompetitionToChannel(comp));
    for (const ec of extraComps) consider(mapCompetitionToChannel(ec));
    // 3. Личный бот (если включено правило)
    consider("personal_bot");
    return targets;
  }

  function enqueueRoutedText(comp: string, text: string, opts?: { ruleKey?: ChannelRuleKey; extraComps?: string[]; kind?: string }) {
    if (process.env.NODE_ENV === "test" || !text) return;
    const ruleKey: ChannelRuleKey = opts?.ruleKey || "liveMatchEvents";
    const channels = resolveAutoChannels(comp, ruleKey, opts?.extraComps || []);
    for (const channelId of channels) {
      if (channelId === "personal_bot") continue; // для массовой рассылки в бот используем явные триггеры (00:01 / сборная / посты)
      for (const part of ctx.splitTgText(text)) {
        if (dispatchQueue.length >= 2500) dispatchQueue.shift();
        dispatchQueue.push({ channelId, comp: comp || "all", kind: opts?.kind || ruleKey, text: part, tries: 0 });
      }
    }
    void pumpQueue();
  }

  async function pumpQueue() {
    if (pumpRunning) return;
    pumpRunning = true;
    try {
      while (dispatchQueue.length) {
        const item = dispatchQueue.shift();
        if (!item) continue;
        const cd = channelCooldownUntil.get(item.channelId) || 0;
        if (Date.now() < cd) {
          if (dispatchQueue.length < 300) dispatchQueue.push(item);
          await sleep(1000);
          continue;
        }
        const now = Date.now();
        sentTimestamps = sentTimestamps.filter((ts) => now - ts < 61_000);
        if (sentTimestamps.length >= 18) {
          await sleep(Math.max(500, 61_000 - (now - sentTimestamps[0]) + 150));
          dispatchQueue.unshift(item);
          continue;
        }
        const creds = resolveChannelCredentials(item.channelId);
        if (!creds.token || !creds.chatId) continue;

        let ok = false;
        let err = "";
        try {
          const resp = await fetch(`https://api.telegram.org/bot${creds.token}/sendMessage`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ chat_id: creds.chatId, text: item.text, parse_mode: "HTML", disable_web_page_preview: true }),
            signal: AbortSignal.timeout(15_000),
          });
          if (resp.status === 429) {
            const j = await resp.json().catch(() => ({}));
            const retryAfter = Math.max(1, Number(j?.parameters?.retry_after || 5));
            if (item.tries < 6) {
              item.tries++;
              dispatchQueue.unshift(item);
            }
            await sleep((retryAfter + 1) * 1000);
            continue;
          }
          const data = await resp.json().catch(() => ({}));
          if (resp.ok && data?.ok) {
            ok = true;
            sentTimestamps.push(Date.now());
          } else {
            err = String(data?.description || `HTTP ${resp.status}`);
            if (resp.status === 401 || resp.status === 403) {
              channelCooldownUntil.set(item.channelId, Date.now() + 60_000);
            }
          }
        } catch (e: any) {
          err = e?.message || "Network error";
        }
        const cfg = getChannelSpecs()[item.channelId];
        if (!ok || item.kind !== "liveMatchEvents") {
          appendDispatchLog({
            channelId: item.channelId,
            channelName: cfg?.name || item.channelId,
            comp: item.comp,
            kind: item.kind,
            hasPhoto: false,
            ok,
            error: ok ? undefined : err,
            preview: item.text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120),
          });
        }
        await sleep(dispatchQueue.length > 8 ? 1800 : 950);
      }
    } finally {
      pumpRunning = false;
      if (dispatchQueue.length > 0) setTimeout(() => { void pumpQueue(); }, 1000);
    }
  }

  /* ────────────── Построитель пакетов (для Превью и Публикации) ────────────── */

  async function buildPackage(params: {
    kind: ChannelPublishKind;
    comp: string;
    round?: string;
    month?: string;
    fixtureId?: string;
    date?: string;
    teamType?: "main" | "u21";
  }): Promise<{
    title: string;
    subtitle: string;
    text: string;
    caption: string;
    photoBuffer: Buffer;
    svg: string;
    ruleKey: ChannelRuleKey;
    comp: string;
  }> {
    const db = ctx.getDb();
    const comp = ["rpl", "fnl", "cup", "national"].includes(params.comp) ? params.comp : "rpl";
    const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(String(params.date || "")) ? String(params.date) : ctx.nowMskParts().dateStr;

    if (params.kind === "poster") {
      let targetFx: any = null;
      if (params.fixtureId) {
        targetFx = (db.fixtures || []).find((f: any) => f.id === params.fixtureId);
        if (!targetFx && comp === "national") {
          targetFx = collectDailyItemsForComp("national", dateStr).find((x) => x.id === params.fixtureId);
        }
      }
      if (!targetFx) {
        const todayItems = collectDailyItemsForComp(comp, dateStr);
        if (todayItems.length) targetFx = todayItems[0];
      }
      if (!targetFx && comp === "national") {
        for (const tt of ["main", "u21"] as const) {
          const nt = ctx.ensureNationalTeam(tt);
          const enr = ctx.enrichNationalBreak(nt.current, tt);
          if (enr.matches?.length) {
            const m = enr.matches[0];
            const isHome = m.home !== false;
            const ruName = tt === "u21" ? "Россия U21" : "Россия";
            targetFx = {
              id: `nt_${tt}_${m.id}`,
              comp: "national",
              homeName: isHome ? ruName : m.opponent,
              awayName: isHome ? m.opponent : ruName,
              homeLogo: isHome ? m.russiaLogo : m.opponentLogo,
              awayLogo: isHome ? m.opponentLogo : m.russiaLogo,
              homeColors: isHome ? { primary: "#1d4ed8", secondary: "#dc2626" } : ctx.getTeamColors(m.opponent),
              awayColors: isHome ? ctx.getTeamColors(m.opponent) : { primary: "#1d4ed8", secondary: "#dc2626" },
              realDate: String(m.realDate || m.date || dateStr).slice(0, 10),
              realTime: String(m.realTime || m.time || "19:00").slice(0, 5),
              roundLabel: tt === "u21" ? "Сборная U21 · Товарищеский матч" : "Сборная России · Товарищеский матч",
              stadium: m.stadium || "ВТБ Арена",
              city: m.city || "Москва",
              status: m.status || "scheduled",
            };
            break;
          }
        }
      }
      if (!targetFx) {
        targetFx = ctx.seasonFx().find((f) => normalizeFixtureCompKey(f) === comp && f.status !== "done") || ctx.seasonFx().find((f) => normalizeFixtureCompKey(f) === comp);
      }
      if (!targetFx && comp === "national") {
        targetFx = {
          id: "nt_showcase",
          comp: "national",
          homeName: params.teamType === "u21" ? "Россия U21" : "Россия",
          awayName: "Сербия",
          homeLogo: "/assets/aistudio/russia_russia-national-team.football-logos.cc_2a5e3ddc.svg",
          awayLogo: "",
          homeColors: { primary: "#1d4ed8", secondary: "#dc2626" },
          awayColors: { primary: "#b91c1c", secondary: "#f8fafc" },
          realDate: dateStr,
          realTime: "19:30",
          roundLabel: params.teamType === "u21" ? "Сборная U21 · Товарищеский матч (шаблон)" : "Сборная России · Товарищеский матч (шаблон)",
          stadium: "ВТБ Арена",
          city: "Москва",
          status: "scheduled",
        };
      }
      if (!targetFx) throw new Error("Не найден матч для генерации афиши");
      const pData = fixtureToPosterData(targetFx);
      const { buffer, svg } = await renderMatchPosterPng(pData);
      const htmlText = buildPosterHtmlText(pData);
      return {
        title: `Афиша · ${pData.homeName} — ${pData.awayName}`,
        subtitle: `${pData.roundLabel} · ${ctx.ruDateStr(pData.realDate)} ${pData.realTime} МСК`,
        text: htmlText,
        caption: htmlText,
        photoBuffer: buffer,
        svg,
        ruleKey: "posters0001",
        comp,
      };
    }

    if (params.kind === "schedule") {
      let items = collectDailyItemsForComp(comp, dateStr);
      let title = `РАСПИСАНИЕ ДНЯ · ${ctx.ruDateStr(dateStr)}`;
      let sub = COMP_META[comp]?.short || comp;
      if (!items.length && params.round && comp !== "national") {
        items = ctx.seasonFx()
          .filter((f) => normalizeFixtureCompKey(f) === comp && ctx.roundLabel(f) === params.round)
          .map(fixtureToPosterData);
        title = `РАСПИСАНИЕ · ${params.round}`;
      } else if (!items.length && comp !== "national") {
        // Для превью покажем ближайший тур, если сегодня матчей нет
        const upcoming = ctx.seasonFx()
          .filter((f) => normalizeFixtureCompKey(f) === comp && f.status !== "done")
          .sort((a, b) => String(a.realDate || a.date || "").localeCompare(String(b.realDate || b.date || "")));
        const fallbackRound = upcoming[0] ? ctx.roundLabel(upcoming[0]) : "";
        if (fallbackRound) {
          items = upcoming.filter((f) => ctx.roundLabel(f) === fallbackRound).slice(0, 10).map(fixtureToPosterData);
          title = `РАСПИСАНИЕ · ${fallbackRound}`;
        }
      }
      const { buffer, svg } = await renderScheduleCardPng(comp, title, sub, items);
      const htmlText = buildScheduleHtmlText(comp, title, items);
      return { title, subtitle: sub, text: htmlText, caption: htmlText, photoBuffer: buffer, svg, ruleKey: "schedule0001", comp };
    }

    if (params.kind === "standings") {
      const targetComp = comp === "national" ? "rpl" : comp;
      const title = targetComp === "cup" ? "ТАБЛИЦЫ ПУТИ РПЛ · КУБОК РОССИИ" : `ТУРНИРНАЯ ТАБЛИЦА · ${COMP_META[targetComp]?.short || targetComp}`;
      const sub = `Сезон ${ctx.S()}`;
      const { buffer, svg } = await renderStandingsPosterPng(targetComp, title, sub);
      const htmlText = buildStandingsHtmlText(targetComp, "Турнирная таблица после тура");
      return { title, subtitle: sub, text: htmlText, caption: htmlText, photoBuffer: buffer, svg, ruleKey: "standingsAfterTour", comp: targetComp };
    }

    if (params.kind === "team_round") {
      const targetComp = comp === "national" ? "rpl" : comp;
      const compDone = ctx.seasonFx()
        .filter((f) => f.comp === targetComp && f.status === "done")
        .sort((a, b) => (Number(a.round) || 0) - (Number(b.round) || 0) || String(a.date || "").localeCompare(String(b.date || "")));
      const rounds = [...new Set(compDone.map((f) => ctx.roundLabel(f)))];
      const selRound = params.round && rounds.includes(params.round) ? params.round : (rounds[rounds.length - 1] || "1-й тур");
      const rFx = compDone.filter((f) => ctx.roundLabel(f) === selRound);
      await ctx.ensureMatches(rFx.map((f) => f.id));
      const matchesMap: Record<string, any> = {};
      for (const f of rFx) {
        const m = ctx.getMatch(f.id);
        if (m) matchesMap[f.id] = m;
      }
      const teamsMap = Object.fromEntries((db.teams || []).map((t: any) => [t.id, ctx.pubTeam(t)]));
      const awards = ctx.buildTeamOfRound(selRound, targetComp, compDone, matchesMap, teamsMap);
      const { buffer, svg } = await renderBestTeamPitchPng("СБОРНАЯ ТУРА", selRound, awards, targetComp);
      const htmlText = buildTeamAwardHtmlText(targetComp, false, selRound, awards);
      return { title: `Сборная тура · ${selRound}`, subtitle: COMP_META[targetComp]?.short || targetComp, text: htmlText, caption: htmlText, photoBuffer: buffer, svg, ruleKey: "teamOfRound", comp: targetComp };
    }

    if (params.kind === "team_month") {
      const targetComp = comp === "national" ? "rpl" : comp;
      const compDone = ctx.seasonFx().filter((f) => f.comp === targetComp && f.status === "done");
      const months = [...new Set(compDone.map((f) => String(f.date || "").slice(0, 7)).filter(Boolean))].sort();
      const selMonth = params.month && months.includes(params.month) ? params.month : (months[months.length - 1] || ctx.nowMskParts().dateStr.slice(0, 7));
      const mFx = compDone.filter((f) => String(f.date || "").startsWith(selMonth));
      await ctx.ensureMatches(mFx.map((f) => f.id));
      const matchesMap: Record<string, any> = {};
      for (const f of mFx) {
        const m = ctx.getMatch(f.id);
        if (m) matchesMap[f.id] = m;
      }
      const teamsMap = Object.fromEntries((db.teams || []).map((t: any) => [t.id, ctx.pubTeam(t)]));
      const awards = ctx.buildTeamOfMonth(selMonth, targetComp, compDone, matchesMap, teamsMap, false);
      const mLabel = ctx.formatAwardMonthLabelRu(selMonth);
      const { buffer, svg } = await renderBestTeamPitchPng("СБОРНАЯ МЕСЯЦА", mLabel, awards, targetComp);
      const htmlText = buildTeamAwardHtmlText(targetComp, true, mLabel, awards);
      return { title: `Сборная месяца · ${mLabel}`, subtitle: COMP_META[targetComp]?.short || targetComp, text: htmlText, caption: htmlText, photoBuffer: buffer, svg, ruleKey: "teamOfMonth", comp: targetComp };
    }

    // national_extended | national_final
    const teamType: "main" | "u21" = params.teamType === "u21" ? "u21" : "main";
    const nt = ctx.ensureNationalTeam(teamType);
    const enriched = ctx.enrichNationalBreak(nt.current, teamType);
    const mode = params.kind === "national_final" ? "final" : "extended";
    const msgs = ctx.buildNationalSquadTelegramMessages(enriched, teamType, mode);
    const htmlText = msgs.join("\n\n");
    const { buffer, svg } = await renderNationalSquadPosterPng(enriched, teamType, mode);
    const caption = `🇷🇺 <b>${teamType === "u21" ? "МОЛОДЁЖНАЯ СБОРНАЯ РОССИИ U21" : "СБОРНАЯ РОССИИ"}</b>\n${mode === "final" ? "✅ Итоговый состав (кого вызвали)" : "📋 Расширенный состав"} · ${ctx.esc(enriched.title || "")}`;
    return {
      title: `${teamType === "u21" ? "Сборная U21" : "Сборная России"} · ${mode === "final" ? "Итоговый вызов" : "Расширенный состав"}`,
      subtitle: enriched.title || "",
      text: htmlText,
      caption,
      photoBuffer: buffer,
      svg,
      ruleKey: mode === "final" ? "nationalFinal" : "nationalExtended",
      comp: "national",
    };
  }

  /* ────────────── Автоматизация: 00:01 МСК, Итоги тура/месяца, Сборная ────────────── */

  async function dispatchMidnightForComp(comp: string, dateStr: string, force = false): Promise<{ comp: string; matches: number; sentSchedule: boolean; sentPosters: number }> {
    const db = ctx.getDb();
    db.settings ||= {};
    db.settings.tgDailyChannelSent ||= {};
    db.settings.tgDailyChannelSent[dateStr] ||= {};

    const items = collectDailyItemsForComp(comp, dateStr);
    if (!items.length) return { comp, matches: 0, sentSchedule: false, sentPosters: 0 };
    if (!force && db.settings.tgDailyChannelSent[dateStr][comp]) {
      return { comp, matches: items.length, sentSchedule: false, sentPosters: 0 };
    }

    db.settings.tgDailyChannelSent[dateStr][comp] = new Date().toISOString();
    ctx.save();

    let sentSchedule = false;
    let sentPosters = 0;

    // 1. Расписание тура / игрового дня
    try {
      const schedTitle = `РАСПИСАНИЕ НА ${ctx.ruDateStr(dateStr)}`;
      const schedPkg = await renderScheduleCardPng(comp, schedTitle, COMP_META[comp]?.short || comp, items);
      const schedHtml = buildScheduleHtmlText(comp, `Матчи на ${ctx.ruDateStr(dateStr)}`, items);
      const targets = resolveAutoChannels(comp, "schedule0001");
      for (const cid of targets) {
        const r = await deliverNowToChannel(cid, { comp, kind: "schedule_0001", text: schedHtml, photoBuffer: schedPkg.buffer, caption: schedHtml });
        if (r.ok) sentSchedule = true;
      }
    } catch (e: any) {
      console.warn(`[Channels 00:01 schedule ${comp}]:`, e?.message || e);
    }

    return { comp, matches: items.length, sentSchedule, sentPosters };
  }

  let midnightTickLock = false;
  async function runDailyMidnightTick() {
    if (midnightTickLock || process.env.NODE_ENV === "test") return;
    const db = ctx.getDb();
    if (!db?.settings) return;
    const { dateStr, hour, minute } = ctx.nowMskParts();
    // 00:01 МСК или догон внутри текущих суток (если сервер перезапустился после 00:01)
    if (hour === 0 && minute < 1) return;

    midnightTickLock = true;
    try {
      for (const comp of DAILY_COMPS) {
        await dispatchMidnightForComp(comp, dateStr, false);
      }
    } finally {
      midnightTickLock = false;
    }
  }

  async function handleRoundCompleted(finishedFixture: any) {
    try {
      if (!finishedFixture) return;
      const db = ctx.getDb();
      if (!db?.settings) return;
      const comp = String(finishedFixture.comp || "").toLowerCase();
      if (!AWARD_COMPS.includes(comp as any)) return;

      const season = finishedFixture.season || ctx.S();
      const rLabel = ctx.roundLabel(finishedFixture);
      if (!rLabel) return;

      const roundAllFx = (db.fixtures || []).filter(
        (x: any) => (x.season || ctx.S()) === season && String(x.comp || "").toLowerCase() === comp && ctx.roundLabel(x) === rLabel
      );
      if (roundAllFx.length < 2) return;
      if (!roundAllFx.every((x: any) => x.status === "done" || x.status === "cancelled")) return;
      const doneFx = roundAllFx.filter((x: any) => x.status === "done");
      if (!doneFx.length) return;

      db.settings.tgRoundAwardsSent ||= {};
      const sentKey = `${season}::${comp}::${rLabel}`;
      if (!db.settings.tgRoundAwardsSent[sentKey]) {
        db.settings.tgRoundAwardsSent[sentKey] = new Date().toISOString();
        ctx.save();

        // 1. Сборная тура (PNG + HTML)
        await ctx.ensureMatches(doneFx.map((x: any) => x.id));
        const matchesMap: Record<string, any> = {};
        for (const f of doneFx) {
          const m = ctx.getMatch(f.id);
          if (m) matchesMap[f.id] = m;
        }
        const teamsMap = Object.fromEntries((db.teams || []).map((t: any) => [t.id, ctx.pubTeam(t)]));
        const roundAwards = ctx.buildTeamOfRound(rLabel, comp, doneFx, matchesMap, teamsMap);
        if (roundAwards && (roundAwards.starters?.length || roundAwards.bestPlayer)) {
          const { buffer } = await renderBestTeamPitchPng("СБОРНАЯ ТУРА", rLabel, roundAwards, comp);
          const html = buildTeamAwardHtmlText(comp, false, rLabel, roundAwards);
          for (const cid of resolveAutoChannels(comp, "teamOfRound")) {
            await deliverNowToChannel(cid, { comp, kind: "team_round", text: html, photoBuffer: buffer, caption: `🏆 <b>Сборная тура · ${ctx.esc(COMP_META[comp]?.short || comp)} · ${ctx.esc(rLabel)}</b>` });
          }
        }

        // 2. Турнирная таблица сразу после тура
        try {
          const stTitle = comp === "cup" ? "ТАБЛИЦЫ ПОСЛЕ ТУРА · КУБОК РОССИИ" : `ТУРНИРНАЯ ТАБЛИЦА · ПОСЛЕ ${rLabel.toUpperCase()}`;
          const { buffer } = await renderStandingsPosterPng(comp, stTitle, `Сезон ${season}`);
          const stHtml = buildStandingsHtmlText(comp, `Турнирная таблица после завершения (${rLabel})`);
          for (const cid of resolveAutoChannels(comp, "standingsAfterTour")) {
            await deliverNowToChannel(cid, { comp, kind: "standings_post_tour", text: stHtml, photoBuffer: buffer, caption: `📊 <b>Турнирная таблица · ${ctx.esc(COMP_META[comp]?.short || comp)}</b> (${ctx.esc(rLabel)})` });
          }
        } catch (e: any) {
          console.warn(`[Channels Standings ${comp}]:`, e?.message || e);
        }
      }

      // 3. Проверка: завершился ли месяц в этом турнире? -> Сборная месяца
      const ym = String(finishedFixture.date || "").slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) {
        const monthAllFx = (db.fixtures || []).filter(
          (x: any) => (x.season || ctx.S()) === season && String(x.comp || "").toLowerCase() === comp && String(x.date || "").startsWith(ym) && x.status !== "cancelled"
        );
        if (monthAllFx.length >= 2 && monthAllFx.every((x: any) => x.status === "done")) {
          db.settings.tgMonthAwardsSent ||= {};
          const mKey = `${season}::${comp}::${ym}`;
          if (!db.settings.tgMonthAwardsSent[mKey]) {
            db.settings.tgMonthAwardsSent[mKey] = new Date().toISOString();
            ctx.save();
            await ctx.ensureMatches(monthAllFx.map((x: any) => x.id));
            const mMap: Record<string, any> = {};
            for (const f of monthAllFx) {
              const mo = ctx.getMatch(f.id);
              if (mo) mMap[f.id] = mo;
            }
            const tMap = Object.fromEntries((db.teams || []).map((t: any) => [t.id, ctx.pubTeam(t)]));
            const mAwards = ctx.buildTeamOfMonth(ym, comp, monthAllFx, mMap, tMap, false);
            if (mAwards && (mAwards.starters?.length || mAwards.bestPlayer)) {
              const mLabel = ctx.formatAwardMonthLabelRu(ym);
              const { buffer } = await renderBestTeamPitchPng("СБОРНАЯ МЕСЯЦА", mLabel, mAwards, comp);
              const html = buildTeamAwardHtmlText(comp, true, mLabel, mAwards);
              for (const cid of resolveAutoChannels(comp, "teamOfMonth")) {
                await deliverNowToChannel(cid, { comp, kind: "team_month", text: html, photoBuffer: buffer, caption: `🌟 <b>Сборная месяца · ${ctx.esc(COMP_META[comp]?.short || comp)} · ${ctx.esc(mLabel)}</b>` });
              }
            }
          }
        }
      }
    } catch (e: any) {
      console.warn("[Channels Round Completion]:", e?.message || e);
    }
  }

  async function publishNationalCallup(
    teamType: "main" | "u21",
    mode: "extended" | "final" | "both",
    opts?: { includePersonalBot?: boolean; onlyPersonalBot?: boolean }
  ): Promise<{ ok: boolean; error?: string; results: any[]; botSent: number }> {
    const nt = ctx.ensureNationalTeam(teamType);
    const enriched = ctx.enrichNationalBreak(nt.current, teamType);
    const stages: Array<"extended" | "final"> = mode === "both" ? ["extended", "final"] : [mode];
    const results: any[] = [];
    let botSent = 0;

    for (const st of stages) {
      const list = st === "final" ? enriched.finalPlayers : enriched.extendedPlayers;
      if (!Array.isArray(list) || !list.length) {
        return {
          ok: false,
          error: st === "final" ? "Список «Кого вызвали» пуст — сначала сформируйте или добавьте игроков." : "Расширенный состав пуст — сначала сформируйте или добавьте игроков.",
          results,
          botSent,
        };
      }
      const pkg = await buildPackage({
        kind: st === "final" ? "national_final" : "national_extended",
        comp: "national",
        teamType,
      });

      const targetIds = new Set<ChannelId>();
      if (!opts?.onlyPersonalBot) {
        const routed = resolveAutoChannels("national", st === "final" ? "nationalFinal" : "nationalExtended");
        for (const cid of routed) targetIds.add(cid);
        // Гарантируем отправку в Сборную России и Матч ТВ при ручной публикации со страницы сборной, если канал настроен
        for (const must of ["national", "matchtv"] as ChannelId[]) {
          const creds = resolveChannelCredentials(must);
          if (creds.token && creds.chatId && getChannelSpecs()[must]?.enabled) targetIds.add(must);
        }
      }
      if (opts?.includePersonalBot || opts?.onlyPersonalBot) {
        targetIds.add("personal_bot");
      }

      if (!targetIds.size) {
        return {
          ok: false,
          error: "Не настроены каналы «Сборная России» или «Матч ТВ» во вкладке «Каналы».",
          results,
          botSent,
        };
      }

      for (const cid of targetIds) {
        const res = await deliverNowToChannel(cid, {
          comp: "national",
          kind: st === "final" ? "national_final" : "national_extended",
          text: pkg.text,
          photoBuffer: pkg.photoBuffer,
          caption: pkg.caption,
        });
        results.push(res);
        if (cid === "personal_bot" && res.sentCount) botSent += res.sentCount;
      }
    }

    const anyOk = results.some((r) => r.ok);
    const errMsg = results.find((r) => !r.ok)?.error;
    return { ok: anyOk, error: anyOk ? undefined : (errMsg || "Не удалось опубликовать"), results, botSent };
  }

  /* ────────────── Маршруты Admin API ────────────── */

  function registerRoutes(app: Express) {
    app.get("/api/admin/channels", ctx.admin, (_req, res) => {
      const db = ctx.getDb();
      const specs = getChannelSpecs();
      const sec = ctx.readSecretsFile() || {};
      const tokenMap = sec.tgChannelTokens && typeof sec.tgChannelTokens === "object" ? sec.tgChannelTokens : {};
      const globalToken = ctx.getGlobalTgToken();
      const globalChat = ctx.getGlobalTgChat();

      const channels = CHANNEL_ORDER.map((id) => {
        const cfg = specs[id];
        const customTok = String(tokenMap[id] || "").trim();
        const creds = resolveChannelCredentials(id);
        return {
          ...cfg,
          effectiveChatId: creds.chatId,
          usesGlobalChat: creds.usesGlobalChat,
          hasToken: !!creds.token,
          usesGlobalToken: creds.usesGlobalToken,
          tokenMasked: customTok ? `••••${customTok.slice(-4)}` : "",
        };
      });

      const recipients = ctx.buildTelegramRecipientsList();
      const msk = ctx.nowMskParts();
      const nextMidnightPreview = DAILY_COMPS.map((c) => {
        const items = collectDailyItemsForComp(c, msk.dateStr);
        return {
          comp: c,
          title: COMP_META[c]?.short || c,
          todayCount: items.length,
          sentToday: Boolean(db?.settings?.tgDailyChannelSent?.[msk.dateStr]?.[c]),
          matches: items.slice(0, 6).map((m) => ({ id: m.id, time: m.realTime, pair: `${m.homeName} — ${m.awayName}` })),
        };
      });

      const availableOptions: Record<string, any> = {};
      for (const c of ["rpl", "fnl", "cup"]) {
        const allFx = ctx.seasonFx().filter((f) => normalizeFixtureCompKey(f) === c);
        const doneFx = allFx.filter((f) => f.status === "done");
        const rounds = [...new Set(doneFx.map((f) => ctx.roundLabel(f)))];
        const schedRounds = [...new Set(allFx.map((f) => ctx.roundLabel(f)))];
        const months = [...new Set(doneFx.map((f) => String(f.date || "").slice(0, 7)).filter(Boolean))].sort().map((ym) => ({
          id: ym,
          label: ctx.formatAwardMonthLabelRu(ym),
        }));
        const fixtures = [...allFx]
          .sort((a, b) => String(b.realDate || b.date || "").localeCompare(String(a.realDate || a.date || "")))
          .slice(0, 40)
          .map((f) => ({
            id: f.id,
            label: `${ctx.tn(f.home)} — ${ctx.tn(f.away)} (${ctx.roundLabel(f)} · ${f.realDate || f.date || ""})`,
          }));
        availableOptions[c] = { rounds: rounds.length ? rounds : schedRounds, months, fixtures };
      }

      const ntMain = ctx.enrichNationalBreak(ctx.ensureNationalTeam("main").current, "main");
      const ntU21 = ctx.enrichNationalBreak(ctx.ensureNationalTeam("u21").current, "u21");
      availableOptions.national = {
        main: {
          title: ntMain.title,
          extendedCount: ntMain.extendedPlayers?.length || 0,
          finalCount: ntMain.finalPlayers?.length || 0,
          matches: (ntMain.matches || []).map((m: any) => ({ id: `nt_main_${m.id}`, label: `Россия — ${m.opponent} (${m.realDate || m.date})` })),
        },
        u21: {
          title: ntU21.title,
          extendedCount: ntU21.extendedPlayers?.length || 0,
          finalCount: ntU21.finalPlayers?.length || 0,
          matches: (ntU21.matches || []).map((m: any) => ({ id: `nt_u21_${m.id}`, label: `Россия U21 — ${m.opponent} (${m.realDate || m.date})` })),
        },
      };

      res.json({
        ok: 1,
        mskNow: msk,
        globalConfig: { hasGlobalToken: !!globalToken, globalChat },
        personalBotStats: {
          totalUsers: recipients.length,
          clubUsers: recipients.filter((r) => !!r.teamId).length,
          activeUsers: recipients.filter((r) => !r.blockedBot).length,
        },
        channels,
        nextMidnightPreview,
        availableOptions,
        logs: Array.isArray(db?.settings?.tgChannelLogs) ? db.settings.tgChannelLogs.slice(0, 60) : [],
      });
    });

    app.post("/api/admin/channels/save", ctx.admin, (req, res) => {
      const id = String(req.body?.id || "") as ChannelId;
      if (!CHANNEL_ORDER.includes(id)) return ctx.fail(res, "Неизвестный канал");
      const specs = getChannelSpecs();
      const db = ctx.getDb();
      const cur = db.settings.tgChannels[id];

      if (typeof req.body?.enabled === "boolean") cur.enabled = req.body.enabled;
      if (typeof req.body?.chatId === "string") cur.chatId = ctx.normalizeTgChat(req.body.chatId);
      if (typeof req.body?.botUsername === "string" && id === "personal_bot") {
        const bu = req.body.botUsername.trim();
        cur.botUsername = bu ? (bu.startsWith("@") ? bu : `@${bu}`) : "@RPLVIRT_bot";
      }
      if (req.body?.rules && typeof req.body.rules === "object") {
        cur.rules ||= { ...specs[id].rules };
        for (const [rk, rv] of Object.entries(req.body.rules)) {
          cur.rules[rk] = Boolean(rv);
        }
      }
      ctx.save();

      if (req.body?.clearToken || (typeof req.body?.token === "string" && !req.body.token.includes("•"))) {
        const sec = ctx.readSecretsFile() || {};
        const tokenMap = { ...(sec.tgChannelTokens && typeof sec.tgChannelTokens === "object" ? sec.tgChannelTokens : {}) };
        if (req.body?.clearToken || !String(req.body.token).trim()) {
          delete tokenMap[id];
        } else {
          tokenMap[id] = String(req.body.token).trim();
        }
        ctx.saveSecretsFile({ tgChannelTokens: tokenMap });
      }
      channelCooldownUntil.delete(id);
      res.json({ ok: 1, message: `Настройки канала «${cur.name}» сохранены` });
    });

    app.post("/api/admin/channels/test", ctx.admin, async (req, res) => {
      const id = String(req.body?.id || "") as ChannelId;
      if (!CHANNEL_ORDER.includes(id)) return ctx.fail(res, "Неизвестный канал");
      const cfg = getChannelSpecs()[id];
      const creds = resolveChannelCredentials(id);

      const overrideToken = typeof req.body?.token === "string" && !req.body.token.includes("•") && req.body.token.trim() ? req.body.token.trim() : creds.token;
      const overrideChat = typeof req.body?.chatId === "string" && req.body.chatId.trim() ? ctx.normalizeTgChat(req.body.chatId) : creds.chatId;

      if (!overrideToken) return ctx.fail(res, "Токен Telegram-бота не задан ни для этого канала, ни глобально.");

      if (id === "personal_bot") {
        try {
          const r = await fetch(`https://api.telegram.org/bot${overrideToken}/getMe`, { signal: AbortSignal.timeout(12_000) });
          const j = await r.json().catch(() => ({}));
          if (!r.ok || !j?.ok) return ctx.fail(res, `Ошибка Telegram API: ${j?.description || r.status}`);
          return res.json({ ok: 1, message: `Личный бот @${j.result?.username || "bot"} онлайн и готов к рассылкам!` });
        } catch (e: any) {
          return ctx.fail(res, `Ошибка соединения с Telegram: ${e?.message || e}`);
        }
      }

      if (!overrideChat) return ctx.fail(res, `Укажите @username или Chat ID для канала «${cfg.name}».`);
      const testMsg = `📡 <b>${ctx.esc(cfg.name)}</b> · Проверка подключения пройдена!\nКанал готов принимать расписание в 00:01 МСК, афиши, таблицы и сборные туров.`;
      const r = await ctx.sendTelegramDirectMessage(overrideToken, overrideChat, testMsg, "HTML");
      if (!r.ok) return ctx.fail(res, `Ошибка отправки в ${overrideChat}: ${r.error}`);
      appendDispatchLog({
        channelId: id,
        channelName: cfg.name,
        comp: id,
        kind: "test",
        hasPhoto: false,
        ok: true,
        preview: `Тестовая проверка связи с ${overrideChat}`,
      });
      res.json({ ok: 1, message: `Тест успешно отправлен в ${cfg.name} (${overrideChat})!` });
    });

    app.get("/api/admin/channels/preview", ctx.admin, async (req, res) => {
      try {
        const kind = String(req.query.kind || "poster") as ChannelPublishKind;
        const comp = String(req.query.comp || "rpl");
        const pkg = await buildPackage({
          kind,
          comp,
          round: req.query.round ? String(req.query.round) : undefined,
          month: req.query.month ? String(req.query.month) : undefined,
          fixtureId: req.query.fixtureId ? String(req.query.fixtureId) : undefined,
          date: req.query.date ? String(req.query.date) : undefined,
          teamType: req.query.teamType === "u21" ? "u21" : "main",
        });

        if (req.query.format === "png") {
          res.setHeader("Content-Type", "image/png");
          return res.send(pkg.photoBuffer);
        }
        res.json({
          ok: 1,
          title: pkg.title,
          subtitle: pkg.subtitle,
          htmlText: pkg.text,
          caption: pkg.caption,
          imageDataUrl: `data:image/png;base64,${pkg.photoBuffer.toString("base64")}`,
          routedChannels: resolveAutoChannels(pkg.comp, pkg.ruleKey),
        });
      } catch (e: any) {
        return ctx.fail(res, e?.message || "Не удалось сформировать превью");
      }
    });

    app.post("/api/admin/channels/publish", ctx.admin, async (req, res) => {
      try {
        const kind = String(req.body?.kind || "poster") as ChannelPublishKind;
        const comp = String(req.body?.comp || "rpl");
        const pkg = await buildPackage({
          kind,
          comp,
          round: req.body?.round ? String(req.body.round) : undefined,
          month: req.body?.month ? String(req.body.month) : undefined,
          fixtureId: req.body?.fixtureId ? String(req.body.fixtureId) : undefined,
          date: req.body?.date ? String(req.body.date) : undefined,
          teamType: req.body?.teamType === "u21" ? "u21" : "main",
        });

        const explicit: ChannelId[] = Array.isArray(req.body?.targets)
          ? req.body.targets.filter((x: any) => CHANNEL_ORDER.includes(x))
          : [];
        const targets = explicit.length ? explicit : resolveAutoChannels(pkg.comp, pkg.ruleKey);

        if (!targets.length) {
          return ctx.fail(res, "Не выбран ни один активный канал с заполненным Chat ID / токеном.");
        }

        const results = [];
        for (const cid of targets) {
          results.push(
            await deliverNowToChannel(cid, {
              comp: pkg.comp,
              kind,
              text: pkg.text,
              photoBuffer: pkg.photoBuffer,
              caption: pkg.caption,
            })
          );
        }
        const okCount = results.filter((r) => r.ok).length;
        res.json({
          ok: okCount > 0 ? 1 : 0,
          results,
          message: okCount > 0
            ? `Опубликовано в каналы: ${results.filter((r) => r.ok).map((r) => r.channelName).join(", ")}`
            : `Ошибка публикации: ${results.find((r) => !r.ok)?.error || "проверьте настройки"}`,
        });
      } catch (e: any) {
        return ctx.fail(res, e?.message || "Ошибка публикации");
      }
    });

    app.post("/api/admin/channels/run-midnight", ctx.admin, async (req, res) => {
      const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.date || "")) ? String(req.body.date) : ctx.nowMskParts().dateStr;
      const force = req.body?.force !== false;
      const singleComp = req.body?.comp && DAILY_COMPS.includes(req.body.comp) ? [String(req.body.comp)] : [...DAILY_COMPS];
      const summary = [];
      for (const c of singleComp) {
        summary.push(await dispatchMidnightForComp(c, dateStr, force));
      }
      const totalMatches = summary.reduce((s, x) => s + x.matches, 0);
      res.json({
        ok: 1,
        dateStr,
        summary,
        message: totalMatches > 0
          ? `Рассылка 00:01 выполнена для ${totalMatches} матчей (${ctx.ruDateStr(dateStr)})`
          : `На ${ctx.ruDateStr(dateStr)} матчей РПЛ, ФНЛ, Кубка и Сборной не найдено`,
      });
    });

    app.post("/api/admin/channels/clear-logs", ctx.admin, (_req, res) => {
      const db = ctx.getDb();
      if (db?.settings) {
        db.settings.tgChannelLogs = [];
        ctx.save();
      }
      res.json({ ok: 1 });
    });
  }

  return {
    registerRoutes,
    enqueueRoutedText,
    deliverNowToChannel,
    runDailyMidnightTick,
    handleRoundCompleted,
    publishNationalCallup,
    buildPackage,
    getChannelSpecs,
    resolveChannelCredentials,
    collectDailyItemsForComp,
  };
}
