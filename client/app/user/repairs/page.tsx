"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

type Repair = {
  id: string;
  ai_summary: string | null;
  mechanic_notes: string | null;
  created_at: string;
  request: {
    id: string;
    description: string | null;
    status: string;
    created_at: string;
    car: {
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

export default function UserRepairsPage() {
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        const response = await fetch(`/api/repairs/by-user?user_id=${user.id}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "שגיאה בטעינת הטיפולים");
        }

        setRepairs(data.repairs || []);
      } catch (err) {
        console.error("Error fetching repairs:", err);
        setError(err instanceof Error ? err.message : "שגיאה בטעינת הטיפולים");
      } finally {
        setLoading(false);
      }
    };

    fetchRepairs();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("he-IL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
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
        <p className="text-white/70 text-lg mb-8">צפייה בכל הטיפולים שבוצעו על הרכב שלכם</p>

        {repairs.length === 0 ? (
          <div className="text-center py-20 text-white/50">
            <p className="text-xl">אין טיפולים להצגה</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-right py-4 px-6 font-semibold text-white">תאריך</th>
                  <th className="text-right py-4 px-6 font-semibold text-white">רכב</th>
                  <th className="text-right py-4 px-6 font-semibold text-white">בעיה</th>
                  <th className="text-right py-4 px-6 font-semibold text-white">סיכום AI</th>
                  <th className="text-right py-4 px-6 font-semibold text-white">הערות מכנית</th>
                  <th className="text-right py-4 px-6 font-semibold text-white">מוסך</th>
                </tr>
              </thead>
              <tbody>
                {repairs.map((repair) => (
                  <tr
                    key={repair.id}
                    className="border-b border-white/10 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-4 px-6 text-white/90">{formatDate(repair.created_at)}</td>
                    <td className="py-4 px-6 text-white/90">
                      {repair.request?.car
                        ? `${repair.request.car.vehicle_catalog?.manufacturer || ""} ${
                            repair.request.car.vehicle_catalog?.model || ""
                          } (${repair.request.car.license_plate || ""})`
                        : "-"}
                    </td>
                    <td className="py-4 px-6 text-white/90 max-w-md truncate">
                      {repair.request?.description || "-"}
                    </td>
                    <td className="py-4 px-6 text-white/90 max-w-md truncate">
                      {repair.ai_summary || "-"}
                    </td>
                    <td className="py-4 px-6 text-white/90 max-w-md truncate">
                      {repair.mechanic_notes || "-"}
                    </td>
                    <td className="py-4 px-6 text-white/90">
                      {repair.garage?.name || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
