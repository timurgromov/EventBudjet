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

export const formatLeadName = (name?: string | null, username?: string | null): string => {
  if (name && username) return `${name} (@${username})`;
  if (name) return name;
  if (username) return `@${username}`;
  return "Без имени";
};

export const formatLeadDateSignal = (weddingDateExact?: string | null, season?: string | null): string => {
  if (weddingDateExact) return formatAdminDate(weddingDateExact);
  if (season) return season;
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
  if (normalizedRole === "bride" || normalizedRole === "невеста") return "невеста";
  if (normalizedRole === "groom" || normalizedRole === "жених") return "жених";
  if (LOW_PRIORITY_ROLE_VALUES.has(normalizedRole)) return "специалист";
  if (typeof role === "string" && role.trim()) return role;
  return "—";
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
