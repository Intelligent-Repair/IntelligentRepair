'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle, AlertCircle, Wrench, FileText, Clock, Car, AlertTriangle } from 'lucide-react';

// Issue type options with Hebrew labels
const ISSUE_TYPES = [
    { value: 'engine', label: 'מנוע' },
    { value: 'brakes', label: 'בלמים' },
    { value: 'electrical', label: 'חשמל' },
    { value: 'ac', label: 'מיזוג אוויר' },
    { value: 'starting', label: 'מערכת התנעה' },
    { value: 'gearbox', label: 'תיבת הילוכים' },
    { value: 'noise', label: 'רעש/רטט' },
    { value: 'suspension', label: 'מתלים' },
    { value: 'transmission', label: 'הנעה (Transmission)' },
    { value: 'fuel_system', label: 'מערכת דלק' },
    { value: 'cooling_system', label: 'מערכת קירור' },
    { value: 'exhaust', label: 'פליטה (אגזוז)' },
    { value: 'tires', label: 'צמיגים' },
    { value: 'steering', label: 'היגוי' },
    { value: 'oil_system', label: 'מערכת שמן' },
    { value: 'sensors', label: 'חיישנים' },
    { value: 'other', label: 'אחר' },
] as const;

// Quick tags for common fixes
const QUICK_TAGS = [
    'החלפת חיישן',
    'החלפת שמן',
    'איפוס קוד שגיאה',
    'החלפת פילטר',
    'תיקון חשמלי',
    'החלפת חלק',
    'בדיקה ותיקון',
];

// Extract values for zod enum
const issueTypeValues = ISSUE_TYPES.map(t => t.value) as [string, ...string[]];

const repairFormSchema = z.object({
    mechanic_notes: z.string()
        .min(20, 'תיאור חייב להכיל לפחות 20 תווים')
        .max(5000, 'תיאור ארוך מדי'),
    final_issue_type: z.enum(issueTypeValues, { message: 'יש לבחור סוג תקלה' }),
    labor_hours: z.number()
        .min(0.5, 'מינימום חצי שעה')
        .max(100, 'מקסימום 100 שעות'),
});

type RepairFormData = z.infer<typeof repairFormSchema>;

interface RepairCompletionFormProps {
    requestId: string;
    garageId: string;
    garageRequestId: string;
    vehicleInfo?: {
        manufacturer?: string;
        model?: string;
        year?: number;
        license_plate?: string;
    };
    primaryDiagnosis?: string;
}

export default function RepairCompletionForm({
    requestId,
    garageId,
    garageRequestId,
    vehicleInfo,
    primaryDiagnosis
}: RepairCompletionFormProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors },
        watch,
        setValue,
        getValues,
    } = useForm<RepairFormData>({
        resolver: zodResolver(repairFormSchema),
        defaultValues: {
            mechanic_notes: '',
            labor_hours: 1,
        },
    });

    const mechanicNotes = watch('mechanic_notes');

    // Handle quick tag click - append tag to notes
    const handleQuickTag = (tag: string) => {
        const current = getValues('mechanic_notes');
        const prefix = current.trim() ? current.trim() + '\n' : '';
        setValue('mechanic_notes', prefix + `• ${tag}`);
    };

    const onSubmit = async (data: RepairFormData) => {
        setIsSubmitting(true);
        setError(null);

        try {
            // Step 1: Create repair record
            const repairRes = await fetch('/api/repairs/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    request_id: requestId,
                    garage_id: garageId,
                    garage_request_id: garageRequestId,
                    mechanic_notes: data.mechanic_notes,
                    problem_category: null,
                    final_issue_type: data.final_issue_type,
                    labor_hours: data.labor_hours,
                    status: 'completed',
                    vehicle_info: vehicleInfo,
                }),
            });

            const repairData = await repairRes.json();

            if (!repairRes.ok) {
                throw new Error(repairData.error || 'שגיאה ביצירת רשומת תיקון');
            }

            // Step 2: Update garage_request status to completed
            const updateRes = await fetch(`/api/garage/requests/${garageRequestId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'completed' }),
            });

            if (!updateRes.ok) {
                console.warn('Failed to update garage_request status');
            }

            // Success - redirect to dashboard
            router.push('/garage/requests');
        } catch (err) {
            console.error('Error completing repair:', err);
            setError(err instanceof Error ? err.message : 'שגיאה בשמירת התיקון');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Glass input styles - lighter background
    const inputClass = "w-full p-3 bg-slate-800/50 border border-white/10 rounded-xl text-white text-right placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all";
    const selectClass = "w-full p-3 bg-slate-800/50 border border-white/10 rounded-xl text-white text-right focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all";

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Error Alert */}
            {error && (
                <div className="p-4 rounded-xl bg-red-900/40 border border-red-500/50 text-red-300 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* ===== Job Context Card - Centered ===== */}
            <div className="p-5 rounded-xl bg-slate-800/60 border border-cyan-500/30 backdrop-blur-sm text-center">
                {/* Vehicle Info - Centered */}
                <div className="flex flex-col items-center gap-2 mb-4">
                    <div className="p-3 rounded-full bg-cyan-500/20">
                        <Car className="w-6 h-6 text-cyan-400" />
                    </div>
                    <p className="text-xl font-bold text-white">
                        {vehicleInfo?.manufacturer} {vehicleInfo?.model} {vehicleInfo?.year && `(${vehicleInfo.year})`}
                    </p>
                    {vehicleInfo?.license_plate && (
                        <p className="text-sm text-slate-400 font-mono" dir="ltr">{vehicleInfo.license_plate}</p>
                    )}
                </div>

                {/* Diagnosis - Centered */}
                {primaryDiagnosis && (
                    <div className="flex items-center justify-center gap-2 pt-3 border-t border-slate-700/50">
                        <AlertTriangle className="w-4 h-4 text-orange-400" />
                        <span className="text-sm text-slate-400">תקלה מדווחת:</span>
                        <span className="text-gray-100 font-bold">{primaryDiagnosis}</span>
                    </div>
                )}
            </div>

            {/* ===== Mechanic Notes with Quick Tags ===== */}
            <div>
                <label className="block text-right text-sm text-slate-300 font-semibold mb-2">
                    <FileText className="w-4 h-4 text-cyan-400 inline-block ml-2" />
                    תיאור העבודה שבוצעה
                </label>
                <textarea
                    {...register('mechanic_notes')}
                    rows={5}
                    className={`${inputClass} resize-none`}
                    dir="rtl"
                    placeholder="תאר בפירוט את התקלה שזוהתה ואת העבודה שבוצעה..."
                />

                {/* Quick Tags - Ghost style, Centered */}
                <div className="flex flex-wrap gap-2 mt-3 justify-center">
                    {QUICK_TAGS.map((tag) => (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => handleQuickTag(tag)}
                            className="px-3 py-1 rounded-full bg-transparent border border-slate-600 text-slate-400 text-xs hover:bg-cyan-500/20 hover:border-cyan-500 hover:text-cyan-300 transition-all"
                        >
                            {tag}
                        </button>
                    ))}
                </div>

                <div className="flex justify-between mt-2">
                    {errors.mechanic_notes && (
                        <span className="text-red-400 text-sm">{errors.mechanic_notes.message}</span>
                    )}
                    <span className="text-slate-500 text-xs mr-auto">{mechanicNotes?.length || 0}/20 תווים לפחות</span>
                </div>
            </div>

            {/* ===== Issue Type & Labor Hours (2 columns - RTL) ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" dir="rtl">
                {/* Final Issue Type - First in DOM = Right side for RTL */}
                <div>
                    <label className="block text-right text-sm text-slate-300 font-semibold mb-2">
                        <Wrench className="w-4 h-4 text-cyan-400 inline-block ml-2" />
                        סוג תקלה
                    </label>
                    <select
                        {...register('final_issue_type')}
                        className={selectClass}
                        dir="rtl"
                    >
                        <option value="">בחר סוג...</option>
                        {ISSUE_TYPES.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    {errors.final_issue_type && (
                        <span className="text-red-400 text-sm mt-1 block text-right">{errors.final_issue_type.message}</span>
                    )}
                </div>

                {/* Labor Hours - Second in DOM = Left side for RTL */}
                <div>
                    <label className="block text-right text-sm text-slate-300 font-semibold mb-2">
                        <Clock className="w-4 h-4 text-cyan-400 inline-block ml-2" />
                        שעות עבודה
                    </label>
                    <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        {...register('labor_hours', { valueAsNumber: true })}
                        className={`${inputClass} text-left`}
                        dir="ltr"
                    />
                    {errors.labor_hours && (
                        <span className="text-red-400 text-sm mt-1 block text-right">{errors.labor_hours.message}</span>
                    )}
                </div>
            </div>

            {/* ===== Submit Buttons ===== */}
            <div className="flex items-center gap-6 pt-4">
                <button
                    type="button"
                    onClick={() => router.back()}
                    disabled={isSubmitting}
                    className="text-slate-400 hover:text-white transition disabled:opacity-50"
                >
                    ביטול
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] hover:from-blue-500 hover:to-indigo-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            מעבד ושומר...
                        </>
                    ) : (
                        <>
                            <CheckCircle className="w-5 h-5" />
                            סיים וסגור טיפול
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
