import { useQuery } from "@tanstack/react-query";
import { Link, useOutletContext } from "react-router-dom";
import { listAdminNotifications } from "@/lib/api";
import { formatAdminDateTime } from "./admin-format";

interface AdminOutletContext {
  adminToken: string;
}

const AdminNotificationsPage = () => {
  const { adminToken } = useOutletContext<AdminOutletContext>();
  const query = useQuery({
    queryKey: ["admin-notifications", adminToken],
    queryFn: () => listAdminNotifications(adminToken),
    enabled: adminToken.trim().length > 0,
  });

  if (!adminToken.trim()) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">Сохраните admin token, чтобы открыть уведомления.</div>;
  }

  if (query.isLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Загружаю уведомления...</div>;
  }

  if (query.isError) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700">{query.error instanceof Error ? query.error.message : "Не удалось загрузить уведомления"}</div>;
  }

  const notifications = query.data?.notifications ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold text-slate-950">Уведомления</div>
        <div className="mt-1 text-sm text-slate-600">Последние {notifications.length} записей</div>
      </div>
      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">Уведомлений пока нет.</div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div key={notification.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-950">{notification.notification_type}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    lead #{notification.lead_id}
                    {notification.username ? ` • @${notification.username}` : ""}
                    {notification.telegram_id ? ` • ${notification.telegram_id}` : ""}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-medium text-slate-950">{notification.status}</div>
                  <div className="mt-1 text-xs text-slate-500">{formatAdminDateTime(notification.created_at)}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <div>priority: {notification.priority ?? "—"}</div>
                <Link to={`/admin/leads/${notification.lead_id}`} className="underline underline-offset-4">Открыть лид</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminNotificationsPage;
