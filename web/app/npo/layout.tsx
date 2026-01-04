import type { ReactNode } from "react";
import NPONavbar from "@/components/layout/NPONavbar";
import CustomCursor from "@/components/ui/CustomCursor";
import LoadingScreenWrapper from "@/components/LoadingScreenWrapper";

export default function NPOLayout({ children }: { children: ReactNode }) {
	return (
		<LoadingScreenWrapper>
			<CustomCursor />
			<NPONavbar />
			<main className="pt-[96px]">{children}</main>
		</LoadingScreenWrapper>
	);
}