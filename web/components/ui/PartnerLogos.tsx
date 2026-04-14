/**
 * Mono-color text logos for all partner/alumni/sponsor organizations.
 * Use currentColor so they inherit parent text color.
 * Replace these with actual SVG icons when available.
 */

function TextLogo({ children, width = 100 }: { children: string; width?: number }) {
  return (
    <svg width={width} height="32" viewBox={`0 0 ${width} 32`} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <text x={width / 2} y="20" textAnchor="middle" fontSize="13" fontWeight="600" fontFamily="'Test Sohne', -apple-system, sans-serif">{children}</text>
    </svg>
  );
}

/* ── Alumni placement logos ── */
export function AppleLogo() { return <TextLogo width={60}>Apple</TextLogo>; }
export function YCLogo() { return <TextLogo width={30}>YC</TextLogo>; }
export function KPMGLogo() { return <TextLogo width={70}>KPMG</TextLogo>; }
export function RBCLogo() { return <TextLogo width={50}>RBC</TextLogo>; }
export function BMOLogo() { return <TextLogo width={55}>BMO</TextLogo>; }
export function CIBCLogo() { return <TextLogo width={55}>CIBC</TextLogo>; }
export function TDLogo() { return <TextLogo width={35}>TD</TextLogo>; }
export function IBMLogo() { return <TextLogo width={50}>IBM</TextLogo>; }
export function AMDLogo() { return <TextLogo width={55}>AMD</TextLogo>; }

/* ── Supported by logos ── */
export function CanadaGovLogo() { return <TextLogo width={120}>Gov of Canada</TextLogo>; }
export function MorrissetteLogo() { return <TextLogo width={100}>Morrissette</TextLogo>; }
export function UbitLogo() { return <TextLogo width={50}>Ubit</TextLogo>; }

/* ── NPO partner logos ── */
export function RedCrossLogo() {
  return (
    <svg width="110" height="32" viewBox="0 0 110 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="10" width="12" height="12" rx="1" />
      <rect x="6" y="6" width="4" height="20" rx="0.5" />
      <rect x="0" y="12" width="16" height="4" rx="0.5" />
      <text x="65" y="20" textAnchor="middle" fontSize="11" fontWeight="600" fontFamily="'Test Sohne', sans-serif">Red Cross</text>
    </svg>
  );
}
export function WorldVisionLogo() { return <TextLogo width={105}>World Vision</TextLogo>; }
export function IRCLogo() { return <TextLogo width={40}>IRC</TextLogo>; }
export function PlanInternationalLogo() { return <TextLogo width={120}>Plan International</TextLogo>; }
export function PlanCatalystLogo() { return <TextLogo width={100}>Plan Catalyst</TextLogo>; }
export function ChildrensMuseumLogo() { return <TextLogo width={140}>Children&apos;s Museum</TextLogo>; }

/* ── Carousel arrays (for easy import) ── */
/* ── LogoItem arrays for LogoLoop ── */
export const ALUMNI_LOGOS = [
  { node: <AppleLogo />, title: "Apple" },
  { node: <YCLogo />, title: "Y Combinator" },
  { node: <KPMGLogo />, title: "KPMG" },
  { node: <RBCLogo />, title: "RBC" },
  { node: <BMOLogo />, title: "BMO" },
  { node: <CIBCLogo />, title: "CIBC" },
  { node: <TDLogo />, title: "TD" },
  { node: <IBMLogo />, title: "IBM" },
  { node: <AMDLogo />, title: "AMD" },
];

export const SPONSOR_LOGOS = [
  { node: <CanadaGovLogo />, title: "Government of Canada" },
  { node: <MorrissetteLogo />, title: "Morrissette" },
  { node: <UbitLogo />, title: "Ubit" },
];

export const NPO_LOGOS = [
  { node: <RedCrossLogo />, title: "Red Cross" },
  { node: <WorldVisionLogo />, title: "World Vision" },
  { node: <IRCLogo />, title: "IRC" },
  { node: <PlanInternationalLogo />, title: "Plan International" },
  { node: <PlanCatalystLogo />, title: "Plan Catalyst" },
  { node: <ChildrensMuseumLogo />, title: "Children's Museum" },
];
