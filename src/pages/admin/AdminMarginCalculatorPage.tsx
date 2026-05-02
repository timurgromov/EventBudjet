import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createClientOrderFromMarginCalculator,
  getClientOrderSummary,
  listClientOrders,
  type MarginCalculatorOrderPayload,
} from "@/lib/api";
import { cn } from "@/lib/utils";

import { formatAdminDate, formatAdminDateTime, formatAdminMoney, formatOrderStatusLabel, formatSourceLabel } from "./admin-format";

type MarginFieldKey =
  | "basePackage"
  | "extraEquipment"
  | "extraHours"
  | "extraHourRate"
  | "djPayout"
  | "adsCost"
  | "otherCosts";

type MarginFormValues = Record<MarginFieldKey, string>;
type MarginTone = "red" | "yellow" | "green" | "teal" | "violet";
type PeriodFilter = "currentYear" | "previousYear" | "custom";
type OrderCreateFieldKey = keyof OrderCreateFormState;

interface AdminOutletContext {
  adminToken: string;
}

interface OrderCreateFormState {
  clientName: string;
  eventTitle: string;
  eventDate: string;
  contractDate: string;
  source: string;
  status: string;
  comment: string;
}

const INITIAL_VALUES: MarginFormValues = {
  basePackage: "",
  extraEquipment: "",
  extraHours: "",
  extraHourRate: "",
  djPayout: "",
  adsCost: "",
  otherCosts: "5000",
};

const ORDER_STATUS_OPTIONS = [
  { value: "signed", label: "Подписан" },
  { value: "in_progress", label: "В работе" },
  { value: "completed", label: "Проведён" },
  { value: "closed", label: "Закрыт" },
  { value: "cancelled", label: "Отменён" },
];

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
const formatDecimalString = (value: string): string => (value.trim() ? value : "0");
const formatSignedMoney = (value: number): string => (value > 0 ? `+${formatMoney(value)}` : value < 0 ? `-${formatMoney(Math.abs(value))}` : formatMoney(0));
const formatSignedMargin = (value: number): string => (value > 0 ? `+${formatMargin(value)}` : value < 0 ? `-${formatMargin(Math.abs(value))}` : formatMargin(0));

const getDefaultOrderForm = (): OrderCreateFormState => {
  const now = new Date();
  const isoDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return {
    clientName: "",
    eventTitle: "",
    eventDate: "",
    contractDate: isoDate,
    source: "",
    status: "signed",
    comment: "",
  };
};

const getProfitStatus = (profit: number): { label: string; description: string; tone: MarginTone } => {
  if (profit < 60000) {
    return {
      label: "Низкая прибыль",
      description: "Заказ ниже минимально комфортного уровня. Брать только осознанно / как исключение.",
      tone: "red",
    };
  }
  if (profit < 75000) {
    return {
      label: "Компромиссная прибыль",
      description: "Экономика допустимая, но слот неидеален.",
      tone: "yellow",
    };
  }
  if (profit < 95000) {
    return {
      label: "Хорошая прибыль",
      description: "Соответствует сильной рабочей модели.",
      tone: "green",
    };
  }
  if (profit < 120000) {
    return {
      label: "Высокая прибыль",
      description: "Сильный коммерческий слот.",
      tone: "teal",
    };
  }
  return {
    label: "Выдающаяся прибыль",
    description: "Топовый слот / премиум-экономика.",
    tone: "violet",
  };
};

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
    return { label: "Высокая маржа", description: "Сценарий даёт сильный запас по прибыльности.", tone: "teal" };
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
  teal: {
    badge: "border border-cyan-200 bg-cyan-50 text-cyan-700",
    panel: "border-cyan-200 bg-cyan-50/70",
    value: "text-cyan-700",
  },
  violet: {
    badge: "border border-violet-300 bg-violet-50 text-violet-700",
    panel: "border-violet-300 bg-violet-50/80",
    value: "text-violet-700",
    effect: "ring-1 ring-violet-200/80 shadow-[0_0_0_1px_rgba(139,92,246,0.08),0_18px_40px_rgba(139,92,246,0.14)]",
  },
};

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

const getDateRange = (periodFilter: PeriodFilter, customDateFrom: string, customDateTo: string): { dateFrom?: string; dateTo?: string } => {
  if (periodFilter === "custom") {
    return {
      dateFrom: customDateFrom || undefined,
      dateTo: customDateTo || undefined,
    };
  }

  const now = new Date();
  const year = periodFilter === "currentYear" ? now.getFullYear() : now.getFullYear() - 1;
  return {
    dateFrom: `${year}-01-01`,
    dateTo: `${year}-12-31`,
  };
};

const parseIsoDate = (value?: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isDateWithinRange = (value: string, dateFrom?: string, dateTo?: string): boolean => {
  const target = parseIsoDate(value);
  if (!target) return false;

  const from = parseIsoDate(dateFrom);
  const to = parseIsoDate(dateTo);

  if (from && target < from) return false;
  if (to && target > to) return false;
  return true;
};

const AdminMarginCalculatorPage = () => {
  const { adminToken } = useOutletContext<AdminOutletContext>();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<MarginFormValues>(INITIAL_VALUES);
  const [orderForm, setOrderForm] = useState<OrderCreateFormState>(getDefaultOrderForm);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("currentYear");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const { dateFrom, dateTo } = useMemo(
    () => getDateRange(periodFilter, customDateFrom, customDateTo),
    [periodFilter, customDateFrom, customDateTo],
  );

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

  const summaryQuery = useQuery({
    queryKey: ["client-order-summary", adminToken, dateFrom, dateTo],
    queryFn: () => getClientOrderSummary(adminToken, { dateFrom, dateTo }),
    enabled: adminToken.trim().length > 0,
  });

  const ordersQuery = useQuery({
    queryKey: ["client-orders", adminToken, dateFrom, dateTo],
    queryFn: () => listClientOrders(adminToken, { dateFrom, dateTo }),
    enabled: adminToken.trim().length > 0,
  });

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const payload: MarginCalculatorOrderPayload = {
        client_name: orderForm.clientName.trim(),
        event_title: orderForm.eventTitle.trim() || null,
        event_date: orderForm.eventDate,
        contract_date: orderForm.contractDate,
        source: orderForm.source.trim() || null,
        status: orderForm.status,
        comment: orderForm.comment.trim() || null,
        base_package: formatDecimalString(values.basePackage),
        extra_equipment: formatDecimalString(values.extraEquipment),
        extra_hours: formatDecimalString(values.extraHours),
        extra_hour_rate: formatDecimalString(values.extraHourRate),
        dj_payout: formatDecimalString(values.djPayout),
        ads_cost: formatDecimalString(values.adsCost),
        other_costs: formatDecimalString(values.otherCosts),
      };
      return createClientOrderFromMarginCalculator(adminToken, payload);
    },
    onSuccess: async (result) => {
      setStatusMessage(`Заказ ${result.order.order_code ?? `#${result.order.id}`} создан.`);
      setOrderForm(getDefaultOrderForm());
      await queryClient.invalidateQueries({ queryKey: ["client-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["client-order-summary"] });
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? `Ошибка создания: ${error.message}` : "Ошибка создания заказа.");
    },
  });

  const handleFieldChange = (key: MarginFieldKey, nextValue: string) => {
    setValues((current) => ({
      ...current,
      [key]: nextValue,
    }));
  };

  const handleOrderFieldChange = (key: keyof OrderCreateFormState, nextValue: string) => {
    setOrderForm((current) => ({
      ...current,
      [key]: nextValue,
    }));
  };

  const handleReset = () => {
    setValues(INITIAL_VALUES);
    setOrderForm(getDefaultOrderForm());
    setStatusMessage(null);
  };

  const profitStatus = getProfitStatus(calculations.profit);
  const marginStatus = getMarginStatus(calculations.margin);
  const profitTone = toneClasses[profitStatus.tone];
  const tone = toneClasses[marginStatus.tone];
  const orders = ordersQuery.data?.orders ?? [];
  const summary = summaryQuery.data;
  const validationErrors = useMemo(() => {
    const nextErrors: Partial<Record<OrderCreateFieldKey | "revenue", string>> = {};

    if (!orderForm.clientName.trim()) nextErrors.clientName = "Добавь имя клиента.";
    if (!orderForm.eventDate) nextErrors.eventDate = "Укажи дату мероприятия.";
    if (!orderForm.contractDate) nextErrors.contractDate = "Укажи дату договора.";
    if (calculations.revenue <= 0) nextErrors.revenue = "Сначала нужен сценарий с выручкой больше нуля.";

    return nextErrors;
  }, [calculations.revenue, orderForm.clientName, orderForm.contractDate, orderForm.eventDate]);
  const canCreateOrder = Object.keys(validationErrors).length === 0;
  const visibleValidationMessages = [
    validationErrors.clientName,
    validationErrors.eventDate,
    validationErrors.contractDate,
    validationErrors.revenue,
  ].filter((value): value is string => Boolean(value));
  const previewSummary = useMemo(() => {
    if (!summary) return null;

    const scenarioFallsIntoPeriod = orderForm.contractDate ? isDateWithinRange(orderForm.contractDate, dateFrom, dateTo) : false;
    const hasScenario = calculations.revenue > 0;

    if (!hasScenario) {
      return {
        state: "empty" as const,
        message: "Чтобы увидеть влияние на период, сначала собери сценарий с выручкой больше нуля.",
      };
    }

    if (!scenarioFallsIntoPeriod) {
      return {
        state: "out_of_range" as const,
        message: "Текущий расчёт не попадёт в выбранный период по дате договора.",
      };
    }

    const currentOrdersCount = summary.orders_count;
    const currentTotalRevenue = parseNumericValue(summary.total_revenue);
    const currentTotalProfit = parseNumericValue(summary.total_profit);
    const currentAverageMargin = parseNumericValue(summary.average_margin);
    const nextOrdersCount = currentOrdersCount + 1;
    const nextTotalRevenue = currentTotalRevenue + calculations.revenue;
    const nextTotalProfit = currentTotalProfit + calculations.profit;
    const nextAverageMargin =
      nextOrdersCount > 0 ? (currentAverageMargin * currentOrdersCount + calculations.margin) / nextOrdersCount : calculations.margin;

    return {
      state: "ready" as const,
      nextOrdersCount,
      nextTotalRevenue,
      nextTotalProfit,
      nextAverageMargin,
      revenueDelta: calculations.revenue,
      profitDelta: calculations.profit,
      marginDelta: nextAverageMargin - currentAverageMargin,
    };
  }, [calculations.margin, calculations.profit, calculations.revenue, dateFrom, dateTo, orderForm.contractDate, summary]);

  if (!adminToken.trim()) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">Сохраните admin token, чтобы открыть модуль маржи.</div>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-950">Margin CRM</div>
            <div className="mt-1 max-w-3xl text-sm text-slate-600">
              Быстрый расчёт маржи, создание реальных заказов и управленческая картина по периоду на одной странице.
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleReset}
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            Сбросить всё
          </Button>
        </div>
      </section>

      {statusMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          {statusMessage}
        </div>
      ) : null}

      <section className={cn("rounded-2xl border p-4 shadow-sm", tone.panel, tone.effect)}>
        <div className="grid gap-4 lg:grid-cols-2">
          {fieldGroups.map((group) => (
            <section key={group.title} className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <div className="text-lg font-semibold text-slate-950">{group.title}</div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {group.fields.map((field) => (
                  <div key={field.key} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                    <div className="text-[11px] font-medium leading-snug text-slate-500">{field.label}</div>
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
            </section>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-950">Данные заказа</div>
            <div className="mt-1 text-sm text-slate-600">Эти поля превратят текущий расчёт в реальный заказ, который начнёт участвовать в годовой картине.</div>
          </div>
          <Button onClick={() => createOrderMutation.mutate()} disabled={!canCreateOrder || createOrderMutation.isPending}>
            {createOrderMutation.isPending ? "Создаю..." : "Создать заказ"}
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <div className="text-[11px] font-medium text-slate-500">Имя клиента</div>
            <Input
              value={orderForm.clientName}
              onChange={(event) => handleOrderFieldChange("clientName", event.target.value)}
              placeholder="Например, Анна и Сергей"
              className="mt-2 bg-white"
            />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <div className="text-[11px] font-medium text-slate-500">Название события</div>
            <Input
              value={orderForm.eventTitle}
              onChange={(event) => handleOrderFieldChange("eventTitle", event.target.value)}
              placeholder="Свадьба в Soho Country Club"
              className="mt-2 bg-white"
            />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <div className="text-[11px] font-medium text-slate-500">Дата мероприятия</div>
            <Input
              type="date"
              value={orderForm.eventDate}
              onChange={(event) => handleOrderFieldChange("eventDate", event.target.value)}
              className="mt-2 bg-white"
            />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <div className="text-[11px] font-medium text-slate-500">Дата договора</div>
            <Input
              type="date"
              value={orderForm.contractDate}
              onChange={(event) => handleOrderFieldChange("contractDate", event.target.value)}
              className="mt-2 bg-white"
            />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <div className="text-[11px] font-medium text-slate-500">Источник заявки</div>
            <Input
              value={orderForm.source}
              onChange={(event) => handleOrderFieldChange("source", event.target.value)}
              placeholder="Например, Telegram Mini App"
              className="mt-2 bg-white"
            />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <div className="text-[11px] font-medium text-slate-500">Статус заказа</div>
            <select
              value={orderForm.status}
              onChange={(event) => handleOrderFieldChange("status", event.target.value)}
              className="mt-2 flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
            >
              {ORDER_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 md:col-span-2">
            <div className="text-[11px] font-medium text-slate-500">Комментарий</div>
            <Textarea
              value={orderForm.comment}
              onChange={(event) => handleOrderFieldChange("comment", event.target.value)}
              placeholder="Например, нужен аккуратный апсейл по оборудованию и аккуратно держим скидку."
              className="mt-2 min-h-[92px] bg-white"
            />
          </div>
        </div>

        {visibleValidationMessages.length > 0 ? (
          <div className="mt-3 text-sm text-rose-700">{visibleValidationMessages[0]}</div>
        ) : (
          <div className="mt-3 text-sm text-slate-500">Если расчёт устраивает, можно сразу зафиксировать его как заказ.</div>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={cn("rounded-2xl border px-4 py-4 shadow-sm", profitTone.panel, profitTone.effect)}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Чистая прибыль по сценарию</div>
              <div className={cn("mt-1.5 text-3xl font-semibold tracking-tight", profitTone.value)}>{formatMoney(calculations.profit)}</div>
            </div>
            <div className={cn("inline-flex rounded-full px-3 py-1 text-sm font-medium", profitTone.badge)}>{profitStatus.label}</div>
          </div>
          <div className="mt-2 text-sm text-slate-700">{profitStatus.description}</div>
        </section>

        <section className={cn("rounded-2xl border px-4 py-4 shadow-sm", tone.panel, tone.effect)}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Маржа по сценарию</div>
              <div className={cn("mt-1.5 text-3xl font-semibold tracking-tight", tone.value)}>{formatMargin(calculations.margin)}</div>
            </div>
            <div className={cn("inline-flex rounded-full px-3 py-1 text-sm font-medium", tone.badge)}>{marginStatus.label}</div>
          </div>
          <div className="mt-2 text-sm text-slate-700">{marginStatus.description}</div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-950">Панель периода</div>
            <div className="mt-1 text-sm text-slate-600">Сводка считается по дате договора и показывает текущую картину по заказам.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => setPeriodFilter("currentYear")}
              className={periodFilter === "currentYear" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}
            >
              Текущий год
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setPeriodFilter("previousYear")}
              className={periodFilter === "previousYear" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}
            >
              Прошлый год
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setPeriodFilter("custom")}
              className={periodFilter === "custom" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}
            >
              Свой период
            </Button>
          </div>
        </div>

        {summary && !summaryQuery.isLoading && !summaryQuery.isError ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Если зафиксировать текущий сценарий</div>
            {previewSummary?.state === "ready" ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <div className="text-[11px] font-medium text-slate-500">Выручка периода</div>
                  <div className="mt-1 font-semibold text-slate-950">{formatMoney(previewSummary.nextTotalRevenue)}</div>
                  <div className="text-xs text-emerald-700">{formatSignedMoney(previewSummary.revenueDelta)}</div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-500">Прибыль периода</div>
                  <div className="mt-1 font-semibold text-slate-950">{formatMoney(previewSummary.nextTotalProfit)}</div>
                  <div className={cn("text-xs", previewSummary.profitDelta >= 0 ? "text-emerald-700" : "text-rose-700")}>
                    {formatSignedMoney(previewSummary.profitDelta)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-500">Средняя маржа</div>
                  <div className="mt-1 font-semibold text-slate-950">{formatMargin(previewSummary.nextAverageMargin)}</div>
                  <div className={cn("text-xs", previewSummary.marginDelta >= 0 ? "text-emerald-700" : "text-rose-700")}>
                    {formatSignedMargin(previewSummary.marginDelta)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-500">Количество заказов</div>
                  <div className="mt-1 font-semibold text-slate-950">{previewSummary.nextOrdersCount}</div>
                  <div className="text-xs text-slate-500">Сейчас: {summary.orders_count}</div>
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-slate-600">{previewSummary?.message ?? "Preview периода появится, когда загрузится сводка."}</div>
            )}
          </div>
        ) : null}

        {periodFilter === "custom" ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
            <Input type="date" value={customDateFrom} onChange={(event) => setCustomDateFrom(event.target.value)} />
            <Input type="date" value={customDateTo} onChange={(event) => setCustomDateTo(event.target.value)} />
          </div>
        ) : null}

        {summaryQuery.isLoading ? (
          <div className="mt-4 text-sm text-slate-600">Собираю сводку...</div>
        ) : summaryQuery.isError ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {summaryQuery.error instanceof Error ? summaryQuery.error.message : "Не удалось загрузить summary"}
          </div>
        ) : summary ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Общая выручка</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{formatAdminMoney(summary.total_revenue)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Общие расходы</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{formatAdminMoney(summary.total_costs)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Общая прибыль</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{formatAdminMoney(summary.total_profit)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Средняя маржа</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{formatMargin(Number(summary.average_margin))}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Количество заказов</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{summary.orders_count}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Средняя прибыль на заказ</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{formatAdminMoney(summary.average_profit_per_order)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Низкомаржинальные</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{summary.low_margin_orders_count}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Период</div>
              <div className="mt-2 text-base font-semibold text-slate-950">
                {formatAdminDate(summary.date_from)} - {formatAdminDate(summary.date_to)}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-950">Список заказов</div>
            <div className="mt-1 text-sm text-slate-600">Все созданные заказы, которые попадают в выбранный период по дате договора.</div>
          </div>
          <div className="text-sm text-slate-500">{orders.length} шт.</div>
        </div>

        {ordersQuery.isLoading ? (
          <div className="mt-4 text-sm text-slate-600">Загружаю заказы...</div>
        ) : ordersQuery.isError ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {ordersQuery.error instanceof Error ? ordersQuery.error.message : "Не удалось загрузить заказы"}
          </div>
        ) : orders.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            Заказов в выбранном периоде пока нет.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                to={`/admin/margin-calculator/orders/${order.id}`}
                className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition-colors hover:border-slate-300 hover:bg-white md:grid-cols-[1.25fr_0.85fr_0.85fr_0.9fr_0.8fr]"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-950">{order.client_name}</div>
                  <div className="mt-1 text-xs text-slate-500">{order.order_code ?? `order #${order.id}`}</div>
                  <div className="mt-1 text-xs text-slate-500">{order.event_title || "Без названия события"}</div>
                  <div className="mt-2 text-xs text-slate-500">Источник: {formatSourceLabel(order.source)}</div>
                </div>
                <div className="text-sm text-slate-700">
                  <div>Договор: {formatAdminDate(order.contract_date)}</div>
                  <div className="mt-1 text-xs text-slate-500">Мероприятие: {formatAdminDate(order.event_date)}</div>
                </div>
                <div className="text-sm text-slate-700">
                  <div className="font-medium text-slate-950">{formatAdminMoney(order.revenue)}</div>
                  <div className="mt-1 text-xs text-slate-500">Выручка</div>
                </div>
                <div className="text-sm text-slate-700">
                  <div className="font-medium text-slate-950">{formatAdminMoney(order.profit)}</div>
                  <div className="mt-1 text-xs text-slate-500">Прибыль • {formatMargin(Number(order.margin))}</div>
                </div>
                <div className="text-sm text-slate-700">
                  <div>{formatOrderStatusLabel(order.status)}</div>
                  <div className="mt-1 text-xs text-slate-500">{formatAdminDateTime(order.updated_at)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminMarginCalculatorPage;
