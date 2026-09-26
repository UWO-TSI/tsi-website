import { Suspense } from "react";
import ApplicantIsland from "@/components/recruit/ApplicantIsland";
import ApplicantLoading from "@/components/recruit/ApplicantLoading";
export default function ApplicantPortalPage(){return <Suspense fallback={<ApplicantLoading />}><ApplicantIsland/></Suspense>;}
