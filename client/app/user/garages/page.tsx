import { Suspense } from "react";
import GaragesClient from "./GaragesClient";

export default function Page() {
    return (
        <Suspense fallback={<div className="p-6 text-slate-200">טוען מוסכים...</div>}>
            <GaragesClient />
        </Suspense>
    );
}
