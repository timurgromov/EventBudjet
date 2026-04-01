import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { deleteAdminLead, listAdminLeads, type AdminLeadListItem } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  formatBotContactLabel,
  formatAdminDateTime,
  formatAdminMoney,
  formatCityLabel,
  formatLeadDateSignal,
  formatLeadName,
  formatLeadStatusLabel,
  getHotLevelLabel,
  getLeadHotScore,
  getLeadPriorityLabel,
  getLeadPriorityScore,
  getLeadRoleLabel,
  getBotContactTone,
  isLowPrioritySpecialist,
  isMoscowPriorityCity,
  formatSourceLabel,
} from "./admin-format";

interface AdminOutletContext {
  adminToken: string;
}

type LeadsFilter = "all" | "moscow" | "specialists";

const LeadRow = ({ lead, onRequestDelete }: { lead: AdminLeadListItem; onRequestDelete: (lead: AdminLeadListItem) => void }) => {
  const contactTone = getBotContactTone(lead.bot_contact_state);
  const hotScore = getLeadHotScore({
    city: lead.city,
    role: lead.role,
    lastSeenAt: lead.last_seen_at,
    weddingDateExact: lead.wedding_date_exact,
    guestsCount: lead.guests_count,
    totalBudget: lead.total_budget,
    leadStatus: lead.lead_status,
  });

  return (
  <Link
    to={`/admin/leads/${lead.lead_id}`}
    className="relative grid gap-2 rounded-xl border border-slate-200 bg-white p-4 pr-12 transition-colors hover:border-slate-300 hover:bg-slate-50 md:grid-cols-[minmax(0,1.3fr)_0.9fr_0.8fr_0.8fr_0.9fr]"
  >
    <div className="absolute right-2 top-2 z-10">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 border-slate-200 bg-white">
          <DropdownMenuItem
            className="text-slate-700 focus:bg-slate-50 focus:text-slate-900"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRequestDelete(lead);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4 text-slate-500" />
            Удалить лид
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <div className="min-w-0">
      <div className="truncate text-sm font-semibold text-slate-950">{formatLeadName(lead.name, lead.username)}</div>
      <div className="mt-1 text-xs text-slate-500">lead #{lead.lead_id}</div>
      <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-slate-600">
        <span className={contactTone === "red" ? "h-2 w-2 rounded-full bg-red-500" : contactTone === "green" ? "h-2 w-2 rounded-full bg-emerald-500" : "h-2 w-2 rounded-full bg-slate-400"} />
        {formatBotContactLabel(lead.bot_contact_state)}
      </div>
      <div className="mt-1 text-xs text-slate-500">Источник: {lead.source_label ?? formatSourceLabel(lead.source)}</div>
    </div>
    <div className="text-sm text-slate-700">
      <div>{formatCityLabel(lead.city)}</div>
      <div className="mt-1 text-xs text-slate-500">{getLeadRoleLabel(lead.role)}</div>
      <div className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">{getLeadPriorityLabel(lead.city, lead.role)}</div>
    </div>
    <div className="text-sm text-slate-700">{formatLeadDateSignal(lead.wedding_date_exact, lead.season)}</div>
    <div className="text-sm text-slate-700">
      <div>{lead.guests_count ?? "—"} гостей</div>
      <div className="mt-1 text-xs text-slate-500">{formatLeadStatusLabel(lead.lead_status)}</div>
    </div>
    <div className="text-sm text-slate-700">
      <div className="font-medium text-slate-950">{formatAdminMoney(lead.total_budget)}</div>
      <div className="mt-1 text-xs text-slate-500">{formatAdminDateTime(lead.last_seen_at)}</div>
      <div className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
        {getHotLevelLabel(hotScore)} • {hotScore}
      </div>
    </div>
  </Link>
  );
};

const AdminLeadsPage = () => {
  const { adminToken } = useOutletContext<AdminOutletContext>();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<LeadsFilter>("all");
  const [deleteLead, setDeleteLead] = useState<AdminLeadListItem | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["admin-leads", adminToken],
    queryFn: () => listAdminLeads(adminToken),
    enabled: adminToken.trim().length > 0,
  });

  const leads = query.data?.leads ?? [];
  const normalizedSearch = search.trim().toLowerCase();
  const canDelete = deleteConfirmText.trim() === "DELETE";

  const deleteLeadMutation = useMutation({
    mutationFn: async (leadId: number) => deleteAdminLead(adminToken, leadId),
    onSuccess: async () => {
      setDeleteStatus("Лид удалён.");
      setDeleteLead(null);
      setDeleteConfirmText("");
      await query.refetch();
    },
    onError: (error) => {
      setDeleteStatus(error instanceof Error ? `Ошибка удаления: ${error.message}` : "Ошибка удаления.");
    },
  });

  const filteredLeads = useMemo(() => {
    const bySearch = normalizedSearch
      ? leads.filter((lead) => {
          const haystack = `${lead.name ?? ""} ${lead.username ?? ""} ${lead.city ?? ""} ${lead.role ?? ""} ${lead.lead_id}`.toLowerCase();
          return haystack.includes(normalizedSearch);
        })
      : leads;

    const filtered = bySearch.filter((lead) => {
      if (activeFilter === "moscow") return isMoscowPriorityCity(lead.city);
      if (activeFilter === "specialists") return isLowPrioritySpecialist(lead.role);
      return true;
    });

    return filtered;
  }, [activeFilter, leads, normalizedSearch]);

  const visibleLeads = useMemo(() => {
    return [...filteredLeads].sort((a, b) => {
      const aTs = a.last_seen_at ? Date.parse(a.last_seen_at) : 0;
      const bTs = b.last_seen_at ? Date.parse(b.last_seen_at) : 0;
      if (aTs !== bTs) return bTs - aTs;
      return b.lead_id - a.lead_id;
    });
  }, [filteredLeads]);

  const moscowHighPriority = filteredLeads.filter((lead) => getLeadPriorityScore(lead.city, lead.role) >= 80).length;

  const hotLeads = useMemo(() => {
    return [...filteredLeads]
      .sort((a, b) => {
        const scoreDiff =
          getLeadHotScore({
            city: b.city,
            role: b.role,
            lastSeenAt: b.last_seen_at,
            weddingDateExact: b.wedding_date_exact,
            guestsCount: b.guests_count,
            totalBudget: b.total_budget,
            leadStatus: b.lead_status,
          }) -
          getLeadHotScore({
            city: a.city,
            role: a.role,
            lastSeenAt: a.last_seen_at,
            weddingDateExact: a.wedding_date_exact,
            guestsCount: a.guests_count,
            totalBudget: a.total_budget,
            leadStatus: a.lead_status,
          });
        if (scoreDiff !== 0) return scoreDiff;

        const aTs = a.last_seen_at ? Date.parse(a.last_seen_at) : 0;
        const bTs = b.last_seen_at ? Date.parse(b.last_seen_at) : 0;
        if (aTs !== bTs) return bTs - aTs;
        return b.lead_id - a.lead_id;
      })
      .slice(0, 5);
  }, [filteredLeads]);

  const filterTitle = activeFilter === "moscow" ? "Москва + МО" : activeFilter === "specialists" ? "Специалисты" : "Все";

  if (!adminToken.trim()) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">Сохраните admin token, чтобы открыть список лидов.</div>;
  }

  if (query.isLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Загружаю лиды...</div>;
  }

  if (query.isError) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700">{query.error instanceof Error ? query.error.message : "Не удалось загрузить лиды"}</div>;
  }

  return (
    <div className="space-y-4">
      <AlertDialog
        open={Boolean(deleteLead)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteLead(null);
            setDeleteConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить лида?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие необратимо. Для подтверждения введите <span className="font-semibold text-slate-900">DELETE</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(event) => setDeleteConfirmText(event.target.value)}
            placeholder="Введите DELETE"
            className="mt-1"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLeadMutation.isPending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canDelete || deleteLeadMutation.isPending || !deleteLead}
              className="bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              onClick={(event) => {
                event.preventDefault();
                if (!deleteLead || !canDelete) return;
                deleteLeadMutation.mutate(deleteLead.lead_id);
              }}
            >
              {deleteLeadMutation.isPending ? "Удаляю..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold text-slate-950">Лиды</div>
        <div className="mt-1 text-sm text-slate-600">Всего: {leads.length} • приоритет Москва/МО: {moscowHighPriority}</div>
        {deleteStatus ? <div className="mt-2 text-xs text-slate-600">{deleteStatus}</div> : null}
        <div className="mt-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск: имя, @username, город, роль, lead id"
            className="bg-slate-50"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            className={activeFilter === "all" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}
            onClick={() => setActiveFilter("all")}
          >
            Все
          </Button>
          <Button
            size="sm"
            className={activeFilter === "moscow" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}
            onClick={() => setActiveFilter("moscow")}
          >
            Москва+МО
          </Button>
          <Button
            size="sm"
            className={activeFilter === "specialists" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}
            onClick={() => setActiveFilter("specialists")}
          >
            Специалисты
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold text-slate-950">Горячие лиды</div>
          <div className="text-xs text-slate-500">Top 5 • фильтр: {filterTitle}</div>
        </div>
        {hotLeads.length === 0 ? (
          <div className="mt-3 text-sm text-slate-600">Под текущий фильтр горячих лидов нет.</div>
        ) : (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {hotLeads.map((lead) => {
              const hotScore = getLeadHotScore({
                city: lead.city,
                role: lead.role,
                lastSeenAt: lead.last_seen_at,
                weddingDateExact: lead.wedding_date_exact,
                guestsCount: lead.guests_count,
                totalBudget: lead.total_budget,
                leadStatus: lead.lead_status,
              });
              return (
                <Link
                  key={`hot-${lead.lead_id}`}
                  to={`/admin/leads/${lead.lead_id}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition-colors hover:bg-white"
                >
                  <div className="truncate text-sm font-semibold text-slate-950">{formatLeadName(lead.name, lead.username)}</div>
                  <div className="mt-1 text-xs text-slate-600">
                    {formatCityLabel(lead.city)} • {getLeadRoleLabel(lead.role)} • {formatAdminDateTime(lead.last_seen_at)}
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-slate-600">
                    <span className={getBotContactTone(lead.bot_contact_state) === "red" ? "h-2 w-2 rounded-full bg-red-500" : getBotContactTone(lead.bot_contact_state) === "green" ? "h-2 w-2 rounded-full bg-emerald-500" : "h-2 w-2 rounded-full bg-slate-400"} />
                    {formatBotContactLabel(lead.bot_contact_state)}
                  </div>
                  <div className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                    {getHotLevelLabel(hotScore)} • score {hotScore}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      {visibleLeads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">Лидов пока нет.</div>
      ) : (
        <div className="space-y-3">
          {visibleLeads.map((lead) => (
            <LeadRow
              key={lead.lead_id}
              lead={lead}
              onRequestDelete={(leadRow) => {
                setDeleteStatus(null);
                setDeleteLead(leadRow);
                setDeleteConfirmText("");
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminLeadsPage;
