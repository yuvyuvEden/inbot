/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="he" dir="rtl">
    <Head />
    <Preview>איפוס סיסמה — INBOT</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Heading style={h1}>איפוס סיסמה</Heading>
          <Text style={text}>
            קיבלנו בקשה לאיפוס הסיסמה לחשבון שלך ב-INBOT.
          </Text>
          <Text style={text}>
            לחץ על הכפתור למטה לבחירת סיסמה חדשה. הקישור תקף ל-60 דקות.
          </Text>
          <Section style={buttonWrap}>
            <Button style={button} href={confirmationUrl}>
              איפוס סיסמה
            </Button>
          </Section>
          <Text style={footerNote}>
            אם לא ביקשת איפוס סיסמה — התעלם ממייל זה. הסיסמה שלך לא תשתנה.
          </Text>
          <Text style={footerNote}>
            לעזרה:{' '}
            <Link href="mailto:support@inbot.co.il" style={link}>
              support@inbot.co.il
            </Link>
          </Text>
        </Section>
        <Text style={copyright}>
          © 2026 INBOT · כל הזכויות שמורות · app.inbot.co.il
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Heebo', Arial, sans-serif",
  direction: 'rtl' as const,
  textAlign: 'right' as const,
}
const container = { padding: '32px 24px', maxWidth: '560px' }
const card = {
  backgroundColor: '#ffffff',
  padding: '32px 28px',
  borderRadius: '12px',
  border: '1px solid #e5e7eb',
}
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#0a2540',
  margin: '0 0 20px',
  textAlign: 'right' as const,
}
const text = {
  fontSize: '15px',
  color: '#334155',
  lineHeight: '1.7',
  margin: '0 0 14px',
  textAlign: 'right' as const,
}
const buttonWrap = { textAlign: 'right' as const, margin: '24px 0' }
const button = {
  backgroundColor: '#e8941a',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '8px',
  padding: '12px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footerNote = {
  fontSize: '13px',
  color: '#64748b',
  lineHeight: '1.6',
  margin: '12px 0 0',
  textAlign: 'right' as const,
}
const link = { color: '#e8941a', textDecoration: 'none' }
const copyright = {
  fontSize: '12px',
  color: '#94a3b8',
  textAlign: 'center' as const,
  margin: '24px 0 0',
}
