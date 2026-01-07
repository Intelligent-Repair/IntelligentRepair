import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

type VehicleCatalog = { manufacturer: string | null; model: string | null; year: number | null };
type VehicleCatalogJoin = VehicleCatalog | VehicleCatalog[] | null | undefined;
type UserRow = { id: string; first_name: string | null; last_name: string | null; phone: string | null; email: string | null };
type UserJoin = UserRow | UserRow[] | null | undefined;
type CarRow = { id: string; license_plate: string | null; vehicle_catalog?: VehicleCatalogJoin; user?: UserJoin };
type CarJoin = CarRow | CarRow[] | null | undefined;
type RequestRow = {
  id: string;
  description: string | null;
  ai_mechanic_summary: string | null;
  status: string | null;
  image_urls: string[] | null;
  ai_diagnosis: unknown;
  ai_confidence: number | null;
  created_at: string;
  user_id: string | null;
  car?: CarJoin;
};

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * GET /api/garage/requests/list
 * 
 * Lists all requests for a garage with optional filters.
 * Query parameters:
 * - status: Filter by status (new, pending, answered, accepted, all)
 * - search: Search term for client name or car info
 */
export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") || "all";
    const searchTerm = searchParams.get("search") || "";

    // Authenticate the user (garage mechanic/owner)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get all requests with related data
    let query = supabase
      .from("requests")
      .select(`
        id,
        description,
        ai_mechanic_summary,
        status,
        image_urls,
        ai_diagnosis,
        ai_confidence,
        created_at,
        user_id,
        car:people_cars (
          id,
          license_plate,
          vehicle_catalog:vehicle_catalog_id (
            manufacturer,
            model,
            year
          ),
          user:users (
            id,
            first_name,
            last_name,
            phone,
            email
          )
        )
      `)
      .order("created_at", { ascending: false });

    // Apply status filter
    if (statusFilter !== "all") {
      if (statusFilter === "new") {
        query = query.eq("status", "open");
      } else if (statusFilter === "pending") {
        query = query.eq("status", "pending");
      } else if (statusFilter === "answered") {
        query = query.in("status", ["answered", "closed"]);
      } else if (statusFilter === "accepted") {
        query = query.eq("status", "accepted");
      } else {
        query = query.eq("status", statusFilter);
      }
    }

    const { data: requestsRaw, error: requestsError } = await query;

    if (requestsError) {
      return NextResponse.json(
        { error: "Failed to fetch requests", details: requestsError.message },
        { status: 500 }
      );
    }
    // Supabase nested selects can come back as arrays depending on FK metadata.
    // We normalize via `firstOrNull` below.
    const requests = (requestsRaw ?? []) as unknown as RequestRow[];

    // Apply search filter in memory
    let filteredRequests = requests;
    
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filteredRequests = filteredRequests.filter((req) => {
        const car = firstOrNull(req.car as CarJoin);
        const user = firstOrNull(car?.user as UserJoin);
        const catalog = firstOrNull(car?.vehicle_catalog as VehicleCatalogJoin);
        const fullName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim().toLowerCase();
        const manufacturer = (catalog?.manufacturer || "").toLowerCase();
        const model = (catalog?.model || "").toLowerCase();
        const licensePlate = (car?.license_plate || "").toLowerCase();

        return (
          fullName.includes(lowerSearchTerm) ||
          manufacturer.includes(lowerSearchTerm) ||
          model.includes(lowerSearchTerm) ||
          licensePlate.includes(lowerSearchTerm)
        );
      });
    }

    // Transform the data
    const transformedRequests = filteredRequests.map((req) => {
      const car = firstOrNull(req.car as CarJoin);
      const user = firstOrNull(car?.user as UserJoin);
      const catalog = firstOrNull(car?.vehicle_catalog as VehicleCatalogJoin);
      const manufacturer = catalog?.manufacturer ?? null;
      const model = catalog?.model ?? null;
      const year = catalog?.year ?? null;
      const problemDescription = req.ai_mechanic_summary || req.description || null;

      return {
        id: req.id,
        description: req.description || problemDescription,
        // Backward-compatible field name used by the UI. The DB does not have
        // `requests.problem_description`, so we map to `ai_mechanic_summary`.
        problem_description: problemDescription,
        status: req.status,
        image_urls: req.image_urls,
        ai_diagnosis: req.ai_diagnosis,
        ai_confidence: req.ai_confidence,
        created_at: req.created_at,
        client: user ? {
          id: user.id,
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          first_name: user.first_name,
          last_name: user.last_name,
          phone: user.phone,
          email: user.email,
        } : null,
        car: car ? {
          id: car.id,
          license_plate: car.license_plate,
          manufacturer: manufacturer,
          model: model,
          year: year,
          full_name: `${manufacturer || ''} ${model || ''} ${year ? `(${year})` : ''}`.trim(),
        } : null,
      };
    });

    return NextResponse.json({
      success: true,
      requests: transformedRequests,
      total: transformedRequests.length,
    });
  } catch (err) {
    console.error("Error fetching requests:", err);
    return NextResponse.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}
