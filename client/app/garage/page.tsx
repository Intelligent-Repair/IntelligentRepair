"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BarChart3, User, Inbox, LogOut, ChevronLeft } from "lucide-react";
import Logo from "@/ffc53cfd-5750-4bfc-8fcf-eeaa1b241560.png";

export default function GaragePage() {
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 relative overflow-hidden text-slate-200">

      {/* רקע דקורטיבי (Ambient Light) */}
      <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-[100px] pointer-events-none" />

      {/* אזור הלוגו */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-12 relative z-10 text-center"
      >
        <div className="flex justify-center mb-3">
          <Image
            src={Logo}
            alt="IntelligentRepair Logo"
            className="w-[380px] max-w-none drop-shadow-[0_0_25px_rgba(59,130,246,0.3)]"
            priority
          />
        </div>
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-gradient-to-r from-blue-100 to-slate-300 bg-clip-text text-transparent text-lg md:text-xl font-medium tracking-wide"
        >
          ממשק ניהול מוסך - שירות חכם ויעיל
        </motion.p>
      </motion.div>

      {/* הקונטיינר הראשי של הכרטיסים */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-5xl flex flex-col gap-5 relative z-10"
      >

        {/* ======================================================== */}
        {/* 🌟 חלק עליון: 2 כרטיסים ראשיים (גריד) */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* 1. דשבורד ונתונים */}
          <motion.div variants={itemVariants}>
            <Link href="/garage/dashboard" className="block group">
              <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-r from-blue-600 to-indigo-600 p-[1px] shadow-[0_15px_40px_-12px_rgba(37,99,235,0.4)] hover:shadow-[0_15px_50px_-12px_rgba(37,99,235,0.6)] transition-shadow duration-500">
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative h-full bg-[#0f172a]/80 backdrop-blur-xl rounded-[23px] p-6 flex items-center gap-5 group-hover:bg-[#0f172a]/60 transition-colors duration-300">
                  <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform duration-500">
                    <BarChart3 size={32} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-white mb-1">דשבורד ונתונים</h2>
                    <p className="text-slate-400 text-sm">צפה בנתונים וסטטיסטיקות</p>
                  </div>
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/20 text-white group-hover:bg-white group-hover:text-blue-600 transition-all duration-300">
                    <ChevronLeft size={20} />
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>

          {/* 2. פניות לקוחות */}
          <motion.div variants={itemVariants}>
            <Link href="/garage/requests" className="block group">
              <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-r from-blue-600 to-indigo-600 p-[1px] shadow-[0_15px_40px_-12px_rgba(37,99,235,0.4)] hover:shadow-[0_15px_50px_-12px_rgba(37,99,235,0.6)] transition-shadow duration-500">
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative h-full bg-[#0f172a]/80 backdrop-blur-xl rounded-[23px] p-6 flex items-center gap-5 group-hover:bg-[#0f172a]/60 transition-colors duration-300">
                  <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform duration-500 relative">
                    <Inbox size={32} className="text-white" />
                    {/* נקודה ירוקה שמראה פעילות */}
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-400 animate-pulse border-2 border-[#0f172a]" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-white mb-1">פניות לקוחות</h2>
                    <p className="text-slate-400 text-sm">צפה וטפל בפניות לקוחות</p>
                  </div>
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/20 text-white group-hover:bg-white group-hover:text-blue-600 transition-all duration-300">
                    <ChevronLeft size={20} />
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        </div>

        {/* ======================================================== */}
        {/* 👇 חלק תחתון: 2 כרטיסים משניים (גריד) */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* 1. האזור האישי */}
          <motion.div variants={itemVariants}>
            <Link href="/garage/profile" className="group relative overflow-hidden rounded-[24px] bg-[#1e293b]/50 border border-slate-700/50 backdrop-blur-md p-6 flex items-center gap-5 hover:bg-[#1e293b] hover:border-blue-500/30 transition-all duration-300 hover:-translate-y-1 block h-full">
              <div className="p-4 bg-slate-800 rounded-xl group-hover:bg-blue-600/20 transition-colors shadow-inner">
                <User size={28} className="text-blue-400 group-hover:text-blue-300" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-200 group-hover:text-white">האזור האישי</h3>
                <p className="text-sm text-slate-500 group-hover:text-slate-400">ניהול פרופיל והגדרות</p>
              </div>
            </Link>
          </motion.div>

          {/* 2. התנתקות */}
          <motion.button
            variants={itemVariants}
            onClick={handleLogout}
            className="group relative overflow-hidden rounded-[24px] bg-[#1e293b]/50 border border-slate-700/50 backdrop-blur-md p-6 flex items-center gap-5 hover:bg-red-500/10 hover:border-red-500/30 transition-all duration-300 hover:-translate-y-1 w-full text-right"
          >
            <div className="p-4 bg-slate-800 rounded-xl group-hover:bg-red-500/20 transition-colors">
              <LogOut size={28} className="text-slate-400 group-hover:text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-200 group-hover:text-red-200">התנתקות</h3>
              <p className="text-sm text-slate-500 group-hover:text-red-400/70">יציאה מהמערכת</p>
            </div>
          </motion.button>

        </div>
      </motion.div>
    </div>
  );
}
