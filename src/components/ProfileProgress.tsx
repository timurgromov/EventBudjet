import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, ClipboardList } from "lucide-react";

interface ProfileProgressProps {
  qualification?: {
    role?: string;
    city?: string;
    guests?: number;
    date?: string;
    venue?: string;
    venueName?: string;
    dateUndecided?: boolean;
    dateSeason?: string;
  };
  onFill: () => void;
}

const paramLabels: Array<{ key: string; label: string; check: (q: NonNullable<ProfileProgressProps["qualification"]>) => boolean }> = [
  { key: "city", label: "город", check: (q) => !!q.city },
  { key: "role", label: "кто вы", check: (q) => !!q.role },
  { key: "guests", label: "количество гостей", check: (q) => !!q.guests && q.guests > 0 },
  { key: "date", label: "дата", check: (q) => !q.dateUndecided && !!q.date },
  { key: "venue", label: "площадка", check: (q) => q.venue === "chosen" && !!q.venueName },
];

const SegmentedProgress: React.FC<{ filled: number; total: number }> = ({ filled, total }) => {
  const [animatedFilled, setAnimatedFilled] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => setAnimatedFilled(filled), 100);
    return () => clearTimeout(timeout);
  }, [filled]);

  return (
    <div className="flex gap-1 mb-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors duration-700 ease-out ${
            i < animatedFilled ? "bg-primary" : "bg-secondary"
          }`}
        />
      ))}
    </div>
  );
};

const ProfileProgress: React.FC<ProfileProgressProps> = ({ qualification, onFill }) => {
  const q = qualification || {};
  const filled = paramLabels.filter((p) => p.check(q as any)).length;
  const total = paramLabels.length;
  const missing = paramLabels.filter((p) => !p.check(q as any)).map((p) => p.label);

  if (filled >= total) return null;

  return (
    <div className="mx-4 mb-3 rounded-xl border border-border bg-card px-4 py-2.5 animate-fade-in">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <ClipboardList className="w-4 h-4 text-muted-foreground" />
          Профиль свадьбы
        </span>
        <span className="text-xs text-muted-foreground">{filled} / {total}</span>
      </div>
      <SegmentedProgress filled={filled} total={total} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Не указаны: {missing.join(" и ")}
        </p>
        <Button
          onClick={onFill}
          variant="ghost"
          size="sm"
          className="h-7 px-3 text-xs text-primary hover:bg-primary/10 shrink-0"
        >
          Заполнить
          <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
        </Button>
      </div>
    </div>
  );
};

export default ProfileProgress;
