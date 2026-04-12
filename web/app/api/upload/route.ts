import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadResumeToDrive } from "@/lib/google-drive";
import { MAX_RESUME_SIZE_BYTES } from "@/lib/recruitment";

export async function POST(request: Request) {
  // Auth check
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

  // Validate file type
  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Only PDF files are accepted" },
      { status: 400 }
    );
  }

  // Validate file size
  if (file.size > MAX_RESUME_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File exceeds 5MB limit" },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const sanitizedName = applicantName.replace(/[^a-zA-Z0-9\s]/g, "").trim();
    const date = new Date().toISOString().split("T")[0];
    const fileName = `${sanitizedName}_${date}.pdf`;
    const folderPath = `Recruitment/${positionSlug}`;

    const { fileUrl, fileId } = await uploadResumeToDrive(
      buffer,
      fileName,
      "application/pdf",
      folderPath
    );

    return NextResponse.json({ fileUrl, fileId });
  } catch (err) {
    console.error("Drive upload error:", err);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
