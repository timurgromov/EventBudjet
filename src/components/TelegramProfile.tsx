import React from "react";
import type { TelegramUser } from "@/hooks/useTelegramUser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TelegramProfileProps {
  user: TelegramUser | null;
}

function getAvatarInitials(user: TelegramUser | null): string {
  if (!user) {
    return "TG";
  }

  const first = user.first_name?.trim().charAt(0) ?? "";
  const last = user.last_name?.trim().charAt(0) ?? "";

  if (first && last) {
    return `${first}${last}`.toUpperCase();
  }

  if (first) {
    return user.first_name.trim().slice(0, 2).toUpperCase();
  }

  if (user.username) {
    return user.username.trim().slice(0, 2).toUpperCase();
  }

  return "TG";
}

const TelegramProfile: React.FC<TelegramProfileProps> = ({ user }) => {
  const displayName = user
    ? user.username
      ? `@${user.username}`
      : user.first_name
    : "Гость";
  const avatarInitials = getAvatarInitials(user);

  return (
    <div className="flex items-center gap-2.5 px-5 py-3 bg-card/50 border-b border-border">
      <Avatar className="h-8 w-8 flex-shrink-0">
        {user?.photo_url ? (
          <AvatarImage
            src={user.photo_url}
            alt={displayName}
            referrerPolicy="no-referrer"
            className="object-cover"
          />
        ) : null}
        <AvatarFallback className="border border-[#D8B26A]/30 bg-[#16131C] text-[#D8B26A] text-[12px] font-semibold tracking-[0.08em] shadow-[0_0_18px_rgba(216,178,106,0.12)]">
          {avatarInitials}
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
