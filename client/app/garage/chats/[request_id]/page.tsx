// client/app/chats/[request_id]/page.tsx
'use client';

import { Send, ArrowLeft, CheckCheck, X } from 'lucide-react';
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

type FinalizeModalProps = {
    finalCost: string;
    finalFault: string;
    onClose: () => void;
    onFinalize: (e: React.FormEvent) => void;
    setFinalCost: (value: string) => void;
    setFinalFault: (value: string) => void;
};

// רכיב המודאל (Modal Component) – חייב להיות מחוץ לרנדר כדי לא ליצור קומפוננטה בזמן render
function FinalizeModal({
    finalCost,
    finalFault,
    onClose,
    onFinalize,
    setFinalCost,
    setFinalFault,
}: FinalizeModalProps) {
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" dir="rtl">
            <div className="bg-zinc-900 rounded-xl border border-sky-400/30 w-full max-w-md p-6 shadow-2xl">
                <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-4">
                    <h2 className="text-2xl font-bold text-sky-300">סגירת טיפול סופית</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <p className="text-slate-300 mb-6">אנא הזן את פרטי הטיפול הסופיים לפני סגירת הפנייה.</p>

                <form onSubmit={onFinalize} className="space-y-4">
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
                            {faultOptions.map((fault) => (
                                <option key={fault} value={fault}>
                                    {fault}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-3 mt-4 rounded-full bg-green-600 hover:bg-green-700 text-white font-semibold flex items-center justify-center gap-2"
                    >
                        <CheckCheck className="w-5 h-5" /> סגור פנייה ועדכן דשבורד
                    </button>
                </form>
            </div>
        </div>
    );
}

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

    const addSystemMessage = (text: string) => {
        setMessages((prev) => [
            ...prev,
            {
                id: prev.length + 1,
                text,
                sender: 'system',
                time: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
            },
        ]);
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isInputDisabled) return;
        const trimmed = input.trim();
        if (!trimmed) return;

        setIsSending(true);
        setMessages((prev) => [
            ...prev,
            {
                id: prev.length + 1,
                text: trimmed,
                sender: 'garage',
                time: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
            },
        ]);
        setInput('');

        // דמו: "שליחה" קצרה
        await new Promise((r) => setTimeout(r, 300));
        setIsSending(false);
    };

    const handleAddTemplate = (template: string) => {
        if (isInputDisabled) return;
        setInput(template);
    };
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

    return (
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white">
            {showFinalModal && (
                <FinalizeModal
                    finalCost={finalCost}
                    finalFault={finalFault}
                    setFinalCost={setFinalCost}
                    setFinalFault={setFinalFault}
                    onClose={() => setShowFinalModal(false)}
                    onFinalize={handleFinalizeRepair}
                />
            )}
            
            <main dir="rtl" className="relative mx-auto w-full max-w-4xl px-6 pb-4 pt-8 sm:px-10 lg:px-12">
                
                <div className="rounded-xl border border-white/10 bg-white/5 shadow-xl backdrop-blur-md flex flex-col h-[70vh]">
                    
                    {/* Header וניווט חזרה */}
                    <div className="p-6 border-b border-white/10 flex justify-between items-center">
                        <button
                            onClick={() => router.push('/garage/requests')}
                            className="text-sky-400 hover:text-sky-300 flex items-center gap-2 transition"
                        >
                            <ArrowLeft className="w-5 h-5" /> חזרה
                        </button>
                        <div className="text-slate-300 text-sm">פנייה: {inquiryId}</div>
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
                        {messages.map((m) => (
                            <div
                                key={m.id}
                                className={[
                                    'max-w-[85%] rounded-2xl px-4 py-2 border',
                                    m.sender === 'garage'
                                        ? 'mr-auto bg-sky-600/20 border-sky-500/30 text-sky-100'
                                        : m.sender === 'client'
                                            ? 'ml-auto bg-white/10 border-white/10 text-slate-100'
                                            : 'mx-auto bg-zinc-800/60 border-zinc-700/50 text-slate-200',
                                ].join(' ')}
                            >
                                <div className="text-xs text-slate-400 mb-1">{m.time}</div>
                                <div className="whitespace-pre-wrap text-sm">{m.text}</div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                    
                    {/* שדה הקלט (Input Area) */}
                    <div className="p-4 border-t border-white/10">
                        <div className="flex flex-wrap gap-2 mb-3">
                            {faultOptions.map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => handleAddTemplate(t)}
                                    disabled={isInputDisabled}
                                    className="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-slate-200 text-xs hover:border-cyan-500 disabled:opacity-50"
                                >
                                    {t}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                            <input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={isInputDisabled}
                                placeholder="כתוב הודעה..."
                                className="flex-1 p-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm"
                            />
                            <button
                                type="submit"
                                disabled={isInputDisabled}
                                className="p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 disabled:bg-zinc-700 text-white flex items-center gap-2"
                            >
                                <Send className="w-4 h-4" /> שלח
                            </button>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
}