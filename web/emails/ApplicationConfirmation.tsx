import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface ApplicationConfirmationProps {
  applicantName: string;
  positionTitle: string;
  dashboardUrl: string;
}

export default function ApplicationConfirmation({
  applicantName = "Applicant",
  positionTitle = "VP Internal",
  dashboardUrl = "https://tethos.ca/student/apply/dashboard",
}: ApplicationConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>
        We received your application for {positionTitle} at Tethos
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={logo}>TETHOS</Text>
          <Hr style={hr} />
          <Heading style={heading}>Application Received</Heading>
          <Text style={paragraph}>Hi {applicantName},</Text>
          <Text style={paragraph}>
            We&apos;ve received your application for <strong>{positionTitle}</strong>.
            Our team will review your submission and get back to you soon.
          </Text>
          <Section style={nextStepsBox}>
            <Text style={nextStepsTitle}>What happens next</Text>
            <Text style={nextStepsItem}>
              1. Our team reviews all applications
            </Text>
            <Text style={nextStepsItem}>
              2. Shortlisted candidates will be invited for an interview
            </Text>
            <Text style={nextStepsItem}>
              3. Decisions are released on your dashboard
            </Text>
          </Section>
          <Text style={paragraph}>
            Track your application status anytime at:{" "}
            <a href={dashboardUrl} style={link}>
              Application Dashboard
            </a>
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            Tethos &mdash; Technology That Moves People Forward
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#0F0F10",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "40px 24px",
  maxWidth: "560px",
};

const logo = {
  color: "#F1FFFF",
  fontSize: "14px",
  fontWeight: "700" as const,
  letterSpacing: "0.15em",
  marginBottom: "24px",
};

const heading = {
  color: "#F1FFFF",
  fontSize: "28px",
  fontWeight: "700" as const,
  lineHeight: "1.2",
  marginBottom: "16px",
};

const paragraph = {
  color: "#E5E7EB",
  fontSize: "16px",
  lineHeight: "1.6",
  marginBottom: "12px",
};

const nextStepsBox = {
  backgroundColor: "rgba(0, 47, 167, 0.12)",
  border: "1px solid rgba(0, 47, 167, 0.3)",
  borderRadius: "12px",
  padding: "20px 24px",
  marginTop: "24px",
  marginBottom: "24px",
};

const nextStepsTitle = {
  color: "#F1FFFF",
  fontSize: "16px",
  fontWeight: "600" as const,
  marginBottom: "12px",
};

const nextStepsItem = {
  color: "#9CA3AF",
  fontSize: "14px",
  lineHeight: "1.6",
  marginBottom: "4px",
};

const link = {
  color: "#22D3EE",
  textDecoration: "underline",
};

const hr = {
  borderColor: "rgba(255, 255, 255, 0.12)",
  margin: "24px 0",
};

const footer = {
  color: "#6B7280",
  fontSize: "12px",
  lineHeight: "1.5",
};
