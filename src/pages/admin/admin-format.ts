export const formatAdminDateTime = (value?: string | null): string => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("ru-RU");
};

export const formatAdminDate = (value?: string | null): string => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("ru-RU");
};

export const formatAdminMoney = (value?: string | null): string => {
  if (!value) return "—";
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) return value;
  return `${Math.round(amount).toLocaleString("ru-RU")} ₽`;
};

const ROLE_LABELS: Record<string, string> = {
  bride: "Невеста",
  groom: "Жених",
  mother: "Мама",
  pro: "Свадебный специалист",
};

const CITY_LABELS: Record<string, string> = {
  moscow: "Москва",
  "москва": "Москва",
  mo: "МО",
  "московская область": "МО",
  region: "Другой регион",
};

const SEASON_LABELS: Record<string, string> = {
  spring: "Весна",
  summer: "Лето",
  autumn: "Осень",
  winter: "Зима",
  next_year: "В следующем году",
};

const LEAD_STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  active: "Активный",
  archived: "Архив",
};

const VENUE_STATUS_LABELS: Record<string, string> = {
  chosen: "Уже выбрали",
  searching: "Пока выбирают",
};

const SOURCE_LABELS: Record<string, string> = {
  telegram_mini_app: "Telegram Mini App",
  direct_personal: "Личный контакт (без метки)",
  calc: "Старая ссылка calc",
};

const DATE_MODE_LABELS: Record<string, string> = {
  exact: "Точная дата",
  season: "Сезон",
};

const PROFILE_FIELD_LABELS: Record<string, string> = {
  role: "роль",
  city: "город",
  venue_status: "площадка",
  venue_name: "название площадки",
  wedding_date_exact: "дата свадьбы",
  wedding_date_mode: "формат даты",
  season: "сезон",
  next_year_flag: "следующий год",
  guests_count: "гости",
  source: "источник",
};

export const formatLeadName = (name?: string | null, username?: string | null): string => {
  if (name && username) return `${name} (@${username})`;
  if (name) return name;
  if (username) return `@${username}`;
  return "Без имени";
};

export const formatLeadDateSignal = (weddingDateExact?: string | null, season?: string | null): string => {
  if (weddingDateExact) return formatAdminDate(weddingDateExact);
  if (season) return formatSeasonLabel(season);
  return "—";
};

const normalizeValue = (value: unknown): string => {
  if (typeof value === "string") return value.trim().toLowerCase();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim().toLowerCase();
  return "";
};

const MOSCOW_CITY_VALUES = new Set(["москва", "moscow"]);
const MOSCOW_REGION_VALUES = new Set(["мо", "московская область", "moscow region"]);
const LOW_PRIORITY_ROLE_VALUES = new Set(["pro", "specialist", "специалист", "свадебный специалист"]);

export const getLeadPriorityScore = (city?: string | null, role?: string | null): number => {
  const normalizedCity = normalizeValue(city);
  const normalizedRole = normalizeValue(role);

  let score = 0;
  if (MOSCOW_CITY_VALUES.has(normalizedCity)) score += 100;
  if (MOSCOW_REGION_VALUES.has(normalizedCity)) score += 80;
  if (LOW_PRIORITY_ROLE_VALUES.has(normalizedRole)) score -= 70;
  return score;
};

export const getLeadPriorityLabel = (city?: string | null, role?: string | null): string => {
  const normalizedCity = normalizeValue(city);
  const normalizedRole = normalizeValue(role);
  if (MOSCOW_CITY_VALUES.has(normalizedCity)) return "приоритет: Москва";
  if (MOSCOW_REGION_VALUES.has(normalizedCity)) return "приоритет: МО";
  if (LOW_PRIORITY_ROLE_VALUES.has(normalizedRole)) return "низкий: специалист";
  return "обычный";
};

export const getLeadRoleLabel = (role?: string | null): string => {
  const normalizedRole = normalizeValue(role);
  if (ROLE_LABELS[normalizedRole]) return ROLE_LABELS[normalizedRole];
  if (normalizedRole === "невеста") return "Невеста";
  if (normalizedRole === "жених") return "Жених";
  if (LOW_PRIORITY_ROLE_VALUES.has(normalizedRole)) return "Свадебный специалист";
  if (typeof role === "string" && role.trim()) return role;
  return "—";
};

export const formatCityLabel = (city?: string | null): string => {
  const normalizedCity = normalizeValue(city);
  if (CITY_LABELS[normalizedCity]) return CITY_LABELS[normalizedCity];
  if (typeof city === "string" && city.trim()) return city;
  return "—";
};

export const formatSeasonLabel = (season?: string | null): string => {
  const normalizedSeason = normalizeValue(season);
  if (SEASON_LABELS[normalizedSeason]) return SEASON_LABELS[normalizedSeason];
  if (typeof season === "string" && season.trim()) return season;
  return "—";
};

export const formatLeadStatusLabel = (status?: string | null): string => {
  const normalizedStatus = normalizeValue(status);
  if (LEAD_STATUS_LABELS[normalizedStatus]) return LEAD_STATUS_LABELS[normalizedStatus];
  if (typeof status === "string" && status.trim()) return status;
  return "—";
};

export const formatVenueValue = (status?: string | null, name?: string | null): string => {
  if (typeof name === "string" && name.trim()) return name;
  const normalizedStatus = normalizeValue(status);
  if (VENUE_STATUS_LABELS[normalizedStatus]) return VENUE_STATUS_LABELS[normalizedStatus];
  return "—";
};

export const formatSourceLabel = (source?: string | null): string => {
  const normalizedSource = normalizeValue(source);
  if (SOURCE_LABELS[normalizedSource]) return SOURCE_LABELS[normalizedSource];
  if (typeof source === "string" && source.trim()) return source;
  return "—";
};

export const formatDateModeLabel = (mode?: string | null): string => {
  const normalizedMode = normalizeValue(mode);
  if (DATE_MODE_LABELS[normalizedMode]) return DATE_MODE_LABELS[normalizedMode];
  if (typeof mode === "string" && mode.trim()) return mode;
  return "—";
};

export const formatProfileFieldLabel = (field?: string | null): string => {
  const normalizedField = normalizeValue(field);
  return PROFILE_FIELD_LABELS[normalizedField] ?? (field || "поле");
};

export const isMoscowPriorityCity = (city?: string | null): boolean => {
  const normalizedCity = normalizeValue(city);
  return MOSCOW_CITY_VALUES.has(normalizedCity) || MOSCOW_REGION_VALUES.has(normalizedCity);
};

export const isLowPrioritySpecialist = (role?: string | null): boolean => {
  const normalizedRole = normalizeValue(role);
  return LOW_PRIORITY_ROLE_VALUES.has(normalizedRole);
};

export const getLeadHotScore = (params: {
  city?: string | null;
  role?: string | null;
  lastSeenAt?: string | null;
  weddingDateExact?: string | null;
  guestsCount?: number | null;
  totalBudget?: string | number | null;
  leadStatus?: string | null;
}): number => {
  const { city, role, lastSeenAt, weddingDateExact, guestsCount, totalBudget, leadStatus } = params;

  let score = getLeadPriorityScore(city, role);

  const lastSeenMs = lastSeenAt ? Date.parse(lastSeenAt) : Number.NaN;
  if (Number.isFinite(lastSeenMs)) {
    const ageHours = (Date.now() - lastSeenMs) / (1000 * 60 * 60);
    if (ageHours <= 24) score += 30;
    else if (ageHours <= 72) score += 15;
  }

  if (weddingDateExact) score += 20;
  if (typeof guestsCount === "number" && guestsCount > 0) score += 10;

  const budget = typeof totalBudget === "number" ? totalBudget : totalBudget ? Number.parseFloat(totalBudget) : Number.NaN;
  if (Number.isFinite(budget) && budget > 0) score += 20;

  if (normalizeValue(leadStatus) === "draft") score -= 10;

  return score;
};

export const getHotLevelLabel = (score: number): string => {
  if (score >= 120) return "Горячий";
  if (score >= 70) return "Тёплый";
  return "Обычный";
};

export const formatBotContactLabel = (state?: string | null): string => {
  const normalized = normalizeValue(state);
  if (normalized === "blocked") return "бот остановлен";
  if (normalized === "active") return "бот активен";
  return "статус неизвестен";
};

export const getBotContactTone = (state?: string | null): "red" | "green" | "gray" => {
  const normalized = normalizeValue(state);
  if (normalized === "blocked") return "red";
  if (normalized === "active") return "green";
  return "gray";
};
