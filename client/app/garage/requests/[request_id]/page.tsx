// client/app/garage/requests/[request_id]/page.tsx
'use client';

import { ArrowLeft, Car, MessageSquare, User, Loader2, AlertCircle } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';

interface RequestDetails {
    id: string;
    client: string;
    phone: string;
    car: string;
    license_plate: string;
    date: string;
    description: string;
    ai_summary: string;
    status: string;
    vehicle_info: any;
    mechanic_summary: any;
    request_id: string;
}

export default function GarageRequestDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const request_id = params.request_id as string;

    const [details, setDetails] = useState<RequestDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch request details from API
    useEffect(() => {
        const fetchDetails = async () => {
            if (!request_id) return;

            setLoading(true);
            try {
                const res = await fetch(`/api/garage/requests/${request_id}`);
                const data = await res.json();

                if (data.error) {
                    setError(data.error);
                } else {
                    setDetails(data.request);
                }
            } catch (err) {
                console.error('Error fetching request details:', err);
                setError('שגיאה בטעינת פרטי הפנייה');
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [request_id]);

    // PDF download function
    const handleDownloadPdf = () => {
        if (!details) return;

        const doc = new jsPDF();
        const margin = 15;
        let yPos = margin;
        const lineSpacing = 8;
        const maxWidth = 180;

        // Title
        doc.setFontSize(20);
        doc.text(`דוח אבחון פנייה #${request_id}`, doc.internal.pageSize.getWidth() - margin, yPos, { align: 'right' });
        yPos += lineSpacing * 2;

        // Details
        doc.setFontSize(14);
        doc.text('פרטי הפנייה:', doc.internal.pageSize.getWidth() - margin, yPos, { align: 'right' });
        yPos += lineSpacing;
        doc.setFontSize(12);

        const detailsContent = [
            `Client: ${details.client}`,
            `Vehicle: ${details.car}`,
            `Phone: ${details.phone}`,
            `Date: ${details.date}`,
        ];

        detailsContent.forEach((line: string) => {
            doc.text(line, doc.internal.pageSize.getWidth() - margin, yPos, { align: 'right' });
            yPos += lineSpacing;
        });

        yPos += lineSpacing;

        // Description
        doc.setFontSize(14);
        doc.text('תיאור הלקוח המקורי:', doc.internal.pageSize.getWidth() - margin, yPos, { align: 'right' });
        yPos += lineSpacing;

        doc.setFontSize(12);
        const splitDescription = doc.splitTextToSize(details.description, maxWidth);
        splitDescription.forEach((line: string) => {
            doc.text(line, doc.internal.pageSize.getWidth() - margin, yPos, { align: 'right' });
            yPos += lineSpacing;
        });

        yPos += lineSpacing;

        // AI Summary
        doc.setFontSize(14);
        doc.text('AI Diagnosis:', doc.internal.pageSize.getWidth() - margin, yPos, { align: 'right' });
        yPos += lineSpacing;

        doc.setFontSize(12);
        const splitAISummary = doc.splitTextToSize(details.ai_summary, maxWidth);
        splitAISummary.forEach((line: string) => {
            doc.text(line, doc.internal.pageSize.getWidth() - margin, yPos, { align: 'right' });
            yPos += lineSpacing;
        });

        doc.save(`IntelligentRepair_Report_${request_id}_${details.client}.pdf`);
    };

    // Navigate to chat
    const handleGoToChat = () => {
        router.push(`/garage/chats/${request_id}`);
    };

    // Loading state
    if (loading) {
        return (
            <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white flex items-center justify-center">
                <div className="flex flex-col items-center">
                    <Loader2 className="w-12 h-12 animate-spin text-sky-400" />
                    <p className="mt-4 text-slate-400">טוען פרטי פנייה...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error || !details) {
        return (
            <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white flex items-center justify-center">
                <div className="flex flex-col items-center">
                    <AlertCircle className="w-12 h-12 text-red-400" />
                    <p className="mt-4 text-red-400">{error || 'פנייה לא נמצאה'}</p>
                    <button
                        onClick={() => router.push('/garage/requests')}
                        className="mt-6 text-sky-400 hover:text-sky-300"
                    >
                        חזרה לרשימת הפניות
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white">
            {/* Background effects */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-500/20 blur-[200px]" />
                <div className="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-b from-cyan-400/10 via-transparent to-indigo-500/10 blur-[180px]" />
                <div className="absolute -bottom-24 left-0 h-80 w-80 rounded-full bg-indigo-600/20 blur-[180px]" />
            </div>

            <main dir="rtl" className="relative mx-auto w-full max-w-7xl px-6 pb-16 pt-8 sm:px-10 lg:px-12">

                <header className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
                    <button onClick={() => router.push('/garage/requests')} className="text-sky-400 hover:text-sky-300 flex items-center gap-2 transition">
                        <ArrowLeft className="w-5 h-5" /> חזרה לרשימת הפניות
                    </button>
                    <h1 className="text-3xl font-extrabold text-white">
                        פרטי פנייה
                    </h1>
                </header>

                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    <div className="lg:col-span-2 space-y-6">
                        {/* Customer Description */}
                        <div className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md">
                            <h2 className="text-xl font-semibold mb-3 text-cyan-300">תיאור הלקוח המקורי</h2>
                            <p className="text-slate-300 border-t border-white/10 pt-3">{details.description}</p>
                        </div>

                        {/* AI Summary */}
                        <div className="rounded-xl border border-sky-400/30 bg-sky-900/10 p-6 shadow-xl backdrop-blur-md">
                            <h2 className="text-xl font-semibold mb-3 text-sky-300">אבחון AI ראשוני (AI Diagnosis)</h2>
                            <p className="text-sky-100 border-t border-sky-400/20 pt-3">{details.ai_summary}</p>
                            <div className="mt-6 flex gap-4">
                                <button
                                    onClick={handleGoToChat}
                                    className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-full flex items-center gap-2 transition"
                                >
                                    <MessageSquare className="w-5 h-5" /> מעבר לצ'אט עם הלקוח
                                </button>
                                <button
                                    onClick={handleDownloadPdf}
                                    className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-full flex items-center gap-2 transition"
                                >
                                    הורד קובץ אבחון (PDF)
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Client Details Sidebar */}
                    <div className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md h-fit">
                        <h2 className="text-xl font-semibold mb-4 text-cyan-300 flex items-center gap-2">
                            <User className="w-5 h-5" /> פרטי לקוח ורכב
                        </h2>
                        <p className="text-slate-300 mt-2"><strong>שם:</strong> {details.client}</p>
                        <p className="text-slate-300"><strong>טלפון:</strong> {details.phone}</p>
                        <p className="text-slate-300 border-t border-white/10 mt-3 pt-3">
                            <Car className="w-4 h-4 inline-block ml-2" /> <strong>רכב:</strong> {details.car}
                        </p>
                        {details.license_plate && (
                            <p className="text-slate-300"><strong>מספר רכב:</strong> <span dir="ltr">{details.license_plate}</span></p>
                        )}
                        <p className="text-slate-300"><strong>תאריך פנייה:</strong> {details.date}</p>
                    </div>

                </section>
            </main>
        </div>
    );
}
