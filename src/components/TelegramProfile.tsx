import React from "react";
import type { TelegramUser } from "@/hooks/useTelegramUser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TelegramProfileProps {
  user: TelegramUser | null;
}

function isTelegramPlaceholderPhoto(url: string | undefined): boolean {
  if (!url) return true;
  return /\/i\/userpic\/|\/userpic\//i.test(url);
}

const TelegramProfile: React.FC<TelegramProfileProps> = ({ user }) => {
  const displayName = user
    ? user.username
      ? `@${user.username}`
      : user.first_name
    : "Гость";
  const photoUrl = user?.photo_url?.trim();
  const showTelegramPhoto = Boolean(photoUrl) && !isTelegramPlaceholderPhoto(photoUrl);

  return (
    <div className="flex items-center gap-2.5 px-5 py-3 bg-card/50 border-b border-border">
      <Avatar className="h-8 w-8 flex-shrink-0">
        {showTelegramPhoto ? (
          <AvatarImage
            src={photoUrl}
            alt={displayName}
            referrerPolicy="no-referrer"
            className="object-cover"
          />
        ) : null}
        <AvatarFallback className="border border-[#D8B26A]/30 bg-[#16131C] shadow-[0_0_18px_rgba(216,178,106,0.12)]">
          <img
            src="/logo-tree-icon.png"
            alt="Логотип свадебного калькулятора"
            className="h-full w-full object-cover"
          />
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
        <p className="text-[11px] text-muted-foreground">Ваши расчёты сохраняются автоматически</p>
      </div>
    </div>
  );
};

export default TelegramProfile;
