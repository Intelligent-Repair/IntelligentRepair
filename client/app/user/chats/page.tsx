import React from "react";

/**
 * This screen will list all chat threads for the user.
 * It will display a list of conversations with different garages/repair requests.
 * Each thread will show the garage name, last message preview, timestamp, and unread count.
 */
export default function UserChatsPage() {
  return (
    <div className="bg-transparent text-white">
      <div className="
        bg-white/5
        backdrop-blur-xl
        border border-white/10
        rounded-3xl
        p-10
        shadow-2xl
        text-white
        w-full
        max-w-4xl
        mx-auto
        mt-8
      ">
        <h1 className="text-3xl font-bold mb-4 text-white">שיחות</h1>
        <p className="text-white/70 text-lg mb-6">
          כאן תוכלו לראות את כל השיחות שלכם עם מוסכים שונים
        </p>
        
        {/* Placeholder for chat threads list */}
        <div className="space-y-4 mt-8">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors">
            <p className="text-white/50 text-sm">רשימת שיחות תוצג כאן</p>
          </div>
        </div>
      </div>
    </div>
  );
}

