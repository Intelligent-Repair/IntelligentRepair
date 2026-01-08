import { Suspense } from "react";
import SummaryClient from "./SummaryClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-200">טוען סיכום...</div>}>
      <SummaryClient />
    </Suspense>
  );
}
