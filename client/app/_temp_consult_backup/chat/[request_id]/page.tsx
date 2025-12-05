import React from "react";

export default function ConsultChatPage({ params }: { params: { request_id: string } }) {
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
        <h1 className="text-3xl font-bold mb-4 text-white">צ'אט ייעוץ AI</h1>
        <p className="text-white/70 text-lg mb-6">בקשה מספר: {params.request_id}</p>
      </div>
    </div>
  );
}

