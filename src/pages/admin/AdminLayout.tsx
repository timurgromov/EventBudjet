import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NavLink } from "@/components/NavLink";
import { toast } from "@/components/ui/sonner";
import { listAdminLeads } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";

const ADMIN_TOKEN_KEY = "eventbudjet_admin_token";

export const getStoredAdminToken = (): string => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
};

const formatToastLeadLabel = (name: string | null, username: string | null, leadId: number): string => {
  if (name) return name;
  if (username) return `@${username}`;
  return `lead #${leadId}`;
};

const AdminLayout = () => {
  const [draftToken, setDraftToken] = useState(getStoredAdminToken());
  const [savedToken, setSavedToken] = useState(getStoredAdminToken());
  const navigate = useNavigate();
  const notifiedEventIdsRef = useRef<Set<number>>(new Set());
  const initialUnreadHydratedRef = useRef(false);

  const hasToken = useMemo(() => savedToken.trim().length > 0, [savedToken]);
  const leadsQuery = useQuery({
    queryKey: ["admin-leads", savedToken],
    queryFn: () => listAdminLeads(savedToken),
    enabled: hasToken,
    refetchInterval: hasToken ? 5000 : false,
    refetchOnWindowFocus: true,
  });

  const leads = hasToken ? (leadsQuery.data?.leads ?? []) : [];
  const unreadMessagesCount = useMemo(
    () => leads.reduce((sum, lead) => sum + Math.max(lead.unread_messages_count ?? 0, 0), 0),
    [leads],
  );
  const unreadLeadCount = useMemo(
    () => leads.filter((lead) => (lead.unread_messages_count ?? 0) > 0).length,
    [leads],
  );

  useEffect(() => {
    if (!hasToken) {
      notifiedEventIdsRef.current.clear();
      initialUnreadHydratedRef.current = false;
      return;
    }

    const unreadLeads = [...leads]
      .filter((lead) => (lead.unread_messages_count ?? 0) > 0 && typeof lead.latest_user_message_event_id === "number")
      .sort((a, b) => {
        const aTs = a.latest_user_message_at ? Date.parse(a.latest_user_message_at) : 0;
        const bTs = b.latest_user_message_at ? Date.parse(b.latest_user_message_at) : 0;
        if (aTs !== bTs) return bTs - aTs;
        return (b.latest_user_message_event_id ?? 0) - (a.latest_user_message_event_id ?? 0);
      });

    if (!initialUnreadHydratedRef.current) {
      unreadLeads.forEach((lead) => {
        if (typeof lead.latest_user_message_event_id === "number") {
          notifiedEventIdsRef.current.add(lead.latest_user_message_event_id);
        }
      });
      initialUnreadHydratedRef.current = true;
      return;
    }

    unreadLeads.forEach((lead) => {
      const eventId = lead.latest_user_message_event_id;
      if (typeof eventId !== "number" || notifiedEventIdsRef.current.has(eventId)) {
        return;
      }
      notifiedEventIdsRef.current.add(eventId);
      toast("Новое сообщение в Telegram", {
        description: `${formatToastLeadLabel(lead.name, lead.username, lead.lead_id)}: ${lead.latest_user_message_text ?? "Сообщение без текста"}`,
        action: {
          label: "Открыть чат",
          onClick: () => navigate(`/admin/wedding-calculator/leads/${lead.lead_id}`),
        },
        duration: 12000,
      });
    });
  }, [hasToken, leads, navigate]);

  const handleSave = () => {
    const normalized = draftToken.trim();
    window.localStorage.setItem(ADMIN_TOKEN_KEY, normalized);
    setSavedToken(normalized);
  };

  const handleReset = () => {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    setDraftToken("");
    setSavedToken("");
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Admin</div>
              <h1 className="mt-1 text-3xl font-serif text-slate-950">CRM-система</h1>
              <p className="mt-1 text-sm text-slate-600">
                Внутренняя панель для свадебного калькулятора и калькулятора маржи.
              </p>
            </div>
            <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-xs font-medium text-slate-500">Admin token</div>
              <div className="flex flex-col gap-2 md:flex-row">
                <Input
                  type="password"
                  value={draftToken}
                  onChange={(e) => setDraftToken(e.target.value)}
                  placeholder="Вставьте X-Admin-Token"
                  className="bg-white"
                />
                <Button onClick={handleSave} className="md:min-w-28">Сохранить</Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="md:min-w-28 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                >
                  Сбросить
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm h-fit">
            <div className="mb-3 px-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Разделы</div>
            <nav className="space-y-1">
              <NavLink
                to="/admin/wedding-calculator"
                className="block rounded-xl px-3 py-2 text-sm text-slate-600 transition-colors"
                activeClassName="bg-slate-950 text-white"
              >
                <span className="flex items-center justify-between gap-3">
                  <span>Свадебный калькулятор</span>
                  {unreadMessagesCount > 0 ? (
                    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                      {unreadMessagesCount}
                    </span>
                  ) : null}
                </span>
              </NavLink>
              <NavLink
                to="/admin/margin-calculator"
                className="block rounded-xl px-3 py-2 text-sm text-slate-600 transition-colors"
                activeClassName="bg-slate-950 text-white"
              >
                Калькулятор маржи
              </NavLink>
            </nav>
            <div className={cn("mt-4 rounded-xl px-3 py-2 text-xs", hasToken ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
              {hasToken
                ? unreadLeadCount > 0
                  ? `Есть непрочитанные сообщения: ${unreadMessagesCount} в ${unreadLeadCount} лидах.`
                  : "Токен сохранён локально в браузере."
                : "Сначала сохраните admin token."}
            </div>
          </aside>

          <main className="min-w-0">
            <Outlet context={{ adminToken: savedToken, unreadMessagesCount, unreadLeadCount }} />
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
