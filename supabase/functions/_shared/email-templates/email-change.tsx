/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName?: string
  email?: string
  newEmail?: string
  confirmationUrl: string
}

const LOGO_URL =
  'https://jkqpkbcdtbelgpuwncam.supabase.co/storage/v1/object/public/assets//LOGO.jpeg'

export const EmailChangeEmail = ({ confirmationUrl }: EmailChangeEmailProps) => (
  <Html lang="he" dir="rtl">
    <Head />
    <Preview>אישור שינוי כתובת מייל — INBOT</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Section style={header}>
            <Img
              src={LOGO_URL}
              alt="INBOT"
              width="120"
              height="40"
              style={logo}
            />
          </Section>

          <Section style={accent} />

          <Section style={bodySection}>
            <Heading style={h1}>אישור שינוי מייל</Heading>
            <Text style={text}>
              קיבלנו בקשה לשינוי כתובת המייל שלך ב-INBOT. לחץ על הכפתור למטה לאישור הכתובת החדשה.
            </Text>
            <Section style={buttonWrap}>
              <Button style={button} href={confirmationUrl}>
                אישור שינוי המייל
              </Button>
            </Section>
            <Text style={footerNote}>
              אם לא ביקשת לשנות את המייל — התעלם ממייל זה ופנה לתמיכה.
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              © 2026 INBOT · כל הזכויות שמורות
            </Text>
          </Section>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Heebo', Arial, sans-serif",
  direction: 'rtl' as const,
  textAlign: 'right' as const,
  margin: 0,
  padding: '24px 0',
}
const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '0 16px',
}
const card = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  overflow: 'hidden',
}
const header = {
  backgroundColor: '#1e3a5f',
  padding: '24px',
  textAlign: 'center' as const,
}
const logo = {
  display: 'inline-block',
  margin: '0 auto',
  maxHeight: '40px',
  width: 'auto',
}
const accent = {
  height: '4px',
  backgroundColor: '#e8941a',
  fontSize: 0,
  lineHeight: '4px',
}
const bodySection = {
  padding: '32px 28px',
}
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#1e3a5f',
  margin: '0 0 20px',
  textAlign: 'right' as const,
}
const text = {
  fontSize: '15px',
  color: '#334155',
  lineHeight: '1.7',
  margin: '0 0 24px',
  textAlign: 'right' as const,
}
const buttonWrap = {
  textAlign: 'right' as const,
  margin: '0 0 28px',
}
const button = {
  backgroundColor: '#e8941a',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '8px',
  padding: '12px 32px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footerNote = {
  fontSize: '13px',
  color: '#64748b',
  lineHeight: '1.6',
  margin: 0,
  textAlign: 'right' as const,
}
const footer = {
  backgroundColor: '#f8fafc',
  borderTop: '1px solid #e2e8f0',
  padding: '16px 24px',
  textAlign: 'center' as const,
}
const footerText = {
  fontSize: '12px',
  color: '#64748b',
  margin: 0,
  textAlign: 'center' as const,
}
