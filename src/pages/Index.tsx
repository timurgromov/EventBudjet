import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import QualificationScreen from "@/components/QualificationScreen";
import EstimateScreen from "@/components/EstimateScreen";
import TelegramProfile from "@/components/TelegramProfile";
import AppHeader from "@/components/AppHeader";
import ProfileProgress from "@/components/ProfileProgress";
import {
  authTelegramInit,
  calculateLead,
  createExpense,
  createLead,
  deleteExpense,
  getLeadProgress,
  listExpenses,
  trackLeadAction,
  updateLead,
} from "@/lib/api";
import { formatDateOnly, parseDateOnly } from "@/lib/date";
import { defaultItems } from "@/components/expense-items-data";
import { useTelegramContext } from "@/hooks/useTelegramUser";

interface SavedData {
  screen: "qualification" | "estimate";
  guests: number;
  qualification?: {
    role: string;
    city: string;
    date: string;
    guests: number;
    venue: string;
    venueName: string;
    dateUndecided: boolean;
    dateSeason: string;
  };
  estimateItems?: Record<string, { checked: boolean; userPrice: string }>;
  customItems?: Array<{ id: string; name: string; checked: boolean; userPrice: string }>;
}

const parseMoney = (raw: string): number => {
  const cleaned = raw.replace(/\D/g, "");
  if (!cleaned) return 0;
  return Number.parseInt(cleaned, 10);
};

const itemById = new Map(defaultItems.map((item) => [item.id, item]));
const FALLBACK_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? "gromov_wedding_bot";
const DEFAULT_SOURCE_CODE = "direct_personal";
const TELEGRAM_STARTAPP_URL = `https://t.me/${FALLBACK_BOT_USERNAME}?startapp=${DEFAULT_SOURCE_CODE}`;

const parseSourceCodeFromInitData = (initDataRaw: string): string => {
  if (!initDataRaw) return DEFAULT_SOURCE_CODE;
  const params = new URLSearchParams(initDataRaw);
  const raw = (params.get("start_param") ?? "").trim().toLowerCase();
  if (!raw || raw === "calc") return DEFAULT_SOURCE_CODE;
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(raw)) return DEFAULT_SOURCE_CODE;
  return raw;
};

const Index = () => {
  const { user, initData, isTelegram } = useTelegramContext();
  const sourceCode = useMemo(() => parseSourceCodeFromInitData(initData), [initData]);

  const [bootstrapTick, setBootstrapTick] = useState(0);
  const [bootLoading, setBootLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  const [screen, setScreen] = useState<"qualification" | "estimate">("qualification");
  const [guests, setGuests] = useState(0);
  const [savedEstimate, setSavedEstimate] = useState<SavedData["estimateItems"]>({});
  const [savedCustomItems, setSavedCustomItems] = useState<SavedData["customItems"]>([]);
  const [savedQualification, setSavedQualification] = useState<SavedData["qualification"]>();

  const [hasLead, setHasLead] = useState(false);
  const [backendTotal, setBackendTotal] = useState<number | null>(null);

  const [syncError, setSyncError] = useState<string | null>(null);
  const hasLeadRef = useRef(false);
  const syncInFlightRef = useRef(false);
  const pendingSyncRef = useRef<{
    estimateItems: Record<string, { checked: boolean; userPrice: string }>;
    customItems: Array<{ id: string; name: string; checked: boolean; userPrice: string }>;
  } | null>(null);
  const qualificationSyncInFlightRef = useRef(false);
  const pendingQualificationRef = useRef<SavedData["qualification"] | null>(null);
  const qualificationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    hasLeadRef.current = hasLead;
  }, [hasLead]);

  useEffect(() => {
    return () => {
      if (qualificationTimerRef.current !== null) {
        window.clearTimeout(qualificationTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      setBootLoading(true);
      setBootError(null);

      if (!isTelegram || !initData) {
        setBootError("Откройте калькулятор через Telegram Mini App");
        setBootLoading(false);
        return;
      }

      try {
        await authTelegramInit(initData);
        const progress = await getLeadProgress(initData);

        if (!progress.lead) {
          setHasLead(false);
          setSavedQualification(undefined);
          setSavedEstimate({});
          setSavedCustomItems([]);
          setGuests(0);
          setScreen("qualification");
          setBackendTotal(null);
          setBootLoading(false);
          return;
        }

        setHasLead(true);
        setGuests(progress.lead.guests_count ?? 0);
        setBackendTotal(progress.total_budget ? Number.parseFloat(progress.total_budget) : null);

        const dateUndecided = !progress.lead.wedding_date_exact;
        const dateSeason = progress.lead.next_year_flag
          ? "next_year"
          : (progress.lead.season ?? "");

        setSavedQualification({
          role: progress.lead.role ?? "",
          city: progress.lead.city ?? "",
          date: progress.lead.wedding_date_exact ?? "",
          guests: progress.lead.guests_count ?? 0,
          venue: progress.lead.venue_status ?? "",
          venueName: progress.lead.venue_name ?? "",
          dateUndecided,
          dateSeason,
        });

        const estimateItems: Record<string, { checked: boolean; userPrice: string }> = {};
        const customItems: Array<{ id: string; name: string; checked: boolean; userPrice: string }> = [];

        progress.expenses.forEach((expense) => {
          const amount = Number.parseFloat(expense.amount);
          const amountValue = Number.isFinite(amount) ? Math.round(amount).toString() : "";

          if (expense.category_code && itemById.has(expense.category_code)) {
            estimateItems[expense.category_code] = { checked: true, userPrice: amountValue };
          } else {
            customItems.push({
              id: `custom-${expense.id}`,
              name: expense.category_name,
              checked: true,
              userPrice: amountValue,
            });
          }
        });

        setSavedEstimate(estimateItems);
        setSavedCustomItems(customItems);
        const hasProfileData = Boolean(
          progress.lead.role ||
          progress.lead.city ||
          progress.lead.venue_status ||
          progress.lead.wedding_date_exact ||
          progress.lead.season ||
          progress.lead.next_year_flag ||
          (progress.lead.guests_count ?? 0) > 0,
        );
        const hasProgressData = hasProfileData || progress.expenses.length > 0 || progress.total_budget !== null;
        setScreen(hasProgressData ? "estimate" : "qualification");
        window.scrollTo(0, 0);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Не удалось загрузить данные";
        setBootError(message);
      } finally {
        setBootLoading(false);
      }
    };

    void bootstrap();
  }, [bootstrapTick, initData, isTelegram]);

  const reportUiAction = useCallback((action: string, source: string, href?: string) => {
    if (!initData || !hasLeadRef.current) {
      return;
    }
    void trackLeadAction(initData, { action, source, href }).catch(() => {
      // best-effort analytics event; do not block user flow
    });
  }, [initData]);

  const buildLeadPayload = (q: SavedData["qualification"]) => {
    if (!q) return {};

    const nextYear = q.dateUndecided && q.dateSeason === "next_year";
    const hasSeason = q.dateUndecided && q.dateSeason && q.dateSeason !== "next_year";

    return {
      role: q.role,
      city: q.city,
      venue_status: q.venue || undefined,
      venue_name: q.venue === "chosen" ? (q.venueName || null) : null,
      wedding_date_exact: q.dateUndecided ? null : (q.date || null),
      wedding_date_mode: q.dateUndecided ? "season" : "exact",
      season: hasSeason ? q.dateSeason : null,
      next_year_flag: nextYear,
      guests_count: q.guests,
      source: sourceCode,
    };
  };

  const runQualificationAutoSync = async () => {
    if (qualificationSyncInFlightRef.current || !initData) return;
    qualificationSyncInFlightRef.current = true;

    try {
      while (pendingQualificationRef.current) {
        const payload = pendingQualificationRef.current;
        pendingQualificationRef.current = null;

        try {
          setSyncError(null);
          if (hasLeadRef.current) {
            await updateLead(initData, buildLeadPayload(payload));
          } else {
            await createLead(initData, buildLeadPayload(payload));
            hasLeadRef.current = true;
            setHasLead(true);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Ошибка автосохранения профиля";
          setSyncError(`Профиль не сохранён: ${message}`);
        }
      }
    } finally {
      qualificationSyncInFlightRef.current = false;
    }
  };

  const scheduleQualificationSync = (payload: SavedData["qualification"]) => {
    if (!initData) return;
    pendingQualificationRef.current = payload;
    if (qualificationTimerRef.current !== null) {
      window.clearTimeout(qualificationTimerRef.current);
    }
    qualificationTimerRef.current = window.setTimeout(() => {
      qualificationTimerRef.current = null;
      void runQualificationAutoSync();
    }, 800);
  };

  const cancelPendingQualificationSync = () => {
    pendingQualificationRef.current = null;
    if (qualificationTimerRef.current !== null) {
      window.clearTimeout(qualificationTimerRef.current);
      qualificationTimerRef.current = null;
    }
  };

  const syncExpensesToBackend = async (
    estimateItems: Record<string, { checked: boolean; userPrice: string }>,
    customItems: Array<{ id: string; name: string; checked: boolean; userPrice: string }>,
  ) => {
    if (!initData || !hasLead) return;

    const desired: Array<{ category_code: string | null; category_name?: string; amount: string }> = [];

    Object.entries(estimateItems).forEach(([categoryCode, value]) => {
      if (!value.checked) return;

      const item = itemById.get(categoryCode);
      const manual = parseMoney(value.userPrice);
      const suggested = item ? (item.getPrice(guests) ?? 0) : 0;
      const amount = manual || suggested;
      if (amount <= 0) return;

      desired.push({
        category_code: categoryCode,
        amount: String(amount),
      });
    });

    customItems.forEach((item) => {
      if (!item.checked) return;
      const amount = parseMoney(item.userPrice);
      if (amount <= 0) return;
      desired.push({
        category_code: "custom",
        category_name: item.name,
        amount: String(amount),
      });
    });

    const existing = await listExpenses(initData);
    for (const expense of existing) {
      await deleteExpense(initData, expense.id);
    }

    for (const item of desired) {
      await createExpense(initData, item);
    }
  };

  const runAutoSync = async () => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;

    try {
      while (pendingSyncRef.current) {
        const payload = pendingSyncRef.current;
        pendingSyncRef.current = null;

        try {
          setSyncError(null);
          await syncExpensesToBackend(payload.estimateItems, payload.customItems);
          const calculated = await calculateLead(initData);
          setBackendTotal(Number.parseFloat(calculated.total_budget));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Ошибка синхронизации расходов";
          setSyncError(`Расходы не сохранены: ${message}`);
        }
      }
    } finally {
      syncInFlightRef.current = false;
    }
  };

  const scheduleAutoSync = (
    estimateItems: Record<string, { checked: boolean; userPrice: string }>,
    customItems: Array<{ id: string; name: string; checked: boolean; userPrice: string }>,
  ) => {
    if (!hasLead || !initData) return;

    pendingSyncRef.current = { estimateItems, customItems };
    void runAutoSync();
  };

  const formattedWeddingDate = useMemo(() => {
    if (!savedQualification) return undefined;
    if (savedQualification.dateUndecided) {
      return savedQualification.dateSeason || "Не определена";
    }
    if (!savedQualification.date) return undefined;

    const parsed = parseDateOnly(savedQualification.date);
    if (!parsed) {
      return savedQualification.date;
    }

    return parsed.toLocaleDateString("ru-RU");
  }, [savedQualification]);

  const missingTelegramContext = !isTelegram || !initData;

  if (bootLoading) {
    return <div className="max-w-md mx-auto min-h-screen bg-background p-6 text-sm text-muted-foreground">Загрузка...</div>;
  }

  if (missingTelegramContext) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-background p-6 space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="text-lg font-semibold text-foreground">Откройте калькулятор внутри Telegram</div>
          <p className="text-sm text-muted-foreground">
            Приложение запущено вне Telegram Mini App. Нажмите кнопку ниже, чтобы открыть его корректно.
          </p>
          <a
            href={TELEGRAM_STARTAPP_URL}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#E6BF3A] px-4 text-sm font-medium text-black"
          >
            Открыть в Telegram
          </a>
          <div className="text-xs text-muted-foreground break-all">
            Если кнопка не сработала, откройте ссылку вручную: {TELEGRAM_STARTAPP_URL}
          </div>
        </div>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-background p-6 space-y-4">
        <div className="text-sm text-destructive">{bootError}</div>
        <button
          onClick={() => setBootstrapTick((x) => x + 1)}
          className="h-10 px-4 rounded-lg border border-border bg-card text-sm"
        >
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-background">
      <TelegramProfile user={user} />
      <AppHeader
        onBack={
          screen === "estimate"
            ? () => {
                setScreen("qualification");
              }
            : undefined
        }
        onSiteClick={() => reportUiAction("open_site_header", "app_header", "https://timurgromov.ru")}
      />
      {screen === "estimate" && (
        <ProfileProgress
          qualification={savedQualification}
          onFill={() => {
            setScreen("qualification");
          }}
        />
      )}
      {screen === "qualification" ? (
        <QualificationScreen
          savedData={savedQualification}
          onFooterSiteClick={() => reportUiAction("open_site_footer", "qualification_footer", "https://timurgromov.ru")}
          onFieldChange={(q) => {
            setSavedQualification(q);
            setGuests(q.guests);
            scheduleQualificationSync(q);
          }}
          onNext={async (data) => {
            const q = {
              role: data.role,
              city: data.city,
              date: formatDateOnly(data.date),
              guests: data.guests,
              venue: data.venue ?? "",
              venueName: data.venueName ?? "",
              dateUndecided: data.dateUndecided ?? false,
              dateSeason: data.dateSeason ?? "",
            };

            try {
              setSyncError(null);
              if (!initData) {
                throw new Error("Отсутствует Telegram initData");
              }

              cancelPendingQualificationSync();

              if (hasLeadRef.current) {
                await updateLead(initData, buildLeadPayload(q));
              } else {
                await createLead(initData, buildLeadPayload(q));
                hasLeadRef.current = true;
                setHasLead(true);
              }

              setGuests(data.guests);
              setSavedQualification(q);
              setScreen("estimate");
              window.scrollTo(0, 0);
            } catch (error) {
              const message = error instanceof Error ? error.message : "Ошибка сохранения профиля";
              setSyncError(message);
              toast.error(`Профиль не сохранён: ${message}`);
            }
          }}
        />
      ) : (
        <EstimateScreen
          guests={guests}
          role={savedQualification?.role}
          city={savedQualification?.city}
          weddingDate={formattedWeddingDate}
          venue={savedQualification?.venue}
          venueName={savedQualification?.venueName}
          savedItems={savedEstimate}
          savedCustomItems={savedCustomItems}
          backendTotal={backendTotal}
          syncError={syncError}
          onCopyEstimate={() => reportUiAction("copy_estimate", "estimate_copy_button")}
          onOnlineReviewClick={() => reportUiAction("view_online_review", "estimate_webinar_button", "https://timurgromov.ru/#webinar")}
          onFooterSiteClick={() => reportUiAction("open_site_footer", "estimate_footer", "https://timurgromov.ru")}
          onSave={(estimateItems, customItems) => {
            setSavedEstimate(estimateItems);
            setSavedCustomItems(customItems);
            scheduleAutoSync(estimateItems, customItems);
          }}
        />
      )}
    </div>
  );
};

export default Index;
