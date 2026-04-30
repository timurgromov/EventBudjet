import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { Outlet } from "react-router-dom";
import { useMemo, useState } from "react";

const ADMIN_TOKEN_KEY = "eventbudjet_admin_token";

export const getStoredAdminToken = (): string => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
};

const AdminLayout = () => {
  const [draftToken, setDraftToken] = useState(getStoredAdminToken());
  const [savedToken, setSavedToken] = useState(getStoredAdminToken());

  const hasToken = useMemo(() => savedToken.trim().length > 0, [savedToken]);

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
                Свадебный калькулятор
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
              {hasToken ? "Токен сохранён локально в браузере." : "Сначала сохраните admin token."}
            </div>
          </aside>

          <main className="min-w-0">
            <Outlet context={{ adminToken: savedToken }} />
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
