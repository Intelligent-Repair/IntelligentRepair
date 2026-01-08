import { Suspense } from "react";
import QuestionsClient from "./QuestionsClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-200">טוען ייעוץ...</div>}>
      <QuestionsClient />
    </Suspense>
  );
}