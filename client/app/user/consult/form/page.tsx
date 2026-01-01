import { Suspense } from "react";
import ConsultFormClient from "./ConsultFormClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="text-slate-200 p-6">טוען...</div>}>
      <ConsultFormClient />
    </Suspense>
  );
}

