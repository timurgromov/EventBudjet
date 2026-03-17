import React from "react";
import { ArrowLeft } from "lucide-react";

interface AppHeaderProps {
  onBack?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onBack }) => {
  return (
    <div className="text-center pt-6 pb-3 px-5 relative">
      {onBack && (
        <button
          onClick={onBack}
          className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}
      <h1 className="text-3xl font-serif text-gold-gradient">Свадебный калькулятор</h1>
      <p className="text-[11px] text-muted-foreground/60 mt-1 italic tracking-wide">
        От{" "}
        <a
          href="https://timurgromov.ru"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-primary transition-colors"
        >
          Тимура Громова
        </a>
      </p>
      
    </div>
  );
};

export default AppHeader;
