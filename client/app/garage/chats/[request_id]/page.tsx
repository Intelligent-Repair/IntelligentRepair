import React from "react";

interface GarageChatPageProps {
  params: {
    request_id: string;
  };
}

/**
 * This screen will load chat messages based on request_id.
 * This screen will allow sending messages between driver and garage.
 * 
 * It will display:
 * - Message history between the garage and the customer/driver
 * - Real-time message updates
 * - Message input field with send functionality
 * - Timestamps for each message
 */
export default function GarageChatDetailPage({ params }: GarageChatPageProps) {
  const { request_id } = params;

  return (
    <div className="bg-transparent text-white h-full flex flex-col">
      <div className="
        bg-white/5
        backdrop-blur-xl
        border border-white/10
        rounded-3xl
        shadow-2xl
        text-white
        w-full
        max-w-4xl
        mx-auto
        mt-8
        flex flex-col
        h-[calc(100vh-8rem)]
      ">
        {/* Chat Header */}
        <div className="p-6 border-b border-white/10">
          <h1 className="text-2xl font-bold text-white">שיחה עם לקוח - {request_id}</h1>
          <p className="text-white/70 text-sm mt-1">פניית תיקון #{request_id}</p>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="text-center text-white/50 text-sm">
            הודעות השיחה יוצגו כאן
          </div>
        </div>

        {/* Message Input */}
        <div className="p-6 border-t border-white/10">
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="הקלד הודעה..."
              className="
                flex-1
                bg-white/5
                border border-white/10
                rounded-xl
                px-4
                py-3
                text-white
                placeholder:text-white/50
                focus:outline-none
                focus:ring-2
                focus:ring-[#4A90E2]/50
                focus:border-[#4A90E2]/50
              "
              disabled
            />
            <button
              className="
                px-6
                py-3
                bg-[#4A90E2]/20
                border border-[#4A90E2]/50
                rounded-xl
                text-white
                font-medium
                hover:bg-[#4A90E2]/30
                transition-colors
                disabled:opacity-50
                disabled:cursor-not-allowed
              "
              disabled
            >
              שלח
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

