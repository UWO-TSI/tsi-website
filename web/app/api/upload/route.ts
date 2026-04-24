import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadResumeToStorage } from "@/lib/resume-storage";
import { MAX_RESUME_SIZE_BYTES } from "@/lib/recruitment";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const positionSlug = formData.get("positionSlug") as string;
  const applicantName = formData.get("applicantName") as string;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Only PDF files are accepted" },
      { status: 400 }
    );
  }

  if (file.size > MAX_RESUME_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File exceeds 5MB limit" },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { fileUrl, path } = await uploadResumeToStorage(buffer, {
      userId: user.id,
      positionSlug: positionSlug || "unsorted",
      applicantName: applicantName || "applicant",
    });
    return NextResponse.json({ fileUrl, fileId: path });
  } catch (err) {
    console.error("Resume upload error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to upload file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
