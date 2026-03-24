import React, { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateOnly, parseDateOnly } from "@/lib/date";
import { cn } from "@/lib/utils";

interface QualificationData {
  role: string;
  city: string;
  date: Date | undefined;
  guests: number;
  venue?: string;
  venueName?: string;
  dateUndecided?: boolean;
  dateSeason?: string;
}

interface QualificationScreenProps {
  onNext: (data: QualificationData) => void;
  onFooterSiteClick?: () => void;
  savedData?: {
    role?: string;
    city?: string;
    date?: string;
    guests?: number;
    venue?: string;
    venueName?: string;
    dateUndecided?: boolean;
    dateSeason?: string;
  };
  onFieldChange?: (data: {
    role: string;
    city: string;
    date: string;
    guests: number;
    venue: string;
    venueName: string;
    dateUndecided: boolean;
    dateSeason: string;
  }) => void;
}

const roles = [
  { value: "bride", label: "Невеста", emoji: "👰" },
  { value: "groom", label: "Жених", emoji: "🤵" },
  { value: "mother", label: "Мама", emoji: "💐" },
  { value: "pro", label: "Свадебный специалист", emoji: "⭐" },
];

const cities = [
  { value: "moscow", label: "Москва" },
  { value: "mo", label: "МО" },
  { value: "region", label: "Другой регион" },
];

const seasons = [
  { value: "spring", label: "Весна" },
  { value: "summer", label: "Лето" },
  { value: "autumn", label: "Осень" },
  { value: "winter", label: "Зима" },
  { value: "next_year", label: "В следующем году" },
];

const QualificationScreen: React.FC<QualificationScreenProps> = ({ onNext, savedData, onFieldChange, onFooterSiteClick }) => {
  const [role, setRole] = useState(savedData?.role ?? "");
  const [city, setCity] = useState(savedData?.city ?? "");
  const [date, setDate] = useState<Date | undefined>(parseDateOnly(savedData?.date));
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [guests, setGuests] = useState<number>(savedData?.guests ?? 0);
  const [venue, setVenue] = useState(savedData?.venue ?? "");
  const [venueName, setVenueName] = useState(savedData?.venueName ?? "");
  const [dateUndecided, setDateUndecided] = useState(savedData?.dateUndecided ?? false);
  const [dateSeason, setDateSeason] = useState(savedData?.dateSeason ?? "");

  const notifyChange = (updates: Partial<{
    role: string; city: string; date: Date | undefined; guests: number;
    venue: string; venueName: string; dateUndecided: boolean; dateSeason: string;
  }>) => {
    const r = updates.role ?? role;
    const c = updates.city ?? city;
    const d = updates.date !== undefined ? updates.date : date;
    const g = updates.guests ?? guests;
    const v = updates.venue ?? venue;
    const vn = updates.venueName ?? venueName;
    const du = updates.dateUndecided ?? dateUndecided;
    const ds = updates.dateSeason ?? dateSeason;
    onFieldChange?.({
      role: r, city: c, date: formatDateOnly(d), guests: g,
      venue: v, venueName: vn, dateUndecided: du, dateSeason: ds,
    });
  };

  const hasDate = dateUndecided ? !!dateSeason : !!date;
  const trimmedVenueName = venueName.trim();
  const isVenueNameRequired = venue === "chosen";
  const hasValidVenue = venue === "searching" || (venue === "chosen" && trimmedVenueName.length > 0);
  const showVenueNameError = isVenueNameRequired && trimmedVenueName.length === 0;
  const isValid = Boolean(role && city && hasDate && guests > 0 && hasValidVenue);
  const guestsInputValue = guests > 0 ? String(guests) : "";

  const parseGuestsInput = (raw: string): number => {
    const digitsOnly = raw.replace(/\D/g, "");
    if (!digitsOnly) return 0;
    const normalized = digitsOnly.replace(/^0+/, "");
    if (!normalized) return 0;
    return Number.parseInt(normalized, 10);
  };

  return (
    <div className="min-h-screen flex flex-col px-5 py-8">

      {/* Role */}
      <div className="mb-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
        <label className="block text-sm text-muted-foreground mb-3 font-medium">Кто вы?</label>
        <div className="grid grid-cols-2 gap-2">
          {roles.map((r) => (
            <button
              key={r.value}
              onClick={() => { setRole(r.value); notifyChange({ role: r.value }); }}
              className={cn(
                "flex items-center gap-2 p-3 rounded-lg border transition-all duration-200 text-sm",
                role === r.value
                  ? "border-primary bg-primary/10 text-foreground glow-gold"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30"
              )}
            >
              <span className="text-lg">{r.emoji}</span>
              <span>{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* City */}
      <div className="mb-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
        <label className="block text-sm text-muted-foreground mb-3 font-medium">Город</label>
        <div className="flex gap-2">
          {cities.map((c) => (
            <button
              key={c.value}
              onClick={() => { setCity(c.value); notifyChange({ city: c.value }); }}
              className={cn(
                "flex-1 p-3 rounded-lg border transition-all duration-200 text-sm",
                city === c.value
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Venue */}
      <div className="mb-6 animate-fade-in" style={{ animationDelay: "0.25s" }}>
        <label className="block text-sm text-muted-foreground mb-3 font-medium">Площадка</label>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => { setVenue("chosen"); notifyChange({ venue: "chosen" }); }}
            className={cn(
              "flex-1 p-3 rounded-lg border transition-all duration-200 text-sm",
              venue === "chosen"
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/30"
            )}
          >
            Уже выбрали
          </button>
          <button
            onClick={() => { setVenue("searching"); setVenueName(""); notifyChange({ venue: "searching", venueName: "" }); }}
            className={cn(
              "flex-1 p-3 rounded-lg border transition-all duration-200 text-sm",
              venue === "searching"
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/30"
            )}
          >
            Пока выбираем
          </button>
        </div>
        {venue === "chosen" && (
          <>
            <input
              type="text"
              value={venueName}
              onChange={(e) => { setVenueName(e.target.value); notifyChange({ venueName: e.target.value }); }}
              placeholder="Название площадки"
              className={cn(
                "w-full h-12 rounded-lg bg-card border px-3 text-base md:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none",
                showVenueNameError
                  ? "border-destructive focus:border-destructive"
                  : "border-border focus:border-primary"
              )}
            />
            {showVenueNameError && (
              <p className="mt-2 text-sm text-destructive">
                Укажи название площадки, чтобы рассчитать бюджет.
              </p>
            )}
          </>
        )}
      </div>

      {/* Date */}
      <div className="mb-6 animate-fade-in" style={{ animationDelay: "0.3s" }}>
        <label className="block text-sm text-muted-foreground mb-3 font-medium">Дата свадьбы</label>

        {!dateUndecided && (
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal bg-card border-border h-12",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                {date ? format(date, "d MMMM yyyy", { locale: ru }) : "Выберите дату"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => {
                  setDate(d);
                  notifyChange({ date: d });
                  if (d) {
                    setIsDatePickerOpen(false);
                  }
                }}
                locale={ru}
                initialFocus
                className="p-3 pointer-events-auto"
                disabled={(d) => d < new Date()}
              />
            </PopoverContent>
          </Popover>
        )}

        <div
          onClick={() => {
            const next = !dateUndecided;
            setDateUndecided(next);
            if (next) { setDate(undefined); notifyChange({ dateUndecided: next, date: undefined }); }
            else { setDateSeason(""); notifyChange({ dateUndecided: next, dateSeason: "" }); }
          }}
          className="flex items-center gap-2 mt-3 cursor-pointer"
        >
          <div
            className={cn(
              "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all",
              dateUndecided ? "bg-primary border-primary" : "border-muted-foreground/30"
            )}
          >
            {dateUndecided && (
              <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <span className="text-sm text-muted-foreground">Пока не определились</span>
        </div>

        {dateUndecided && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            {seasons.map((s) => (
              <button
                key={s.value}
                onClick={() => { setDateSeason(s.value); notifyChange({ dateSeason: s.value }); }}
                className={cn(
                  "p-3 rounded-lg border transition-all duration-200 text-sm",
                  dateSeason === s.value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/30",
                  s.value === "next_year" && "col-span-2"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Guests */}
      <div className="mb-10 animate-fade-in" style={{ animationDelay: "0.4s" }}>
        <label className="block text-sm text-muted-foreground mb-3 font-medium">Количество гостей</label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { const g = Math.max(0, guests - 5); setGuests(g); notifyChange({ guests: g }); }}
            className="w-12 h-12 rounded-lg bg-card border border-border flex items-center justify-center text-foreground text-lg hover:border-primary/30 transition-colors"
          >
            −
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={guestsInputValue}
            onChange={(e) => {
              const g = parseGuestsInput(e.target.value);
              setGuests(g);
              notifyChange({ guests: g });
            }}
            placeholder="0"
            className="flex-1 h-12 rounded-lg bg-card border border-border text-center text-xl font-serif text-foreground focus:outline-none focus:border-primary"
          />
          <button
            onClick={() => { const g = guests + 5; setGuests(g); notifyChange({ guests: g }); }}
            className="w-12 h-12 rounded-lg bg-card border border-border flex items-center justify-center text-foreground text-lg hover:border-primary/30 transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-auto animate-fade-in" style={{ animationDelay: "0.5s" }}>
        <Button
          onClick={() => isValid && onNext({ role, city, date, guests, venue, venueName: trimmedVenueName, dateUndecided, dateSeason })}
          disabled={!isValid}
          className="w-full h-14 text-base font-medium gradient-gold text-primary-foreground rounded-xl disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale"
        >
          Рассчитать бюджет
          <ChevronRight className="w-5 h-5 ml-1" />
        </Button>
      </div>

      {/* Footer */}
      <div className="text-center py-4 text-[10px] text-muted-foreground/40 tracking-wide">
        © Тимур Громов •{" "}
        <a
          href="https://timurgromov.ru"
          target="_blank"
          rel="noopener noreferrer"
          onClick={onFooterSiteClick}
          className="underline underline-offset-2 hover:text-primary transition-colors"
        >
          timurgromov.ru
        </a>
      </div>
    </div>
  );
};

export default QualificationScreen;
