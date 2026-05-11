import { CircleCheck } from "lucide-react";

import { toast } from "@/components/ui/sonner";

interface AdminSuccessToastOptions {
  title: string;
  description?: string;
}

export const showAdminSuccessToast = ({ title, description }: AdminSuccessToastOptions) => {
  toast.custom(
    () => (
      <div className="w-[min(560px,calc(100vw-32px))] animate-in rounded-3xl border-2 border-emerald-200 bg-gradient-to-r from-emerald-500 to-green-500 px-6 py-5 text-white shadow-[0_24px_70px_rgba(16,185,129,0.42)] slide-in-from-top-6 zoom-in-95">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/35">
            <CircleCheck className="h-8 w-8 text-white" />
          </div>
          <div>
            <div className="text-xl font-semibold leading-tight">{title}</div>
            {description ? <div className="mt-1 text-sm font-medium text-emerald-50">{description}</div> : null}
          </div>
        </div>
      </div>
    ),
    {
      className: "!border-0 !bg-transparent !p-0 !shadow-none",
      duration: 3200,
      position: "top-center",
    },
  );
};
