"use client";

import { use, useEffect, useState } from "react";
import { Lock, Printer } from "lucide-react";
import QRCode from "qrcode";
import { useUser } from "@/components/portal/UserContext";
import { createClient } from "@/lib/supabase/client";
import { Button, Empty, ErrorNote, Loading } from "@/components/gui";

interface EventRow {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  qr_check_in_code: string | null;
}

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";
const ZONE = "America/Toronto";
const longDate = (d: Date) =>
  d.toLocaleString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: ZONE });
const timeOnly = (d: Date) => d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", timeZone: ZONE });
const sameDay = (a: Date, b: Date) =>
  a.toLocaleDateString("en-CA", { timeZone: ZONE }) === b.toLocaleDateString("en-CA", { timeZone: ZONE });

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
      <div className={PAGE}>
        <Loading label="Getting the event…" />
      </div>
    );
  }

  const tier = profile?.tier ?? 5;
  if (tier > 2) {
    return (
      <div className={`${PAGE} flex min-h-[60vh] items-center justify-center`}>
        <Empty icon={<Lock size={32} />} title="Admins only">
          Event admin is only open to the club’s admins.
        </Empty>
      </div>
    );
  }

  if (error || !row) {
    return (
      <div className={PAGE}>
        <ErrorNote>This event didn’t load ({error ?? "Event not found"}).</ErrorNote>
      </div>
    );
  }

  const checkInUrl = row.qr_check_in_code
    ? `https://tethos.org/student/check-in?code=${row.qr_check_in_code}`
    : "";

  const start = new Date(row.start_time);
  const end = row.end_time ? new Date(row.end_time) : null;
  const dateStr = longDate(start);
  const endStr = end ? (sameDay(start, end) ? timeOnly(end) : longDate(end)) : null;

  return (
    <div className="print-shell flex flex-col items-center px-5 pt-6 pb-16 sm:px-8">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-shell { min-height: auto !important; padding: 0 !important; }
          .print-sheet { box-shadow: none !important; }
          @page { margin: 1cm; }
        }
      `}</style>

      <div className="no-print mb-6 flex w-full max-w-2xl flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--gui-muted)]">
          Print this and put it up at the door. Members scan it to check in.
        </p>
        <Button size="sm" onClick={() => window.print()}>
          <Printer size={16} aria-hidden /> Print
        </Button>
      </div>

      <div className="print-sheet w-full max-w-2xl rounded-[var(--gui-r-card)] bg-white px-6 py-10 text-center shadow-[var(--gui-shadow-md)]">
        <h1 className="mb-2 text-3xl font-extrabold text-[var(--gui-ink-strong)]">{row.title}</h1>
        <p className="mb-1 text-base text-[var(--gui-ink-2)]">
          {dateStr}
          {endStr ? ` – ${endStr}` : null}
        </p>
        {row.location ? (
          <p className="mb-6 text-base text-[var(--gui-ink-2)]">{row.location}</p>
        ) : (
          <div className="mb-6" />
        )}

        <div className="mb-6 flex justify-center">
          {qrDataUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={qrDataUrl}
              alt="QR check-in code"
              className="h-[400px] w-[400px] max-w-full object-contain"
            />
          ) : (
            <div className="flex h-[400px] w-[400px] max-w-full items-center justify-center rounded-[var(--gui-r-card)] bg-[var(--gui-paper-warm)] px-6 text-sm font-bold text-[var(--gui-ink-2)]">
              {row.qr_check_in_code ? "Drawing the QR code…" : "This event has no check-in code yet."}
            </div>
          )}
        </div>

        <p className="mb-1 text-base font-extrabold text-[var(--gui-ink-strong)]">Scan to check in</p>
        <p className="mx-auto max-w-md break-all text-sm text-[var(--gui-ink-2)]">
          {checkInUrl}
        </p>
      </div>
    </div>
  );
}
