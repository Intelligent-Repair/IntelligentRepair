'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle, AlertCircle, Wrench, FileText, Clock, Gauge } from 'lucide-react';

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
    { value: 'other', label: 'אחר' },
] as const;

// Extract values for zod enum
const issueTypeValues = ISSUE_TYPES.map(t => t.value) as [string, ...string[]];

// Validation schema
const repairFormSchema = z.object({
    mechanic_notes: z.string()
        .min(20, 'תיאור חייב להכיל לפחות 20 תווים')
        .max(5000, 'תיאור ארוך מדי'),
    final_issue_type: z.enum(issueTypeValues, { message: 'יש לבחור סוג תקלה' }),
    labor_hours: z.number()
        .min(0.5, 'מינימום חצי שעה')
        .max(100, 'מקסימום 100 שעות'),
    mileage: z.number()
        .min(0, 'קילומטראז לא יכול להיות שלילי')
        .max(1000000, 'קילומטראז לא תקין')
        .optional(),
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
}

export default function RepairCompletionForm({
    requestId,
    garageId,
    garageRequestId,
    vehicleInfo
}: RepairCompletionFormProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors },
        watch,
    } = useForm<RepairFormData>({
        resolver: zodResolver(repairFormSchema),
        defaultValues: {
            mechanic_notes: '',
            labor_hours: 1,
            mileage: undefined,
        },
    });

    const mechanicNotes = watch('mechanic_notes');

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
                    problem_category: null, // Not used anymore
                    final_issue_type: data.final_issue_type,
                    labor_hours: data.labor_hours,
                    status: 'completed',
                    vehicle_info: {
                        ...vehicleInfo,
                        current_mileage: data.mileage,
                    },
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

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Error Alert */}
            {error && (
                <div className="p-4 rounded-xl bg-red-900/40 border border-red-500/50 text-red-300 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Vehicle Info Banner (Read-only) */}
            {vehicleInfo && (
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                        <Gauge className="w-4 h-4" />
                        פרטי רכב
                    </div>
                    <div className="text-white font-medium">
                        {vehicleInfo.manufacturer} {vehicleInfo.model} {vehicleInfo.year && `(${vehicleInfo.year})`}
                        {vehicleInfo.license_plate && (
                            <span className="text-cyan-400 mr-2">• {vehicleInfo.license_plate}</span>
                        )}
                    </div>
                </div>
            )}

            {/* Mechanic Notes - Full Width */}
            <div>
                <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                    <FileText className="w-4 h-4" />
                    תיאור העבודה שבוצעה *
                </label>
                <textarea
                    {...register('mechanic_notes')}
                    rows={6}
                    className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                    dir="rtl"
                    placeholder="תאר בפירוט את התקלה שזוהתה ואת העבודה שבוצעה..."
                />
                <div className="flex justify-between mt-1">
                    {errors.mechanic_notes && (
                        <span className="text-red-400 text-sm">{errors.mechanic_notes.message}</span>
                    )}
                    <span className="text-slate-500 text-xs mr-auto">{mechanicNotes?.length || 0}/20 תווים לפחות</span>
                </div>
            </div>

            {/* Issue Type & Labor Hours Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Final Issue Type */}
                <div>
                    <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                        <Wrench className="w-4 h-4" />
                        סוג תקלה *
                    </label>
                    <select
                        {...register('final_issue_type')}
                        className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        dir="rtl"
                    >
                        <option value="">בחר סוג...</option>
                        {ISSUE_TYPES.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    {errors.final_issue_type && (
                        <span className="text-red-400 text-sm mt-1 block">{errors.final_issue_type.message}</span>
                    )}
                </div>

                {/* Labor Hours */}
                <div>
                    <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                        <Clock className="w-4 h-4" />
                        שעות עבודה *
                    </label>
                    <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        {...register('labor_hours', { valueAsNumber: true })}
                        className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        dir="ltr"
                    />
                    {errors.labor_hours && (
                        <span className="text-red-400 text-sm mt-1 block">{errors.labor_hours.message}</span>
                    )}
                </div>
            </div>

            {/* Mileage - Full Width */}
            <div>
                <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                    <Gauge className="w-4 h-4" />
                    קילומטראז נוכחי (אופציונלי)
                </label>
                <input
                    type="number"
                    {...register('mileage', { valueAsNumber: true })}
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    dir="ltr"
                    placeholder="הזן קילומטראז..."
                />
                {errors.mileage && (
                    <span className="text-red-400 text-sm mt-1 block">{errors.mileage.message}</span>
                )}
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4 pt-4">
                <button
                    type="button"
                    onClick={() => router.back()}
                    disabled={isSubmitting}
                    className="px-6 py-3 rounded-xl bg-slate-700 text-white hover:bg-slate-600 transition disabled:opacity-50"
                >
                    ביטול
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition disabled:opacity-50 flex items-center justify-center gap-2"
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
