import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, Link2, Plus } from "lucide-react";
import { useState } from "react";
import { useOutletContext } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createAdminSource, listAdminSources } from "@/lib/api";
import { formatAdminDateTime } from "./admin-format";

interface AdminOutletContext {
  adminToken: string;
}

const FALLBACK_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? "gromov_wedding_bot";
const LEGACY_SOURCE_CODES = new Set(["telegram_mini_app", "calc"]);

const buildSourceLink = (code: string): string => `https://t.me/${FALLBACK_BOT_USERNAME}?startapp=${encodeURIComponent(code)}`;

const AdminSourcesPage = () => {
  const { adminToken } = useOutletContext<AdminOutletContext>();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string | null>(null);

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
  const activeSources = allSources.filter((source) => !LEGACY_SOURCE_CODES.has(source.code));
  const legacySources = allSources.filter((source) => LEGACY_SOURCE_CODES.has(source.code));

  return (
    <div className="space-y-4">
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
        {query.isLoading ? (
          <div className="mt-3 text-sm text-slate-600">Загружаю источники...</div>
        ) : query.isError ? (
          <div className="mt-3 text-sm text-rose-700">
            {query.error instanceof Error ? query.error.message : "Не удалось загрузить источники"}
          </div>
        ) : activeSources.length === 0 ? (
          <div className="mt-3 text-sm text-slate-600">Пока нет источников.</div>
        ) : (
          <div className="mt-3 space-y-2">
            {activeSources.map((source) => {
              const link = buildSourceLink(source.code);
              return (
                <div key={source.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-950">{source.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        код: <span className="font-mono text-slate-700">{source.code}</span> • лидов: {source.leads_count}
                      </div>
                      {source.description ? <div className="mt-1 text-xs text-slate-600">{source.description}</div> : null}
                      <div className="mt-1 text-xs text-slate-500">создан: {formatAdminDateTime(source.created_at)}</div>
                    </div>
                    <div className="flex w-full max-w-xl items-center gap-2 md:w-auto">
                      <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs text-slate-700">
                        {link}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                        onClick={() => void handleCopy(link)}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Копировать
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {legacySources.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-700">Исторические источники (legacy)</div>
          <div className="mt-1 text-xs text-slate-500">
            Эти источники оставлены для истории и совместимости старых ссылок.
          </div>
          <div className="mt-3 space-y-2">
            {legacySources.map((source) => (
              <div key={`legacy-${source.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-sm font-medium text-slate-900">{source.name}</div>
                <div className="mt-1 text-xs text-slate-500">
                  код: <span className="font-mono text-slate-700">{source.code}</span> • лидов: {source.leads_count}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
