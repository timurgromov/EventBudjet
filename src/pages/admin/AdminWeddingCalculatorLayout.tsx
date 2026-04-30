import { NavLink } from "@/components/NavLink";
import { Outlet, useOutletContext } from "react-router-dom";

interface AdminOutletContext {
  adminToken: string;
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
            Лиды
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
