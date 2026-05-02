import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createClientOrderItem,
  deleteClientOrder,
  deleteClientOrderItem,
  getClientOrder,
  updateClientOrder,
  updateClientOrderItem,
  type ClientOrderItem,
  type ClientOrderItemCreatePayload,
} from "@/lib/api";

import { formatAdminDate, formatAdminDateTime, formatAdminMoney, formatOrderStatusLabel, formatSourceLabel } from "./admin-format";

interface AdminOutletContext {
  adminToken: string;
}

interface OrderFormState {
  clientName: string;
  eventTitle: string;
  eventDate: string;
  contractDate: string;
  source: string;
  status: string;
  comment: string;
}

interface NewItemState {
  title: string;
  amount: string;
}

const ORDER_STATUS_OPTIONS = [
  { value: "signed", label: "Подписан" },
  { value: "in_progress", label: "В работе" },
  { value: "completed", label: "Проведён" },
  { value: "closed", label: "Закрыт" },
  { value: "cancelled", label: "Отменён" },
];

const formatMargin = (value?: string | null): string => {
  if (!value) return "—";
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return value;
  return `${parsed.toFixed(1)}%`;
};

const buildOrderForm = (order: {
  client_name: string;
  event_title: string | null;
  event_date: string | null;
  contract_date: string | null;
  source: string | null;
  status: string;
  comment: string | null;
}): OrderFormState => ({
  clientName: order.client_name,
  eventTitle: order.event_title ?? "",
  eventDate: order.event_date ?? "",
  contractDate: order.contract_date ?? "",
  source: order.source ?? "",
  status: order.status,
  comment: order.comment ?? "",
});

const buildItemDrafts = (items: ClientOrderItem[]) =>
  Object.fromEntries(
    items.map((item) => [
      item.id,
      {
        title: item.title,
        amount: item.amount,
      },
    ]),
  );

const AdminClientOrderDetailPage = () => {
  const { adminToken } = useOutletContext<AdminOutletContext>();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const numericOrderId = Number(orderId);
  const [orderForm, setOrderForm] = useState<OrderFormState | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<number, { title: string; amount: string }>>({});
  const [newRevenueItem, setNewRevenueItem] = useState<NewItemState>({ title: "", amount: "" });
  const [newCostItem, setNewCostItem] = useState<NewItemState>({ title: "", amount: "" });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["client-order", adminToken, numericOrderId],
    queryFn: () => getClientOrder(adminToken, numericOrderId),
    enabled: adminToken.trim().length > 0 && Number.isFinite(numericOrderId),
  });

  useEffect(() => {
    if (!query.data) return;
    setOrderForm(buildOrderForm(query.data.order));
    setItemDrafts(buildItemDrafts(query.data.items));
  }, [query.data]);

  const refreshOrder = async () => {
    await query.refetch();
    await queryClient.invalidateQueries({ queryKey: ["client-orders"] });
    await queryClient.invalidateQueries({ queryKey: ["client-order-summary"] });
  };

  const updateOrderMutation = useMutation({
    mutationFn: async () => {
      if (!orderForm) throw new Error("Форма заказа не готова");
      return updateClientOrder(adminToken, numericOrderId, {
        client_name: orderForm.clientName.trim(),
        event_title: orderForm.eventTitle.trim() || null,
        event_date: orderForm.eventDate || null,
        contract_date: orderForm.contractDate || null,
        source: orderForm.source.trim() || null,
        status: orderForm.status,
        comment: orderForm.comment.trim() || null,
      });
    },
    onSuccess: async () => {
      setStatusMessage("Карточка заказа обновлена.");
      await refreshOrder();
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? `Ошибка обновления: ${error.message}` : "Ошибка обновления заказа.");
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId }: { itemId: number }) => {
      const draft = itemDrafts[itemId];
      if (!draft) throw new Error("Черновик строки не найден");
      return updateClientOrderItem(adminToken, numericOrderId, itemId, {
        title: draft.title.trim(),
        amount: draft.amount,
      });
    },
    onSuccess: async () => {
      setStatusMessage("Финансовая строка обновлена.");
      await refreshOrder();
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? `Ошибка строки: ${error.message}` : "Ошибка обновления строки.");
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async ({ itemId }: { itemId: number }) => deleteClientOrderItem(adminToken, numericOrderId, itemId),
    onSuccess: async () => {
      setStatusMessage("Строка удалена.");
      await refreshOrder();
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? `Ошибка удаления строки: ${error.message}` : "Ошибка удаления строки.");
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (payload: ClientOrderItemCreatePayload) => createClientOrderItem(adminToken, numericOrderId, payload),
    onSuccess: async (_, variables) => {
      setStatusMessage("Строка добавлена.");
      if (variables.item_type === "revenue") {
        setNewRevenueItem({ title: "", amount: "" });
      } else {
        setNewCostItem({ title: "", amount: "" });
      }
      await refreshOrder();
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? `Ошибка добавления строки: ${error.message}` : "Ошибка добавления строки.");
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async () => deleteClientOrder(adminToken, numericOrderId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["client-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["client-order-summary"] });
      navigate("/admin/margin-calculator");
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? `Ошибка удаления заказа: ${error.message}` : "Ошибка удаления заказа.");
    },
  });

  const handleCreateItem = (itemType: "revenue" | "cost") => {
    const draft = itemType === "revenue" ? newRevenueItem : newCostItem;
    createItemMutation.mutate({
      item_type: itemType,
      title: draft.title.trim(),
      amount: draft.amount,
    });
  };

  const order = query.data?.order;
  const items = query.data?.items ?? [];
  const revenueItems = useMemo(() => items.filter((item) => item.item_type === "revenue"), [items]);
  const costItems = useMemo(() => items.filter((item) => item.item_type === "cost"), [items]);

  if (!adminToken.trim()) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">Сохраните admin token, чтобы открыть карточку заказа.</div>;
  }

  if (query.isError) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700">{query.error instanceof Error ? query.error.message : "Не удалось загрузить заказ"}</div>;
  }

  if (query.isLoading || !order || !orderForm) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Загружаю карточку заказа...</div>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link to="/admin/margin-calculator" className="text-sm text-slate-500 underline underline-offset-4">
              Назад к панели Margin CRM
            </Link>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{order.client_name}</div>
            <div className="mt-1 text-sm text-slate-500">{order.order_code ?? `order #${order.id}`}</div>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              if (window.confirm("Удалить заказ целиком? Это действие необратимо.")) {
                deleteOrderMutation.mutate();
              }
            }}
            className="border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-800"
          >
            Удалить заказ
          </Button>
        </div>
        {statusMessage ? <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{statusMessage}</div> : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg font-semibold text-slate-950">Шапка заказа</div>
          <Button onClick={() => updateOrderMutation.mutate()} disabled={updateOrderMutation.isPending}>
            {updateOrderMutation.isPending ? "Сохраняю..." : "Сохранить карточку"}
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <div className="text-[11px] font-medium text-slate-500">Имя клиента</div>
            <Input value={orderForm.clientName} onChange={(event) => setOrderForm((current) => current ? { ...current, clientName: event.target.value } : current)} className="mt-2 bg-white" />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <div className="text-[11px] font-medium text-slate-500">Название события</div>
            <Input value={orderForm.eventTitle} onChange={(event) => setOrderForm((current) => current ? { ...current, eventTitle: event.target.value } : current)} className="mt-2 bg-white" />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <div className="text-[11px] font-medium text-slate-500">Дата мероприятия</div>
            <Input type="date" value={orderForm.eventDate} onChange={(event) => setOrderForm((current) => current ? { ...current, eventDate: event.target.value } : current)} className="mt-2 bg-white" />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <div className="text-[11px] font-medium text-slate-500">Дата договора</div>
            <Input type="date" value={orderForm.contractDate} onChange={(event) => setOrderForm((current) => current ? { ...current, contractDate: event.target.value } : current)} className="mt-2 bg-white" />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <div className="text-[11px] font-medium text-slate-500">Источник</div>
            <Input value={orderForm.source} onChange={(event) => setOrderForm((current) => current ? { ...current, source: event.target.value } : current)} className="mt-2 bg-white" />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <div className="text-[11px] font-medium text-slate-500">Статус</div>
            <select
              value={orderForm.status}
              onChange={(event) => setOrderForm((current) => current ? { ...current, status: event.target.value } : current)}
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
            <Textarea value={orderForm.comment} onChange={(event) => setOrderForm((current) => current ? { ...current, comment: event.target.value } : current)} className="mt-2 min-h-[92px] bg-white" />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Выручка</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{formatAdminMoney(order.revenue)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Расходы</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{formatAdminMoney(order.total_costs)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Прибыль</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{formatAdminMoney(order.profit)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Маржа</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{formatMargin(order.margin)}</div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold text-slate-950">Контекст заказа</div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm text-slate-700">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Статус</div>
            <div className="mt-1">{formatOrderStatusLabel(order.status)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Источник</div>
            <div className="mt-1">{formatSourceLabel(order.source)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Создан</div>
            <div className="mt-1">{formatAdminDateTime(order.created_at)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Обновлён</div>
            <div className="mt-1">{formatAdminDateTime(order.updated_at)}</div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {[{ title: "Доходы", itemType: "revenue" as const, items: revenueItems, draft: newRevenueItem, setDraft: setNewRevenueItem }, { title: "Расходы", itemType: "cost" as const, items: costItems, draft: newCostItem, setDraft: setNewCostItem }].map((group) => (
          <section key={group.itemType} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-lg font-semibold text-slate-950">{group.title}</div>

            <div className="mt-4 space-y-3">
              {group.items.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto_auto]">
                    <Input
                      value={itemDrafts[item.id]?.title ?? item.title}
                      onChange={(event) =>
                        setItemDrafts((current) => ({
                          ...current,
                          [item.id]: {
                            ...(current[item.id] ?? { title: item.title, amount: item.amount }),
                            title: event.target.value,
                          },
                        }))
                      }
                      className="bg-white"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={itemDrafts[item.id]?.amount ?? item.amount}
                      onChange={(event) =>
                        setItemDrafts((current) => ({
                          ...current,
                          [item.id]: {
                            ...(current[item.id] ?? { title: item.title, amount: item.amount }),
                            amount: event.target.value,
                          },
                        }))
                      }
                      className="bg-white text-right"
                    />
                    <Button type="button" variant="outline" onClick={() => updateItemMutation.mutate({ itemId: item.id })} disabled={updateItemMutation.isPending}>
                      Сохранить
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                      onClick={() => deleteItemMutation.mutate({ itemId: item.id })}
                      disabled={deleteItemMutation.isPending}
                    >
                      Удалить
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                <Input
                  value={group.draft.title}
                  onChange={(event) => group.setDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder={group.itemType === "revenue" ? "Новый апсейл или доход" : "Новая расходная статья"}
                  className="bg-white"
                />
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={group.draft.amount}
                  onChange={(event) => group.setDraft((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="0"
                  className="bg-white text-right"
                />
                <Button onClick={() => handleCreateItem(group.itemType)} disabled={createItemMutation.isPending}>
                  Добавить
                </Button>
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        История изменений как отдельный журнал пока не добавлена. На этом этапе карточка уже поддерживает рабочее сопровождение заказа: шапка, строки доходов, строки расходов и пересчёт итогов.
      </section>
    </div>
  );
};

export default AdminClientOrderDetailPage;
