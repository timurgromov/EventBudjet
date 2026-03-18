import { useMemo } from "react";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
  };
  ready: () => void;
  expand: () => void;
  sendData?: (data: string) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export interface TelegramContext {
  user: TelegramUser | null;
  initData: string;
  isTelegram: boolean;
}

function readTelegramContext(): TelegramContext {
  const tg = window.Telegram?.WebApp;
  if (!tg) {
    return { user: null, initData: "", isTelegram: false };
  }

  tg.ready();
  tg.expand();

  return {
    user: tg.initDataUnsafe?.user ?? null,
    initData: tg.initData ?? "",
    isTelegram: true,
  };
}

export function useTelegramContext(): TelegramContext {
  return useMemo(() => readTelegramContext(), []);
}

export function useTelegramUser(): TelegramUser | null {
  return useTelegramContext().user;
}

export function getStorageKey(userId: number | null): string {
  return `wedding_calc_${userId ?? "guest"}`;
}
