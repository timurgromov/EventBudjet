import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ChevronDown, ChevronUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { showAdminSuccessToast } from "@/lib/admin-toast";
import {
  archiveIncomingRequestSource,
  createIncomingRequest,
  createIncomingRequestSource,
  deleteIncomingRequest,
  getIncomingRequestSummary,
  listIncomingRequests,
  listIncomingRequestSources,
  restoreIncomingRequestSource,
  updateIncomingRequest,
  type IncomingRequest,
  type IncomingRequestCreatePayload,
  type IncomingRequestUpdatePayload,
} from "@/lib/api";
import { cn } from "@/lib/utils";

import { formatAdminDate, formatAdminDateTime } from "./admin-format";

type RequestStatus = "in_work" | "signed" | "rejected";
type EventTimingTone = "future" | "soon" | "past";

interface AdminOutletContext {
  adminToken: string;
}

interface RequestFormState {
  sourceId: string;
  eventDate: string;
  lastContactDate: string;
  meetingHeld: boolean;
  comment: string;
  status: RequestStatus;
}

const STATUS_OPTIONS: Array<{ value: RequestStatus; label: string }> = [
  { value: "in_work", label: "В работе" },
  { value: "signed", label: "Договор" },
  { value: "rejected", label: "Отказ" },
];

const STATUS_SORT_WEIGHT: Record<RequestStatus, number> = {
  in_work: 0,
  signed: 1,
  rejected: 2,
};
const DAY_MS = 24 * 60 * 60 * 1000;

const AUTOSAVE_DELAY_MS = 1200;

const EMPTY_FORM: RequestFormState = {
  sourceId: "",
  eventDate: "",
  lastContactDate: "",
  meetingHeld: false,
  comment: "",
  status: "in_work",
};

const getStatusLabel = (status: string): string => STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;

const getStatusSortWeight = (status: string): number =>
  status === "signed" || status === "rejected" ? STATUS_SORT_WEIGHT[status] : STATUS_SORT_WEIGHT.in_work;

const getEventDateDistance = (eventDate: string | null, todayTime: number): number => {
  if (!eventDate) return Number.POSITIVE_INFINITY;
  const eventTime = Date.parse(eventDate);
  if (Number.isNaN(eventTime)) return Number.POSITIVE_INFINITY;
  return Math.abs(eventTime - todayTime);
};

const pluralDays = (value: number): string => {
  const abs = Math.abs(value);
  const lastTwo = abs % 100;
  const last = abs % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "дней";
  if (last === 1) return "день";
  if (last >= 2 && last <= 4) return "дня";
  return "дней";
};

const parseDateOnly = (value?: string | null): Date | null => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getEventTiming = (eventDate?: string | null): { label: string; tone: EventTimingTone } | null => {
  const parsed = parseDateOnly(eventDate);
  if (!parsed) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffDays = Math.round((eventDay.getTime() - today.getTime()) / DAY_MS);

  if (diffDays < 0) {
    const daysAgo = Math.abs(diffDays);
    return { label: `было ${daysAgo} ${pluralDays(daysAgo)} назад`, tone: "past" };
  }
  if (diffDays === 0) return { label: "сегодня", tone: "soon" };
  return { label: `через ${diffDays} ${pluralDays(diffDays)}`, tone: diffDays <= 14 ? "soon" : "future" };
};

const getEventTimingClassName = (tone: EventTimingTone): string => {
  if (tone === "past") return "text-slate-500";
  if (tone === "soon") return "font-medium text-amber-700";
  return "text-slate-500";
};

const getRequestCardTone = (status: string, meetingHeld: boolean, needsFollowUp: boolean): { card: string; stripe: string; badge: string } => {
  if (status === "signed") {
    return {
      card: "border-emerald-200 bg-emerald-50/70",
      stripe: "bg-emerald-400",
      badge: "border-emerald-200 bg-emerald-100 text-emerald-800",
    };
  }
  if (status === "rejected") {
    return {
      card: "border-rose-200 bg-rose-50/70",
      stripe: "bg-rose-400",
      badge: "border-rose-200 bg-rose-100 text-rose-800",
    };
  }
  if (status === "in_work" && meetingHeld) {
    return {
      card: "border-sky-200 bg-sky-50/70",
      stripe: "bg-sky-400",
      badge: "border-sky-200 bg-sky-100 text-sky-800",
    };
  }
  if (status === "in_work" && needsFollowUp) {
    return {
      card: "border-amber-200 bg-amber-50/70",
      stripe: "bg-amber-400",
      badge: "border-amber-200 bg-amber-100 text-amber-800",
    };
  }
  return {
    card: "border-slate-200 bg-slate-50/80",
    stripe: "bg-slate-300",
    badge: "border-slate-200 bg-white text-slate-700",
  };
};

const toFormState = (request: IncomingRequest): RequestFormState => ({
  sourceId: request.source_id ? String(request.source_id) : "",
  eventDate: request.event_date ?? "",
  lastContactDate: request.last_contact_date ?? "",
  meetingHeld: Boolean(request.meeting_held),
  comment: request.comment ?? "",
  status: request.status === "signed" || request.status === "rejected" ? request.status : "in_work",
});

const toPayload = (form: RequestFormState): IncomingRequestCreatePayload => ({
  source_id: form.sourceId ? Number(form.sourceId) : null,
  source: "",
  event_date: form.eventDate || null,
  last_contact_date: form.lastContactDate || null,
  meeting_held: form.meetingHeld,
  comment: form.comment.trim() || null,
  status: form.status,
});

const AdminRequestsPage = () => {
  const { adminToken } = useOutletContext<AdminOutletContext>();
  const queryClient = useQueryClient();
  const [newRequest, setNewRequest] = useState<RequestFormState>(EMPTY_FORM);
  const [newSourceName, setNewSourceName] = useState("");
  const [drafts, setDrafts] = useState<Record<number, RequestFormState>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RequestStatus | "attention">("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [expandedRequestIds, setExpandedRequestIds] = useState<Record<number, boolean>>({});
  const autosaveTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const requestsQuery = useQuery({
    queryKey: ["incoming-requests", adminToken],
    queryFn: () => listIncomingRequests(adminToken),
    enabled: adminToken.trim().length > 0,
  });

  const sourcesQuery = useQuery({
    queryKey: ["incoming-request-sources", adminToken],
    queryFn: () => listIncomingRequestSources(adminToken),
    enabled: adminToken.trim().length > 0,
  });

  const summaryQuery = useQuery({
    queryKey: ["incoming-request-summary", adminToken],
    queryFn: () => getIncomingRequestSummary(adminToken),
    enabled: adminToken.trim().length > 0,
  });

  const requests = useMemo(() => requestsQuery.data?.requests ?? [], [requestsQuery.data?.requests]);
  const sources = useMemo(() => sourcesQuery.data?.sources ?? [], [sourcesQuery.data?.sources]);
  const activeSources = sources.filter((source) => !source.is_archived);
  const summary = summaryQuery.data;

  const visibleRequests = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    return requests
      .filter((request) => {
        if (statusFilter === "attention" && !request.needs_follow_up) return false;
        if (statusFilter !== "all" && statusFilter !== "attention" && request.status !== statusFilter) return false;
        if (sourceFilter !== "all" && String(request.source_id ?? "") !== sourceFilter) return false;
        if (!normalizedSearch) return true;
        return [request.source_name, request.comment, request.event_date, request.last_contact_date]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      })
      .sort((left, right) => {
        const statusDiff = getStatusSortWeight(left.status) - getStatusSortWeight(right.status);
        if (statusDiff !== 0) return statusDiff;

        const dateDiff = getEventDateDistance(left.event_date, todayTime) - getEventDateDistance(right.event_date, todayTime);
        if (dateDiff !== 0) return dateDiff;

        return Date.parse(right.updated_at) - Date.parse(left.updated_at);
      });
  }, [requests, search, sourceFilter, statusFilter]);

  const attentionCount = summary?.attention_count ?? requests.filter((request) => request.needs_follow_up).length;

  const invalidateRequests = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["incoming-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["incoming-request-sources"] }),
      queryClient.invalidateQueries({ queryKey: ["incoming-request-summary"] }),
    ]);
  };

  const createSourceMutation = useMutation({
    mutationFn: () =>
      createIncomingRequestSource(adminToken, {
        name: newSourceName.trim(),
      }),
    onSuccess: async (source) => {
      setNewSourceName("");
      setNewRequest((current) => ({ ...current, sourceId: String(source.id) }));
      setStatusMessage("Источник добавлен.");
      showAdminSuccessToast({
        title: "Источник добавлен",
        description: `${source.name} доступен для новых заявок.`,
      });
      await invalidateRequests();
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? `Ошибка источника: ${error.message}` : "Ошибка создания источника.");
    },
  });

  const archiveSourceMutation = useMutation({
    mutationFn: ({ sourceId, archived }: { sourceId: number; archived: boolean }) =>
      archived ? restoreIncomingRequestSource(adminToken, sourceId) : archiveIncomingRequestSource(adminToken, sourceId),
    onSuccess: async () => {
      setStatusMessage("Источник обновлён.");
      showAdminSuccessToast({
        title: "Источник сохранён",
        description: "Справочник заявок обновлён.",
      });
      await invalidateRequests();
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? `Ошибка источника: ${error.message}` : "Ошибка обновления источника.");
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: IncomingRequestCreatePayload) => createIncomingRequest(adminToken, payload),
    onSuccess: async () => {
      setNewRequest(EMPTY_FORM);
      setStatusMessage("Заявка добавлена.");
      showAdminSuccessToast({
        title: "Заявка добавлена",
        description: "Новая строка сохранена в CRM.",
      });
      await invalidateRequests();
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? `Ошибка создания: ${error.message}` : "Ошибка создания заявки.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ requestId, payload }: { requestId: number; payload: IncomingRequestUpdatePayload }) =>
      updateIncomingRequest(adminToken, requestId, payload),
    onSuccess: async () => {
      setStatusMessage(null);
      await invalidateRequests();
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? `Ошибка сохранения: ${error.message}` : "Ошибка сохранения заявки.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (requestId: number) => deleteIncomingRequest(adminToken, requestId),
    onSuccess: async () => {
      setStatusMessage("Заявка удалена.");
      await invalidateRequests();
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? `Ошибка удаления: ${error.message}` : "Ошибка удаления заявки.");
    },
  });

  useEffect(() => {
    const timers = autosaveTimersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  const queueAutosave = (requestId: number, draft: RequestFormState) => {
    const payload = toPayload(draft);
    if (!payload.source_id) {
      setStatusMessage("Источник не может быть пустым.");
      return;
    }

    clearTimeout(autosaveTimersRef.current[requestId]);
    autosaveTimersRef.current[requestId] = setTimeout(() => {
      updateMutation.mutate({ requestId, payload });
    }, AUTOSAVE_DELAY_MS);
  };

  const handleNewFieldChange = <K extends keyof RequestFormState>(field: K, value: RequestFormState[K]) => {
    setNewRequest((current) => ({ ...current, [field]: value }));
  };

  const handleDraftChange = <K extends keyof RequestFormState>(request: IncomingRequest, field: K, value: RequestFormState[K]) => {
    const nextDraft = {
      ...(drafts[request.id] ?? toFormState(request)),
      [field]: value,
    };

    setDrafts((current) => ({
      ...current,
      [request.id]: nextDraft,
    }));
    queueAutosave(request.id, nextDraft);
  };

  const handleNewStatusChange = (status: RequestStatus) => {
    setNewRequest((current) => ({
      ...current,
      status,
    }));
  };

  const handleDraftStatusChange = (request: IncomingRequest, status: RequestStatus) => {
    const currentDraft = drafts[request.id] ?? toFormState(request);
    const nextDraft = {
      ...currentDraft,
      status,
      meetingHeld: status === "signed" ? true : currentDraft.meetingHeld,
    };

    setDrafts((current) => {
      return {
        ...current,
        [request.id]: nextDraft,
      };
    });
    queueAutosave(request.id, nextDraft);
  };

  const toggleRequestExpanded = (requestId: number) => {
    setExpandedRequestIds((current) => ({
      ...current,
      [requestId]: !current[requestId],
    }));
  };

  const handleCreateSource = () => {
    if (!newSourceName.trim()) {
      setStatusMessage("Добавь название источника.");
      return;
    }
    createSourceMutation.mutate();
  };

  const handleCreate = () => {
    const payload = toPayload(newRequest);
    if (!payload.source_id) {
      setStatusMessage("Выбери источник заявки.");
      return;
    }
    createMutation.mutate(payload);
  };

  const handleDelete = (request: IncomingRequest) => {
    if (window.confirm(`Удалить заявку "${request.source_name}"?`)) {
      deleteMutation.mutate(request.id);
    }
  };

  if (!adminToken.trim()) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">Сохраните admin token, чтобы открыть раздел заявок.</div>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-950">Все заявки</div>
            <div className="mt-1 max-w-3xl text-sm text-slate-600">
              Реестр заявок с фиксированными источниками и быстрой статистикой по конверсии.
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-slate-500">
            <span>{summary?.total_count ?? requests.length} всего</span>
            <span>•</span>
            <span>{attentionCount} требуют внимания</span>
          </div>
        </div>
      </section>

      {statusMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          {statusMessage}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-7 gap-1">
          <div className="flex min-h-11 min-w-0 flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1.5">
            <div className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.04em] text-slate-500">Всего</div>
            <div className="text-base font-semibold leading-none text-slate-950">{summary?.total_count ?? 0}</div>
          </div>
          <div className="flex min-h-11 min-w-0 flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1.5">
            <div className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.04em] text-slate-500">В работе</div>
            <div className="text-base font-semibold leading-none text-slate-950">{summary?.in_work_count ?? 0}</div>
          </div>
          <div className="flex min-h-11 min-w-0 flex-col items-center justify-center rounded-lg border border-violet-200 bg-violet-50 px-1.5 py-1.5">
            <div className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.04em] text-violet-700">Встречи</div>
            <div className="text-base font-semibold leading-none text-violet-800">{summary?.meeting_count ?? 0}</div>
          </div>
          <div className="flex min-h-11 min-w-0 flex-col items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-1.5 py-1.5">
            <div className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.04em] text-rose-700">Отказ</div>
            <div className="text-base font-semibold leading-none text-rose-800">{summary?.rejected_count ?? 0}</div>
          </div>
          <div className="flex min-h-11 min-w-0 flex-col items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-1.5 py-1.5">
            <div className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.04em] text-emerald-700">Договор</div>
            <div className="text-base font-semibold leading-none text-emerald-800">{summary?.signed_count ?? 0}</div>
          </div>
          <div className="flex min-h-11 min-w-0 flex-col items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50 px-1.5 py-1.5">
            <div className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.04em] text-cyan-700">Конверсия</div>
            <div className="text-base font-semibold leading-none text-cyan-800">{summary?.conversion_rate ?? 0}%</div>
          </div>
          <div className="flex min-h-11 min-w-0 flex-col items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-1.5 py-1.5">
            <div className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.04em] text-indigo-700">Встречи %</div>
            <div className="text-base font-semibold leading-none text-indigo-800">{summary?.meeting_conversion_rate ?? 0}%</div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        {(summary?.sources ?? []).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-1.5 font-semibold">Источник</th>
                  <th className="border-b border-slate-200 px-3 py-1.5 text-right font-semibold">Всего</th>
                  <th className="border-b border-slate-200 px-3 py-1.5 text-right font-semibold">В работе</th>
                  <th className="border-b border-slate-200 px-3 py-1.5 text-right font-semibold">Встречи</th>
                  <th className="border-b border-slate-200 px-3 py-1.5 text-right font-semibold">Отказ</th>
                  <th className="border-b border-slate-200 px-3 py-1.5 text-right font-semibold">Договор</th>
                  <th className="border-b border-slate-200 px-3 py-1.5 text-right font-semibold">Конверсия</th>
                  <th className="border-b border-slate-200 px-3 py-1.5 text-right font-semibold">Встречи %</th>
                </tr>
              </thead>
              <tbody>
                {(summary?.sources ?? []).map((source) => (
                  <tr key={source.source_id ?? source.source_name}>
                    <td className="border-b border-slate-100 px-3 py-1.5 font-medium text-slate-950">{source.source_name}</td>
                    <td className="border-b border-slate-100 px-3 py-1.5 text-right text-slate-700">{source.total_count}</td>
                    <td className="border-b border-slate-100 px-3 py-1.5 text-right text-slate-700">{source.in_work_count}</td>
                    <td className="border-b border-slate-100 px-3 py-1.5 text-right text-violet-700">{source.meeting_count}</td>
                    <td className="border-b border-slate-100 px-3 py-1.5 text-right text-rose-700">{source.rejected_count}</td>
                    <td className="border-b border-slate-100 px-3 py-1.5 text-right text-emerald-700">{source.signed_count}</td>
                    <td className="border-b border-slate-100 px-3 py-1.5 text-right font-medium text-slate-950">{source.conversion_rate}%</td>
                    <td className="border-b border-slate-100 px-3 py-1.5 text-right font-medium text-indigo-700">
                      {source.meeting_conversion_rate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <Input
            value={newSourceName}
            onChange={(event) => setNewSourceName(event.target.value)}
            placeholder="Новый источник: Московское небо"
            className="bg-white"
          />
          <Button onClick={handleCreateSource} disabled={createSourceMutation.isPending}>
            <Plus className="mr-2 h-4 w-4" />
            Источник
          </Button>
        </div>

        {sources.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {sources.map((source) => (
              <button
                key={source.id}
                type="button"
                onClick={() => archiveSourceMutation.mutate({ sourceId: source.id, archived: source.is_archived })}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors",
                  source.is_archived
                    ? "border-slate-200 bg-slate-100 text-slate-500"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                )}
                title={source.is_archived ? "Вернуть источник" : "Архивировать источник"}
              >
                {source.is_archived ? <RotateCcw className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                {source.name}
                <span className="text-slate-400">{source.requests_count}</span>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3">
          <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(220px,1fr)_160px_160px_140px_auto] lg:items-end">
            <label className="min-w-0">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">Источник</span>
              <select
                value={newRequest.sourceId}
                onChange={(event) => handleNewFieldChange("sourceId", event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
              >
                <option value="">Выбрать источник</option>
                {activeSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">Дата мероприятия</span>
              <Input
                type="date"
                value={newRequest.eventDate}
                onChange={(event) => handleNewFieldChange("eventDate", event.target.value)}
                className="bg-white text-slate-950 [color-scheme:light]"
              />
            </label>
            <label className="min-w-0">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">Последний контакт</span>
              <Input
                type="date"
                value={newRequest.lastContactDate}
                onChange={(event) => handleNewFieldChange("lastContactDate", event.target.value)}
                className="bg-white text-slate-950 [color-scheme:light]"
              />
            </label>
            <label className="min-w-0">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">Статус</span>
              <select
                value={newRequest.status}
                onChange={(event) => handleNewStatusChange(event.target.value as RequestStatus)}
                className="h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="h-10">
              <Plus className="mr-2 h-4 w-4" />
              Добавить
            </Button>
          </div>
          <Input
            value={newRequest.comment}
            onChange={(event) => handleNewFieldChange("comment", event.target.value)}
            placeholder="Комментарий: имя, телефон, история"
            className="bg-white"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid gap-2 lg:grid-cols-[minmax(220px,320px)_190px_180px]">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по источнику и комментарию"
              className="bg-white"
            />
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
              className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm"
            >
              <option value="all">Все источники</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | RequestStatus | "attention")}
              className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm"
            >
              <option value="all">Все статусы</option>
              <option value="attention">Требуют внимания</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm text-slate-500">Показано: {visibleRequests.length}</div>
        </div>

        {requestsQuery.isLoading || sourcesQuery.isLoading ? (
          <div className="mt-4 text-sm text-slate-600">Загружаю заявки...</div>
        ) : requestsQuery.isError || sourcesQuery.isError ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {requestsQuery.error instanceof Error
              ? requestsQuery.error.message
              : sourcesQuery.error instanceof Error
                ? sourcesQuery.error.message
                : "Не удалось загрузить заявки"}
          </div>
        ) : visibleRequests.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            Заявок пока нет.
          </div>
        ) : (
          <TooltipProvider delayDuration={250}>
            <div className="mt-4 space-y-3">
              {visibleRequests.map((request) => {
                const draft = drafts[request.id] ?? toFormState(request);
                const cardTone = getRequestCardTone(draft.status, draft.meetingHeld, request.needs_follow_up);
                const isWaitingForDecision = draft.status === "in_work" && draft.meetingHeld;
                const isExpanded = Boolean(expandedRequestIds[request.id]);
                const comment = draft.comment.trim();
                const eventTiming = getEventTiming(draft.eventDate);

                return (
                  <article
                    key={request.id}
                    className={cn("relative overflow-hidden rounded-2xl border p-4 pl-5 transition-colors", cardTone.card)}
                  >
                    <span className={cn("absolute inset-y-0 left-0 w-1.5", cardTone.stripe)} />
                    <div className="grid gap-3 lg:grid-cols-[0.9fr_0.8fr_0.85fr_1.15fr_0.95fr]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-semibold text-slate-950">{request.source_name}</div>
                          <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", cardTone.badge)}>
                            {getStatusLabel(draft.status)}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">Заявка #{request.id}</div>
                        <div className="mt-1 text-xs text-slate-500">Изменено: {formatAdminDateTime(request.updated_at)}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {isWaitingForDecision ? (
                            <span className="text-xs font-medium text-sky-700">Ждём решение</span>
                          ) : null}
                          {request.needs_follow_up ? (
                            <span className="text-xs font-medium text-amber-700">Требует внимания</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="text-sm text-slate-700">
                        <div>Мероприятие: {formatAdminDate(draft.eventDate)}</div>
                        {eventTiming ? (
                          <div className={cn("mt-1 text-xs", getEventTimingClassName(eventTiming.tone))}>
                            {eventTiming.label}
                          </div>
                        ) : null}
                        <div className="mt-1 text-xs text-slate-500">Последний контакт: {formatAdminDate(draft.lastContactDate)}</div>
                      </div>

                      <div className="space-y-2">
                        <label className="flex h-9 items-center gap-2 rounded-md border border-input bg-white px-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={draft.meetingHeld}
                            onChange={(event) => handleDraftChange(request, "meetingHeld", event.target.checked)}
                            className="h-4 w-4"
                          />
                          Встреча была
                        </label>
                        <select
                          value={draft.status}
                          onChange={(event) => handleDraftStatusChange(request, event.target.value as RequestStatus)}
                          className="h-9 w-full rounded-md border border-input bg-white px-2 py-1 text-sm"
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="min-w-0 text-sm text-slate-700">
                        <div className="mb-1 text-xs font-medium text-slate-500">Комментарий</div>
                        {comment ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" className="line-clamp-2 w-full text-left leading-snug text-slate-950">
                                {comment}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xl whitespace-pre-wrap bg-white p-3 text-sm leading-relaxed text-slate-800 shadow-lg">
                              {comment}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <div className="text-xs text-slate-400">Комментарий не заполнен</div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-start justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => toggleRequestExpanded(request.id)}
                          className="h-9 border-slate-200 bg-white px-2 text-slate-700 hover:bg-slate-50"
                        >
                          {isExpanded ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
                          Править
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(request)}
                          disabled={deleteMutation.isPending}
                          title="Удалить"
                          className="h-9 border-slate-200 bg-white px-2 text-slate-700 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 lg:grid-cols-[minmax(220px,1fr)_160px_160px_140px]">
                        <label className="min-w-0">
                          <span className="mb-1 block text-[11px] font-medium text-slate-500">Источник</span>
                          <select
                            value={draft.sourceId}
                            onChange={(event) => handleDraftChange(request, "sourceId", event.target.value)}
                            className="h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                          >
                            <option value="">Источник</option>
                            {activeSources.map((source) => (
                              <option key={source.id} value={source.id}>
                                {source.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="min-w-0">
                          <span className="mb-1 block text-[11px] font-medium text-slate-500">Дата мероприятия</span>
                          <Input
                            type="date"
                            value={draft.eventDate}
                            onChange={(event) => handleDraftChange(request, "eventDate", event.target.value)}
                            className="bg-white text-slate-950 [color-scheme:light]"
                          />
                        </label>
                        <label className="min-w-0">
                          <span className="mb-1 block text-[11px] font-medium text-slate-500">Последний контакт</span>
                          <Input
                            type="date"
                            value={draft.lastContactDate}
                            onChange={(event) => handleDraftChange(request, "lastContactDate", event.target.value)}
                            className="bg-white text-slate-950 [color-scheme:light]"
                          />
                        </label>
                        <label className="min-w-0">
                          <span className="mb-1 block text-[11px] font-medium text-slate-500">Статус</span>
                          <select
                            value={draft.status}
                            onChange={(event) => handleDraftStatusChange(request, event.target.value as RequestStatus)}
                            className="h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                          >
                            {STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="min-w-0 lg:col-span-4">
                          <span className="mb-1 block text-[11px] font-medium text-slate-500">Комментарий</span>
                          <Textarea
                            value={draft.comment}
                            onChange={(event) => handleDraftChange(request, "comment", event.target.value)}
                            className="min-h-[92px] bg-white text-sm"
                          />
                        </label>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </TooltipProvider>
        )}
      </section>
    </div>
  );
};

export default AdminRequestsPage;
