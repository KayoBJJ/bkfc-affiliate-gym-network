import { createClient } from "@supabase/supabase-js";
import * as tus from "tus-js-client";
import type { IssuedUpload } from "./direct-upload-contract";

type BrowserFile = { field: "logoUpload" | "gymPhotos" | "fighterListUpload"; file: File };

function browserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("upload_configuration_unavailable");
  return { supabase: createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }), anonKey: key };
}

export async function anonymousUploadAccess() {
  const { supabase, anonKey } = browserSupabase();
  let { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const result = await supabase.auth.signInAnonymously();
    if (result.error || !result.data.session) throw new Error("anonymous_upload_session_failed");
    session = result.data.session;
  }
  return { accessToken: session.access_token, anonKey };
}

export function resumableUpload(
  endpoint: string,
  bucket: string,
  accessToken: string,
  anonKey: string,
  issued: IssuedUpload,
  file: File,
  onProgress: (uploaded: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint,
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${accessToken}`, apikey: anonKey },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: bucket,
        objectName: issued.path,
        contentType: issued.contentType,
        cacheControl: "3600",
      },
      onError: reject,
      onProgress: (uploaded) => onProgress(uploaded),
      onSuccess: () => resolve(),
    });
    upload.findPreviousUploads().then((previous) => {
      if (previous[0]) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    }).catch(reject);
  });
}

export function selectedUploadFiles(formData: FormData): BrowserFile[] {
  const files: BrowserFile[] = [];
  const logo = formData.get("logoUpload");
  if (logo instanceof File && logo.size) files.push({ field: "logoUpload", file: logo });
  for (const photo of formData.getAll("gymPhotos")) {
    if (photo instanceof File && photo.size) files.push({ field: "gymPhotos", file: photo });
  }
  const fighter = formData.get("fighterListUpload");
  if (fighter instanceof File && fighter.size) files.push({ field: "fighterListUpload", file: fighter });
  return files;
}
