"use client";

import { use, useEffect, useState } from "react";
import { Shield, Printer } from "lucide-react";
import QRCode from "qrcode";
import { useUser } from "@/components/portal/UserContext";
import { createClient } from "@/lib/supabase/client";

interface EventRow {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  qr_check_in_code: string | null;
}

export default function PrintEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { profile, loading } = useUser();
  const [row, setRow] = useState<EventRow | null>(null);
  const [rowLoading, setRowLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("events")
          .select("id, title, start_time, end_time, location, qr_check_in_code")
          .eq("id", id)
          .single();
        if (cancelled) return;
        if (error || !data) {
          setError(error?.message ?? "Event not found");
        } else {
          setRow(data as EventRow);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load event");
        }
      } finally {
        if (!cancelled) setRowLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!row?.qr_check_in_code) return;
    const checkInUrl = `https://tethos.org/student/check-in?code=${row.qr_check_in_code}`;
    let cancelled = false;
    QRCode.toDataURL(checkInUrl, { width: 400, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [row?.qr_check_in_code]);

  if (loading || rowLoading) {
    return (
      <p className="text-center py-8 font-mono text-sm text-gray-500 animate-pulse">
        Loading...
      </p>
    );
  }

  const tier = profile?.tier ?? 5;
  if (tier > 2) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white text-black">
        <div className="text-center">
          <Shield size={48} className="mx-auto text-gray-300 mb-4" />
          <h2 className="text-lg font-bold mb-2">Access Denied</h2>
          <p className="text-sm">T1/T2 clearance required for content admin.</p>
        </div>
      </div>
    );
  }

  if (error || !row) {
    return (
      <div className="min-h-screen bg-white text-black text-center py-8">
        <p className="font-mono text-sm text-red-600">
          {error ?? "Event not found"}
        </p>
      </div>
    );
  }

  const checkInUrl = row.qr_check_in_code
    ? `https://tethos.org/student/check-in?code=${row.qr_check_in_code}`
    : "";

  const dateStr = new Date(row.start_time).toLocaleString();
  const endStr = row.end_time ? new Date(row.end_time).toLocaleString() : null;

  return (
    <div className="print-shell min-h-screen bg-white text-black flex flex-col items-center justify-center p-8">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-shell { min-height: auto !important; }
          @page { margin: 1cm; }
        }
        .print-shell { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
      `}</style>

      <div className="no-print w-full max-w-2xl mb-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-xs uppercase tracking-wider rounded-md hover:opacity-80 transition-opacity"
        >
          <Printer size={14} /> Print
        </button>
      </div>

      <div className="w-full max-w-2xl text-center">
        <h1 className="text-3xl font-bold mb-2">{row.title}</h1>
        <p className="text-sm text-gray-700 mb-1">
          {dateStr}
          {endStr ? ` — ${endStr}` : null}
        </p>
        {row.location ? (
          <p className="text-sm text-gray-700 mb-6">{row.location}</p>
        ) : (
          <div className="mb-6" />
        )}

        <div className="flex justify-center mb-6">
          {qrDataUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={qrDataUrl}
              alt="QR check-in code"
              className="w-[400px] h-[400px]"
            />
          ) : (
            <div className="w-[400px] h-[400px] bg-gray-100 flex items-center justify-center text-sm text-gray-500">
              rendering QR...
            </div>
          )}
        </div>

        <p className="text-sm font-semibold mb-1">Scan to check in</p>
        <p className="text-xs text-gray-600 break-all max-w-md mx-auto">
          {checkInUrl}
        </p>
      </div>
    </div>
  );
}
