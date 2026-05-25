import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";

interface StatusUpdateProps {
  applicantName: string;
  positionTitle: string;
  newStatus: string;
  statusMessage: string;
  dashboardUrl: string;
}

const STATUS_MESSAGES: Record<string, string> = {
  screening:
    "Your application is now being reviewed by our team.",
  interview_invite:
    "Congratulations! You've been selected for an interview. We'll reach out with scheduling details soon.",
  final_review:
    "Your interview is complete and your application is in final review.",
  accepted:
    "Congratulations! We're excited to offer you a position at Tethos. Check your dashboard for next steps.",
  waitlist:
    "Your application has been placed on our waitlist. We'll notify you if a spot opens up.",
  rejected:
    "After careful consideration, we've decided to move forward with other candidates. We appreciate your interest in Tethos.",
};

export default function StatusUpdate({
  applicantName = "Applicant",
  positionTitle = "VP Internal",
  newStatus = "screening",
  statusMessage,
  dashboardUrl = "https://tethos.ca/student/apply/dashboard",
}: StatusUpdateProps) {
  const message = statusMessage || STATUS_MESSAGES[newStatus] || "";

  return (
    <Html>
      <Head />
      <Preview>
        Update on your {positionTitle} application at Tethos
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={logo}>TETHOS</Text>
          <Hr style={hr} />
          <Heading style={heading}>Application Update</Heading>
          <Text style={paragraph}>Hi {applicantName},</Text>
          <Text style={paragraph}>{message}</Text>
          <Text style={paragraph}>
            <strong>Position:</strong> {positionTitle}
          </Text>
          <Text style={paragraph}>
            View your full application status at:{" "}
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
