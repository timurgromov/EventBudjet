export interface TelegramInitResponse {
  user_id: number;
  telegram_id: number;
  is_new_user: boolean;
  visits_count: number;
}

export interface Lead {
  id: number;
  user_id: number;
  role: string | null;
  city: string | null;
  venue_status: string | null;
  venue_name: string | null;
  wedding_date_exact: string | null;
  wedding_date_mode: string | null;
  season: string | null;
  next_year_flag: boolean | null;
  guests_count: number | null;
  source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  partner_code: string | null;
  total_budget: string | null;
  lead_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: number;
  lead_id: number;
  category_code: string | null;
  category_name: string;
  amount: string;
  created_at: string;
  updated_at: string;
}

export interface LeadProgressResponse {
  lead: Lead | null;
  expenses: Expense[];
  total_budget: string | null;
  lead_status: string | null;
}

export interface LeadCalculateResponse {
  lead_id: number;
  total_budget: string;
}

export interface LeadActionPayload {
  action: string;
  source?: string;
  href?: string;
}

export interface LeadPayload {
  role?: string;
  city?: string;
  venue_status?: string;
  venue_name?: string | null;
  wedding_date_exact?: string | null;
  wedding_date_mode?: string;
  season?: string | null;
  next_year_flag?: boolean;
  guests_count?: number;
  source?: string;
}

export interface ExpensePayload {
  category_code?: string | null;
  category_name?: string;
  amount: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

function normalizeErrorDetail(detail: unknown): string {
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const message = "msg" in item ? item.msg : undefined;
        const location = "loc" in item && Array.isArray(item.loc) ? item.loc.join(".") : undefined;
        if (typeof message === "string" && message) {
          return location ? `${location}: ${message}` : message;
        }
        return null;
      })
      .filter((value): value is string => Boolean(value));

    if (messages.length > 0) {
      return messages.join("; ");
    }
  }

  if (detail && typeof detail === "object") {
    try {
      return JSON.stringify(detail);
    } catch {
      return "Request failed";
    }
  }

  return "Request failed";
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  telegramInitData?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (telegramInitData) {
    headers.set("X-Telegram-Init-Data", telegramInitData);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let detail = "Request failed";
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (body && typeof body === "object" && "detail" in body) {
        detail = normalizeErrorDetail(body.detail);
      }
    } catch {
      // ignore parse errors and keep generic message
    }
    throw new Error(`${response.status}: ${detail}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function authTelegramInit(initData: string): Promise<TelegramInitResponse> {
  return request<TelegramInitResponse>("/auth/telegram/init", {
    method: "POST",
    body: JSON.stringify({ init_data: initData }),
  });
}

export function getLeadProgress(initData: string): Promise<LeadProgressResponse> {
  return request<LeadProgressResponse>("/lead/progress", { method: "GET" }, initData);
}

export function createLead(initData: string, payload: LeadPayload): Promise<Lead> {
  return request<Lead>("/lead", { method: "POST", body: JSON.stringify(payload) }, initData);
}

export function updateLead(initData: string, payload: LeadPayload): Promise<Lead> {
  return request<Lead>("/lead", { method: "PATCH", body: JSON.stringify(payload) }, initData);
}

export function listExpenses(initData: string): Promise<Expense[]> {
  return request<Expense[]>("/lead/expenses", { method: "GET" }, initData);
}

export function createExpense(initData: string, payload: ExpensePayload): Promise<Expense> {
  return request<Expense>("/lead/expenses", { method: "POST", body: JSON.stringify(payload) }, initData);
}

export function deleteExpense(initData: string, expenseId: number): Promise<void> {
  return request<void>(`/lead/expenses/${expenseId}`, { method: "DELETE" }, initData);
}

export function calculateLead(initData: string): Promise<LeadCalculateResponse> {
  return request<LeadCalculateResponse>("/lead/calculate", { method: "POST" }, initData);
}

export function trackLeadAction(initData: string, payload: LeadActionPayload): Promise<void> {
  return request<void>("/lead/events", { method: "POST", body: JSON.stringify(payload) }, initData);
}
