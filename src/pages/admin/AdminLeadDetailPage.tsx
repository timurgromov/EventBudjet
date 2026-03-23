import { useQuery } from "@tanstack/react-query";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { getAdminLead } from "@/lib/api";
import { formatAdminDate, formatAdminDateTime, formatAdminMoney, formatLeadName } from "./admin-format";

interface AdminOutletContext {
  adminToken: string;
}

const AdminLeadDetailPage = () => {
  const { adminToken } = useOutletContext<AdminOutletContext>();
  const params = useParams();
  const leadId = Number(params.leadId);

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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <Link to="/admin/leads" className="text-sm text-slate-500 underline underline-offset-4">Назад к лидам</Link>
            <h2 className="mt-2 text-2xl font-serif text-slate-950">{formatLeadName([user.first_name, user.last_name].filter(Boolean).join(" ") || null, user.username)}</h2>
            <div className="mt-1 text-sm text-slate-600">lead #{lead.id} • telegram_id {user.telegram_id}</div>
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
            <div><span className="text-slate-500">Роль:</span> {lead.role ?? "—"}</div>
            <div><span className="text-slate-500">Город:</span> {lead.city ?? "—"}</div>
            <div><span className="text-slate-500">Дата свадьбы:</span> {formatAdminDate(lead.wedding_date_exact)}</div>
            <div><span className="text-slate-500">Сезон:</span> {lead.season ?? "—"}</div>
            <div><span className="text-slate-500">Гостей:</span> {lead.guests_count ?? "—"}</div>
            <div><span className="text-slate-500">Статус:</span> {lead.lead_status ?? "—"}</div>
            <div><span className="text-slate-500">Площадка:</span> {lead.venue_name ?? lead.venue_status ?? "—"}</div>
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
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 text-lg font-semibold text-slate-950">Последние события</div>
        <div className="space-y-3">
          {recentEvents.map((event) => (
            <div key={event.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div className="text-sm font-medium text-slate-950">{event.event_type}</div>
                <div className="text-xs text-slate-500">{formatAdminDateTime(event.created_at)}</div>
              </div>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(event.event_payload ?? {}, null, 2)}</pre>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdminLeadDetailPage;
