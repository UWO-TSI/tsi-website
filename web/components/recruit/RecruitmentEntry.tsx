"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import ApplicantLoading from "./ApplicantLoading";
import RecruitmentLanding from "./RecruitmentLanding";
import { useFormOnly } from "./useFormOnly";

const ApplicantIsland = dynamic(() => import("./ApplicantIsland"), { ssr: false, loading: () => <ApplicantLoading /> });

export default function RecruitmentEntry() {
  const params = useSearchParams();
  const formOnly = useFormOnly();
  return formOnly || params.get("view") === "form" ? <RecruitmentLanding /> : <ApplicantIsland />;
}
