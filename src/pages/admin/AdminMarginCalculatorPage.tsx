import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type MarginFieldKey =
  | "basePackage"
  | "extraEquipment"
  | "extraHours"
  | "extraHourRate"
  | "djPayout"
  | "adsCost"
  | "otherCosts";

type MarginFormValues = Record<MarginFieldKey, string>;

type MarginTone = "red" | "yellow" | "green" | "amber" | "violet";

const INITIAL_VALUES: MarginFormValues = {
  basePackage: "",
  extraEquipment: "",
  extraHours: "",
  extraHourRate: "",
  djPayout: "",
  adsCost: "",
  otherCosts: "",
};

const MONEY_FORMATTER = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const MARGIN_FORMATTER = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const parseNumericValue = (value: string): number => {
  if (!value.trim()) return 0;
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const formatMoney = (value: number): string => MONEY_FORMATTER.format(value);

const formatMargin = (value: number): string => `${MARGIN_FORMATTER.format(value)}%`;

const getMarginStatus = (margin: number): { label: string; description: string; tone: MarginTone } => {
  if (margin < 35) {
    return { label: "Низкая маржа", description: "Ниже целевого диапазона, сценарий требует пересмотра.", tone: "red" };
  }
  if (margin < 45) {
    return { label: "Компромиссная маржа", description: "На границе нормы, стоит проверить цену и расходы.", tone: "yellow" };
  }
  if (margin <= 60) {
    return { label: "Хорошая маржа", description: "Сценарий выглядит здоровым по текущей модели.", tone: "green" };
  }
  if (margin <= 75) {
    return { label: "Высокая маржа", description: "Сценарий даёт сильный запас по прибыльности.", tone: "amber" };
  }
  return { label: "Выдающаяся маржа", description: "Премиальный уровень рентабельности, сценарий выглядит максимально сильным.", tone: "violet" };
};

const toneClasses: Record<MarginTone, { badge: string; panel: string; value: string; effect?: string }> = {
  red: {
    badge: "border border-red-200 bg-red-50 text-red-600",
    panel: "border-red-200 bg-red-50/70",
    value: "text-red-600",
  },
  yellow: {
    badge: "border border-yellow-200 bg-yellow-50 text-yellow-700",
    panel: "border-yellow-200 bg-yellow-50/70",
    value: "text-yellow-700",
  },
  green: {
    badge: "border border-green-200 bg-green-50 text-green-600",
    panel: "border-green-200 bg-green-50/70",
    value: "text-green-600",
  },
  amber: {
    badge: "border border-amber-200 bg-amber-50 text-amber-700",
    panel: "border-amber-200 bg-amber-50/70",
    value: "text-amber-700",
  },
  violet: {
    badge: "border border-violet-300 bg-violet-50 text-violet-700",
    panel: "border-violet-300 bg-violet-50/80",
    value: "text-violet-700",
    effect:
      "ring-1 ring-violet-200/80 shadow-[0_0_0_1px_rgba(139,92,246,0.08),0_18px_40px_rgba(139,92,246,0.14)]",
  },
} as const;

const fieldGroups: Array<{
  title: string;
  fields: Array<{ key: MarginFieldKey; label: string; step?: string }>;
}> = [
  {
    title: "Доходы",
    fields: [
      { key: "basePackage", label: "Ведущий + DJ" },
      { key: "extraEquipment", label: "Оборудование" },
      { key: "extraHours", label: "Доп. часы", step: "1" },
      { key: "extraHourRate", label: "Стоимость часа" },
    ],
  },
  {
    title: "Расходы",
    fields: [
      { key: "djPayout", label: "Выплата DJ" },
      { key: "adsCost", label: "Реклама" },
      { key: "otherCosts", label: "Прочие расходы" },
    ],
  },
];

const AdminMarginCalculatorPage = () => {
  const [values, setValues] = useState<MarginFormValues>(INITIAL_VALUES);

  const handleFieldChange = (key: MarginFieldKey, nextValue: string) => {
    setValues((current) => ({
      ...current,
      [key]: nextValue,
    }));
  };

  const handleReset = () => {
    setValues(INITIAL_VALUES);
  };

  const calculations = useMemo(() => {
    const basePackage = parseNumericValue(values.basePackage);
    const extraEquipment = parseNumericValue(values.extraEquipment);
    const extraHours = parseNumericValue(values.extraHours);
    const extraHourRate = parseNumericValue(values.extraHourRate);
    const djPayout = parseNumericValue(values.djPayout);
    const adsCost = parseNumericValue(values.adsCost);
    const otherCosts = parseNumericValue(values.otherCosts);

    const revenue = basePackage + extraEquipment + extraHours * extraHourRate;
    const totalCosts = djPayout + adsCost + otherCosts;
    const profit = revenue - totalCosts;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    return {
      revenue,
      totalCosts,
      profit,
      margin,
    };
  }, [values]);

  const marginStatus = getMarginStatus(calculations.margin);
  const tone = toneClasses[marginStatus.tone];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-950">Калькулятор маржи</div>
            <div className="mt-1 max-w-3xl text-sm text-slate-600">
              Быстрый расчёт выручки, переменных расходов, чистой прибыли и маржи по сценарию заказа.
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleReset}
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            Сбросить
          </Button>
        </div>
      </section>

      <div className="space-y-4">
        <section className={cn("rounded-2xl border p-4 shadow-sm", tone.panel, tone.effect)}>
          <div className="grid gap-4 lg:grid-cols-2">
          {fieldGroups.map((group) => (
            <section key={group.title} className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <div className="text-lg font-semibold text-slate-950">{group.title}</div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {group.fields.map((field) => (
                  <div
                    key={field.key}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5"
                  >
                    <div className="text-[11px] font-medium leading-snug text-slate-500">
                      {field.label}
                    </div>
                    <Input
                      id={field.key}
                      type="number"
                      min="0"
                      step={field.step ?? "1"}
                      inputMode="decimal"
                      value={values[field.key]}
                      onChange={(event) => handleFieldChange(field.key, event.target.value)}
                      className="mt-2 h-10 w-full max-w-[180px] bg-white text-right text-base"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {group.title === "Доходы" ? "Выручка" : "Общие расходы"}
                </div>
                <div className="mt-1.5 text-2xl font-semibold text-slate-950">
                  {group.title === "Доходы" ? formatMoney(calculations.revenue) : formatMoney(calculations.totalCosts)}
                </div>
              </div>

              {group.title === "Доходы" ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Чистая прибыль</div>
                  <div className={cn("mt-1.5 text-2xl font-semibold", calculations.profit < 0 ? "text-rose-700" : "text-slate-950")}>
                    {formatMoney(calculations.profit)}
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Маржа</div>
                      <div className={cn("mt-1.5 text-3xl font-semibold tracking-tight", tone.value)}>
                        {formatMargin(calculations.margin)}
                      </div>
                    </div>
                    <div className={cn("inline-flex rounded-full px-3 py-1 text-sm font-medium", tone.badge)}>
                      {marginStatus.label}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-700">{marginStatus.description}</div>
                </div>
              )}
            </section>
          ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminMarginCalculatorPage;
