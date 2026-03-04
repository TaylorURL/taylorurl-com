import LegalPage from '@components/LegalPage'
import { CONTACT_EMAIL } from '@constants/navigation'

const SECTIONS = [
  {
    title: 'Information We Collect',
    content: `We collect information you provide directly to us, such as when you fill out a contact form, subscribe to our newsletter, or communicate with us. This may include your name, email address, phone number, company name, and any other information you choose to provide. We also automatically collect certain information when you visit our website, including your IP address, browser type, operating system, referring URLs, and information about how you interact with our website.`,
  },
  {
    title: 'How We Use Your Information',
    content: `We use the information we collect to provide, maintain, and improve our services, to communicate with you about projects, services, and promotional offers, to respond to your inquiries and provide customer support, to monitor and analyze trends, usage, and activities in connection with our services, and to detect, investigate, and prevent fraudulent transactions and other illegal activities.`,
  },
  {
    title: 'Information Sharing',
    content: `We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this policy. We may share your information with service providers who assist us in operating our website and conducting our business, when required by law or to respond to legal process, to protect our rights, privacy, safety, or property, and in connection with a merger, acquisition, or sale of assets.`,
  },
  {
    title: 'Data Security',
    content: `We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.`,
  },
  {
    title: 'Cookies and Tracking',
    content: `We use cookies and similar tracking technologies to track activity on our website and hold certain information. Cookies are files with a small amount of data which may include an anonymous unique identifier. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.`,
  },
  {
    title: 'Your Rights',
    content: `You have the right to access, correct, or delete your personal information. You may also object to or restrict certain processing of your information. To exercise these rights, please contact us at ${CONTACT_EMAIL}.`,
  },
  {
    title: 'Changes to This Policy',
    content: `We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.`,
  },
]

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="How we collect, use, and protect your information."
      effectiveDate="Last Updated: February 1, 2026"
      introText='TaylorURL ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website taylorurl.com.'
      sections={SECTIONS}
      footer={{
        heading: 'Questions?',
        body: (
          <>
            If you have any questions about this Privacy Policy, please contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 underline">
              {CONTACT_EMAIL}
            </a>
          </>
        ),
      }}
    />
  )
}
