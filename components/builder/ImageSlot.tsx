"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { deleteStoredImage, saveStepImage, uploadStepImage } from "@/lib/firebase/stepImages";
import { MAX_INPUT_BYTES, MAX_STORED_BYTES, Shape, sizeText, sizeWarning, StepImage } from "@/lib/images";

// One picture spot on a message: an email's [IMAGE: ...] marker, or the
// image for a social post or ad. Empty, it's a drop zone that says which
// size is best. Pick a file and it opens the cropper (the shapes that fit
// this message, best first), then uploads the cropped picture and saves
// it on the step. Filled, it shows the picture with Replace, Download and
// Remove.

interface ImageSlotProps {
  campaignId: string | null;
  stepId: string;
  slot: string;
  /** What the picture should show, e.g. the email marker's text. */
  label: string;
  shapes: Shape[];
  image?: StepImage;
  onChange: (image: StepImage | null) => void;
}

export function ImageSlot({ campaignId, stepId, slot, label, shapes, image, onChange }: ImageSlotProps) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ img: HTMLImageElement; file: File; src: string } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const best = shapes[0];

  function pick(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (!/^image\/(jpeg|png|gif|webp)$/.test(f.type)) {
      setError("That file isn't a picture we can use. Try a JPG, PNG, GIF or WebP.");
      return;
    }
    if (f.size > MAX_INPUT_BYTES) {
      setError("That picture is over 20 MB. Try a smaller one.");
      return;
    }
    const src = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => setFile({ img, file: f, src });
    img.onerror = () => {
      URL.revokeObjectURL(src);
      setError("We couldn't open that picture. Try another one.");
    };
    img.src = src;
  }

  function closeCropper() {
    if (file) URL.revokeObjectURL(file.src);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function upload(blob: Blob, width: number, height: number, shape: Shape) {
    if (!user || !campaignId || !file) return;
    const name = file.file.name;
    closeCropper();
    setProgress(0);
    setError(null);
    try {
      const saved = await uploadStepImage({
        uid: user.uid,
        campaignId,
        stepId,
        slot,
        blob,
        width,
        height,
        shape: shape.id,
        name,
        onProgress: setProgress,
      });
      await saveStepImage(campaignId, stepId, slot, saved);
      if (image) deleteStoredImage(image.path);
      onChange(saved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        /unauthorized|permission/i.test(msg)
          ? "Couldn't save the picture. Make sure it's under 5 MB, then try again."
          : /bucket|storage\/no-default-bucket|invalid-argument/i.test(msg)
            ? "Picture uploads aren't switched on yet. Try again soon."
            : "Couldn't upload the picture. Check your connection and try again."
      );
    } finally {
      setProgress(null);
    }
  }

  async function remove() {
    if (!campaignId || !image) return;
    if (!window.confirm("Remove this picture?")) return;
    try {
      await saveStepImage(campaignId, stepId, slot, null);
      deleteStoredImage(image.path);
      onChange(null);
    } catch {
      setError("Couldn't remove the picture. Try again.");
    }
  }

  const shape = shapes.find((s) => s.id === image?.shape) ?? best;
  const warn = image ? sizeWarning(image.width, shape) : null;

  return (
    <div className="w-full text-left">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />

      {image ? (
        <div className="rounded-2xl bg-[#F4F4F5] p-3 flex flex-col sm:flex-row gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- user upload, sized by its own aspect */}
          <img
            src={image.url}
            alt={label || "Your picture"}
            className="w-full sm:w-[180px] max-h-[240px] object-contain rounded-xl bg-white"
          />
          <div className="flex-grow min-w-0 flex flex-col gap-1.5">
            {label && <div className="text-[14px] font-semibold leading-snug">{label}</div>}
            <div className="text-[13px] text-muted">
              {image.width} × {image.height} · {shape.label}
            </div>
            {warn && <div className="text-[13px] text-warnFg">{warn}</div>}
            <div className="flex flex-wrap gap-2 mt-auto pt-2">
              <a
                href={image.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] bg-slate text-white text-[13px] font-semibold"
              >
                <DownloadIcon /> Download
              </a>
              <button
                onClick={() => inputRef.current?.click()}
                disabled={progress !== null}
                className="h-9 px-3.5 rounded-[10px] border border-[#E3E1E8] bg-white text-[13px] font-semibold"
              >
                Replace
              </button>
              <button onClick={remove} className="h-9 px-3 rounded-[10px] text-[13px] font-semibold text-muted hover:text-dangerFg">
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
        {label && <div className="text-[13px] text-muted mb-2">{label}</div>}
        <button
          type="button"
          disabled={!campaignId || progress !== null}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          title={!campaignId ? "Write the campaign first, then add pictures." : label ? `Add image: ${label}` : "Add an image"}
          // A plain grey tile in the shape of the picture it's waiting
          // for: tall for posts, wide for emails.
          style={{ aspectRatio: best.height ? `${best.width} / ${best.height}` : "2 / 1" }}
          className={`group relative overflow-hidden flex flex-col items-center justify-center gap-1.5 rounded-2xl transition-colors ${
            best.height ? "w-[180px]" : "w-full max-h-[160px]"
          } ${dragOver ? "bg-[#ECEAF0]" : "bg-[#F4F4F5] hover:bg-[#EEEEF0]"} disabled:cursor-default`}
        >
          {progress !== null && (
            <span
              aria-hidden="true"
              className="absolute left-0 bottom-0 h-[3px] bg-slate transition-[width] duration-200"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          )}
          <span className="text-[#A1A1AA] group-hover:text-[#71717A] transition-colors">
            <PictureIcon />
          </span>
          <span className="text-[13px] font-medium text-[#71717A]">
            {progress !== null ? `Uploading ${Math.round(progress * 100)}%` : !campaignId ? "Write first" : "Add image"}
          </span>
          <span className="font-mono text-[11px] text-[#A1A1AA]">{sizeText(best)}</span>
        </button>
        </>
      )}

      {error && <div className="mt-2 text-[13px] text-warnFg">{error}</div>}

      {file && (
        <Cropper
          img={file.img}
          file={file.file}
          shapes={shapes}
          onCancel={closeCropper}
          onDone={upload}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cropper                                                             */
/* ------------------------------------------------------------------ */

const FRAME_MAX = 420;

function Cropper({
  img,
  file,
  shapes,
  onCancel,
  onDone,
}: {
  img: HTMLImageElement;
  file: File;
  shapes: Shape[];
  onCancel: () => void;
  onDone: (blob: Blob, width: number, height: number, shape: Shape) => void;
}) {
  const [shape, setShape] = useState<Shape>(shapes[0]);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [frameMax, setFrameMax] = useState(FRAME_MAX);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const fit = () => setFrameMax(Math.min(FRAME_MAX, window.innerWidth - 72, window.innerHeight - 330));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const keep = shape.height === null;
  const aspect = keep ? iw / ih : shape.width / (shape.height as number);
  const fw = aspect >= 1 ? frameMax : Math.round(frameMax * aspect);
  const fh = aspect >= 1 ? Math.round(frameMax / aspect) : frameMax;
  const scale = Math.max(fw / iw, fh / ih) * (keep ? 1 : zoom);
  const sw = iw * scale;
  const sh = ih * scale;
  const clamp = (p: { x: number; y: number }) => ({
    x: Math.min(0, Math.max(fw - sw, p.x)),
    y: Math.min(0, Math.max(fh - sh, p.y)),
  });

  // Centre the picture whenever the shape changes.
  useEffect(() => {
    setZoom(1);
  }, [shape.id]);
  useEffect(() => {
    setPos({ x: (fw - sw) / 2, y: (fh - sh) / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape.id, fw, fh]);

  const p = clamp(pos);
  const isGif = file.type === "image/gif";

  async function done() {
    setBusy(true);
    try {
      // An email picture kept at its own shape that's already small
      // enough is stored as is: GIFs keep their animation, logos keep
      // their sharp edges.
      if (keep && file.size <= MAX_STORED_BYTES && (isGif || iw <= shape.width)) {
        onDone(file, iw, ih, shape);
        return;
      }
      const outW = keep ? Math.min(shape.width, iw) : shape.width;
      const outH = keep ? Math.round(outW / aspect) : (shape.height as number);
      const k = outW / fw;
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      const png = file.type === "image/png" && keep;
      if (!png) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, outW, outH);
      }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, p.x * k, p.y * k, sw * k, sh * k);
      let quality = 0.9;
      let blob = await toBlob(canvas, png ? "image/png" : "image/jpeg", quality);
      while (blob && blob.size > MAX_STORED_BYTES && !png && quality > 0.5) {
        quality -= 0.1;
        blob = await toBlob(canvas, "image/jpeg", quality);
      }
      if (blob && blob.size > MAX_STORED_BYTES && png) {
        blob = await toBlob(canvas, "image/jpeg", 0.85);
      }
      if (!blob || blob.size > MAX_STORED_BYTES) throw new Error("too big");
      onDone(blob, outW, outH, shape);
    } catch {
      setBusy(false);
      window.alert("Couldn't get that picture ready. Try a different one.");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[rgba(15,12,20,0.6)]" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Crop your picture"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[520px] max-h-full overflow-y-auto bg-paper rounded-[24px] shadow-2xl p-5 sm:p-6 flex flex-col gap-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[18px] font-semibold">Crop your picture</h2>
          <button onClick={onCancel} aria-label="Close" className="w-9 h-9 rounded-[10px] bg-ivory flex items-center justify-center text-muted">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Shape">
          {shapes.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setShape(s)}
              aria-pressed={shape.id === s.id}
              className={`h-9 px-3.5 rounded-full text-[13px] font-semibold border ${
                shape.id === s.id ? "bg-slate text-white border-slate" : "bg-white text-slate border-[#E3E1E8]"
              }`}
            >
              {s.label}
              {i === 0 && <span className={shape.id === s.id ? "text-white/70" : "text-[#15803D]"}> · Best</span>}
            </button>
          ))}
        </div>
        <div className="text-[13px] text-muted -mt-1">
          {sizeText(shape)}. {shape.note}.
        </div>

        <div className="flex justify-center">
          <div
            className="relative overflow-hidden rounded-xl bg-[#F2F1F5] touch-none select-none"
            style={{ width: fw, height: fh, cursor: keep ? "default" : "grab" }}
            onPointerDown={(e) => {
              if (keep) return;
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, px: p.x, py: p.y };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              setPos(clamp({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }));
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the picked file */}
            <img
              src={img.src}
              alt=""
              draggable={false}
              style={{ position: "absolute", left: p.x, top: p.y, width: sw, height: sh, maxWidth: "none" }}
            />
            {!keep && (
              <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.6)" }}>
                <div className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
                <div className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
                <div className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
                <div className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
              </div>
            )}
          </div>
        </div>

        {!keep ? (
          <label className="flex items-center gap-3 text-[13px] text-muted">
            Zoom
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => {
                const z = Number(e.target.value);
                // Zoom around the centre of the frame.
                const cx = (fw / 2 - p.x) / sw;
                const cy = (fh / 2 - p.y) / sh;
                const ns = Math.max(fw / iw, fh / ih) * z;
                setZoom(z);
                setPos({ x: fw / 2 - cx * iw * ns, y: fh / 2 - cy * ih * ns });
              }}
              className="flex-grow accent-[#17131F]"
            />
          </label>
        ) : (
          <div className="text-[13px] text-muted">
            {isGif ? "GIFs keep their animation." : "The whole picture is used, sized for email."}
          </div>
        )}
        {!keep && <div className="text-[12px] text-faint -mt-2">Drag the picture to move it.</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="h-11 px-4 rounded-xl border border-[#E3E1E8] text-[14px] font-semibold">
            Cancel
          </button>
          <button
            onClick={done}
            disabled={busy}
            className="h-11 px-5 rounded-xl bg-slate text-white text-[14px] font-semibold disabled:opacity-60"
          >
            {busy ? "Getting it ready..." : "Use this picture"}
          </button>
        </div>
      </div>
    </div>
  );
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function PictureIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="M21 16l-5-5-8 9" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </svg>
  );
}
