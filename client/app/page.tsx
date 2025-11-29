// client/app/page.tsx
'use client'; // **** 1. חובה: הופך את הקומפוננטה לפעילה בצד הלקוח ****

import Image from "next/image";
import { useRouter } from 'next/navigation'; // 2. ייבוא ה-Router

const userBenefits = [
    // ... (שמירה על הנתונים הקיימים) ...
];

const garageBenefits = [
    // ... (שמירה על הנתונים הקיימים) ...
];

const flowSteps = [
    // ... (שמירה על הנתונים הקיימים) ...
];

export default function Home() {
    // 3. אתחול ה-Router
    const router = useRouter(); 

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-500/20 blur-[200px]" />
        <div className="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-b from-cyan-400/10 via-transparent to-indigo-500/10 blur-[180px]" />
        <div className="absolute -bottom-24 left-0 h-80 w-80 rounded-full bg-indigo-600/20 blur-[180px]" />
      </div>

      <main
        dir="rtl"
        className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-16 pt-16 sm:px-10 lg:px-12"
      >
        <section className="mx-auto flex w-full max-w-4xl flex-col items-center text-center gap-3">
          <Image
            src="/AppLogo2.png"
            alt="IntelligentRepair"
            width={520}
            height={270}
            priority
            className="w-[380px] md:w-[520px] h-auto translate-x-2 md:translate-x-4 drop-shadow-[0_0_36px_rgba(0,140,255,0.55)] mix-blend-screen opacity-0"
            style={{
              maskImage:
                "radial-gradient(circle at center, rgba(0,0,0,0.95) 50%, rgba(0,0,0,0.1) 72%, transparent 100%)",
              WebkitMaskImage:
                "radial-gradient(circle at center, rgba(0,0,0,0.95) 50%, rgba(0,0,0,0.1) 72%, transparent 100%)",
              animation: "heroLogoReveal 1.8s cubic-bezier(0.22, 0.9, 0.3, 1) forwards",
            }}
          />
          <p className="mt-3 text-sm tracking-[0.65em] text-slate-300">
            INTELLIGENTREPAIR • AI-FIRST AUTOMOTIVE SERVICE CLOUD
          </p>
          <h1
            className="mt-4 max-w-3xl text-[1.55rem] font-semibold leading-snug text-white sm:text-[2.35rem] lg:text-[2.45rem]"
            style={{
              WebkitTextStroke: "1.4px #7dd3ff",
              WebkitTextFillColor: "#ffffff",
              color: "#ffffff",
            }}
          >
            העוזר הדיגיטלי שמעניק לנהגים אבחון מיידי, מחבר אותם למוסכים המתאימים
            ומפשט את כל מסע התיקון בלחיצת כפתור
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-slate-200">
            פלטפורמת IntelligentRepair מספקת ניתוח תקלות אוטומטי, אבחון מהיר ותיעוד
            מלא — כך שכל צד יודע בדיוק מה קורה בכל רגע.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <button
              type="button"
               onClick={() => router.push('/signup')} // **** חיבור הרשמה ****
              className="rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-sky-500 px-12 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-sky-500/40 transition hover:-translate-y-0.5 hover:shadow-sky-500/60"
            >
              הרשמה
            </button>
            <button
              type="button"
               onClick={() => router.push('/login')} // **** חיבור התחברות ****
              className="rounded-full border border-white/20 bg-white/5 px-12 py-3 text-base font-semibold text-white backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/10"
            >
              התחברות
            </button>
          </div>
        </section>

        <section aria-labelledby="user-benefits" className="space-y-10">
          {/* ... שאר הסקשנים נשארים זהים ... */}
        </section>

        <section aria-labelledby="garage-benefits" className="space-y-8">
            {/* ... */}
        </section>

        <section aria-labelledby="flow" className="space-y-10 text-center">
            {/* ... */}
        </section>

        <footer className="border-t border-white/10 pt-8 text-center text-sm text-slate-400">
          © IntelligentRepair — הדור הבא של שירותי הרכב
        </footer>
      </main>
    </div>
  );
}