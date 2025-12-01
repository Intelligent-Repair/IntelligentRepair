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
    detail: "הדיווח נשמר בדשבורד וניתן לשיתוף",
  },
  {
    stage: "שלב 4",
    detail: "בחירת מוסך אשר יקבל את אבחון התקלה",
  },
];

export default function Home() {
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
        <div className="flex justify-center items-center mt-8 mb-6 w-full">
          <div className="flex justify-center items-center w-auto">
            <Image
              src={Logo}
              alt="IntelligentRepair Logo"
              className="w-[600px] max-w-[90%] drop-shadow-[0_0_18px_rgba(255,255,255,0.45)] animate-fadeIn"
              priority
            />
          </div>
        </div>

        <section className="mx-auto flex w-full max-w-4xl flex-col items-center text-center gap-3">
          <p className="text-center text-white/70 mt-2 text-lg">
            A smart automotive service platform for modern repair centers
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/auth/register"
              className="rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-sky-500 px-12 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-sky-500/40 transition hover:-translate-y-0.5 hover:shadow-sky-500/60 text-center"
            >
              הרשמה
            </Link>
            <Link
              href="/auth/login"
              className="rounded-full border border-white/20 bg-white/5 px-12 py-3 text-base font-semibold text-white backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/10 text-center"
            >
              התחברות
            </Link>
          </div>
        </section>

        <section aria-labelledby="user-benefits" className="space-y-10">
          <div className="text-center">
            <p className="text-base font-semibold tracking-[0.45em] text-sky-200">
              יתרונות למשתמשים
            </p>
            <h2
              id="user-benefits"
              className="mt-3 text-4xl font-semibold text-white sm:text-5xl lg:text-6xl"
            >
              חוויית שירות מקיפה לכל נהג
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {userBenefits.map((benefit) => (
              <article
                key={benefit.title}
                className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-center shadow-[0_30px_80px_rgba(5,10,30,0.35)] backdrop-blur-xl"
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/30 to-indigo-500/30 text-xl text-white">
                  ✦
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-white">
                    {benefit.title}
                  </h3>
                  <p className="text-base text-slate-200">{benefit.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="garage-benefits" className="space-y-8">
          <div className="rounded-[32px] border border-white/10 bg-gradient-to-r from-white/5 via-white/10 to-transparent p-10 shadow-[0_40px_120px_rgba(4,8,20,0.55)] backdrop-blur-2xl">
            <div className="flex flex-col gap-8 text-center">
              <div>
                <p className="text-base font-semibold tracking-[0.45em] text-cyan-200">
                  יתרונות למוסכים
                </p>
                <h2
                  id="garage-benefits"
                  className="mt-3 text-4xl font-semibold text-white sm:text-5xl lg:text-6xl"
                >
                  ניהול חכם שמקדים את הצרכים של הצוות
                </h2>
                <p className="mt-4 text-base text-slate-200">
                  מוסכים מוציאים יותר ערך מהזמן בכל יום עבודה כאשר המידע זמין,
                  מדויק וקל להפעלה.
                </p>
              </div>
              <ul className="grid gap-4 text-center sm:grid-cols-2 lg:grid-cols-4">
                {garageBenefits.map((item) => (
                  <li
                    key={item}
                    className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-base text-white shadow-inner shadow-black/30"
                  >
                    <span className="align-middle">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section aria-labelledby="flow" className="space-y-10 text-center">
          <div>
            <p className="text-base font-semibold tracking-[0.45em] text-slate-300">
              איך המערכת עובדת
            </p>
            <h2
              id="flow"
              className="mt-3 text-4xl font-semibold text-white sm:text-5xl lg:text-6xl"
            >
              ארבעה שלבים לזרימת מידע מושלמת
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {flowSteps.map((step) => (
              <article
                key={step.stage}
                className="flex flex-col items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-6 py-8 shadow-[0_30px_80px_rgba(3,5,12,0.55)] backdrop-blur-2xl"
              >
                <div className="text-sm font-semibold tracking-[0.35em] text-cyan-200">
                  {step.stage}
                </div>
                <p className="text-lg text-white">{step.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="border-t border-white/10 pt-8 text-center text-sm text-slate-400">
          © IntelligentRepair — הדור הבא של שירותי הרכב
        </footer>
      </main>
    </div>
  );
}
