import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  text: string;
  position?: "top" | "bottom" | "right";
  className?: string;
}

export function InfoTooltip({ text, position = "top", className }: InfoTooltipProps) {
  const pos = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  }[position];

  const arrow = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-slate-800/95 border-x-transparent border-b-transparent border-4",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-slate-800/95 border-x-transparent border-t-transparent border-4",
    right: "right-full top-1/2 -translate-y-1/2 border-r-slate-800/95 border-y-transparent border-l-transparent border-4",
  }[position];

  return (
    <span className={cn("group relative inline-flex items-center", className)}>
      {/* Icon */}
      <span className="flex h-4 w-4 cursor-default items-center justify-center rounded-full border border-slate-700/60 bg-slate-800/60 text-[9px] font-bold text-slate-500 transition-all duration-150 group-hover:border-blue-500/40 group-hover:bg-blue-500/10 group-hover:text-blue-400">
        i
      </span>

      {/* Tooltip bubble */}
      <span
        className={cn(
          "pointer-events-none absolute z-50 w-56 rounded-xl px-3 py-2.5",
          "bg-slate-800/95 border border-slate-700/60 backdrop-blur-xl shadow-2xl",
          "text-[11px] leading-relaxed text-slate-300",
          "opacity-0 scale-95 transition-all duration-200",
          "group-hover:opacity-100 group-hover:scale-100",
          pos
        )}
      >
        {text}
        {/* Arrow */}
        <span className={cn("absolute border", arrow)} />
      </span>
    </span>
  );
}
