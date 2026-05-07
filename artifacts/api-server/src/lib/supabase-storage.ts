import { createClient } from "@supabase/supabase-js";

export const STORAGE_BUCKET = "exam-files";

let _client: ReturnType<typeof createClient> | null = null;
let _initialized = false;

function getClient(): ReturnType<typeof createClient> | null {
  if (_initialized) return _client;
  _initialized = true;

  const dbUrl     = process.env.SUPABASE_DATABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!dbUrl || !serviceKey) return null;

  const match = dbUrl.match(/@db\.([a-z0-9]+)\.supabase\.co/);
  if (!match) return null;

  const supabaseUrl = `https://${match[1]}.supabase.co`;
  _client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  return _client;
}

export function isStorageEnabled(): boolean {
  return !!process.env.SUPABASE_SERVICE_KEY && !!process.env.SUPABASE_DATABASE_URL;
}

export async function uploadToStorage(
  originalFileName: string,
  mimeType: string,
  base64Data: string,
): Promise<string | null> {
  const sb = getClient();
  if (!sb) return null;

  const buf  = Buffer.from(base64Data, "base64");
  const safe = originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${Date.now()}_${safe}`;

  const { error } = await sb.storage
    .from(STORAGE_BUCKET)
    .upload(path, buf, { contentType: mimeType, upsert: false });

  if (error) {
    console.error("Supabase Storage upload error:", error.message);
    return null;
  }

  const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteFromStorage(fileUrl: string): Promise<void> {
  const sb = getClient();
  if (!sb || !fileUrl) return;
  try {
    const url = new URL(fileUrl);
    const m = url.pathname.match(/\/storage\/v1\/object\/public\/exam-files\/(.+)$/);
    if (m) await sb.storage.from(STORAGE_BUCKET).remove([m[1]]);
  } catch { /* ignore */ }
}
