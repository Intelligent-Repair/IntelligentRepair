// client/app/garage/requests/[request_id]/page.tsx
'use client';

import { ArrowLeft, Car, MessageSquare, User, Loader2, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';

type RequestData = {
    id: number;
    description: string;
    problem_description: string;
    status: string;
    image_urls: string[];
    ai_diagnosis: any;
    ai_confidence: number;
    created_at: string;
    client: {
        id: string;
        name: string;
        phone: string;
        email: string;
    } | null;
    car: {
        id: string;
        license_plate: string;
        manufacturer: string;
        model: string;
        year: string;
        full_name: string;
    } | null;
    repair: {
        id: number;
        status: string;
        mechanic_notes: string;
        final_issue_type: string;
        ai_summary: string;
        created_at: string;
        updated_at: string;
    } | null;
};

export default function GarageRequestDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const request_id = params.request_id as string;

    const [requestData, setRequestData] = useState<RequestData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [accepting, setAccepting] = useState(false);

    // Fetch request data
    useEffect(() => {
        const fetchRequest = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/garage/requests/${request_id}`);
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch request');
                }
                
                setRequestData(data.request);
            } catch (err) {
                console.error('Error fetching request:', err);
                setError(err instanceof Error ? err.message : 'Failed to load request');
            } finally {
                setLoading(false);
            }
        };

        if (request_id) {
            fetchRequest();
        }
    }, [request_id]);

    // Handle accepting the request and converting to repair
    const handleAcceptRequest = async () => {
        if (!requestData) return;

        setAccepting(true);
        try {
            const response = await fetch('/api/garage/repairs/accept', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    request_id: requestData.id,
                    ai_summary: requestData.ai_diagnosis,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to accept request');
            }

            // Refresh the request data to show the repair
            const refreshResponse = await fetch(`/api/garage/requests/${request_id}`);
            const refreshData = await refreshResponse.json();
            setRequestData(refreshData.request);

            alert('הפנייה התקבלה בהצלחה! התיקון נוצר.');
        } catch (err) {
            console.error('Error accepting request:', err);
            alert(err instanceof Error ? err.message : 'Failed to accept request');
        } finally {
            setAccepting(false);
        }
    };

    // Download PDF report
    const handleDownloadPdf = () => {
        if (!requestData) return;

        const doc = new jsPDF();
        const margin = 15;
        let yPos = margin;
        const lineSpacing = 8;
        const maxWidth = 180;

        // Title
        doc.setFontSize(20);
        doc.text(`Diagnosis Report #${request_id}`, doc.internal.pageSize.getWidth() - margin, yPos, { align: 'right' });
        yPos += lineSpacing * 2;

        // Details
        doc.setFontSize(14);
        doc.text('Request Details:', doc.internal.pageSize.getWidth() - margin, yPos, { align: 'right' });
        yPos += lineSpacing;
        doc.setFontSize(12);

        const detailsContent = [
            `Client: ${requestData.client?.name || 'Unknown'}`,
            `Vehicle: ${requestData.car?.full_name || 'Unknown'}`,
            `Phone: ${requestData.client?.phone || 'Unknown'}`,
            `Date: ${new Date(requestData.created_at).toLocaleDateString()}`,
        ];

        detailsContent.forEach((line: string) => {
            doc.text(line, doc.internal.pageSize.getWidth() - margin, yPos, { align: 'right' });
            yPos += lineSpacing;
        });

        yPos += lineSpacing;

        // Description
        doc.setFontSize(14);
        doc.text('Client Description:', doc.internal.pageSize.getWidth() - margin, yPos, { align: 'right' });
        yPos += lineSpacing;

        doc.setFontSize(12);
        const description = requestData.problem_description || requestData.description || 'No description';
        const splitDescription = doc.splitTextToSize(description, maxWidth);
        splitDescription.forEach((line: string) => {
            doc.text(line, doc.internal.pageSize.getWidth() - margin, yPos, { align: 'right' });
            yPos += lineSpacing;
        });

        yPos += lineSpacing;

        // AI Diagnosis
        if (requestData.ai_diagnosis) {
            doc.setFontSize(14);
            doc.text('AI Diagnosis:', doc.internal.pageSize.getWidth() - margin, yPos, { align: 'right' });
            yPos += lineSpacing;

            doc.setFontSize(12);
            const aiText = typeof requestData.ai_diagnosis === 'string' 
                ? requestData.ai_diagnosis 
                : JSON.stringify(requestData.ai_diagnosis);
            const splitAI = doc.splitTextToSize(aiText, maxWidth);
            splitAI.forEach((line: string) => {
                doc.text(line, doc.internal.pageSize.getWidth() - margin, yPos, { align: 'right' });
                yPos += lineSpacing;
            });
        }

        doc.save(`IntelligentRepair_Report_${request_id}_${requestData.client?.name || 'client'}.pdf`);
    };

    // Navigate to chat
    const handleGoToChat = () => {
        router.push(`/garage/chats/${request_id}`);
    };

    // Format date
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('he-IL');
    };

    if (loading) {
        return (
            <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white">
                <div className="flex items-center justify-center min-h-screen">
                    <Loader2 className="w-12 h-12 animate-spin text-sky-400" />
                </div>
            </div>
        );
    }

    if (error || !requestData) {
        return (
            <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white">
                <div className="flex flex-col items-center justify-center min-h-screen">
                    <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
                    <p className="text-red-300">{error || 'Request not found'}</p>
                    <button
                        onClick={() => router.push('/garage/requests')}
                        className="mt-4 px-4 py-2 bg-sky-600 hover:bg-sky-700 rounded-lg"
                    >
                        חזרה לרשימת הפניות
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white">
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
                        פרטי פנייה #{request_id}
                    </h1>
                </header>

                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        {/* Client Description */}
                        <div className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md">
                            <h2 className="text-xl font-semibold mb-3 text-cyan-300">תיאור הלקוח המקורי</h2>
                            <p className="text-slate-300 border-t border-white/10 pt-3 whitespace-pre-wrap">
                                {requestData.problem_description || requestData.description || 'אין תיאור'}
                            </p>
                        </div>

                        {/* AI Diagnosis */}
                        {requestData.ai_diagnosis && (
                            <div className="rounded-xl border border-sky-400/30 bg-sky-900/10 p-6 shadow-xl backdrop-blur-md">
                                <h2 className="text-xl font-semibold mb-3 text-sky-300">אבחון AI ראשוני (AI Diagnosis)</h2>
                                <div className="text-sky-100 border-t border-sky-400/20 pt-3">
                                    <p className="font-semibold">תקציר AI:</p>
                                    <p className="mt-2 whitespace-pre-wrap">
                                        {typeof requestData.ai_diagnosis === 'string' 
                                            ? requestData.ai_diagnosis 
                                            : JSON.stringify(requestData.ai_diagnosis, null, 2)}
                                    </p>
                                    {requestData.ai_confidence && (
                                        <p className="mt-2 text-sm">
                                            <span className="font-semibold">רמת ביטחון:</span> {(requestData.ai_confidence * 100).toFixed(0)}%
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Images */}
                        {requestData.image_urls && requestData.image_urls.length > 0 && (
                            <div className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md">
                                <h2 className="text-xl font-semibold mb-3 text-cyan-300">תמונות</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    {requestData.image_urls.map((url, index) => (
                                        <img
                                            key={index}
                                            src={url}
                                            alt={`Image ${index + 1}`}
                                            className="rounded-lg w-full h-auto"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-4">
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
                                <FileText className="w-5 h-5" /> הורד קובץ אבחון (PDF)
                            </button>
                            {!requestData.repair && (
                                <button
                                    onClick={handleAcceptRequest}
                                    disabled={accepting}
                                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-full flex items-center gap-2 transition"
                                >
                                    {accepting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" /> מקבל פנייה...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="w-5 h-5" /> קבל פנייה והתחל תיקון
                                        </>
                                    )}
                                </button>
                            )}
                        </div>

                        {/* Repair Status */}
                        {requestData.repair && (
                            <div className="rounded-xl border border-green-400/30 bg-green-900/10 p-6 shadow-xl backdrop-blur-md">
                                <h2 className="text-xl font-semibold mb-3 text-green-300">סטטוס תיקון</h2>
                                <div className="text-green-100 border-t border-green-400/20 pt-3">
                                    <p><span className="font-semibold">מזהה תיקון:</span> #{requestData.repair.id}</p>
                                    <p><span className="font-semibold">סטטוס:</span> {requestData.repair.status}</p>
                                    {requestData.repair.final_issue_type && (
                                        <p><span className="font-semibold">סוג בעיה:</span> {requestData.repair.final_issue_type}</p>
                                    )}
                                    {requestData.repair.mechanic_notes && (
                                        <div className="mt-3">
                                            <p className="font-semibold">הערות מכונאי:</p>
                                            <p className="mt-1 whitespace-pre-wrap">{requestData.repair.mechanic_notes}</p>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => router.push(`/garage/repairs`)}
                                        className="mt-4 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-full"
                                    >
                                        עבור לעדכון התיקון
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Client and Car Info Sidebar */}
                    <div className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md h-fit">
                        <h2 className="text-xl font-semibold mb-4 text-cyan-300 flex items-center gap-2">
                            <User className="w-5 h-5" /> פרטי לקוח ורכב
                        </h2>
                        <div className="space-y-2">
                            <p className="text-slate-300"><span className="font-semibold">שם:</span> {requestData.client?.name || '—'}</p>
                            <p className="text-slate-300"><span className="font-semibold">טלפון:</span> {requestData.client?.phone || '—'}</p>
                            <p className="text-slate-300"><span className="font-semibold">אימייל:</span> {requestData.client?.email || '—'}</p>
                            <div className="border-t border-white/10 mt-3 pt-3">
                                <p className="text-slate-300 flex items-center gap-2">
                                    <Car className="w-4 h-4" />
                                    <span className="font-semibold">רכב:</span> {requestData.car?.full_name || '—'}
                                </p>
                                <p className="text-slate-300"><span className="font-semibold">מספר רישוי:</span> {requestData.car?.license_plate || '—'}</p>
                            </div>
                            <div className="border-t border-white/10 mt-3 pt-3">
                                <p className="text-slate-300"><span className="font-semibold">תאריך פנייה:</span> {formatDate(requestData.created_at)}</p>
                                <p className="text-slate-300"><span className="font-semibold">סטטוס:</span> {requestData.status}</p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
