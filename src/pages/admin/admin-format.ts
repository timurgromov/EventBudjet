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

const normalizeValue = (value?: string | null): string => (value ?? "").trim().toLowerCase();

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
  return role ?? "—";
};
