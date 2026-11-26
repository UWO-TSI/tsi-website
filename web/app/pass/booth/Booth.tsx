"use client";
/* eslint-disable @next/next/no-img-element -- data URLs from the canvas and QR, nothing to optimize */

import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { dither, newPhotoId } from "@/lib/genesis/booth";
import { photoQueue } from "./queue";

const PRINT_WIDTH = 576; // 80 mm paper at 203 dpi: 72 mm printable
const PHOTO_WIDTH = 1600;

type Phase = "ready" | "count" | "shot";

/**
 * The booth: a mirrored camera preview, a 3-2-1 countdown, the capture, the receipt (dithered photo, QR, line) sent to
 * the printer, and the colour photo queued for upload, retried until it lands so a bad venue connection never stops the
 * line. Space or the big button takes a photo.
 */
export default function Booth() {
  const video = useRef<HTMLVideoElement>(null);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [cam, setCam] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("ready");
  const [count, setCount] = useState(3);
  const [shot, setShot] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ photo: string; qr: string; id: string } | null>(null);
  const [pending, setPending] = useState(0);
  const [taken, setTaken] = useState(0);
  const [autoPrint, setAutoPrint] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Camera: the chosen one, or the first; the list fills once permission is given.
  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: { deviceId: cam ? { exact: cam } : undefined, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then(async (s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
        setCams((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput"));
        setError(null);
      })
      .catch(() => setError("The camera didn't start. Check it's plugged in and Chrome may use it."));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [cam]);

  // Upload queue: retried every 5 seconds until each photo lands.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const left = await photoQueue.flush(async (id, blob) => {
        const form = new FormData();
        form.set("id", id); form.set("photo", blob, `${id}.jpg`);
        const res = await fetch("/api/genesis/photo", { method: "POST", body: form, credentials: "include" });
        return res.ok;
      }).catch(() => -1);
      if (alive && left >= 0) setPending(left);
    };
    tick();
    const t = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const capture = useCallback(async () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const id = newPhotoId();
    // The colour photo, as the guest saw it (mirrored), for the pass.
    const c = document.createElement("canvas");
    c.width = PHOTO_WIDTH; c.height = Math.round((PHOTO_WIDTH * v.videoHeight) / v.videoWidth);
    const g = c.getContext("2d")!;
    g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(v, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), "image/jpeg", 0.9));
    await photoQueue.add(id, blob);
    setPending((n) => n + 1);
    setShot(c.toDataURL("image/jpeg", 0.8));
    // The receipt's black-and-white copy.
    const p = document.createElement("canvas");
    p.width = PRINT_WIDTH; p.height = Math.round((PRINT_WIDTH * c.height) / c.width);
    const pg = p.getContext("2d")!;
    pg.drawImage(c, 0, 0, p.width, p.height);
    const img = pg.getImageData(0, 0, p.width, p.height);
    dither(img.data, p.width, p.height);
    pg.putImageData(img, 0, 0);
    const qr = await QRCode.toDataURL(`https://genesis.tethos.ca/ph/${id}`, { margin: 1, width: 320, errorCorrectionLevel: "M" });
    setReceipt({ photo: p.toDataURL("image/png"), qr, id });
    setTaken((n) => n + 1);
  }, []);

  // Print once the receipt has rendered.
  useEffect(() => {
    if (!receipt || !autoPrint) return;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [receipt, autoPrint]);

  const start = useCallback(() => {
    if (phase !== "ready") return;
    setPhase("count"); setCount(3);
    let n = 3;
    const t = setInterval(() => {
      n -= 1;
      if (n > 0) { setCount(n); return; }
      clearInterval(t);
      setPhase("shot");
      capture().finally(() => setTimeout(() => { setShot(null); setPhase("ready"); }, 4000));
    }, 1000);
  }, [phase, capture]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); start(); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [start]);

  return (
    <div className="gb">
      <div className="gb-stage" onClick={start}>
        <video ref={video} autoPlay playsInline muted className="gb-video" />
        {phase === "count" && <div className="gb-count" key={count}>{count}</div>}
        {phase === "shot" && <div className="gb-flash" />}
        {shot && <img src={shot} alt="" className="gb-shot" />}
        {phase === "ready" && <div className="gb-hint">Tap to take your photo</div>}
      </div>
      <div className="gb-bar">
        <select value={cam} onChange={(e) => setCam(e.target.value)} aria-label="Camera">
          <option value="">Default camera</option>
          {cams.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Camera"}</option>)}
        </select>
        <label><input type="checkbox" checked={autoPrint} onChange={(e) => setAutoPrint(e.target.checked)} /> Print</label>
        {receipt && <button type="button" onClick={() => window.print()}>Reprint last</button>}
        <button type="button" onClick={() => document.documentElement.requestFullscreen?.()}>Full screen</button>
        <span>{taken} taken · {pending ? `${pending} uploading` : "all uploaded"}</span>
        {error && <span className="gb-err">{error}</span>}
      </div>
      {receipt && (
        <div className="gb-receipt" aria-hidden>
          <p className="gb-r-title">GENESIS 2027</p>
          <img src={receipt.photo} alt="" />
          <img src={receipt.qr} alt="" className="gb-r-qr" />
          <p>Scan for your photo in colour</p>
          <p className="gb-r-small">genesis.tethos.ca/ph/{receipt.id}</p>
        </div>
      )}
    </div>
  );
}
