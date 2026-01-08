// client/app/chats/[request_id]/page.tsx
'use client';

import { Send, ArrowLeft, Loader2, CheckCheck, X } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

// הגדרת טיפוסים
type Message = { id: number; text: string; sender: 'garage' | 'client' | 'system'; time: string; };

const mockMessages: Message[] = [
    { id: 1, text: "שלום, קיבלנו את האבחון המקוצר. אנא אשר שהפרטים נכונים.", sender: 'garage', time: '10:00' },
    { id: 2, text: "הפרטים נכונים, הבדיקה שלכם תואמת למה שחשבתי. מה הלאה?", sender: 'client', time: '10:05' },
    { id: 3, text: "הלקוח אישר את פרטי הבעיה. ניתן להתחיל טיפול.", sender: 'system', time: '10:06' }, 
];

// אפשרויות דמה לסוגי תקלות
const faultOptions = [
    'בדיקה מקיפה (כללי)', 'החלפת רפידות ודיסקים', 'תיקון מערכת קירור', 
    'החלפת חיישן O2/טיפול מנוע', 'טיפול תקופתי'
];


export default function GarageChatPage() {
    const params = useParams();
    const router = useRouter();
    const inquiryId = params.request_id as string; 
    
    const [messages, setMessages] = useState<Message[]>(mockMessages);
    const [isFinished, setIsFinished] = useState(false); 
    const [showFinalModal, setShowFinalModal] = useState(false); // *** State חדש למודאל ***
    const [finalCost, setFinalCost] = useState('');
    const [finalFault, setFinalFault] = useState(faultOptions[0]);
    
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null); 

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const addSystemMessage = (text: string) => { /* ... לוגיקה ... */ };
    const handleSendMessage = (e: React.FormEvent) => { /* ... לוגיקה ... */ };
    const handleAddTemplate = (template: string) => { /* ... לוגיקה ... */ };
    const isInputDisabled = isFinished || isSending;

    // --------------------------------------------------------
    // *** פונקציה לסיום טיפול ועדכון סטטוס ***
    // --------------------------------------------------------
    const handleFinalizeRepair = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isFinished) return;
        
        if (!finalCost || !finalFault) {
            alert('אנא הזן סכום לתשלום ובחר את סוג הטיפול הסופי.');
            return;
        }

        setShowFinalModal(false); // סגירת המודאל
        setIsFinished(true); // נעילת כפתורים

        // 1. שליחת הודעת סיום ללקוח (עם פרטים כספיים)
        const finalMessageText = `**הטיפול הושלם!** סוג הבעיה הסופי הוא: ${finalFault}. סכום לתשלום: ${finalCost}. רכבך מוכן לאיסוף.`;
        addSystemMessage(finalMessageText); 
        
        // 2. שמירת הנתונים האנליטיים (Backend Logic)
        /* const analyticsData = {
            inquiryId: inquiryId,
            finalCost: parseFloat(finalCost.replace(/[^0-9.]/g, '')), // ניקוי והמרה למספר
            finalFaultType: finalFault,
            // ... API call to save to Supabase/DB ...
        };
        console.log("Saving Final Analytics Data:", analyticsData);
        */

        // 3. עדכון סטטוס ב-DB (במקביל)

        // 4. ניתוב מחדש לרשימת הפניות
        setTimeout(() => {
            router.push('/garage/requests'); 
        }, 3000);
    };
    // --------------------------------------------------------
    

    // רכיב המודאל (Modal Component)
    const FinalizeModal = () => (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" dir="rtl">
            <div className="bg-zinc-900 rounded-xl border border-sky-400/30 w-full max-w-md p-6 shadow-2xl">
                
                <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-4">
                    <h2 className="text-2xl font-bold text-sky-300">סגירת טיפול סופית</h2>
                    <button onClick={() => setShowFinalModal(false)} className="text-slate-400 hover:text-white"><X className="w-6 h-6"/></button>
                </div>
                
                <p className="text-slate-300 mb-6">אנא הזן את פרטי הטיפול הסופיים לפני סגירת הפנייה.</p>

                <form onSubmit={handleFinalizeRepair} className="space-y-4">
                    
                    {/* 1. סכום לתשלום */}
                    <div>
                        <label className="text-sm text-slate-400 block mb-1">סכום לתשלום (₪)</label>
                        <input
                            type="number"
                            value={finalCost}
                            onChange={(e) => setFinalCost(e.target.value)}
                            placeholder="לדוגמה: 1500"
                            required
                            className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-right focus:ring-sky-500"
                            min="0"
                        />
                    </div>
                    
                    {/* 2. סוג תקלה סופית */}
                    <div>
                        <label className="text-sm text-slate-400 block mb-1">סוג הבעיה הסופית</label>
                        <select
                            value={finalFault}
                            onChange={(e) => setFinalFault(e.target.value)}
                            required
                            className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-right focus:ring-sky-500"
                        >
                            {faultOptions.map(fault => (
                                <option key={fault} value={fault}>{fault}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-3 mt-4 rounded-full bg-green-600 hover:bg-green-700 text-white font-semibold flex items-center justify-center gap-2"
                    >
                        <CheckCheck className="w-5 h-5"/> סגור פנייה ועדכן דשבורד
                    </button>
                </form>
            </div>
        </div>
    );

    return (
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white">
            {showFinalModal && <FinalizeModal />} {/* הצגת המודאל */}
            
            <main dir="rtl" className="relative mx-auto w-full max-w-4xl px-6 pb-4 pt-8 sm:px-10 lg:px-12">
                
                <div className="rounded-xl border border-white/10 bg-white/5 shadow-xl backdrop-blur-md flex flex-col h-[70vh]">
                    
                    {/* Header וניווט חזרה */}
                    <div className="p-6 border-b border-white/10 flex justify-between items-center">
                        {/* ... ניווט ... */}
                    </div>
                    
                    {/* כפתור סיום טיפול - עכשיו פותח מודאל */}
                    <div className="p-4 border-b border-white/10 text-center bg-green-900/20">
                        <button
                            onClick={() => setShowFinalModal(true)} // <--- פותח את המודאל
                            disabled={isFinished}
                            className={`
                                w-full py-2 px-4 rounded-lg font-semibold transition flex items-center justify-center gap-2
                                ${isFinished 
                                    ? 'bg-green-700 text-white/80 cursor-not-allowed' 
                                    : 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/30'
                                }
                            `}
                        >
                            {isFinished ? (
                                <>
                                    <CheckCheck className="w-5 h-5"/> טיפול הושלם ונשלח
                                </>
                            ) : (
                                "סמן טיפול כהושלם (מעביר לסטטוס 'נענה')"
                            )}
                        </button>
                    </div>

                    {/* חלון ההודעות (Messages Area) */}
                    <div className="flex-grow p-4 overflow-y-auto space-y-4">
                        {/* ... (הודעות) ... */}
                    </div>
                    
                    {/* שדה הקלט (Input Area) */}
                    <div className="p-4 border-t border-white/10">
                        {/* ... (תבניות ושדה הקלט) ... */}
                    </div>
                </div>
            </main>
        </div>
    );
}