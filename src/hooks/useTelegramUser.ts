import { useEffect, useState } from "react";

export interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initDataUnsafe: {
          user?: TelegramUser;
        };
        ready: () => void;
        expand: () => void;
        sendData: (data: string) => void;
      };
    };
  }
}

function getTelegramUser(): TelegramUser | null {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    const tgUser = tg.initDataUnsafe?.user;
    if (tgUser) {
      try {
        tg.sendData(JSON.stringify({
          event: "app_open",
          telegram_id: tgUser.id,
          first_name: tgUser.first_name,
          username: tgUser.username,
          timestamp: new Date().toISOString(),
        }));
      } catch {}
      return tgUser;
    }
  }
  return null;
}

const resolvedUser = getTelegramUser();

export function useTelegramUser(): TelegramUser | null {
  return resolvedUser;
}

export function getStorageKey(userId: number | null): string {
  return `wedding_calc_${userId ?? "guest"}`;
}
