import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "success"
    | "warning"
    | "info"
    | "taken"
    | "cutting"
    | "stitching"
    | "trial"
    | "ready"
    | "delivered"
    | "cancelled";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantClasses = {
    default: "bg-gray-900 text-gray-50 hover:bg-gray-900/80 border-transparent",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-100/80 border-transparent",
    destructive: "bg-red-50 text-red-700 border-red-200/60 hover:bg-red-100/40",
    outline: "text-gray-900 border-gray-200 hover:bg-gray-50",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200/60 hover:bg-emerald-100/40",
    warning: "bg-amber-50 text-amber-700 border-amber-200/60 hover:bg-amber-100/40",
    info: "bg-sky-50 text-sky-700 border-sky-200/60 hover:bg-sky-100/40",
    
    // Status color-coding mapping
    taken: "bg-blue-50 text-blue-700 border-blue-200/60 hover:bg-blue-100/40",
    cutting: "bg-amber-50 text-amber-700 border-amber-200/60 hover:bg-amber-100/40",
    stitching: "bg-orange-50 text-orange-700 border-orange-200/60 hover:bg-orange-100/40",
    trial: "bg-purple-50 text-purple-700 border-purple-200/60 hover:bg-purple-100/40",
    ready: "bg-emerald-50 text-emerald-700 border-emerald-200/60 hover:bg-emerald-100/40",
    delivered: "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200/50",
    cancelled: "bg-red-50 text-red-700 border-red-200/60 hover:bg-red-100/40",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
