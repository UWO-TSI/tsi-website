/**
 * Resume storage via Supabase Storage.
 *
 * Uploads use the service-role client (admin) because the bucket is
 * private and we don't expose write access to anon/authenticated roles.
 * The route that calls this already verifies the user session.
 *
 * Signed URLs are long-lived (1 year) so that `resume_drive_url` stored
 * on applications keeps working without a refresh endpoint for the
 * initial launch. A future pass can swap to short-lived signed URLs
 * fetched on demand per view.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export const RESUME_BUCKET = "resumes";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "applicant";
}

export async function uploadResumeToStorage(
  buffer: Buffer,
  opts: {
    userId: string;
    positionSlug: string;
    applicantName: string;
  }
): Promise<{ fileUrl: string; path: string }> {
  const admin = createAdminClient();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${sanitize(opts.applicantName)}_${stamp}.pdf`;
  const path = `${opts.positionSlug}/${opts.userId}/${filename}`;

  const { error: uploadError } = await admin.storage
    .from(RESUME_BUCKET)
    .upload(path, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data: signed, error: signError } = await admin.storage
    .from(RESUME_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    throw new Error(`Signed URL generation failed: ${signError?.message}`);
  }

  return { fileUrl: signed.signedUrl, path };
}
