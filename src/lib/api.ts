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

export interface AdminLeadListItem {
  lead_id: number;
  name: string | null;
  username: string | null;
  role: string | null;
  city: string | null;
  wedding_date_exact: string | null;
  season: string | null;
  guests_count: number | null;
  total_budget: string | null;
  lead_status: string | null;
  last_seen_at: string | null;
  source: string | null;
  source_label?: string | null;
  bot_contact_state: "active" | "blocked" | "unknown" | string | null;
}

export interface AdminLeadListResponse {
  leads: AdminLeadListItem[];
}

export interface AdminUserRead {
  id: number;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  last_seen_at: string | null;
}

export interface AdminLeadEventRead {
  id: number;
  lead_id: number;
  event_type: string;
  event_payload: Record<string, unknown> | null;
  created_at: string;
}

export interface AdminLeadDetailResponse {
  lead: Lead;
  source_label?: string | null;
  user: AdminUserRead;
  expenses: Expense[];
  recent_events: AdminLeadEventRead[];
}

export interface AdminLeadSourceItem {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_archived: boolean;
  leads_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminLeadSourcesResponse {
  sources: AdminLeadSourceItem[];
}

export interface AdminLeadSourceCreatePayload {
  name: string;
  code?: string | null;
  description?: string | null;
}

export interface AdminLeadSourceActionResponse {
  source_id: number;
  status: "archived" | "restored" | "deleted" | string;
}

export interface AdminNotificationsRead {
  id: number;
  lead_id: number;
  notification_type: string;
  priority: string | null;
  status: string;
  sent_at: string | null;
  created_at: string;
  telegram_id: number | null;
  username: string | null;
}

export interface AdminNotificationsResponse {
  notifications: AdminNotificationsRead[];
}

export interface AdminDirectMessageResponse {
  lead_id: number;
  telegram_id: number;
  status: "sent" | "failed" | string;
}

export interface AdminLeadActionResponse {
  lead_id: number;
  status: "reset" | "deleted" | string;
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

        if (typeof message !== "string" || !message) {
          return null;
        }

        return location ? `${location}: ${message}` : message;
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

async function adminRequest<T>(path: string, adminToken: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  headers.set("X-Admin-Token", adminToken);

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

export function listAdminLeads(adminToken: string): Promise<AdminLeadListResponse> {
  return adminRequest<AdminLeadListResponse>("/admin/leads", adminToken);
}

export function getAdminLead(adminToken: string, leadId: number): Promise<AdminLeadDetailResponse> {
  return adminRequest<AdminLeadDetailResponse>(`/admin/leads/${leadId}`, adminToken);
}

export function listAdminNotifications(adminToken: string): Promise<AdminNotificationsResponse> {
  return adminRequest<AdminNotificationsResponse>("/admin/notifications", adminToken);
}

export function listAdminSources(adminToken: string): Promise<AdminLeadSourcesResponse> {
  return adminRequest<AdminLeadSourcesResponse>("/admin/sources", adminToken);
}

export function createAdminSource(
  adminToken: string,
  payload: AdminLeadSourceCreatePayload,
): Promise<AdminLeadSourceItem> {
  return adminRequest<AdminLeadSourceItem>("/admin/sources", adminToken, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function archiveAdminSource(adminToken: string, sourceId: number): Promise<AdminLeadSourceActionResponse> {
  return adminRequest<AdminLeadSourceActionResponse>(`/admin/sources/${sourceId}/archive`, adminToken, {
    method: "POST",
  });
}

export function restoreAdminSource(adminToken: string, sourceId: number): Promise<AdminLeadSourceActionResponse> {
  return adminRequest<AdminLeadSourceActionResponse>(`/admin/sources/${sourceId}/restore`, adminToken, {
    method: "POST",
  });
}

export function deleteAdminSource(adminToken: string, sourceId: number): Promise<AdminLeadSourceActionResponse> {
  return adminRequest<AdminLeadSourceActionResponse>(`/admin/sources/${sourceId}`, adminToken, {
    method: "DELETE",
  });
}

export function sendAdminMessageToLead(
  adminToken: string,
  leadId: number,
  text: string,
): Promise<AdminDirectMessageResponse> {
  return adminRequest<AdminDirectMessageResponse>(`/admin/leads/${leadId}/send-message`, adminToken, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export function resetAdminLead(adminToken: string, leadId: number): Promise<AdminLeadActionResponse> {
  return adminRequest<AdminLeadActionResponse>(`/admin/leads/${leadId}/reset`, adminToken, {
    method: "POST",
  });
}

export function deleteAdminLead(adminToken: string, leadId: number): Promise<AdminLeadActionResponse> {
  return adminRequest<AdminLeadActionResponse>(`/admin/leads/${leadId}`, adminToken, {
    method: "DELETE",
  });
}
