import { Body, Container, Head, Html, Img, Link, Preview, Section, Text } from "@react-email/components";

interface Step {
  title: string;
  body: string;
  href: string;
  cta: string;
}

interface FinalRoundWelcomeProps {
  firstName: string;
  project: string;
  deadline: string;
  steps: Step[];
}

const SIGNATURE_LOGO = "https://uwo-tsi.github.io/tsi-signature-generator/logo-blue.png";

export default function FinalRoundWelcome({
  firstName = "Kayden",
  project = "Ark Aid Mission",
  deadline = "11:59 PM ET tonight (Wed, Oct 8)",
  steps = [],
}: FinalRoundWelcomeProps) {
  return (
    <Html>
      <Head />
      <Preview>You made it into Tech for Social Impact. Confirm your spot by {deadline}.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={paragraph}>Hi {firstName},</Text>
          <Text style={paragraph}>
            Congratulations, you&apos;re officially in. Welcome to Tech for Social Impact and to the{" "}
            <strong>{project}</strong> team for 2026/27. (And sorry about the vault.)
          </Text>
          <Text style={paragraph}>
            To confirm your position, complete these steps by <strong>{deadline}</strong>:
          </Text>

          <Section style={list}>
            {steps.map((s, i) => (
              <Section key={s.title} style={i < steps.length - 1 ? step : stepLast}>
                <Text style={stepTitle}>
                  {i + 1}. {s.title}
                </Text>
                <Text style={stepBody}>{s.body}</Text>
                {s.href && (
                  <Link href={s.href} style={button}>
                    {s.cta}
                  </Link>
                )}
              </Section>
            ))}
          </Section>

          <Text style={paragraph}>
            If anything comes up, just reply to this email. We can&apos;t wait to build with you.
          </Text>
          <Text style={paragraph}>Best,</Text>

          <table cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse", marginTop: "8px" }}>
            <tbody>
              <tr>
                <td style={{ verticalAlign: "middle", padding: "0 16px 0 0" }}>
                  <Link href="https://tethos.ca">
                    <Img src={SIGNATURE_LOGO} width={60} height={60} alt="TSI" style={{ display: "block", border: 0 }} />
                  </Link>
                </td>
                <td style={{ verticalAlign: "top", borderLeft: "1px solid #e4e4e8", padding: "0 0 0 16px" }}>
                  <div style={sigName}>David Liu</div>
                  <div style={sigRole}>Co-President, Tech for Social Impact</div>
                  <div style={sigMuted}>Western University</div>
                  <div style={{ ...sigLine, paddingTop: "10px" }}>
                    <Link href="mailto:dliu468@uwo.ca" style={sigLink}>dliu468@uwo.ca</Link>
                    <span style={sigDot}>&nbsp;&nbsp;&middot;&nbsp;&nbsp;</span>
                    <Link href="tel:+17789810189" style={sigLink}>(778) 981-0189</Link>
                  </div>
                  <div style={sigLine}>
                    <Link href="https://tethos.ca" style={sigLink}>tethos.ca</Link>
                    <span style={sigDot}>&nbsp;&nbsp;&middot;&nbsp;&nbsp;</span>
                    <Link href="https://www.linkedin.com/in/davidmakesmoves" style={sigLink}>LinkedIn</Link>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </Container>
      </Body>
    </Html>
  );
}

const font = "'Helvetica Neue',Helvetica,Arial,sans-serif";

const body = { backgroundColor: "#ffffff", fontFamily: font };

const container = { margin: "0 auto", padding: "24px 20px", maxWidth: "580px" };

const paragraph = { color: "#111114", fontSize: "15px", lineHeight: "1.6", margin: "0 0 14px" };

const list = { margin: "4px 0 18px", border: "1px solid #e4e4e8", borderRadius: "10px", padding: "4px 18px" };

const step = { padding: "14px 0", borderBottom: "1px solid #eeeef1" };

const stepLast = { padding: "14px 0" };

const stepTitle = { color: "#111114", fontSize: "15px", fontWeight: 600, margin: "0 0 4px" };

const stepBody = { color: "#3a3a44", fontSize: "14px", lineHeight: "1.55", margin: "0 0 10px" };

const button = {
  display: "inline-block",
  backgroundColor: "#1d9bf0",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
  padding: "9px 16px",
  borderRadius: "8px",
};

const sigName = { fontFamily: font, fontSize: "15px", fontWeight: 600, color: "#111114", lineHeight: "20px" };
const sigRole = { fontFamily: font, fontSize: "13px", color: "#3a3a44", lineHeight: "19px" };
const sigMuted = { fontFamily: font, fontSize: "12px", color: "#7a7a85", lineHeight: "18px" };
const sigLine = { fontFamily: font, fontSize: "12px", lineHeight: "18px" };
const sigLink = { color: "#1d9bf0", textDecoration: "none" };
const sigDot = { color: "#b8b8c0" };
