"use client";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div
      dir="rtl"
      className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white flex items-center justify-center p-6"
    >
      {/* Background gradient effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-500/20 blur-[200px]" />
        <div className="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-b from-cyan-400/10 via-transparent to-indigo-500/10 blur-[180px]" />
        <div className="absolute -bottom-24 left-0 h-80 w-80 rounded-full bg-indigo-600/20 blur-[180px]" />
      </div>

      {/* Glass card container */}
      <div className="relative w-full max-w-md">
        <div className="rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl p-10">
          {children}
        </div>
      </div>
    </div>
  );
}

