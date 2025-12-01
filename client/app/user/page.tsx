"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lightbulb, User, MessageCircle, Wrench, LogOut } from "lucide-react";
import Logo from "@/ffc53cfd-5750-4bfc-8fcf-eeaa1b241560.png";

export default function UserPage() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      router.push("/");
    } catch (err) {
      console.error("Logout error:", err);
      router.push("/");
    }
  };

  const cards = [
    {
      title: "פתיחת ייעוץ חדש",
      subtitle: "קבל ייעוץ מקצועי לתקלות ברכב",
      icon: Lightbulb,
      link: "/consult",
    },
    {
      title: "האזור האישי",
      subtitle: "נהל את הפרופיל וההגדרות שלך",
      icon: User,
      link: "/user/profile",
    },
    {
      title: "השיחות שלי",
      subtitle: "צפה בהיסטוריית השיחות",
      icon: MessageCircle,
      link: "/user/chats",
    },
    {
      title: "תחזוקה בקליק",
      subtitle: "נהל תחזוקה ותזכורות",
      icon: Wrench,
      link: "/maintenance",
    },
    {
      title: "התנתקות",
      subtitle: "התנתק מהמערכת",
      icon: LogOut,
      onClick: handleLogout,
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
      },
    },
  };

  return (
    <div dir="rtl" className="min-h-screen flex flex-col items-center justify-center container mx-auto px-6 py-20 text-white">
      {/* Logo Section */}
      <div className="flex justify-center items-center mt-8 mb-6 w-full">
        <div className="flex justify-center items-center w-auto">
          <Image
            src={Logo}
            alt="IntelligentRepair Logo"
            className="w-[460px] max-w-none drop-shadow-[0_0_18px_rgba(255,255,255,0.45)] animate-fadeIn"
            priority
          />
        </div>
      </div>

      {/* Title Section */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="text-center mb-12"
      >
        <p className="text-white/70 text-center text-2xl mt-2 mb-10">
          A smart automotive service platform for modern repair centers
        </p>
      </motion.div>

      {/* Feature Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-6xl mx-auto"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card, index) => {
            const IconComponent = card.icon;
            const CardContent = (
              <>
                <div className="mb-4 group-hover:scale-110 transition-transform duration-300 relative z-10">
                  <IconComponent className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-xl font-bold text-center mb-2 relative z-10">
                  {card.title}
                </h2>
                <p className="text-sm text-white/60 text-center relative z-10">
                  {card.subtitle}
                </p>
              </>
            );

            if (card.onClick) {
              return (
                <motion.button
                  key={index}
                  variants={itemVariants}
                  onClick={card.onClick}
                  className="
                    bg-white/10
                    backdrop-blur-xl
                    border border-white/10
                    rounded-3xl
                    p-8
                    text-white
                    hover:bg-white/20
                    transition-all duration-300
                    hover:scale-105
                    shadow-xl shadow-black/40
                    flex flex-col
                    items-center
                    justify-center
                    gap-3
                    min-h-[200px]
                    group
                    relative
                    overflow-hidden
                    cursor-pointer
                    w-full
                  "
                >
                  {CardContent}
                </motion.button>
              );
            }

            return (
              <motion.div key={index} variants={itemVariants}>
                <Link
                  href={card.link!}
                  className="
                    bg-white/10
                    backdrop-blur-xl
                    border border-white/10
                    rounded-3xl
                    p-8
                    text-white
                    hover:bg-white/20
                    transition-all duration-300
                    hover:scale-105
                    shadow-xl shadow-black/40
                    flex flex-col
                    items-center
                    justify-center
                    gap-3
                    min-h-[200px]
                    group
                    relative
                    overflow-hidden
                    block
                  "
                >
                  {CardContent}
                </Link>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
