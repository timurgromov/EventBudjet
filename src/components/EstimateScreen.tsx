import React, { useState, useMemo, useCallback } from "react";
import { ChevronDown, Plus, Play, X, HelpCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { defaultItems, ItemInfo } from "./expense-items-data";

interface EstimateScreenProps {
  guests: number;
  city?: string;
  weddingDate?: string;
  savedItems?: Record<string, { checked: boolean; userPrice: string }>;
  savedCustomItems?: Array<{ id: string; name: string; checked: boolean; userPrice: string }>;
  onSave?: (items: Record<string, { checked: boolean; userPrice: string }>, customItems: Array<{ id: string; name: string; checked: boolean; userPrice: string }>) => void;
  onCalculate?: (
    items: Record<string, { checked: boolean; userPrice: string }>,
    customItems: Array<{ id: string; name: string; checked: boolean; userPrice: string }>,
  ) => Promise<void> | void;
  isCalculating?: boolean;
  backendTotal?: number | null;
  syncError?: string | null;
}

interface ExpenseItem {
  id: string;
  name: string;
  info: ItemInfo | null;
  getPrice: (n: number) => number | null;
  checked: boolean;
  userPrice: string;
  isCustom?: boolean;
}

const formatPrice = (price: number): string => price.toLocaleString("ru-RU");

const InfoBlock: React.FC<{ info: ItemInfo }> = ({ info }) => (
  <div className="px-3 pb-3 pt-0">
    <div className="bg-secondary/50 rounded-lg p-3 space-y-2.5">
      <div>
        <p className="text-[11px] text-primary font-medium mb-1">Что входит в стоимость</p>
        <ul className="space-y-0.5">
          {info.includes.map((item, i) => (
            <li key={i} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
              <span className="text-primary/60 mt-0.5">•</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-[11px] text-primary font-medium mb-1">Что влияет на стоимость</p>
        <ul className="space-y-0.5">
          {info.factors.map((item, i) => (
            <li key={i} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
              <span className="text-primary/60 mt-0.5">•</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  </div>
);

const EstimateScreen: React.FC<EstimateScreenProps> = ({
  guests,
  city,
  weddingDate,
  savedItems,
  savedCustomItems,
  onSave,
  onCalculate,
  isCalculating = false,
  backendTotal = null,
  syncError = null,
}) => {
  const [items, setItems] = useState<ExpenseItem[]>(() => {
    const base: ExpenseItem[] = defaultItems.map((d) => ({
      id: d.id,
      name: d.name,
      info: d.info,
      getPrice: d.getPrice,
      checked: savedItems?.[d.id]?.checked ?? d.defaultChecked,
      userPrice: savedItems?.[d.id]?.userPrice ?? "",
    }));
    const custom: ExpenseItem[] = (savedCustomItems ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      info: null,
      getPrice: () => null,
      checked: c.checked,
      userPrice: c.userPrice,
      isCustom: true,
    }));
    return [...base, ...custom];
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");

  const triggerSave = useCallback((currentItems: ExpenseItem[]) => {
    if (!onSave) return;
    const estimateItems: Record<string, { checked: boolean; userPrice: string }> = {};
    const customItems: Array<{ id: string; name: string; checked: boolean; userPrice: string }> = [];
    currentItems.forEach((it) => {
      if (it.isCustom) {
        customItems.push({ id: it.id, name: it.name, checked: it.checked, userPrice: it.userPrice });
      } else {
        estimateItems[it.id] = { checked: it.checked, userPrice: it.userPrice };
      }
    });
    onSave(estimateItems, customItems);
  }, [onSave]);

  const total = useMemo(() => {
    return items.reduce((sum, item) => {
      if (!item.checked) return sum;
      const userVal = item.userPrice ? parseInt(item.userPrice.replace(/\D/g, "")) : 0;
      const calcPrice = item.getPrice(guests);
      return sum + (userVal || calcPrice || 0);
    }, 0);
  }, [items, guests]);

  const updateItem = (id: string, updates: Partial<ExpenseItem>) => {
    setItems((prev) => {
      const next = prev.map((it) => (it.id === id ? { ...it, ...updates } : it));
      triggerSave(next);
      return next;
    });
  };

  const addCustomItem = () => {
    if (!newName.trim()) return;
    const newItem: ExpenseItem = {
      id: `custom-${Date.now()}`,
      name: newName.trim(),
      info: null,
      getPrice: () => null,
      checked: true,
      userPrice: "",
      isCustom: true,
    };
    setItems((prev) => {
      const next = [...prev, newItem];
      triggerSave(next);
      return next;
    });
    setNewName("");
    setShowAddForm(false);
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((it) => it.id !== id);
      triggerSave(next);
      return next;
    });
  };

  const snapshotData = () => {
    const estimateItems: Record<string, { checked: boolean; userPrice: string }> = {};
    const customItems: Array<{ id: string; name: string; checked: boolean; userPrice: string }> = [];
    items.forEach((it) => {
      if (it.isCustom) {
        customItems.push({ id: it.id, name: it.name, checked: it.checked, userPrice: it.userPrice });
      } else {
        estimateItems[it.id] = { checked: it.checked, userPrice: it.userPrice };
      }
    });
    return { estimateItems, customItems };
  };

  return (
    <div className="min-h-screen flex flex-col pb-64">
      {/* Subtitle */}
      <p className="text-sm text-foreground/80 text-center px-4 pt-1 pb-1">Рассчитайте бюджет вашего торжества</p>

      {/* Items */}
      <div className="px-4 py-3 space-y-2">
        {items.map((item, i) => {
          const calcPrice = item.getPrice(guests);
          const isExpanded = expandedId === item.id;
          const hasInfo = !!item.info;

          return (
            <div
              key={item.id}
              className="rounded-xl border border-border bg-card overflow-hidden animate-fade-in"
              style={{ animationDelay: `${i * 0.03}s` }}
            >
              <div className="flex items-center gap-3 p-3">
                <button
                  onClick={() => updateItem(item.id, { checked: !item.checked })}
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all",
                    item.checked ? "bg-primary border-primary" : "border-muted-foreground/30"
                  )}
                >
                  {item.checked && (
                    <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>

                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="flex-1 text-left flex items-center gap-1 min-w-0"
                >
                  <span className={cn("text-sm truncate", item.checked ? "text-foreground" : "text-muted-foreground")}>
                    {item.name}
                  </span>
                  {hasInfo && (
                    <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform", isExpanded && "rotate-180")} />
                  )}
                </button>

                {hasInfo && (
                  <button
                    className="flex-shrink-0 text-muted-foreground/50 hover:text-primary transition-colors"
                    onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : item.id); }}
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                )}

                <div className="flex-shrink-0 w-28">
                  <input
                    type="text"
                    value={item.userPrice}
                    onChange={(e) => updateItem(item.id, { userPrice: e.target.value })}
                    placeholder={calcPrice !== null ? `от ${formatPrice(calcPrice)}` : item.isCustom ? "введите сумму" : "—"}
                    className="w-full text-right text-sm bg-transparent border-b border-border/50 py-1 px-1 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                {item.isCustom && (
                  <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {isExpanded && item.info && <InfoBlock info={item.info} />}
            </div>
          );
        })}

        {showAddForm ? (
          <div className="flex gap-2 p-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomItem()}
              placeholder="Название расхода..."
              autoFocus
              className="flex-1 h-10 rounded-lg bg-card border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
            <button onClick={addCustomItem} className="h-10 px-4 rounded-lg gradient-gold text-primary-foreground text-sm font-medium">ОК</button>
            <button onClick={() => setShowAddForm(false)} className="h-10 px-3 rounded-lg bg-card border border-border text-muted-foreground text-sm">✕</button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-border text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Добавить свой расход
          </button>
        )}
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-xl border-t border-border px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Итого:</span>
          <span className="text-2xl font-serif text-gold-gradient">{formatPrice(total)} ₽</span>
        </div>
        {backendTotal !== null && (
          <div className="text-xs text-muted-foreground">
            Сохранённый расчёт в базе: {formatPrice(backendTotal)} ₽
          </div>
        )}
        {syncError && <div className="text-xs text-destructive">{syncError}</div>}
        <button
          onClick={() => {
            if (!onCalculate) return;
            const snapshot = snapshotData();
            onCalculate(snapshot.estimateItems, snapshot.customItems);
          }}
          disabled={isCalculating}
          className="w-full h-11 rounded-xl border border-border bg-card text-foreground font-medium text-sm hover:bg-secondary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isCalculating ? "Сохраняем..." : "Сохранить и рассчитать"}
        </button>
        <button
          onClick={() => {
            const lines: string[] = ["📋 Смета свадьбы\n"];
            if (city) lines.push(`Город: ${city}`);
            if (weddingDate) lines.push(`Дата свадьбы: ${weddingDate}`);
            lines.push(`Гостей: ${guests}\n`);
            items.forEach((item) => {
              if (!item.checked) return;
              const userVal = item.userPrice ? parseInt(item.userPrice.replace(/\D/g, "")) : 0;
              const calcPrice = item.getPrice(guests);
              const price = userVal || calcPrice || 0;
              lines.push(`${item.name} — ${price > 0 ? formatPrice(price) + " ₽" : "не указано"}`);
            });
            lines.push(`\nИтого: ${formatPrice(total)} ₽`);
            lines.push(`\nРасчёт сделан в свадебном калькуляторе Тимура Громова`);
            navigator.clipboard.writeText(lines.join("\n")).then(() => {
              toast("Смета скопирована");
            });
          }}
          className="w-full h-11 rounded-xl border border-border bg-card text-foreground font-medium flex items-center justify-center gap-2 text-sm hover:bg-secondary transition-colors"
        >
          <Copy className="w-4 h-4" />
          Скопировать смету
        </button>
        <a
          href="https://timurgromov.ru/#webinar"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full h-14 rounded-xl gradient-gold text-primary-foreground font-medium flex flex-col items-center justify-center gap-0.5"
        >
          <span className="text-sm flex items-center gap-2">
            <Play className="w-4 h-4" />
            Посмотреть онлайн-разбор
          </span>
          <span className="text-[11px] opacity-80">Пошаговый план организации свадьбы</span>
        </a>

        {/* Footer */}
        <div className="text-center py-4 text-[10px] text-muted-foreground/40 tracking-wide">
          © Тимур Громов •{" "}
          <a href="https://timurgromov.ru" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-primary transition-colors">
            timurgromov.ru
          </a>
        </div>
      </div>
    </div>
  );
};

export default EstimateScreen;
