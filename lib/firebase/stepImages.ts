import { deleteField, doc, updateDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, getStorage, listAll, ref, uploadBytesResumable } from "firebase/storage";
import { db, firebaseApp } from "./client";
import { StepImage } from "../images";

// Pictures on campaign messages. The file lives in Firebase Storage at
// users/{uid}/campaigns/{campaignId}/{stepId}/{slot}-{time}.{ext} (see
// storage.rules: only that user, images only, under 5 MB). The step doc
// keeps a small record of it under images.{slot}.

function storage() {
  // Created on first use, so pages that never touch images never need
  // the storage bucket configured.
  return getStorage(firebaseApp);
}

export async function uploadStepImage(opts: {
  uid: string;
  campaignId: string;
  stepId: string;
  slot: string;
  blob: Blob;
  width: number;
  height: number;
  shape: string;
  name: string;
  onProgress?: (fraction: number) => void;
}): Promise<StepImage> {
  const ext = opts.blob.type === "image/png" ? "png" : opts.blob.type === "image/gif" ? "gif" : "jpg";
  const path = `users/${opts.uid}/campaigns/${opts.campaignId}/${opts.stepId}/${opts.slot}-${Date.now()}.${ext}`;
  const fileName = `${opts.name.replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9-_ ]/gi, "").trim() || "image"}-${opts.width}x${opts.height}.${ext}`;
  const task = uploadBytesResumable(ref(storage(), path), opts.blob, {
    contentType: opts.blob.type,
    // Opening the link downloads the file with a sensible name, so the
    // same URL works for the preview (<img>) and the Download button.
    contentDisposition: `attachment; filename="${fileName}"`,
    cacheControl: "public, max-age=31536000",
  });
  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => opts.onProgress?.(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0),
      reject,
      () => resolve()
    );
  });
  const url = await getDownloadURL(task.snapshot.ref);
  return {
    url,
    path,
    width: opts.width,
    height: opts.height,
    shape: opts.shape,
    name: fileName,
    uploadedAt: new Date().toISOString(),
  };
}

/** Saves (or with null, removes) one image record on the step doc. */
export async function saveStepImage(
  campaignId: string,
  stepId: string,
  slot: string,
  image: StepImage | null
): Promise<void> {
  await updateDoc(doc(db, "campaigns", campaignId, "steps", stepId), {
    [`images.${slot}`]: image ?? deleteField(),
  });
}

/** Best effort: a file that's already gone is fine. */
export async function deleteStoredImage(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage(), path));
  } catch {
    // already deleted, or storage not set up; nothing to do
  }
}

/** Deletes every picture saved for a campaign (used when it's deleted). */
export async function deleteCampaignImages(uid: string, campaignId: string): Promise<void> {
  try {
    const root = ref(storage(), `users/${uid}/campaigns/${campaignId}`);
    const steps = await listAll(root);
    await Promise.all(
      steps.prefixes.map(async (stepRef) => {
        const files = await listAll(stepRef);
        await Promise.all(files.items.map((f) => deleteObject(f).catch(() => {})));
      })
    );
  } catch {
    // no images, or storage not set up
  }
}
