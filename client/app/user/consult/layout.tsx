import React from "react";

interface ConsultLayoutProps {
  children: React.ReactNode;
}

export default function ConsultLayout({ children }: ConsultLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1120] via-[#0f1a2e] to-[#0a1120]">
      {children}
    </div>
  );
}

