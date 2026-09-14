"use client";

import { useRef, useState } from "react";
import { Camera, RefreshCw, SkipForward } from "lucide-react";
import { MIN_TOUCH_TARGET_PX } from "@/lib/consumer/triageUi";

export type CaptureQuality = {
  acceptable: boolean;
  issues: string[];
};

export type CapturedImageDraft = {
  file: File;
  previewUrl: string;
  quality: CaptureQuality;
};

type CameraCaptureProps = {
  onCapture: (draft: CapturedImageDraft | null) => void;
};

const MAX_FAILED_ATTEMPTS = 2;

function assessImageQuality(imageData: ImageData): CaptureQuality {
  const { data, width, height } = imageData;
  let brightnessTotal = 0;
  let edgeTotal = 0;
  let samples = 0;

  for (let y = 1; y < height - 1; y += 4) {
    for (let x = 1; x < width - 1; x += 4) {
      const index = (y * width + x) * 4;
      const r = data[index] ?? 0;
      const g = data[index + 1] ?? 0;
      const b = data[index + 2] ?? 0;
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      brightnessTotal += luminance;

      const right = data[index + 4] ?? r;
      const below = data[((y + 1) * width + x) * 4] ?? r;
      edgeTotal += Math.abs(luminance - (0.2126 * right + 0.7152 * g + 0.0722 * b));
      edgeTotal += Math.abs(luminance - (0.2126 * below + 0.7152 * g + 0.0722 * b));
      samples += 1;
    }
  }

  const averageBrightness = samples === 0 ? 0 : brightnessTotal / samples;
  const averageEdge = samples === 0 ? 0 : edgeTotal / samples;
  const issues: string[] = [];

  if (averageBrightness < 45) {
    issues.push("low_light");
  }
  if (averageBrightness > 230) {
    issues.push("glare");
  }
  if (averageEdge < 8) {
    issues.push("motion_blur");
  }

  return {
    acceptable: issues.length === 0,
    issues,
  };
}

export function CameraCapture({ onCapture }: CameraCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.src = objectUrl;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = Math.min(image.width, 640);
    canvas.height = Math.round((image.height / image.width) * canvas.width);
    const context = canvas.getContext("2d");
    if (!context) {
      setMessage("Unable to check image quality. You can skip the photo.");
      return;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const quality = assessImageQuality(imageData);

    if (!quality.acceptable) {
      const nextFailures = failedAttempts + 1;
      setFailedAttempts(nextFailures);
      setPreviewUrl(objectUrl);
      onCapture(null);
      setMessage(
        nextFailures >= MAX_FAILED_ATTEMPTS
          ? "Photo quality is still unclear. You can retry or skip and continue without a photo."
          : "Photo looks too dark, bright, or blurry. Try again with steadier lighting.",
      );
      return;
    }

    setFailedAttempts(0);
    setPreviewUrl(objectUrl);
    setMessage(null);
    onCapture({ file, previewUrl: objectUrl, quality });
  }

  return (
    <section aria-label="Optional photo" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <Camera className="mt-1 h-5 w-5 text-teal-800" aria-hidden />
        <div>
          <h2 className="text-base font-semibold text-slate-900">Optional photo</h2>
          <p className="mt-1 text-sm text-slate-600">
            Add a clear photo if it helps describe the concern. Photos stay private.
            You can skip this step.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        aria-label="Choose or take a photo"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
          style={{ minHeight: MIN_TOUCH_TARGET_PX }}
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="h-4 w-4" aria-hidden />
          Add photo
        </button>
        <button
          type="button"
          className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          style={{ minHeight: MIN_TOUCH_TARGET_PX }}
          onClick={() => inputRef.current?.click()}
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Retry
        </button>
        {failedAttempts >= MAX_FAILED_ATTEMPTS ? (
          <button
            type="button"
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            style={{ minHeight: MIN_TOUCH_TARGET_PX }}
            onClick={() => {
              onCapture(null);
              setPreviewUrl(null);
              setMessage("Continuing without a photo.");
            }}
          >
            <SkipForward className="h-4 w-4" aria-hidden />
            Skip photo
          </button>
        ) : null}
      </div>

      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Selected symptom photo preview"
          className="max-h-48 w-full rounded-xl object-cover"
        />
      ) : null}
      {message ? (
        <p className="text-sm text-slate-700" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
