import { notFound } from "next/navigation";
import VillageUIPreview from "@/components/recruit/VillageUIPreview";

export default function RecruitmentUIPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <VillageUIPreview />;
}
