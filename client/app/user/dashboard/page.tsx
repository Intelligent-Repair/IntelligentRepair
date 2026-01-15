"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

type Request = {
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
};

export default function UserDashboardPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setError("לא נמצא משתמש מחובר");
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/requests/by-user?user_id=${user.id}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "שגיאה בטעינת הפניות");
        }

        setRequests(data.requests || []);
      } catch (err) {
        console.error("Error fetching requests:", err);
        setError(err instanceof Error ? err.message : "שגיאה בטעינת הפניות");
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
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

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { text: string; className: string }> = {
      open: { text: "פתוח", className: "bg-blue-500/20 text-blue-300" },
      in_progress: { text: "בטיפול", className: "bg-yellow-500/20 text-yellow-300" },
      pending_quotes: { text: "ממתין להצעות", className: "bg-orange-500/20 text-orange-300" },
      pending_approval: { text: "ממתין לאישור", className: "bg-purple-500/20 text-purple-300" },
      approved: { text: "אושר", className: "bg-teal-500/20 text-teal-300" },
      completed: { text: "הושלם", className: "bg-green-500/20 text-green-300" },
      closed: { text: "נסגר ללא טיפול", className: "bg-gray-500/20 text-gray-300" },
      cancelled: { text: "בוטל", className: "bg-red-500/20 text-red-300" },
      rejected: { text: "נדחה", className: "bg-red-500/20 text-red-300" },
    };

    const statusInfo = statusMap[status] || { text: status, className: "bg-gray-500/20 text-gray-300" };

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${statusInfo.className}`}>
        {statusInfo.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-transparent text-white">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 shadow-2xl text-white w-full max-w-6xl mx-auto mt-8">
          <div className="flex items-center justify-center py-20">
            <div className="text-white/70 text-lg">טוען פניות...</div>
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
        <h1 className="text-3xl font-bold mb-6 text-white">היסטוריית פניות</h1>
        <p className="text-white/70 text-lg mb-8">כאן תוכלו לראות את כל הפניות והצ'אטים שלכם</p>

        {requests.length === 0 ? (
          <div className="text-center py-20 text-white/50">
            <p className="text-xl">אין פניות להצגה</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-right py-4 px-6 font-semibold text-white">תאריך</th>
                  <th className="text-right py-4 px-6 font-semibold text-white">תיאור</th>
                  <th className="text-right py-4 px-6 font-semibold text-white">רכב</th>
                  <th className="text-right py-4 px-6 font-semibold text-white">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr
                    key={request.id}
                    className="border-b border-white/10 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-4 px-6 text-white/90">{formatDate(request.created_at)}</td>
                    <td className="py-4 px-6 text-white/90 max-w-md truncate">
                      {request.description || "-"}
                    </td>
                    <td className="py-4 px-6 text-white/90">
                      {request.car
                        ? `${request.car.vehicle_catalog?.manufacturer || ""} ${request.car.vehicle_catalog?.model || ""
                        } (${request.car.license_plate || ""})`
                        : "-"}
                    </td>
                    <td className="py-4 px-6">{getStatusBadge(request.status)}</td>
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
