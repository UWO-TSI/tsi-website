import { notFound } from "next/navigation";
import FinalRound from "../FinalRound";
import { verifyInvite } from "../token";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = verifyInvite(token);
  if (!invite) notFound();
  return <FinalRound invite={invite} />;
}
