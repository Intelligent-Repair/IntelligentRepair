"use client";

import Image from "next/image";
import Link from "next/link";
import Logo from "@/ffc53cfd-5750-4bfc-8fcf-eeaa1b241560.png";

const userBenefits = [
  {
    title: "אבחון ראשוני ללא ידע טכני",
    description: "תהליך מובנה שמתרגם תקלות לשפה ברורה בכל מכשיר.",
  },
  {
    title: "העלאת תמונות ותובנות בזמן אמת",
    description: "המערכת מפענחת תמונות ומחזירה הסבר מקצועי בדקות.",
  },
  {
    title: "חיסכון בזמן וכסף",
    description: "מזהים את הבעיה מוקדם ומגיעים למוסך מוכנים מראש.",
  },
  {
    title: "תיעוד מלא של כל ההיסטוריה",
    description: "כל בדיקה, אישור ותיקון נשמרים בענן מאובטח אחד.",
  },
];

const garageBenefits = [
  "קבלת מידע מלא לפני הגעת הלקוח",
  "דשבורד חכם לצפייה בתקלות והסקת מסקנות על דגמי הרכב",
  "שיפור יעילות העבודה",
  "יכולת תיעוד ומעקב מקצועי",
];

// SWAPPED: Step 3 and Step 4 content
const flowSteps = [
  {
    stage: "שלב 1",
    detail: "הלקוח מזין תקלה ומעלה תמונות",
  },
  {
    stage: "שלב 2",
    detail: "AI מנתח ומספק אבחון",
  },
  {
    stage: "שלב 3",
    detail: "בחירת מוסך אשר יקבל את אבחון התקלה",
  },
  {
    stage: "שלב 4",
    detail: "הדיווח נשמר בדשבורד וניתן לשיתוף",
  },
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#030712] via-[#0a1628] to-[#020617] text-white">
      {/* Animated Background Pattern */}
      <div className="pointer-events-none absolute inset-0">
        {/* Hexagonal mesh overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 17.32v34.64L30 60 0 51.96V17.32L30 0z' fill='none' stroke='%2306b6d4' stroke-width='0.5'/%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px',
          }}
        />
        {/* Glow effects */}
        <div className="absolute -top-32 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-cyan-500/20 blur-[250px] animate-pulse" />
        <div className="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-b from-teal-400/15 via-transparent to-cyan-500/10 blur-[200px]" />
        <div className="absolute -bottom-24 left-0 h-96 w-96 rounded-full bg-cyan-600/15 blur-[200px]" />
        {/* Scan line effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/[0.02] to-transparent animate-[scan_8s_ease-in-out_infinite]" />
      </div>

      <main
        dir="rtl"
        className="relative mx-auto flex w-full max-w-6xl flex-col gap-20 px-6 pb-20 pt-16 sm:px-10 lg:px-12"
      >
        {/* Hero Section */}
        <div className="flex justify-center items-center mt-8 mb-6 w-full">
          <div className="flex justify-center items-center w-auto">
            <Image
              src={Logo}
              alt="IntelligentRepair Logo"
              className="w-[600px] max-w-[90%] drop-shadow-[0_0_30px_rgba(6,182,212,0.4)] animate-fadeIn"
              priority
            />
          </div>
        </div>

        <section className="mx-auto flex w-full max-w-4xl flex-col items-center text-center gap-4">
          <p className="text-center text-slate-400 mt-2 text-lg tracking-wide">
            הדור הבא של שירותי הרכב למוסכים ונהגים
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            {/* Neon Register Button */}
            <Link
              href="/auth/register"
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-14 py-4 text-lg font-bold text-slate-950 shadow-lg shadow-cyan-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-500/60 text-center uppercase tracking-wider"
            >
              הרשמה
            </Link>
            <Link
              href="/auth/login"
              className="rounded-xl border border-cyan-500/30 bg-slate-900/50 backdrop-blur-xl px-14 py-4 text-lg font-semibold text-white transition-all duration-300 hover:-translate-y-1 hover:bg-slate-800/60 hover:border-cyan-500/50 text-center"
            >
              התחברות
            </Link>
          </div>
        </section>

        {/* User Benefits - Glassmorphism Cards */}
        <section aria-labelledby="user-benefits" className="space-y-12">
          <div className="text-center">
            <p className="text-sm font-bold tracking-[0.5em] text-cyan-400 uppercase">
              יתרונות למשתמשים
            </p>
            <h2
              id="user-benefits"
              className="mt-4 text-4xl font-bold sm:text-5xl lg:text-6xl bg-gradient-to-r from-white via-cyan-200 to-teal-300 bg-clip-text text-transparent"
            >
              חוויית שירות מקיפה לכל נהג
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {userBenefits.map((benefit) => (
              <article
                key={benefit.title}
                className="group flex flex-col items-center gap-5 rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-8 text-center transition-all duration-300 hover:scale-[1.02] hover:border-cyan-500/40 hover:shadow-[0_0_30px_rgba(6,182,212,0.25)]"
              >
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-2xl text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
                  ✦
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-bold text-white tracking-wide">
                    {benefit.title}
                  </h3>
                  <p className="text-base text-slate-400 leading-relaxed">{benefit.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Garage Benefits - Glassmorphism Panel */}
        <section aria-labelledby="garage-benefits" className="space-y-8">
          <div className="rounded-3xl border border-cyan-500/20 bg-slate-900/50 backdrop-blur-xl p-10 shadow-2xl shadow-cyan-500/5">
            <div className="flex flex-col gap-10 text-center">
              <div>
                <p className="text-sm font-bold tracking-[0.5em] text-cyan-400 uppercase">
                  יתרונות למוסכים
                </p>
                <h2
                  id="garage-benefits"
                  className="mt-4 text-4xl font-bold sm:text-5xl lg:text-6xl bg-gradient-to-r from-white via-cyan-200 to-teal-300 bg-clip-text text-transparent"
                >
                  ניהול חכם שמקדים את הצרכים של הצוות
                </h2>
                <p className="mt-5 text-lg text-slate-400 max-w-3xl mx-auto">
                  מוסכים מוציאים יותר ערך מהזמן בכל יום עבודה כאשר המידע זמין,
                  מדויק וקל להפעלה.
                </p>
              </div>
              <ul className="grid gap-5 text-center sm:grid-cols-2 lg:grid-cols-4">
                {garageBenefits.map((item) => (
                  <li
                    key={item}
                    className="group rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-sm px-5 py-6 text-base text-white transition-all duration-300 hover:scale-[1.02] hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]"
                  >
                    <span className="align-middle font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Flow Steps - Connected Process Flow */}
        <section aria-labelledby="flow" className="space-y-12 text-center">
          <div>
            <p className="text-sm font-bold tracking-[0.5em] text-cyan-400 uppercase">
              איך המערכת עובדת
            </p>
            <h2
              id="flow"
              className="mt-4 text-4xl font-bold sm:text-5xl lg:text-6xl bg-gradient-to-r from-white via-cyan-200 to-teal-300 bg-clip-text text-transparent"
            >
              ארבעה שלבים לזרימת מידע מושלמת
            </h2>
          </div>

          {/* Steps with connector line */}
          <div className="relative">
            {/* Connector line - hidden on mobile */}
            <div className="hidden lg:block absolute top-1/2 left-12 right-12 h-0.5 bg-gradient-to-r from-cyan-500/50 via-teal-500/30 to-cyan-500/50 -translate-y-1/2 z-0" />
            <div className="hidden lg:flex absolute top-1/2 left-12 right-12 -translate-y-1/2 z-0 justify-between px-[15%]">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
              ))}
            </div>

            <div className="relative z-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {flowSteps.map((step, index) => (
                <article
                  key={step.stage}
                  className="group flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl px-6 py-10 transition-all duration-300 hover:scale-[1.03] hover:border-cyan-500/40 hover:shadow-[0_0_30px_rgba(6,182,212,0.25)]"
                >
                  {/* Step number badge */}
                  <div className="w-12 h-12 rounded-full bg-cyan-500/10 border-2 border-cyan-500/50 flex items-center justify-center text-cyan-400 font-bold text-lg group-hover:bg-cyan-500/20 group-hover:border-cyan-400 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                    {index + 1}
                  </div>
                  <div className="text-xs font-bold tracking-[0.4em] text-cyan-400 uppercase">
                    {step.stage}
                  </div>
                  <p className="text-lg text-white font-medium leading-relaxed">{step.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-cyan-500/20 pt-10 text-center text-sm text-slate-500">
          <span className="text-cyan-500/70">©</span> IntelligentRepair — הדור הבא של שירותי הרכב
        </footer>
      </main>

      {/* CSS Animation for scan effect */}
      <style jsx>{`
        @keyframes scan {
          0%, 100% { transform: translateY(-100%); }
          50% { transform: translateY(100%); }
        }
      `}</style>
    </div>
  );
}
