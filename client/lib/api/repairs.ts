// lib/api/repairs.ts
// Client-side API helper functions for repairs
// Schema source: public.repairs table (2026-01-08)

// Valid status values (matches DB constraint)
export type RepairStatus = 'in_progress' | 'completed';

// Valid issue types (matches DB constraint)
export type FinalIssueType =
    | 'mechanical'
    | 'electrical'
    | 'bodywork'
    | 'software'
    | 'maintenance'
    | 'other';

// Vehicle info JSONB structure
export interface VehicleInfo {
    manufacturer?: string;
    model?: string;
    year?: number;
    license_plate?: string;
    mileage?: number;
    fuel_type?: string;
    [key: string]: any; // Allow additional fields
}

// Input for creating a new repair
export interface RepairInput {
    request_id: string;           // FK to requests
    garage_id: string;            // FK to garages
    garage_request_id?: string;   // FK to garage_requests (the accepted quote)
    mechanic_notes: string;       // Raw mechanic input
    problem_category: string;     // FK to problem_categories(code)
    final_issue_type: FinalIssueType;
    labor_hours: number;          // numeric(5,2)
    status: RepairStatus;
    vehicle_info?: VehicleInfo;   // JSONB
}

// Full repair record from database
export interface RepairData {
    id: string;                           // uuid PK
    request_id: string | null;            // FK to requests
    garage_id: string | null;             // FK to garages
    garage_request_id: string | null;     // FK to garage_requests
    status: RepairStatus;
    problem_category: string | null;
    final_issue_type: FinalIssueType | null;
    vehicle_info: VehicleInfo | null;     // JSONB
    mechanic_notes: string | null;
    mechanic_description_ai: string | null;  // AI-generated
    ai_summary: string | null;               // AI-generated
    labor_hours: number | null;           // numeric(5,2)
    created_at: string;
    updated_at: string;
    completed_at: string | null;
}

export interface RepairResponse {
    repair: RepairData;
    message: string;
}

export interface RepairError {
    error: string;
    details?: string;
}

/**
 * Submit repair data to the API with AI processing
 * @param input - The repair input data
 * @returns The created repair record
 * @throws Error if the API call fails
 */
export async function submitRepairData(input: RepairInput): Promise<RepairData> {
    const response = await fetch('/api/repairs/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
    });

    const data = await response.json();

    if (!response.ok) {
        const errorMessage = (data as RepairError).error || `HTTP ${response.status}`;
        const errorDetails = (data as RepairError).details;
        throw new Error(errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage);
    }

    return (data as RepairResponse).repair;
}

/**
 * Fetch repair data by request ID
 * @param requestId - The request UUID
 * @returns The repair data or null if not found
 */
export async function fetchRepairByRequestId(requestId: string): Promise<RepairData | null> {
    const response = await fetch(`/api/repairs/${requestId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as RepairError).error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.repair;
}

/**
 * Update an existing repair (for future use)
 * @param repairId - The repair UUID
 * @param updates - Partial repair data to update
 */
export async function updateRepair(
    repairId: string,
    updates: Partial<RepairInput>
): Promise<RepairData> {
    const response = await fetch(`/api/repairs/${repairId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error((data as RepairError).error || `HTTP ${response.status}`);
    }

    return data.repair;
}
