import { useQuery } from "@tanstack/react-query";
import { useOutletContext, Link } from "react-router-dom";
import { listAdminLeads, type AdminLeadListItem } from "@/lib/api";
import { formatAdminDateTime, formatAdminMoney, formatLeadDateSignal, formatLeadName } from "./admin-format";

interface AdminOutletContext {
  adminToken: string;
}

const LeadRow = ({ lead }: { lead: AdminLeadListItem }) => (
  <Link
    to={`/admin/leads/${lead.lead_id}`}
    className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50 md:grid-cols-[minmax(0,1.3fr)_0.9fr_0.8fr_0.8fr_0.9fr]"
  >
    <div className="min-w-0">
      <div className="truncate text-sm font-semibold text-slate-950">{formatLeadName(lead.name, lead.username)}</div>
      <div className="mt-1 text-xs text-slate-500">lead #{lead.lead_id}</div>
    </div>
    <div className="text-sm text-slate-700">
      <div>{lead.city ?? "—"}</div>
      <div className="mt-1 text-xs text-slate-500">{lead.role ?? "—"}</div>
    </div>
    <div className="text-sm text-slate-700">{formatLeadDateSignal(lead.wedding_date_exact, lead.season)}</div>
    <div className="text-sm text-slate-700">
      <div>{lead.guests_count ?? "—"} гостей</div>
      <div className="mt-1 text-xs text-slate-500">{lead.lead_status ?? "—"}</div>
    </div>
    <div className="text-sm text-slate-700">
      <div className="font-medium text-slate-950">{formatAdminMoney(lead.total_budget)}</div>
      <div className="mt-1 text-xs text-slate-500">{formatAdminDateTime(lead.last_seen_at)}</div>
    </div>
  </Link>
);

const AdminLeadsPage = () => {
  const { adminToken } = useOutletContext<AdminOutletContext>();
  const query = useQuery({
    queryKey: ["admin-leads", adminToken],
    queryFn: () => listAdminLeads(adminToken),
    enabled: adminToken.trim().length > 0,
  });

  if (!adminToken.trim()) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">Сохраните admin token, чтобы открыть список лидов.</div>;
  }

  if (query.isLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Загружаю лиды...</div>;
  }

  if (query.isError) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700">{query.error instanceof Error ? query.error.message : "Не удалось загрузить лиды"}</div>;
  }

  const leads = query.data?.leads ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold text-slate-950">Лиды</div>
        <div className="mt-1 text-sm text-slate-600">Всего: {leads.length}</div>
      </div>
      {leads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">Лидов пока нет.</div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <LeadRow key={lead.lead_id} lead={lead} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminLeadsPage;
