import React, { useState, useEffect } from "react";
import QualificationScreen from "@/components/QualificationScreen";
import EstimateScreen from "@/components/EstimateScreen";
import TelegramProfile from "@/components/TelegramProfile";
import AppHeader from "@/components/AppHeader";
import ProfileProgress from "@/components/ProfileProgress";
import { useTelegramUser, getStorageKey } from "@/hooks/useTelegramUser";

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

const Index = () => {
  const user = useTelegramUser();
  const [screen, setScreen] = useState<"qualification" | "estimate">("qualification");
  const [guests, setGuests] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [savedEstimate, setSavedEstimate] = useState<SavedData["estimateItems"]>();
  const [savedCustomItems, setSavedCustomItems] = useState<SavedData["customItems"]>();
  const [savedQualification, setSavedQualification] = useState<SavedData["qualification"]>();

  // Load saved data
  useEffect(() => {
    const key = getStorageKey(user?.id ?? null);
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const data: SavedData = JSON.parse(raw);
        setScreen(data.screen);
        setGuests(data.guests);
        if (data.estimateItems) setSavedEstimate(data.estimateItems);
        if (data.customItems) setSavedCustomItems(data.customItems);
        if (data.qualification) setSavedQualification(data.qualification);
      }
    } catch {}
    setLoaded(true);
  }, [user]);

  const saveData = (data: Partial<SavedData>) => {
    const key = getStorageKey(user?.id ?? null);
    try {
      const existing = JSON.parse(localStorage.getItem(key) || "{}");
      localStorage.setItem(key, JSON.stringify({ ...existing, ...data }));
    } catch {}
  };

  if (!loaded) return null;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-background">
      <TelegramProfile user={user} />
      <AppHeader onBack={screen === "estimate" ? () => {
        setScreen("qualification");
        saveData({ screen: "qualification" });
        const key = getStorageKey(user?.id ?? null);
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const data: SavedData = JSON.parse(raw);
            if (data.qualification) setSavedQualification(data.qualification);
          }
        } catch {}
      } : undefined} />
      {screen === "estimate" && (
        <ProfileProgress
          qualification={savedQualification}
          onFill={() => {
            setScreen("qualification");
            saveData({ screen: "qualification" });
          }}
        />
      )}
      {screen === "qualification" ? (
        <QualificationScreen
          savedData={savedQualification}
          onFieldChange={(q) => saveData({ qualification: q, guests: q.guests })}
          onNext={(data) => {
            const q = {
              role: data.role,
              city: data.city,
              date: data.date?.toISOString() ?? "",
              guests: data.guests,
              venue: data.venue ?? "",
              venueName: data.venueName ?? "",
              dateUndecided: data.dateUndecided ?? false,
              dateSeason: data.dateSeason ?? "",
            };
            setGuests(data.guests);
            setSavedQualification(q);
            setScreen("estimate");
            window.scrollTo(0, 0);
            saveData({ screen: "estimate", guests: data.guests, qualification: q });
          }}
        />
      ) : (
        <EstimateScreen
          guests={guests}
          city={savedQualification?.city}
          weddingDate={savedQualification?.dateUndecided
            ? (savedQualification?.dateSeason || "Не определена")
            : (savedQualification?.date ? new Date(savedQualification.date).toLocaleDateString("ru-RU") : undefined)}
          savedItems={savedEstimate}
          savedCustomItems={savedCustomItems}
          onSave={(estimateItems, customItems) => saveData({ estimateItems, customItems })}
        />
      )}
    </div>
  );
};

export default Index;
