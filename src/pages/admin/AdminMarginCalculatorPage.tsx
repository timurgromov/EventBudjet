import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type MarginTone = "red" | "yellow" | "green" | "amber";

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
  return { label: "Очень высокая маржа", description: "Запас по прибыльности высокий, можно использовать как сильный сценарий.", tone: "amber" };
};

const toneClasses: Record<MarginTone, { badge: string; panel: string; value: string }> = {
  red: {
    badge: "bg-rose-100 text-rose-700",
    panel: "border-rose-200 bg-rose-50/70",
    value: "text-rose-700",
  },
  yellow: {
    badge: "bg-yellow-100 text-yellow-800",
    panel: "border-yellow-200 bg-yellow-50/70",
    value: "text-yellow-800",
  },
  green: {
    badge: "bg-emerald-100 text-emerald-700",
    panel: "border-emerald-200 bg-emerald-50/70",
    value: "text-emerald-700",
  },
  amber: {
    badge: "bg-amber-100 text-amber-800",
    panel: "border-amber-200 bg-amber-50/70",
    value: "text-amber-800",
  },
};

const fieldGroups: Array<{
  title: string;
  description: string;
  fields: Array<{ key: MarginFieldKey; label: string; step?: string }>;
}> = [
  {
    title: "Доходы",
    description: "Собираем входную выручку по заказу и дополнительным работам.",
    fields: [
      { key: "basePackage", label: "Базовая стоимость пакета «Ведущий + DJ»" },
      { key: "extraEquipment", label: "Стоимость дополнительного оборудования" },
      { key: "extraHours", label: "Количество дополнительных часов", step: "1" },
      { key: "extraHourRate", label: "Стоимость 1 дополнительного часа" },
    ],
  },
  {
    title: "Расходы",
    description: "Фиксируем переменные затраты, которые влияют на маржу заказа.",
    fields: [
      { key: "djPayout", label: "Выплата DJ" },
      { key: "adsCost", label: "Расход на рекламу / привлечение клиента" },
      { key: "otherCosts", label: "Прочие переменные расходы" },
    ],
  },
];

const ScenarioMetricCard = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
    <div className={cn("mt-1.5 text-xl font-semibold text-slate-950", accent)}>{value}</div>
  </div>
);

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
        <div className="grid gap-4 xl:grid-cols-2">
            {fieldGroups.map((group) => (
              <section key={group.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-1">
                  <div className="text-lg font-semibold text-slate-950">{group.title}</div>
                  <div className="text-sm text-slate-600">{group.description}</div>
                </div>

                <div className="mt-4 grid gap-3">
                  {group.fields.map((field) => (
                    <div key={field.key} className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_176px] lg:items-center lg:gap-4">
                      <Label htmlFor={field.key} className="text-xs font-medium leading-snug text-slate-500">
                        {field.label}
                      </Label>
                      <div className="lg:justify-self-end">
                        <Input
                          id={field.key}
                          type="number"
                          min="0"
                          step={field.step ?? "1"}
                          inputMode="decimal"
                          value={values[field.key]}
                          onChange={(event) => handleFieldChange(field.key, event.target.value)}
                          className="h-10 w-full bg-slate-50 text-right text-base lg:w-44"
                          placeholder="0"
                        />
                      </div>
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
              </section>
            ))}
        </div>

        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-lg font-semibold text-slate-950">Сценарий заказа</div>
            <div className="mt-1 text-sm text-slate-600">Сводка по текущему набору значений пересчитывается сразу при изменении полей.</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-4">
              <ScenarioMetricCard label="Выручка" value={formatMoney(calculations.revenue)} />
              <ScenarioMetricCard label="Расходы" value={formatMoney(calculations.totalCosts)} />
              <ScenarioMetricCard
                label="Чистая прибыль"
                value={formatMoney(calculations.profit)}
                accent={calculations.profit < 0 ? "text-rose-700" : "text-slate-950"}
              />
              <ScenarioMetricCard label="Маржа" value={formatMargin(calculations.margin)} accent={tone.value} />
            </div>
          </section>

          <section className={cn("rounded-2xl border p-4 shadow-sm", tone.panel)}>
            <div className="text-sm font-medium text-slate-600">Финансовый результат</div>
            <div className="mt-3 rounded-2xl bg-white/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Маржа</div>
                  <div className={cn("mt-1.5 text-4xl font-semibold tracking-tight", tone.value)}>
                    {formatMargin(calculations.margin)}
                  </div>
                </div>
                <div className={cn("inline-flex rounded-full px-3 py-1 text-sm font-medium", tone.badge)}>
                  {marginStatus.label}
                </div>
              </div>

              <div className="mt-2 text-sm text-slate-700">{marginStatus.description}</div>

              <div className="mt-4 grid gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Чистая прибыль</div>
                  <div className={cn("mt-1.5 text-2xl font-semibold", calculations.profit < 0 ? "text-rose-700" : "text-slate-950")}>
                    {formatMoney(calculations.profit)}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Выручка</div>
                    <div className="mt-1.5 text-lg font-semibold text-slate-950">{formatMoney(calculations.revenue)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Общие расходы</div>
                    <div className="mt-1.5 text-lg font-semibold text-slate-950">{formatMoney(calculations.totalCosts)}</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminMarginCalculatorPage;
