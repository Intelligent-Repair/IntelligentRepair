// client/app/garage/requests/[request_id]/page.tsx
'use client';

import { ArrowLeft, Car, MessageSquare, User } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useMemo } from 'react';
import { jsPDF } from 'jspdf'; 

// -------------------------------------------------------------------
// 1. נתוני דמה ריאליסטיים מגוונים (Mock Data Sets)
// -------------------------------------------------------------------
const mockDataSets = [
    {
        car: 'Mazda 3 (2018)',
        client: 'דניאל לוי',
        phone: '052-1234567',
        date: '2025-12-05',
        description: 'רעש חזק מאוד מגיע מהגלגל הקדמי הימני בזמן בלימה קלה. זה התחיל פתאום אחרי נסיעה ארוכה בכביש משובש. אני חושש שמשהו שבור.',
        ai_summary: 'AI Diagnosis: Severe front brake pad wear is indicated by the grinding noise. Action: Immediate inspection of the front caliper assembly and rotor thickness is required. Advise replacement of pads and machining/replacement of rotors.',
    },
    {
        car: 'Hyundai i30 (2020)',
        client: 'מאיה כהן',
        phone: '054-9876543',
        date: '2025-12-04',
        description: 'נורת המנוע הצהובה נדלקה, והרכב מרגיש חלש מאוד בעליות. אין רעשים חריגים, אבל הוא משתעל קצת בהתנעה.',
        ai_summary: 'AI Diagnosis: Engine Control Unit (ECU) logged a P0420 (Catalyst Efficiency Below Threshold). Action: Check oxygen sensor (O2 sensor) readings and exhaust leaks. Recommend running a fuel system diagnostic.',
    },
    {
        car: 'Kia Picanto (2022)',
        client: 'רועי שואף',
        phone: '050-1122334',
        date: '2025-12-03',
        description: 'שמתי לב שמי הקירור יורדים מהר, והרצפה מתחת לרכב רטובה מעט בצד הנוסע. אני ממלא מים כל יומיים.',
        ai_summary: 'AI Diagnosis: External coolant leak suspected, possibly from the radiator or a loose hose clamp (common issue). Action: Pressure test the cooling system immediately to locate the source of the leak and prevent engine overheating.',
    },
];

export default function GarageRequestDetailsPage() {
    const router = useRouter();
    const params = useParams(); 
    
    // קריאה נכונה לפרמטר הדינמי:
    const request_id = params.request_id as string; 

    // *** חישוב נתונים דינמיים לפי ID ***
    const details = useMemo(() => {
        const idNum = parseInt(request_id) || 0;
        return mockDataSets[idNum % mockDataSets.length];
    }, [request_id]);
    
    // -------------------------------------------------------------------
    // 2. פונקציה ליצירת והורדת מסמך PDF (כולל תיקוני TypeScript)
    // -------------------------------------------------------------------
    const handleDownloadPdf = () => {
        const doc = new jsPDF();
        const margin = 15;
        let yPos = margin;
        const lineSpacing = 8;
        const maxWidth = 180; 

        // 1. כותרת הדוח
        doc.setFontSize(20);
        doc.text(`דוח אבחון פנייה #${request_id}`, doc.internal.pageSize.getWidth() - margin, yPos, { align: 'right' });
        yPos += lineSpacing * 2;

        // 2. פרטי הפנייה
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

        // 3. תיאור הלקוח
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
        
        // 4. אבחון AI
        doc.setFontSize(14);
        doc.text('AI Diagnosis:', doc.internal.pageSize.getWidth() - margin, yPos, { align: 'right' });
        yPos += lineSpacing;

        doc.setFontSize(12);
        const splitAISummary = doc.splitTextToSize(details.ai_summary, maxWidth);
        splitAISummary.forEach((line: string) => {
            doc.text(line, doc.internal.pageSize.getWidth() - margin, yPos, { align: 'right' });
            yPos += lineSpacing;
        });

        // שמירת הקובץ
        doc.save(`IntelligentRepair_Report_${request_id}_${details.client}.pdf`);
    };

    // -------------------------------------------------------------------
    // 3. פונקציית ניווט לצ'אט
    // -------------------------------------------------------------------
    const handleGoToChat = () => {
        // מנווט לעמוד הצ'אט: /garage/chats/[request_id]
        router.push(`/garage/chats/${request_id}`); 
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white">
            {/* אפקטי הרקע ... */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-500/20 blur-[200px]" />
                <div className="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-b from-cyan-400/10 via-transparent to-indigo-500/10 blur-[180px]" />
                <div className="absolute -bottom-24 left-0 h-80 w-80 rounded-full bg-indigo-600/20 blur-[180px]" />
            </div>

            {/* תוכן הפירוט הראשי */}
            <main dir="rtl" className="relative mx-auto w-full max-w-7xl px-6 pb-16 pt-8 sm:px-10 lg:px-12">
                
                <header className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
                    <button onClick={() => router.push('/garage/requests')} className="text-sky-400 hover:text-sky-300 flex items-center gap-2 transition">
                        <ArrowLeft className="w-5 h-5"/> חזרה לרשימת הפניות
                    </button>
                    <h1 className="text-3xl font-extrabold text-white">
                        פרטי פנייה #{request_id} 
                    </h1>
                </header>

                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    <div className="lg:col-span-2 space-y-6">
                        {/* 1. פרטי התקלה המקורית */}
                        <div className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md">
                            <h2 className="text-xl font-semibold mb-3 text-cyan-300"> תיאור הלקוח המקורי </h2>
                            <p className="text-slate-300 border-t border-white/10 pt-3">{details.description}</p>
                        </div>
                        
                        {/* 2. סיכום AI ומסקנות */}
                        <div className="rounded-xl border border-sky-400/30 bg-sky-900/10 p-6 shadow-xl backdrop-blur-md">
                            <h2 className="text-xl font-semibold mb-3 text-sky-300"> אבחון AI ראשוני (AI Diagnosis) </h2>
                            <p className="text-sky-100 border-t border-sky-400/20 pt-3"> **תקציר AI:** {details.ai_summary} </p>
                            <div className="mt-6 flex gap-4">
                                <button 
                                    onClick={handleGoToChat} // <--- חיבור הצ'אט
                                    className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-full flex items-center gap-2 transition"
                                >
                                    <MessageSquare className="w-5 h-5"/> מעבר לצ'אט עם הלקוח
                                </button>
                                <button 
                                    onClick={handleDownloadPdf} // <--- הורדת PDF
                                    className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-full flex items-center gap-2 transition"
                                >
                                    הורד קובץ אבחון (PDF)
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    {/* --- כרטיס פרטי לקוח (סיידבר) --- */}
                    <div className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md h-fit">
                        <h2 className="text-xl font-semibold mb-4 text-cyan-300 flex items-center gap-2">
                            <User className="w-5 h-5"/> פרטי לקוח ורכב
                        </h2>
                        <p className="text-slate-300 mt-2">**שם:** {details.client}</p>
                        <p className="text-slate-300">**טלפון:** {details.phone}</p>
                        <p className="text-slate-300 border-t border-white/10 mt-3 pt-3">
                            <Car className="w-4 h-4 inline-block ml-2"/> **רכב:** {details.car}
                        </p>
                        <p className="text-slate-300">**תאריך פנייה:** {details.date}</p>
                    </div>

                </section>
            </main>
        </div>
    );
}