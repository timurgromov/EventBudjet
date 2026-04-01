import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, Link2, Plus } from "lucide-react";
import { useState } from "react";
import { useOutletContext } from "react-router-dom";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  archiveAdminSource,
  createAdminSource,
  deleteAdminSource,
  listAdminSources,
  restoreAdminSource,
  type AdminLeadSourceItem,
} from "@/lib/api";
import { formatAdminDateTime } from "./admin-format";

interface AdminOutletContext {
  adminToken: string;
}

const FALLBACK_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? "gromov_wedding_bot";
const LEGACY_SOURCE_CODES = new Set(["telegram_mini_app", "calc"]);
type SourceFilter = "active" | "archived";

const buildSourceLink = (code: string): string => `https://t.me/${FALLBACK_BOT_USERNAME}?startapp=${encodeURIComponent(code)}`;

const AdminSourcesPage = () => {
  const { adminToken } = useOutletContext<AdminOutletContext>();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("active");
  const [deleteSource, setDeleteSource] = useState<AdminLeadSourceItem | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const query = useQuery({
    queryKey: ["admin-sources", adminToken],
    queryFn: () => listAdminSources(adminToken),
    enabled: adminToken.trim().length > 0,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createAdminSource(adminToken, {
        name: name.trim(),
        code: code.trim() || null,
        description: description.trim() || null,
      }),
    onSuccess: async (created) => {
      setStatus(`Источник создан: ${created.name} (${created.code})`);
      setName("");
      setCode("");
      setDescription("");
      await query.refetch();
    },
    onError: (error) => {
      setStatus(error instanceof Error ? `Ошибка: ${error.message}` : "Не удалось создать источник.");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (sourceId: number) => archiveAdminSource(adminToken, sourceId),
    onSuccess: async () => {
      setStatus("Источник отправлен в архив.");
      await query.refetch();
    },
    onError: (error) => {
      setStatus(error instanceof Error ? `Ошибка: ${error.message}` : "Не удалось архивировать источник.");
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (sourceId: number) => restoreAdminSource(adminToken, sourceId),
    onSuccess: async () => {
      setStatus("Источник восстановлен.");
      await query.refetch();
    },
    onError: (error) => {
      setStatus(error instanceof Error ? `Ошибка: ${error.message}` : "Не удалось восстановить источник.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (sourceId: number) => deleteAdminSource(adminToken, sourceId),
    onSuccess: async () => {
      setStatus("Источник удалён.");
      setDeleteSource(null);
      setDeleteConfirmText("");
      await query.refetch();
    },
    onError: (error) => {
      setStatus(error instanceof Error ? `Ошибка: ${error.message}` : "Не удалось удалить источник.");
    },
  });

  const handleCreate = () => {
    if (!name.trim()) {
      setStatus("Введите название источника.");
      return;
    }
    setStatus(null);
    createMutation.mutate();
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Ссылка скопирована.");
    } catch {
      setStatus("Не удалось скопировать ссылку.");
    }
  };

  if (!adminToken.trim()) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">
        Сохраните admin token, чтобы работать с источниками.
      </div>
    );
  }

  const allSources = query.data?.sources ?? [];
  const activeSources = allSources.filter((source) => !source.is_archived);
  const archivedSources = allSources.filter((source) => source.is_archived);
  const sourcesToShow = sourceFilter === "active" ? activeSources : archivedSources;
  const canDelete = deleteConfirmText.trim() === "DELETE";

  return (
    <div className="space-y-4">
      <AlertDialog
        open={Boolean(deleteSource)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteSource(null);
            setDeleteConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить источник?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие необратимо. Для подтверждения введите <span className="font-semibold text-slate-900">DELETE</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(event) => setDeleteConfirmText(event.target.value)}
            placeholder="Введите DELETE"
            className="mt-1"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canDelete || deleteMutation.isPending || !deleteSource}
              className="bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              onClick={(event) => {
                event.preventDefault();
                if (!deleteSource || !canDelete) return;
                deleteMutation.mutate(deleteSource.id);
              }}
            >
              {deleteMutation.isPending ? "Удаляю..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold text-slate-950">Источники</div>
        <div className="mt-1 text-sm text-slate-600">
          Создайте источник, и система сгенерирует ссылку для выдачи партнёрам/каналам.
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-xs font-medium text-slate-500">Название источника</div>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Например: Ведущий Иван Иванов"
                className="bg-slate-50"
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-slate-500">Код (необязательно)</div>
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Если пусто — сгенерируется автоматически"
                className="bg-slate-50"
              />
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">Комментарий (необязательно)</div>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Примечание по источнику"
              className="min-h-24 bg-slate-50"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            <Plus className="mr-2 h-4 w-4" />
            {createMutation.isPending ? "Создаю..." : "Создать источник"}
          </Button>
          {status ? <div className="text-xs text-slate-600">{status}</div> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold text-slate-950">Список источников</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            className={sourceFilter === "active" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}
            onClick={() => setSourceFilter("active")}
          >
            Активные ({activeSources.length})
          </Button>
          <Button
            size="sm"
            className={sourceFilter === "archived" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}
            onClick={() => setSourceFilter("archived")}
          >
            Архивные ({archivedSources.length})
          </Button>
        </div>
        {query.isLoading ? (
          <div className="mt-3 text-sm text-slate-600">Загружаю источники...</div>
        ) : query.isError ? (
          <div className="mt-3 text-sm text-rose-700">
            {query.error instanceof Error ? query.error.message : "Не удалось загрузить источники"}
          </div>
        ) : sourcesToShow.length === 0 ? (
          <div className="mt-3 text-sm text-slate-600">Пока нет источников.</div>
        ) : (
          <div className="mt-3 space-y-2">
            {sourcesToShow.map((source) => {
              const link = buildSourceLink(source.code);
              const isLegacy = LEGACY_SOURCE_CODES.has(source.code);
              const canHardDelete = source.leads_count === 0;
              return (
                <div key={source.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-950">
                        {source.name}
                        {isLegacy ? <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">legacy</span> : null}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        код: <span className="font-mono text-slate-700">{source.code}</span> • лидов: {source.leads_count}
                      </div>
                      {source.description ? <div className="mt-1 text-xs text-slate-600">{source.description}</div> : null}
                      <div className="mt-1 text-xs text-slate-500">создан: {formatAdminDateTime(source.created_at)}</div>
                    </div>
                    <div className="flex w-full max-w-xl flex-col gap-2 md:w-auto">
                      <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs text-slate-700">
                        {link}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                          onClick={() => void handleCopy(link)}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Копировать
                        </Button>
                        {!source.is_archived ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                            onClick={() => archiveMutation.mutate(source.id)}
                            disabled={archiveMutation.isPending}
                          >
                            В архив
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                            onClick={() => restoreMutation.mutate(source.id)}
                            disabled={restoreMutation.isPending}
                          >
                            Восстановить
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-800 disabled:opacity-50"
                          disabled={!canHardDelete}
                          onClick={() => {
                            setDeleteSource(source);
                            setDeleteConfirmText("");
                          }}
                        >
                          Удалить
                        </Button>
                        {!canHardDelete ? (
                          <div className="self-center text-[11px] text-slate-500">Удаление доступно только при 0 лидах</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        <div className="flex items-center gap-2 font-medium text-slate-800">
          <Link2 className="h-4 w-4" />
          Как это работает
        </div>
        <div className="mt-2">
          Клиент открывает ссылку источника → Telegram передаёт метку `startapp` → при создании лида источник сохраняется в карточке.
        </div>
      </section>
    </div>
  );
};

export default AdminSourcesPage;
