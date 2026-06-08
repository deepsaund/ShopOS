import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variantClasses = {
      default: "bg-violet-600 text-white shadow-sm hover:bg-violet-700 active:bg-violet-800 focus-visible:ring-violet-500",
      secondary: "bg-gray-100 text-gray-900 shadow-sm hover:bg-gray-200/80 active:bg-gray-200 focus-visible:ring-gray-400",
      outline: "border border-gray-200 bg-white shadow-sm hover:bg-gray-50 active:bg-gray-100 focus-visible:ring-gray-300",
      ghost: "hover:bg-gray-50 text-gray-700 active:bg-gray-100",
      link: "text-violet-600 underline-offset-4 hover:underline",
      destructive: "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500",
    };

    const sizeClasses = {
      default: "h-9 px-4 py-2",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-10 rounded-md px-8",
      icon: "h-9 w-9",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
