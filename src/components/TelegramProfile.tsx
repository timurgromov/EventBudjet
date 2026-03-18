import React, { useEffect, useState } from "react";
import type { TelegramUser } from "@/hooks/useTelegramUser";

interface TelegramProfileProps {
  user: TelegramUser | null;
}

const TelegramProfile: React.FC<TelegramProfileProps> = ({ user }) => {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const displayName = user
    ? user.username
      ? `@${user.username}`
      : user.first_name
    : "Гость";
  const avatarLetter = user?.first_name?.slice(0, 1).toUpperCase() ?? "👤";
  const avatarSrc = user?.photo_url || (user?.username ? `https://t.me/i/userpic/320/${user.username}.jpg` : null);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarSrc]);

  return (
    <div className="flex items-center gap-2.5 px-5 py-3 bg-card/50 border-b border-border">
      {avatarSrc && !avatarFailed ? (
        <img
          src={avatarSrc}
          alt={displayName}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
          referrerPolicy="no-referrer"
          onError={() => setAvatarFailed(true)}
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
          <span className="text-sm">{avatarLetter}</span>
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
        <p className="text-[11px] text-muted-foreground">Ваши расчёты сохраняются автоматически</p>
      </div>
    </div>
  );
};

export default TelegramProfile;
