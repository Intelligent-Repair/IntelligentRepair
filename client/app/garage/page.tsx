import React from "react";
import Link from "next/link";

export default function GaragePage() {
  const cards = [
    {
      title: "דשבורד ונתונים",
      icon: "📊",
      link: "/garage/dashboard",
    },
    {
      title: "איזור אישי",
      icon: "🧑‍🔧",
      link: "/garage/profile",
    },
    {
      title: "צ'אטים עם לקוחות",
      icon: "💬",
      link: "/garage/chats",
    },
    {
      title: "פניות לקוחות",
      icon: "📨",
      link: "/garage/requests",
    },
  ];

  return (
    <div className="bg-transparent text-white min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {cards.map((card, index) => (
            <Link
              key={index}
              href={card.link}
              className="
                bg-white/10
                backdrop-blur-xl
                border border-white/10
                rounded-3xl
                p-10
                text-white
                hover:bg-white/20
                transition-all duration-300
                hover:scale-105
                hover:shadow-2xl
                hover:shadow-[#4A90E2]/20
                flex flex-col
                items-center
                justify-center
                gap-4
                min-h-[280px]
                group
              "
            >
              <div className="text-6xl mb-2 group-hover:scale-110 transition-transform duration-300">
                {card.icon}
              </div>
              <h2 className="text-2xl font-bold text-center">{card.title}</h2>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
