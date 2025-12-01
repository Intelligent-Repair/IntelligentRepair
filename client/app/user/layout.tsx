"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface UserLayoutProps {
  children: React.ReactNode;
}

export default function UserLayout({ children }: UserLayoutProps) {
  const pathname = usePathname();
  const isHomePage = pathname === "/user";

  const menu = [
    { name: "היסטוריית פניות", href: "/user/dashboard" },
    { name: "היסטוריית טיפולים", href: "/user/repairs" },
    { name: "פרטים אישיים", href: "/user/profile" },
    { name: "הגדרות", href: "/user/settings" },
  ];

  // If on home page, render children full-screen without sidebar/header
  if (isHomePage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1120] via-[#0f1a2e] to-[#0a1120]">
        {children}
      </div>
    );
  }

  // Otherwise, render with sidebar and header
  return (
    <div className="min-h-screen flex bg-gradient-to-br from-[#0a1120] via-[#0f1a2e] to-[#0a1120]">
      {/* Sidebar - Dark Glassmorphism */}
      <aside className="w-64 bg-black/20 backdrop-blur-xl border-r border-white/10 shadow-2xl p-6 flex flex-col gap-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-1">האזור האישי</h2>
          <div className="h-1 w-12 bg-gradient-to-r from-[#4A90E2] to-transparent rounded-full"></div>
        </div>

        <nav className="flex flex-col gap-2">
          {menu.map((item) => {
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative p-3 rounded-xl block font-medium transition-all duration-300 ${
                  isActive
                    ? "bg-[#4A90E2]/20 text-white shadow-lg shadow-[#4A90E2]/30 ring-1 ring-[#4A90E2]/50"
                    : "text-white/70 hover:text-white hover:bg-white/5 hover:shadow-md hover:shadow-white/5"
                }`}
              >
                {isActive && (
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#4A90E2]/10 to-transparent blur-sm"></div>
                )}
                <span className="relative z-10">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Sticky Header */}
        <header className="sticky top-0 z-10 bg-black/10 backdrop-blur-xl border-b border-white/10 shadow-lg px-8 py-4">
          <h1 className="text-2xl font-bold text-white">האזור האישי</h1>
        </header>

        {/* Content Container */}
        <div className="flex-1 p-6">
          <div className="h-full bg-black/10 backdrop-blur-md rounded-3xl border border-white/15 shadow-2xl p-8 text-white">
            <div className="text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_h4]:text-white [&_h5]:text-white [&_h6]:text-white [&_p]:text-white/90 [&_span]:text-white [&_label]:text-white [&_li]:text-white [&_td]:text-white [&_th]:text-white">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
