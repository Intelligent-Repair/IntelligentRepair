import React from "react";
import Link from "next/link";
import Image from "next/image";

export default function UserPage() {
  const cards = [
    {
      title: "פתיחת ייעוץ חדש",
      icon: "💡",
      link: "/consult",
    },
    {
      title: "האזור האישי",
      icon: "👤",
      link: "/user/profile",
    },
    {
      title: "השיחות שלי",
      icon: "💬",
      link: "/user/chats",
    },
    {
      title: "תחזוקה בקליק",
      icon: "🛠",
      link: "/maintenance",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 text-white">
      {/* Logo Section */}
      <div className="mb-12 flex justify-center">
        <Image
          src="/AppLogo2.png"
          alt="IntelligentRepair"
          width={400}
          height={200}
          priority
          className="w-[320px] md:w-[400px] h-auto drop-shadow-[0_0_36px_rgba(74,144,226,0.55)]"
        />
      </div>

      {/* Welcome Section */}
      <div className="text-center mb-12 max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">
          ברוך הבא למערכת IntelligentRepair
        </h1>
        <p className="text-lg md:text-xl text-white/80 leading-relaxed">
          פלטפורמה חכמה לניהול תיקונים, תחזוקה ושירותי רכב מתקדמים
        </p>
      </div>

      {/* Feature Grid */}
      <div className="w-full max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cards.map((card, index) => (
            <Link
              key={index}
              href={card.link}
              className="
                bg-black/20
                backdrop-blur-xl
                border border-white/10
                rounded-3xl
                p-10
                text-white
                hover:bg-black/30
                hover:border-[#4A90E2]/50
                transition-all duration-300
                hover:scale-[1.02]
                hover:shadow-2xl
                hover:shadow-[#4A90E2]/30
                flex flex-col
                items-center
                justify-center
                gap-4
                min-h-[240px]
                group
                relative
                overflow-hidden
              "
            >
              {/* Hover glow effect */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#4A90E2]/0 via-[#4A90E2]/0 to-[#4A90E2]/0 group-hover:from-[#4A90E2]/10 group-hover:via-[#4A90E2]/5 group-hover:to-[#4A90E2]/10 transition-all duration-300"></div>
              
              <div className="text-6xl mb-2 group-hover:scale-110 transition-transform duration-300 relative z-10">
                {card.icon}
              </div>
              <h2 className="text-2xl font-bold text-center relative z-10">
                {card.title}
              </h2>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
