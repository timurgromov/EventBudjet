import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { showAdminSuccessToast } from "@/lib/admin-toast";
import {
  createClientOrderFromMarginCalculator,
  getClientOrderSummary,
  listClientOrders,
  type ClientOrder,
  type MarginCalculatorOrderPayload,
} from "@/lib/api";
import { cn } from "@/lib/utils";

import { formatAdminDate, formatAdminDateTime, formatAdminMoney, formatOrderStatusLabel, formatSourceLabel } from "./admin-format";

type MarginFieldKey =
  | "basePackage"
  | "extraEquipment"
  | "extraHours"
  | "extraHourRate"
  | "upsell"
  | "djPayout"
  | "adsCost"
  | "otherCosts";

type MarginFormValues = Record<MarginFieldKey, string>;
type MarginTone = "red" | "yellow" | "green" | "teal" | "violet";
type PeriodFilter = "currentYear" | "previousYear" | "custom";
type OrderCreateFieldKey = keyof OrderCreateFormState;
type EventTimingTone = "future" | "soon" | "past" | "unknown";

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
  upsell: "",
  djPayout: "",
  adsCost: "",
  otherCosts: "0",
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
const formatSignedCount = (value: number): string => (value > 0 ? `+${value}` : String(value));
const DAY_MS = 24 * 60 * 60 * 1000;

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

const getEventTiming = (eventDate?: string | null): { label: string; description: string; tone: EventTimingTone } => {
  const parsed = parseDateOnly(eventDate);
  if (!parsed) return { label: "Без даты", description: "Дата мероприятия не указана", tone: "unknown" };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffDays = Math.round((eventDay.getTime() - today.getTime()) / DAY_MS);

  if (diffDays < 0) {
    const daysAgo = Math.abs(diffDays);
    return { label: "Прошло", description: `было ${daysAgo} ${pluralDays(daysAgo)} назад`, tone: "past" };
  }
  if (diffDays === 0) return { label: "Сегодня", description: "мероприятие сегодня", tone: "soon" };
  if (diffDays <= 14) return { label: "Скоро", description: `через ${diffDays} ${pluralDays(diffDays)}`, tone: "soon" };
  return { label: "Впереди", description: `через ${diffDays} ${pluralDays(diffDays)}`, tone: "future" };
};

const sortOrdersByEventDate = (orders: ClientOrder[]): ClientOrder[] => {
  const now = new Date();
  const todayTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  return [...orders].sort((left, right) => {
    const leftEventTime = parseDateOnly(left.event_date)?.getTime();
    const rightEventTime = parseDateOnly(right.event_date)?.getTime();

    const leftGroup = leftEventTime == null ? 2 : leftEventTime >= todayTime ? 0 : 1;
    const rightGroup = rightEventTime == null ? 2 : rightEventTime >= todayTime ? 0 : 1;
    if (leftGroup !== rightGroup) return leftGroup - rightGroup;

    if (leftEventTime != null && rightEventTime != null && leftEventTime !== rightEventTime) {
      return leftGroup === 1 ? rightEventTime - leftEventTime : leftEventTime - rightEventTime;
    }

    const leftContractTime = parseDateOnly(left.contract_date)?.getTime() ?? 0;
    const rightContractTime = parseDateOnly(right.contract_date)?.getTime() ?? 0;
    if (leftContractTime !== rightContractTime) return rightContractTime - leftContractTime;

    const leftUpdatedTime = Date.parse(left.updated_at);
    const rightUpdatedTime = Date.parse(right.updated_at);
    if (Number.isFinite(leftUpdatedTime) && Number.isFinite(rightUpdatedTime) && leftUpdatedTime !== rightUpdatedTime) {
      return rightUpdatedTime - leftUpdatedTime;
    }

    return right.id - left.id;
  });
};

const eventTimingClasses: Record<EventTimingTone, { card: string; stripe: string; badge: string; text: string }> = {
  future: {
    card: "border-emerald-200 bg-emerald-50/45 hover:border-emerald-300 hover:bg-emerald-50/65",
    stripe: "bg-emerald-400",
    badge: "border-emerald-200 bg-emerald-100 text-emerald-700",
    text: "text-emerald-700",
  },
  soon: {
    card: "border-amber-200 bg-amber-50/70 hover:border-amber-300 hover:bg-amber-50",
    stripe: "bg-amber-400",
    badge: "border-amber-200 bg-amber-100 text-amber-800",
    text: "text-amber-700",
  },
  past: {
    card: "border-slate-200 bg-slate-50/70 opacity-80 hover:border-slate-300 hover:bg-white hover:opacity-100",
    stripe: "bg-slate-300",
    badge: "border-slate-200 bg-slate-100 text-slate-600",
    text: "text-slate-500",
  },
  unknown: {
    card: "border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-white",
    stripe: "bg-slate-300",
    badge: "border-slate-200 bg-white text-slate-500",
    text: "text-slate-500",
  },
};

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
      { key: "upsell", label: "Апсейл" },
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
    const upsell = parseNumericValue(values.upsell);
    const djPayout = parseNumericValue(values.djPayout);
    const adsCost = parseNumericValue(values.adsCost);
    const otherCosts = parseNumericValue(values.otherCosts);

    const revenue = basePackage + extraEquipment + extraHours * extraHourRate + upsell;
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
        upsell: formatDecimalString(values.upsell),
        dj_payout: formatDecimalString(values.djPayout),
        ads_cost: formatDecimalString(values.adsCost),
        other_costs: formatDecimalString(values.otherCosts),
      };
      return createClientOrderFromMarginCalculator(adminToken, payload);
    },
    onSuccess: async (result) => {
      const orderCode = result.order.order_code ?? `#${result.order.id}`;
      setStatusMessage(`Заказ ${orderCode} создан.`);
      showAdminSuccessToast({
        title: "Заказ добавлен",
        description: `${orderCode} сохранён и участвует в годовой картине.`,
      });
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

  const profitStatus = getProfitStatus(calculations.profit);
  const marginStatus = getMarginStatus(calculations.margin);
  const profitTone = toneClasses[profitStatus.tone];
  const tone = toneClasses[marginStatus.tone];
  const orders = ordersQuery.data?.orders ?? [];
  const sortedOrders = useMemo(() => sortOrdersByEventDate(orders), [orders]);
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
    const currentTotalCosts = parseNumericValue(summary.total_costs);
    const currentTotalProfit = parseNumericValue(summary.total_profit);
    const currentAverageMargin = parseNumericValue(summary.average_margin);
    const currentAverageProfitPerOrder = parseNumericValue(summary.average_profit_per_order);
    const currentLowMarginOrdersCount = summary.low_margin_orders_count;
    const nextOrdersCount = currentOrdersCount + 1;
    const nextTotalRevenue = currentTotalRevenue + calculations.revenue;
    const nextTotalCosts = currentTotalCosts + calculations.totalCosts;
    const nextTotalProfit = currentTotalProfit + calculations.profit;
    const nextAverageMargin =
      nextOrdersCount > 0 ? (currentAverageMargin * currentOrdersCount + calculations.margin) / nextOrdersCount : calculations.margin;
    const nextAverageProfitPerOrder = nextOrdersCount > 0 ? nextTotalProfit / nextOrdersCount : calculations.profit;
    const nextLowMarginOrdersCount =
      currentLowMarginOrdersCount + (calculations.revenue > 0 && calculations.margin < 35 ? 1 : 0);

    return {
      state: "ready" as const,
      nextOrdersCount,
      nextTotalRevenue,
      nextTotalCosts,
      nextTotalProfit,
      nextAverageMargin,
      nextAverageProfitPerOrder,
      nextLowMarginOrdersCount,
      revenueDelta: calculations.revenue,
      costsDelta: calculations.totalCosts,
      profitDelta: calculations.profit,
      marginDelta: nextAverageMargin - currentAverageMargin,
      averageProfitDelta: nextAverageProfitPerOrder - currentAverageProfitPerOrder,
      lowMarginOrdersDelta: nextLowMarginOrdersCount - currentLowMarginOrdersCount,
    };
  }, [calculations.margin, calculations.profit, calculations.revenue, calculations.totalCosts, dateFrom, dateTo, orderForm.contractDate, summary]);

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
        </div>
      </section>

      {statusMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          {statusMessage}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-2">
          {fieldGroups.map((group) => (
            <section key={group.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-lg font-semibold text-slate-950">{group.title}</div>

              <div className={cn("mt-4 grid gap-3", group.title === "Доходы" ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
                {group.fields.map((field) => (
                  <div
                    key={field.key}
                    className={cn(
                      "rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5",
                      group.title === "Доходы" && (field.key === "extraHours" || field.key === "extraHourRate") ? "sm:col-span-1" : "",
                    )}
                  >
                    <div className="text-[11px] font-medium leading-snug text-slate-500">{field.label}</div>
                    <Input
                      id={field.key}
                      type="number"
                      min="0"
                      step={field.step ?? "1"}
                      inputMode="decimal"
                      value={values[field.key]}
                      onChange={(event) => handleFieldChange(field.key, event.target.value)}
                      className={cn("mt-2 h-10 w-full bg-white text-right text-base", group.title === "Доходы" ? "max-w-[132px]" : "max-w-[180px]")}
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
                <div className={cn("mt-3 rounded-xl border px-4 py-3", profitTone.panel, profitTone.effect)}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Чистая прибыль</div>
                      <div className={cn("mt-1.5 text-2xl font-semibold", profitTone.value)}>{formatMoney(calculations.profit)}</div>
                    </div>
                    <div className={cn("inline-flex rounded-full px-3 py-1 text-sm font-medium", profitTone.badge)}>{profitStatus.label}</div>
                  </div>
                  <div className="mt-2 text-sm text-slate-700">{profitStatus.description}</div>
                </div>
              ) : (
                <div className={cn("mt-3 rounded-xl border px-4 py-3", tone.panel, tone.effect)}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Маржа</div>
                      <div className={cn("mt-1.5 text-3xl font-semibold tracking-tight", tone.value)}>{formatMargin(calculations.margin)}</div>
                    </div>
                    <div className={cn("inline-flex rounded-full px-3 py-1 text-sm font-medium", tone.badge)}>{marginStatus.label}</div>
                  </div>
                  <div className="mt-2 text-sm text-slate-700">{marginStatus.description}</div>
                </div>
              )}
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

        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <div className={cn("rounded-xl border bg-slate-50/70 px-3 py-2.5 lg:col-span-2", validationErrors.clientName ? "border-rose-300" : "border-slate-200")}>
            <div className="text-[11px] font-medium text-slate-500">Имя клиента</div>
            <Input
              value={orderForm.clientName}
              onChange={(event) => handleOrderFieldChange("clientName", event.target.value)}
              placeholder="Например, Анна и Сергей"
              className={cn("mt-2 bg-white", validationErrors.clientName ? "border-rose-300 focus-visible:ring-rose-200" : "")}
            />
            {validationErrors.clientName ? <div className="mt-2 text-xs text-rose-700">{validationErrors.clientName}</div> : null}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 lg:col-span-2">
            <div className="text-[11px] font-medium text-slate-500">Название события</div>
            <Input
              value={orderForm.eventTitle}
              onChange={(event) => handleOrderFieldChange("eventTitle", event.target.value)}
              placeholder="Свадьба в Soho Country Club"
              className="mt-2 bg-white"
            />
          </div>
          <div className={cn("rounded-xl border bg-slate-50/70 px-3 py-2.5", validationErrors.eventDate ? "border-rose-300" : "border-slate-200")}>
            <div className="text-[11px] font-medium text-slate-500">Дата мероприятия</div>
            <Input
              type="date"
              value={orderForm.eventDate}
              onChange={(event) => handleOrderFieldChange("eventDate", event.target.value)}
              className={cn("mt-2 bg-white", validationErrors.eventDate ? "border-rose-300 focus-visible:ring-rose-200" : "")}
            />
            {validationErrors.eventDate ? <div className="mt-2 text-xs text-rose-700">{validationErrors.eventDate}</div> : null}
          </div>
          <div className={cn("rounded-xl border bg-slate-50/70 px-3 py-2.5", validationErrors.contractDate ? "border-rose-300" : "border-slate-200")}>
            <div className="text-[11px] font-medium text-slate-500">Дата договора</div>
            <Input
              type="date"
              value={orderForm.contractDate}
              onChange={(event) => handleOrderFieldChange("contractDate", event.target.value)}
              className={cn("mt-2 bg-white", validationErrors.contractDate ? "border-rose-300 focus-visible:ring-rose-200" : "")}
            />
            {validationErrors.contractDate ? <div className="mt-2 text-xs text-rose-700">{validationErrors.contractDate}</div> : null}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <div className="text-[11px] font-medium text-slate-500">Источник</div>
            <Input
              value={orderForm.source}
              onChange={(event) => handleOrderFieldChange("source", event.target.value)}
              placeholder="Например, Telegram Mini App"
              className="mt-2 bg-white"
            />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <div className="text-[11px] font-medium text-slate-500">Статус</div>
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
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 lg:col-span-4">
            <div className="text-[11px] font-medium text-slate-500">Комментарий</div>
            <Textarea
              value={orderForm.comment}
              onChange={(event) => handleOrderFieldChange("comment", event.target.value)}
              placeholder="Например, нужен аккуратный апсейл по оборудованию и аккуратно держим скидку."
              className="mt-2 min-h-[92px] bg-white"
            />
          </div>
        </div>

        {calculations.revenue > 0 ? (
          <div className="mt-3 text-sm text-slate-500">Если расчёт устраивает, можно сразу зафиксировать его как заказ.</div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-950">Панель периода</div>
            <div className="mt-1 text-sm text-slate-600">Сводка считается по дате договора и показывает текущую картину по заказам.</div>
          </div>
          <div className="lg:text-right">
            <div className="flex flex-nowrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => setPeriodFilter("currentYear")}
                className={cn(
                  "h-8 whitespace-nowrap px-3 text-xs",
                  periodFilter === "currentYear" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                )}
              >
                Текущий год
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setPeriodFilter("previousYear")}
                className={cn(
                  "h-8 whitespace-nowrap px-3 text-xs",
                  periodFilter === "previousYear" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                )}
              >
                Прошлый год
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setPeriodFilter("custom")}
                className={cn(
                  "h-8 whitespace-nowrap px-3 text-xs",
                  periodFilter === "custom" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                )}
              >
                Свой период
              </Button>
            </div>
            <div className="mt-2 text-xs font-medium text-slate-500">
              Период: {summary ? `${formatAdminDate(summary.date_from)} - ${formatAdminDate(summary.date_to)}` : "загружается"}
            </div>
          </div>
        </div>

        {summary && !summaryQuery.isLoading && !summaryQuery.isError ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">После создания заказа из текущего сценария</div>
            {previewSummary?.state === "ready" ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Общая выручка</div>
                  <div className="mt-1.5 text-xl font-semibold leading-tight text-slate-950">{formatMoney(previewSummary.nextTotalRevenue)}</div>
                  <div className="mt-1 text-xs text-emerald-700">{formatSignedMoney(previewSummary.revenueDelta)}</div>
                </div>
                <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Общая прибыль</div>
                  <div className="mt-1.5 text-xl font-semibold leading-tight text-slate-950">{formatMoney(previewSummary.nextTotalProfit)}</div>
                  <div className={cn("mt-1 text-xs", previewSummary.profitDelta >= 0 ? "text-emerald-700" : "text-rose-700")}>
                    {formatSignedMoney(previewSummary.profitDelta)}
                  </div>
                </div>
                <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Средняя маржа</div>
                  <div className="mt-1.5 text-xl font-semibold leading-tight text-slate-950">{formatMargin(previewSummary.nextAverageMargin)}</div>
                  <div className={cn("mt-1 text-xs", previewSummary.marginDelta >= 0 ? "text-emerald-700" : "text-rose-700")}>
                    {formatSignedMargin(previewSummary.marginDelta)}
                  </div>
                </div>
                <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Количество заказов</div>
                  <div className="mt-1.5 text-xl font-semibold leading-tight text-slate-950">{previewSummary.nextOrdersCount}</div>
                  <div className="mt-1 text-xs text-emerald-700">{formatSignedCount(1)}</div>
                </div>
                <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Средняя прибыль на заказ</div>
                  <div className="mt-1.5 text-xl font-semibold leading-tight text-slate-950">{formatMoney(previewSummary.nextAverageProfitPerOrder)}</div>
                  <div className={cn("mt-1 text-xs", previewSummary.averageProfitDelta >= 0 ? "text-emerald-700" : "text-rose-700")}>
                    {formatSignedMoney(previewSummary.averageProfitDelta)}
                  </div>
                </div>
                <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Низкомаржинальные</div>
                  <div className="mt-1.5 text-xl font-semibold leading-tight text-slate-950">{previewSummary.nextLowMarginOrdersCount}</div>
                  <div className={cn("mt-1 text-xs", previewSummary.lowMarginOrdersDelta > 0 ? "text-rose-700" : "text-slate-500")}>
                    {formatSignedCount(previewSummary.lowMarginOrdersDelta)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-slate-600">{previewSummary?.message ?? "Preview периода появится, когда загрузится сводка."}</div>
            )}
          </div>
        ) : null}

        {periodFilter === "custom" ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
            <Input
              type="date"
              value={customDateFrom}
              onChange={(event) => setCustomDateFrom(event.target.value)}
              className="bg-white text-slate-950 [color-scheme:light]"
            />
            <Input
              type="date"
              value={customDateTo}
              onChange={(event) => setCustomDateTo(event.target.value)}
              className="bg-white text-slate-950 [color-scheme:light]"
            />
          </div>
        ) : null}

        {summaryQuery.isLoading ? (
          <div className="mt-4 text-sm text-slate-600">Собираю сводку...</div>
        ) : summaryQuery.isError ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {summaryQuery.error instanceof Error ? summaryQuery.error.message : "Не удалось загрузить summary"}
          </div>
        ) : summary ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Общая выручка</div>
              <div className="mt-1.5 text-xl font-semibold leading-tight text-slate-950">{formatAdminMoney(summary.total_revenue)}</div>
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Общая прибыль</div>
              <div className="mt-1.5 text-xl font-semibold leading-tight text-slate-950">{formatAdminMoney(summary.total_profit)}</div>
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Средняя маржа</div>
              <div className="mt-1.5 text-xl font-semibold leading-tight text-slate-950">{formatMargin(Number(summary.average_margin))}</div>
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Количество заказов</div>
              <div className="mt-1.5 text-xl font-semibold leading-tight text-slate-950">{summary.orders_count}</div>
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Средняя прибыль на заказ</div>
              <div className="mt-1.5 text-xl font-semibold leading-tight text-slate-950">{formatAdminMoney(summary.average_profit_per_order)}</div>
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Низкомаржинальные</div>
              <div className="mt-1.5 text-xl font-semibold leading-tight text-slate-950">{summary.low_margin_orders_count}</div>
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
          <div className="text-sm text-slate-500">{sortedOrders.length} шт.</div>
        </div>

        {ordersQuery.isLoading ? (
          <div className="mt-4 text-sm text-slate-600">Загружаю заказы...</div>
        ) : ordersQuery.isError ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {ordersQuery.error instanceof Error ? ordersQuery.error.message : "Не удалось загрузить заказы"}
          </div>
        ) : sortedOrders.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            Заказов в выбранном периоде пока нет.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {sortedOrders.map((order) => {
              const eventTiming = getEventTiming(order.event_date);
              const eventTimingStyle = eventTimingClasses[eventTiming.tone];

              return (
                <Link
                  key={order.id}
                  to={`/admin/margin-calculator/orders/${order.id}`}
                  className={cn(
                    "relative grid overflow-hidden rounded-2xl border p-4 pl-5 transition-colors md:grid-cols-[1.25fr_0.85fr_0.85fr_0.9fr_0.8fr]",
                    "gap-3",
                    eventTimingStyle.card,
                  )}
                >
                  <span className={cn("absolute inset-y-0 left-0 w-1.5", eventTimingStyle.stripe)} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-semibold text-slate-950">{order.client_name}</div>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", eventTimingStyle.badge)}>
                        {eventTiming.label}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{order.order_code ?? `order #${order.id}`}</div>
                    <div className="mt-1 text-xs text-slate-500">{order.event_title || "Без названия события"}</div>
                    <div className="mt-2 text-xs text-slate-500">Источник: {formatSourceLabel(order.source)}</div>
                  </div>
                  <div className="text-sm text-slate-700">
                    <div>Договор: {formatAdminDate(order.contract_date)}</div>
                    <div className="mt-1 text-xs text-slate-500">Мероприятие: {formatAdminDate(order.event_date)}</div>
                    <div className={cn("mt-1 text-xs font-medium", eventTimingStyle.text)}>{eventTiming.description}</div>
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
                    <div className="font-medium text-slate-950">{formatOrderStatusLabel(order.status)}</div>
                    <div className="mt-1 text-xs text-slate-500">Подписание: {formatAdminDate(order.contract_date)}</div>
                    <div className="mt-1 text-xs text-slate-500">Изменено: {formatAdminDateTime(order.updated_at)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminMarginCalculatorPage;
