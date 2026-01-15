// client/app/garage/requests/[request_id]/report/page.tsx
// Server Component - fetches garage_request data and renders RepairCompletionForm

import { ArrowRight, Wrench } from 'lucide-react';
import Link from 'next/link';
import RepairCompletionForm from '@/components/garage/RepairCompletionForm';
import { createServerSupabase } from "@/lib/supabaseServer";

interface PageProps {
    params: Promise<{ request_id: string }>;
}

interface GarageRequestData {
    id: string;
    garage_id: string;
    request_id: string;
    status: string;
    vehicle_info?: {
        manufacturer?: string;
        model?: string;
        year?: number;
        license_plate?: string;
    };
    mechanic_summary?: {
        diagnoses?: { issue: string; probability: number }[];
        topDiagnosis?: { name: string }[];
        originalComplaint?: string;
        category?: string;
    };
}

async function fetchAcceptedGarageRequest(requestId: string): Promise<{ garageRequest: GarageRequestData | null; error: string | null }> {
    try {
        const supabase = await createServerSupabase();

        // Fetch the accepted garage_request for this request
        const { data: garageRequest, error } = await supabase
            .from('garage_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (error) {
            console.error('[ReportPage] DB error:', error);
            if (error.code === 'PGRST116') {
                return { garageRequest: null, error: 'לא נמצאה הצעה מאושרת לבקשה זו' };
            }
            return { garageRequest: null, error: 'שגיאה בטעינת הנתונים מהשרת' };
        }

        if (!garageRequest) {
            return { garageRequest: null, error: 'לא נמצאה הצעה מאושרת לבקשה זו' };
        }

        return { garageRequest, error: null };
    } catch (err) {
        console.error('[ReportPage] Unexpected error:', err);
        return { garageRequest: null, error: 'שגיאה בטעינת הנתונים' };
    }
}

export default async function ReportPage({ params }: PageProps) {
    const { request_id } = await params;

    const { garageRequest, error } = await fetchAcceptedGarageRequest(request_id);

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white">
            {/* Background effects */}
            <div className="pointer-events-none fixed inset-0">
                <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-500/20 blur-[200px]" />
                <div className="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-b from-cyan-400/10 via-transparent to-indigo-500/10 blur-[180px]" />
                <div className="absolute -bottom-24 left-0 h-80 w-80 rounded-full bg-indigo-600/20 blur-[180px]" />
            </div>

            <main dir="rtl" className="relative mx-auto w-full max-w-3xl px-6 pb-16 pt-8">
                {/* Header Bar */}
                <div className="relative flex items-center justify-center mb-8 pb-4 border-b border-white/5">
                    {/* Back Button - Right side for RTL */}
                    <Link
                        href="/garage/requests"
                        className="absolute right-0 p-2 rounded-full hover:bg-white/10 transition"
                    >
                        <ArrowRight className="w-5 h-5" />
                    </Link>

                    {/* Centered Title */}
                    <h1 className="text-xl font-bold text-white">
                        דיווח סיום טיפול
                    </h1>
                </div>

                {/* Error State */}
                {error ? (
                    <div className="p-8 rounded-2xl bg-red-900/30 border border-red-500/50 text-center">
                        <p className="text-red-300 text-lg mb-4">{error}</p>
                        <Link
                            href="/garage/requests"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition"
                        >
                            חזרה לרשימה
                        </Link>
                    </div>
                ) : !garageRequest ? (
                    <div className="p-8 rounded-2xl bg-slate-800/50 border border-slate-700 text-center">
                        <p className="text-slate-400 mb-4">לא נמצאו נתונים</p>
                        <Link
                            href="/garage/requests"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition"
                        >
                            חזרה לרשימה
                        </Link>
                    </div>
                ) : (() => {
                    // Extract primary diagnosis from mechanic_summary
                    const ms = garageRequest.mechanic_summary;
                    const primaryDiagnosis =
                        ms?.diagnoses?.[0]?.issue ||
                        ms?.topDiagnosis?.[0]?.name ||
                        ms?.category ||
                        ms?.originalComplaint ||
                        undefined;

                    return (
                        /* Main Form Card */
                        <div className="rounded-2xl bg-slate-900/80 border border-slate-700/50 p-8 shadow-xl backdrop-blur-sm">
                            <RepairCompletionForm
                                requestId={garageRequest.request_id}
                                garageId={garageRequest.garage_id}
                                garageRequestId={garageRequest.id}
                                vehicleInfo={garageRequest.vehicle_info}
                                primaryDiagnosis={primaryDiagnosis}
                            />
                        </div>
                    );
                })()}
            </main>
        </div>
    );
}
