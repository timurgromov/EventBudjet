import { NavLink } from "@/components/NavLink";
import { Outlet, useOutletContext } from "react-router-dom";

interface AdminOutletContext {
  adminToken: string;
  unreadMessagesCount: number;
}

const AdminWeddingCalculatorLayout = () => {
  const context = useOutletContext<AdminOutletContext>();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <NavLink
            to="/admin/wedding-calculator/leads"
            className="rounded-xl px-4 py-2 text-sm text-slate-600 transition-colors"
            activeClassName="bg-slate-950 text-white"
          >
            <span className="flex items-center gap-2">
              <span>Лиды</span>
              {context.unreadMessagesCount > 0 ? (
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                  {context.unreadMessagesCount}
                </span>
              ) : null}
            </span>
          </NavLink>
          <NavLink
            to="/admin/wedding-calculator/notifications"
            end
            className="rounded-xl px-4 py-2 text-sm text-slate-600 transition-colors"
            activeClassName="bg-slate-950 text-white"
          >
            Уведомления
          </NavLink>
          <NavLink
            to="/admin/wedding-calculator/sources"
            end
            className="rounded-xl px-4 py-2 text-sm text-slate-600 transition-colors"
            activeClassName="bg-slate-950 text-white"
          >
            Источники
          </NavLink>
        </div>
      </div>

      <Outlet context={context} />
    </div>
  );
};

export default AdminWeddingCalculatorLayout;
