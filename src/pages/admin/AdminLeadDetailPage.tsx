import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { getAdminLead } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  formatAdminDate,
  formatAdminDateTime,
  formatAdminMoney,
  formatCityLabel,
  formatDateModeLabel,
  formatLeadName,
  formatLeadStatusLabel,
  formatProfileFieldLabel,
  formatSeasonLabel,
  formatSourceLabel,
  formatVenueValue,
  getLeadRoleLabel,
} from "./admin-format";

interface AdminOutletContext {
  adminToken: string;
}

const asString = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
};

const formatEventSummary = (eventType: string, payload: Record<string, unknown> | null): string => {
  const p = payload ?? {};
  const amount = asString(p.amount);
  const categoryName = asString(p.category_name);
  const totalBudget = asString(p.total_budget);
  const action = asString(p.action);
  const source = asString(p.source);

  if (eventType === "expense_added") {
    return `Добавлен расход${categoryName ? `: ${categoryName}` : ""}${amount ? ` — ${formatAdminMoney(amount)}` : ""}`;
  }

  if (eventType === "expense_updated") {
    const changes = Array.isArray(p.changes) ? p.changes : [];
    if (changes.length > 0) {
      const changedFields = changes
        .map((change) => (change && typeof change === "object" && "field" in change ? formatProfileFieldLabel(asString(change.field)) : null))
        .filter((field): field is string => Boolean(field));
      if (changedFields.length > 0) return `Обновлён расход: ${changedFields.join(", ")}`;
    }
    return "Обновлён расход";
  }

  if (eventType === "expense_removed") {
    return `Удалён расход${categoryName ? `: ${categoryName}` : ""}${amount ? ` — ${formatAdminMoney(amount)}` : ""}`;
  }

  if (eventType === "profile_updated") {
    const fields = Array.isArray(p.updated_fields) ? p.updated_fields.filter((x) => typeof x === "string") : [];
    const translatedFields = fields.map((field) => formatProfileFieldLabel(field));
    return translatedFields.length > 0 ? `Обновлён профиль: ${translatedFields.join(", ")}` : "Обновлён профиль";
  }

  if (eventType === "budget_calculated") {
    return `Пересчитан бюджет${totalBudget ? `: ${formatAdminMoney(totalBudget)}` : ""}`;
  }

  if (eventType === "profile_completed") return "Профиль заполнен";
  if (eventType === "profile_started") return "Начато заполнение профиля";
  if (eventType === "lead_created") return "Создан лид";
  if (eventType === "bot_started") return "Старт из бота";
  if (eventType === "miniapp_opened") return "Открыл Mini App";
  if (eventType === "app_resumed") return "Вернулся в приложение";
  if (eventType === "ui_action") {
    if (action === "copy_estimate") return "Нажал «Скопировать смету»";
    if (action === "view_online_review") return "Нажал «Посмотреть онлайн-разбор»";
    if (action === "open_site_header") return "Перешёл на сайт из шапки";
    if (action === "open_site_footer") return "Перешёл на сайт из подвала";
    if (action || source) return `Дополнительное действие: ${action ?? source ?? "—"}`;
    return "Дополнительное действие";
  }

  return eventType;
};

const AdminLeadDetailPage = () => {
  const { adminToken } = useOutletContext<AdminOutletContext>();
  const params = useParams();
  const leadId = Number(params.leadId);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-lead-detail", adminToken, leadId],
    queryFn: () => getAdminLead(adminToken, leadId),
    enabled: adminToken.trim().length > 0 && Number.isFinite(leadId),
  });

  if (!adminToken.trim()) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">Сохраните admin token, чтобы открыть карточку лида.</div>;
  }

  if (query.isLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Загружаю карточку лида...</div>;
  }

  if (query.isError || !query.data) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700">{query.error instanceof Error ? query.error.message : "Не удалось загрузить карточку лида"}</div>;
  }

  const { lead, user, expenses, recent_events: recentEvents } = query.data;

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(`${label} скопирован`);
    } catch {
      setCopyStatus("Не удалось скопировать");
    }
    setTimeout(() => setCopyStatus(null), 1800);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <Link to="/admin/leads" className="text-sm text-slate-500 underline underline-offset-4">Назад к лидам</Link>
            <h2 className="mt-2 text-2xl font-serif text-slate-950">{formatLeadName([user.first_name, user.last_name].filter(Boolean).join(" ") || null, user.username)}</h2>
            <div className="mt-1 text-sm text-slate-600">lead #{lead.id} • telegram_id {user.telegram_id}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {user.username ? (
                <Button variant="outline" size="sm" onClick={() => handleCopy(`@${user.username}`, "Username")}>
                  Копировать @username
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => handleCopy(String(user.telegram_id), "Telegram ID")}>
                Копировать telegram_id
              </Button>
            </div>
            {copyStatus ? <div className="mt-2 text-xs text-emerald-700">{copyStatus}</div> : null}
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-right">
            <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Итоговый бюджет</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{formatAdminMoney(lead.total_budget)}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 text-lg font-semibold text-slate-950">Профиль</div>
          <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
            <div><span className="text-slate-500">Роль:</span> {getLeadRoleLabel(lead.role)}</div>
            <div><span className="text-slate-500">Город:</span> {formatCityLabel(lead.city)}</div>
            <div><span className="text-slate-500">Дата свадьбы:</span> {formatAdminDate(lead.wedding_date_exact)}</div>
            <div><span className="text-slate-500">Сезон:</span> {formatSeasonLabel(lead.season)}</div>
            <div><span className="text-slate-500">Гостей:</span> {lead.guests_count ?? "—"}</div>
            <div><span className="text-slate-500">Статус:</span> {formatLeadStatusLabel(lead.lead_status)}</div>
            <div><span className="text-slate-500">Площадка:</span> {formatVenueValue(lead.venue_status, lead.venue_name)}</div>
            <div><span className="text-slate-500">Источник:</span> {formatSourceLabel(lead.source)}</div>
            <div><span className="text-slate-500">Формат даты:</span> {formatDateModeLabel(lead.wedding_date_mode)}</div>
            <div><span className="text-slate-500">Последняя активность:</span> {formatAdminDateTime(user.last_seen_at)}</div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 text-lg font-semibold text-slate-950">Смета</div>
          {expenses.length === 0 ? (
            <div className="text-sm text-slate-600">Расходов пока нет.</div>
          ) : (
            <div className="space-y-2">
              {expenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
                  <div className="min-w-0 pr-4 text-slate-700">{expense.category_name}</div>
                  <div className="shrink-0 font-medium text-slate-950">{formatAdminMoney(expense.amount)}</div>
                </div>
              ))}
              <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-950 px-4 py-3 text-sm">
                <div className="font-semibold text-white">Итого</div>
                <div className="shrink-0 text-base font-semibold text-white">{formatAdminMoney(lead.total_budget)}</div>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 text-lg font-semibold text-slate-950">Последние события</div>
        {recentEvents.length === 0 ? (
          <div className="text-sm text-slate-600">Событий пока нет.</div>
        ) : (
          <div className="space-y-3">
            {recentEvents.map((event) => (
              <div key={event.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm font-semibold text-slate-950">{formatEventSummary(event.event_type, event.event_payload)}</div>
                  <div className="text-xs text-slate-500">{formatAdminDateTime(event.created_at)}</div>
                </div>
                <div className="mt-1 text-xs text-slate-500">технический тип: {event.event_type}</div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-slate-500">Показать payload</summary>
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(event.event_payload ?? {}, null, 2)}</pre>
                </details>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminLeadDetailPage;
