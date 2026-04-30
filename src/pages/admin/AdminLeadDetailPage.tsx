import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { deleteAdminLead, getAdminLead, markAdminLeadChatRead, resetAdminLead, sendAdminMessageToLead } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  const messageText = asString(p.text);

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
  if (eventType === "user_message") {
    return `Сообщение клиента${messageText ? `: ${messageText}` : ""}`;
  }
  if (eventType === "admin_message_sent") {
    return `Исходящее сообщение${messageText ? `: ${messageText}` : ""}`;
  }
  if (eventType === "bot_message_sent") {
    return `Сообщение бота${messageText ? `: ${messageText}` : ""}`;
  }
  if (eventType === "bot_blocked") {
    return "Пользователь заблокировал бота";
  }
  if (eventType === "bot_unblocked") {
    return "Пользователь снова разрешил бота";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const leadId = Number(params.leadId);
  const lastMarkedMessageEventIdRef = useRef<number | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [directMessageText, setDirectMessageText] = useState("");
  const [directMessageStatus, setDirectMessageStatus] = useState<string | null>(null);
  const [dangerStatus, setDangerStatus] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-lead-detail", adminToken, leadId],
    queryFn: () => getAdminLead(adminToken, leadId),
    enabled: adminToken.trim().length > 0 && Number.isFinite(leadId),
    refetchInterval: adminToken.trim().length > 0 && Number.isFinite(leadId) ? 5000 : false,
    refetchOnWindowFocus: true,
  });

  const directMessageMutation = useMutation({
    mutationFn: async (text: string) => sendAdminMessageToLead(adminToken, leadId, text),
    onSuccess: async (result) => {
      if (result.status === "sent") {
        setDirectMessageStatus("Сообщение отправлено пользователю в Telegram.");
        setDirectMessageText("");
      } else {
        setDirectMessageStatus("Отправка не удалась. Проверь, запускал ли пользователь бота.");
      }
      await query.refetch();
    },
    onError: (error) => {
      setDirectMessageStatus(error instanceof Error ? `Ошибка: ${error.message}` : "Ошибка отправки сообщения.");
    },
  });

  const resetLeadMutation = useMutation({
    mutationFn: async () => resetAdminLead(adminToken, leadId),
    onSuccess: async () => {
      setDangerStatus("Данные лида сброшены. Пользователь пройдёт путь заново.");
      await query.refetch();
    },
    onError: (error) => {
      setDangerStatus(error instanceof Error ? `Ошибка сброса: ${error.message}` : "Ошибка сброса.");
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async () => deleteAdminLead(adminToken, leadId),
    onSuccess: () => {
      navigate("/admin/wedding-calculator/leads");
    },
    onError: (error) => {
      setDangerStatus(error instanceof Error ? `Ошибка удаления: ${error.message}` : "Ошибка удаления.");
    },
  });

  const markChatReadMutation = useMutation({
    mutationFn: async () => markAdminLeadChatRead(adminToken, leadId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-leads", adminToken] });
      await query.refetch();
    },
  });

  const recentEvents = query.data?.recent_events ?? [];
  const conversationEvents = useMemo(
    () =>
      [...recentEvents]
        .reverse()
        .filter((event) =>
          ["user_message", "admin_message_sent", "bot_message_sent", "bot_started", "bot_blocked", "bot_unblocked", "miniapp_opened", "app_resumed"].includes(event.event_type),
        ),
    [recentEvents],
  );
  const stageEvents = useMemo(() => {
    const findLatest = (eventType: string): string | null => {
      const match = recentEvents.find((event) => event.event_type === eventType);
      return match?.created_at ?? null;
    };
    return {
      botStartedAt: findLatest("bot_started"),
      miniAppOpenedAt: findLatest("miniapp_opened"),
      budgetCalculatedAt: findLatest("budget_calculated"),
    };
  }, [recentEvents]);

  useEffect(() => {
    lastMarkedMessageEventIdRef.current = null;
  }, [leadId]);

  useEffect(() => {
    if (!query.data || !adminToken.trim() || markChatReadMutation.isPending) {
      return;
    }
    const latestMessageEventId = query.data.latest_user_message_event_id ?? null;
    if ((query.data.unread_messages_count ?? 0) < 1 || latestMessageEventId === null) {
      return;
    }
    if (lastMarkedMessageEventIdRef.current === latestMessageEventId) {
      return;
    }
    lastMarkedMessageEventIdRef.current = latestMessageEventId;
    markChatReadMutation.mutate();
  }, [adminToken, markChatReadMutation, query.data]);

  if (!adminToken.trim()) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">Сохраните admin token, чтобы открыть карточку лида.</div>;
  }

  if (query.isLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Загружаю карточку лида...</div>;
  }

  if (query.isError || !query.data) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700">{query.error instanceof Error ? query.error.message : "Не удалось загрузить карточку лида"}</div>;
  }

  const { lead, user, expenses } = query.data;

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(`${label} скопирован`);
    } catch {
      setCopyStatus("Не удалось скопировать");
    }
    setTimeout(() => setCopyStatus(null), 1800);
  };

  const handleDirectMessageSend = () => {
    const normalized = directMessageText.trim();
    if (!normalized) return;
    setDirectMessageStatus(null);
    directMessageMutation.mutate(normalized);
  };

  const handleResetLead = () => {
    if (!window.confirm("Сбросить профиль и смету этого лида?")) {
      return;
    }
    setDangerStatus(null);
    resetLeadMutation.mutate();
  };

  const handleDeleteLead = () => {
    const confirmation = window.prompt('Для удаления введите DELETE');
    if (confirmation !== "DELETE") {
      return;
    }
    setDangerStatus(null);
    deleteLeadMutation.mutate();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <Link to="/admin/wedding-calculator/leads" className="text-sm text-slate-500 underline underline-offset-4">Назад к лидам</Link>
            <h2 className="mt-2 text-2xl font-serif text-slate-950">{formatLeadName([user.first_name, user.last_name].filter(Boolean).join(" ") || null, user.username)}</h2>
            <div className="mt-1 text-sm text-slate-600">lead #{lead.id} • telegram_id {user.telegram_id}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {user.username ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  onClick={() => handleCopy(`@${user.username}`, "Username")}
                >
                  Копировать @username
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                onClick={() => handleCopy(String(user.telegram_id), "Telegram ID")}
              >
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
          <div><span className="text-slate-500">Источник:</span> {query.data.source_label ?? formatSourceLabel(lead.source)}</div>
          <div><span className="text-slate-500">Формат даты:</span> {formatDateModeLabel(lead.wedding_date_mode)}</div>
          <div><span className="text-slate-500">Последняя активность:</span> {formatAdminDateTime(user.last_seen_at)}</div>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-sm font-medium text-slate-900">Этапы пользователя</div>
          <div className="mt-2 grid gap-2 text-xs text-slate-700 md:grid-cols-3">
            <div>Start в боте: <span className="text-slate-900">{formatAdminDateTime(stageEvents.botStartedAt)}</span></div>
            <div>Открыл Mini App: <span className="text-slate-900">{formatAdminDateTime(stageEvents.miniAppOpenedAt)}</span></div>
            <div>Сделал расчёт: <span className="text-slate-900">{formatAdminDateTime(stageEvents.budgetCalculatedAt)}</span></div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-semibold text-slate-950">Диалог с клиентом</div>
            {query.data.unread_messages_count > 0 ? (
              <div className="rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-semibold text-white">
                {query.data.unread_messages_count} новых
              </div>
            ) : null}
          </div>
          <div className="text-sm text-slate-500">Сообщения клиента, ваши ответы и ключевые точки входа.</div>
        </div>

        <div className="max-h-[58vh] overflow-y-auto space-y-3 bg-slate-50/70 px-4 py-4">
          {conversationEvents.length === 0 ? (
            <div className="text-sm text-slate-600">Пока нет событий переписки.</div>
          ) : (
            conversationEvents.map((event) => {
              const isOutgoing = event.event_type === "admin_message_sent";
              const isIncoming = event.event_type === "user_message";
              const isBotMessage = event.event_type === "bot_message_sent";
              const text = asString(event.event_payload?.text);

              return (
                <div key={event.id} className={isOutgoing ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={isOutgoing || isBotMessage
                      ? "max-w-[88%] rounded-2xl rounded-br-md bg-[#E6BF3A] px-3 py-2 text-sm text-black"
                      : isIncoming
                        ? "max-w-[88%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                        : "max-w-[92%] rounded-xl bg-slate-200 px-3 py-2 text-xs text-slate-700"}
                  >
                    <div className="whitespace-pre-wrap break-words">
                      {isIncoming || isOutgoing || isBotMessage
                        ? (text || "Сообщение без текста")
                        : formatEventSummary(event.event_type, event.event_payload)}
                    </div>
                    <div className={isOutgoing || isBotMessage ? "mt-1 text-[11px] text-black/70" : "mt-1 text-[11px] text-slate-500"}>
                      {formatAdminDateTime(event.created_at)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-slate-200 bg-white p-4 space-y-3">
          <Textarea
            value={directMessageText}
            onChange={(e) => setDirectMessageText(e.target.value)}
            placeholder="Напишите сообщение клиенту..."
            className="min-h-[96px] bg-white"
          />
          <div className="flex items-center gap-3">
            <Button
              onClick={handleDirectMessageSend}
              disabled={!directMessageText.trim() || directMessageMutation.isPending}
            >
              {directMessageMutation.isPending ? "Отправляю..." : "Отправить сообщение"}
            </Button>
            {directMessageStatus ? <div className="text-sm text-slate-600">{directMessageStatus}</div> : null}
          </div>
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

      <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
        <div className="mb-2 text-lg font-semibold text-slate-950">Управление лидом</div>
        <div className="text-sm text-slate-600">
          Сброс полезен для ретеста. Удаление окончательно уберёт лид из админки.
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            onClick={handleResetLead}
            disabled={resetLeadMutation.isPending || deleteLeadMutation.isPending}
            className="bg-[#E6BF3A] text-black hover:bg-[#d4af34]"
          >
            {resetLeadMutation.isPending ? "Сбрасываю..." : "Сбросить данные"}
          </Button>
          <Button
            onClick={handleDeleteLead}
            disabled={resetLeadMutation.isPending || deleteLeadMutation.isPending}
            variant="destructive"
          >
            {deleteLeadMutation.isPending ? "Удаляю..." : "Удалить лид"}
          </Button>
          {dangerStatus ? <div className="text-sm text-slate-700">{dangerStatus}</div> : null}
        </div>
      </section>
    </div>
  );
};

export default AdminLeadDetailPage;
