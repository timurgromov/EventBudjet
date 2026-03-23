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
