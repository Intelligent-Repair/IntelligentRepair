"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Car, Calendar, Wrench, TrendingUp, Filter, CheckCircle } from "lucide-react";

type Repair = {
  id: string;
  ai_summary: string | null;
  mechanic_notes: string | null;
  issue_description: string | null; // תקלה מדווחת מ-mechanic_summary
  final_issue_type: string | null;
  created_at: string;
  request: {
    id: string;
    description: string | null;
    status: string;
    created_at: string;
    car_id: string | null;
    car: {
      id: string;
      license_plate: string | null;
      vehicle_catalog: {
        manufacturer: string | null;
        model: string | null;
      } | null;
    } | null;
  } | null;
  garage: {
    id: string;
    name: string | null;
  } | null;
};

type Vehicle = {
  id: string;
  label: string;
  licensePlate: string;
};

export default function UserRepairsPage() {
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<string>("all");

  useEffect(() => {
    const fetchRepairs = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setError("לא נמצא משתמש מחובר");
          setLoading(false);
          return;
        }

        // Step 1: Get all request IDs for this user
        const { data: userRequests, error: requestsError } = await supabase
          .from("requests")
          .select("id")
          .eq("user_id", user.id);

        if (requestsError) {
          throw new Error("שגיאה בטעינת הנתונים");
        }

        const requestIds = (userRequests || []).map(r => r.id);

        if (requestIds.length === 0) {
          setRepairs([]);
          setLoading(false);
          return;
        }

        // Step 2: Fetch repairs directly from repairs table with garage_requests join
        const { data: repairsData, error: repairsError } = await supabase
          .from("repairs")
          .select(`
            id,
            request_id,
            garage_request_id,
            mechanic_notes,
            ai_summary,
            final_issue_type,
            created_at,
            completed_at,
            vehicle_info,
            garage_request:garage_requests!garage_request_id (
              mechanic_summary,
              garage:garages!garage_id (
                id,
                garage_name
              )
            )
          `)
          .in("request_id", requestIds)
          .order("completed_at", { ascending: false, nullsFirst: false });

        if (repairsError) {
          throw new Error("שגיאה בטעינת היסטוריית הטיפולים");
        }

        // Step 3: Get car details
        const { data: requestsWithCars } = await supabase
          .from("requests")
          .select(`
            id,
            description,
            status,
            created_at,
            car_id,
            car:people_cars (
              id,
              license_plate,
              vehicle_catalog:vehicle_catalog_id (
                manufacturer,
                model
              )
            )
          `)
          .in("id", requestIds);

        const requestMap = new Map((requestsWithCars || []).map(r => [r.id, r]));

        // Transform data
        const transformedRepairs: Repair[] = (repairsData || []).map((repair: any) => {
          const request = requestMap.get(repair.request_id) as any;
          const vehicleInfo = repair.vehicle_info || {};
          // Supabase returns car as array, take first element
          const carData = Array.isArray(request?.car) ? request.car[0] : request?.car;

          // Extract issue description from mechanic_summary (like in report page)
          const garageReq = Array.isArray(repair.garage_request) ? repair.garage_request[0] : repair.garage_request;
          const ms = garageReq?.mechanic_summary;
          const issueDescription =
            ms?.diagnoses?.[0]?.issue ||
            ms?.topDiagnosis?.[0]?.name ||
            ms?.category ||
            ms?.originalComplaint ||
            null;

          // Extract garage info from nested garage object
          const garageData = garageReq?.garage;
          const garageInfo = Array.isArray(garageData) ? garageData[0] : garageData;

          return {
            id: repair.id,
            ai_summary: repair.ai_summary || null,
            mechanic_notes: repair.mechanic_notes || null,
            issue_description: issueDescription,
            final_issue_type: repair.final_issue_type || null,
            created_at: repair.completed_at || repair.created_at,
            request: request ? {
              id: request.id,
              description: repair.mechanic_notes || request.description,
              status: request.status,
              created_at: request.created_at,
              car_id: request.car_id,
              car: carData ? {
                id: carData.id,
                license_plate: carData.license_plate || null,
                vehicle_catalog: Array.isArray(carData.vehicle_catalog)
                  ? carData.vehicle_catalog[0] || null
                  : carData.vehicle_catalog || null,
              } : {
                id: null,
                license_plate: vehicleInfo.license_plate || null,
                vehicle_catalog: {
                  manufacturer: vehicleInfo.manufacturer || null,
                  model: vehicleInfo.model || null,
                }
              },
            } : null,
            garage: garageInfo ? {
              id: garageInfo.id,
              name: garageInfo.garage_name || null,
            } : null,
          };
        });

        setRepairs(transformedRepairs);
      } catch (err) {
        console.error("Error fetching repairs:", err);
        setError(err instanceof Error ? err.message : "שגיאה בטעינת הטיפולים");
      } finally {
        setLoading(false);
      }
    };

    fetchRepairs();
  }, []);

  // Extract unique vehicles from repairs
  const vehicles = useMemo<Vehicle[]>(() => {
    const vehicleMap = new Map<string, Vehicle>();
    repairs.forEach((repair) => {
      const car = repair.request?.car;
      if (car?.id) {
        vehicleMap.set(car.id, {
          id: car.id,
          label: `${car.vehicle_catalog?.manufacturer || ""} ${car.vehicle_catalog?.model || ""}`.trim() || "רכב",
          licensePlate: car.license_plate || "",
        });
      }
    });
    return Array.from(vehicleMap.values());
  }, [repairs]);

  // Filter repairs by selected vehicle
  const filteredRepairs = useMemo(() => {
    if (selectedVehicle === "all") return repairs;
    return repairs.filter((r) => r.request?.car?.id === selectedVehicle);
  }, [repairs, selectedVehicle]);

  // Calculate stats for filtered repairs
  const stats = useMemo(() => {
    const issueCount: Record<string, number> = {};
    filteredRepairs.forEach((r) => {
      const issue = r.final_issue_type || "other";
      issueCount[issue] = (issueCount[issue] || 0) + 1;
    });

    const topIssue = Object.entries(issueCount).sort((a, b) => b[1] - a[1])[0];

    return {
      total: filteredRepairs.length,
      topIssue: topIssue ? { type: topIssue[0], count: topIssue[1] } : null,
    };
  }, [filteredRepairs]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("he-IL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const issueTypeLabels: Record<string, string> = {
    engine: "מנוע",
    brakes: "בלמים",
    electrical: "חשמל",
    ac: "מיזוג",
    starting: "התנעה",
    gearbox: "גיר",
    noise: "רעשים",
    suspension: "מתלים",
    transmission: "תמסורת",
    fuel_system: "מע' דלק",
    cooling_system: "קירור",
    exhaust: "פליטה",
    tires: "צמיגים",
    steering: "הגה",
    other: "אחר",
  };

  if (loading) {
    return (
      <div className="bg-transparent text-white">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 shadow-2xl text-white w-full max-w-6xl mx-auto mt-8">
          <div className="flex items-center justify-center py-20">
            <div className="text-white/70 text-lg">טוען טיפולים...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-transparent text-white">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 shadow-2xl text-white w-full max-w-6xl mx-auto mt-8">
          <div className="text-red-400 text-center py-10">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-transparent text-white">
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 shadow-2xl text-white w-full max-w-6xl mx-auto mt-8">
        <h1 className="text-3xl font-bold mb-6 text-white">היסטוריית טיפולים</h1>

        {/* Filter and Stats Section */}
        <div className="flex flex-wrap gap-4 mb-8 items-center justify-between">
          {/* Vehicle Filter */}
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
            <Filter size={18} className="text-white/50" />
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className="bg-transparent text-white border-none focus:outline-none cursor-pointer"
              dir="rtl"
            >
              <option value="all" className="bg-gray-800">כל הרכבים</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id} className="bg-gray-800">
                  {v.label} ({v.licensePlate})
                </option>
              ))}
            </select>
          </div>

          {/* Stats Cards */}
          <div className="flex gap-4">
            <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-2">
              <Wrench size={18} className="text-blue-400" />
              <span className="text-blue-300 font-medium">{stats.total} טיפולים</span>
            </div>
          </div>
        </div>

        {filteredRepairs.length === 0 ? (
          <div className="text-center py-20 text-white/50">
            <Car size={48} className="mx-auto mb-4 opacity-30" style={{ transform: 'scaleX(-1)' }} />
            <p className="text-xl">אין טיפולים להצגה</p>
            {selectedVehicle !== "all" && (
              <button
                onClick={() => setSelectedVehicle("all")}
                className="mt-4 text-blue-400 hover:underline"
              >
                הצג את כל הרכבים
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {filteredRepairs.map((repair) => (
              <div
                key={repair.id}
                className="bg-gradient-to-br from-white/[0.07] to-white/[0.03] border border-white/10 rounded-2xl px-6 py-5 hover:border-white/20 hover:from-white/[0.09] hover:to-white/[0.05] transition-all duration-300 shadow-lg shadow-black/10"
                dir="rtl"
              >
                {/* Header Row */}
                <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                  {/* Right Side - Car Model & License Plate (Primary) */}
                  <div className="flex items-center gap-2">
                    <Car size={20} className="text-blue-400 flex-shrink-0" />
                    <h3 className="text-lg font-bold text-white">
                      {repair.request?.car
                        ? `${repair.request.car.vehicle_catalog?.manufacturer || ""} ${repair.request.car.vehicle_catalog?.model || ""} (${repair.request.car.license_plate || ""})`
                        : "רכב לא ידוע"}
                    </h3>
                  </div>

                  {/* Left Side - Date & Garage (Secondary) */}
                  <div className="flex items-center gap-2 text-sm text-gray-400" dir="ltr">
                    <span>{formatDate(repair.created_at)}</span>
                    {repair.garage?.name && (
                      <>
                        <span className="text-gray-600">•</span>
                        <span className="text-gray-400">מוסך: {repair.garage.name}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Category Badge */}
                {repair.final_issue_type && (
                  <div className="mb-4">
                    <span className="inline-flex items-center px-3 py-1 bg-purple-500/15 border border-purple-500/25 rounded-full text-purple-300 text-sm font-medium">
                      {issueTypeLabels[repair.final_issue_type] || repair.final_issue_type}
                    </span>
                  </div>
                )}

                {/* Issue Description */}
                <div className="mb-4">
                  <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                    תיאור תקלה
                  </span>
                  <p className="text-base text-gray-200 font-medium">
                    {repair.issue_description || repair.request?.description || "-"}
                  </p>
                </div>

                {/* Repair Summary */}
                {repair.ai_summary && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                      סיכום תיקון
                    </span>
                    <div className="flex items-start gap-2">
                      <CheckCircle size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                      <p className="text-emerald-400 font-medium">{repair.ai_summary}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

