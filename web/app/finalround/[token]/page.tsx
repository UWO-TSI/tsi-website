import { notFound } from "next/navigation";
import FinalRound from "../FinalRound";
import { readProgress } from "../progress";
import { verifyInvite } from "../token";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = verifyInvite(token);
  if (!invite) notFound();
  const progress = await readProgress(token);
  return <FinalRound invite={invite} token={token} progress={progress} />;
}
