import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// GET /api/jobs — list job listings with optional filters
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const jobType = searchParams.get("type"); // internship, full_time, part_time, contract
  const search = searchParams.get("search");
  const category = searchParams.get("category");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);

  let query = supabase
    .from("job_listings")
    .select("*")
    .eq("is_flagged", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (jobType) {
    query = query.eq("job_type", jobType);
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,company.ilike.%${search}%`);
  }

  if (category) {
    query = query.contains("categories", [category]);
  }

  const { data: jobs, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ jobs: jobs ?? [] });
}

// POST /api/jobs — create a job listing
const CreateJobSchema = z.object({
  title: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  location: z.string().max(200).nullable().optional(),
  job_type: z.enum(["internship", "full_time", "part_time", "contract"]),
  url: z.string().url().max(500),
  categories: z.array(z.string().max(50)).max(10).optional().default([]),
  tags: z.array(z.string().max(50)).max(10).optional().default([]),
  description: z.string().max(5000).nullable().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data: job, error } = await supabase
    .from("job_listings")
    .insert({
      ...parsed.data,
      posted_by: user.id,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ job }, { status: 201 });
}
