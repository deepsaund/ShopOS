import React from "react";
import "./globals.css";
import SmoothScroll from "@/components/ui/smooth-scroll";

export const metadata = {
  title: "ShopOS CRM",
  description: "ShopOS Multi-Tenant SaaS CRM Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-slate-900">
      <body className="h-full antialiased text-slate-100 selection:bg-indigo-500 selection:text-white">
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
