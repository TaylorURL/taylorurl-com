import LegalPage from '@components/LegalPage'
import Seo from '@components/Seo'
import { SUPPORT_EMAIL } from '@constants/navigation'

const SECTIONS = [
  {
    title: 'Information I Collect',
    content: `I collect information you provide directly to me, such as when you fill out a contact form, subscribe to the newsletter, or communicate with me. This may include your name, email address, phone number, company name, and any other information you choose to provide. I also automatically collect certain information when you visit this website, including your IP address, browser type, operating system, referring URLs, and information about how you interact with the site.`,
  },
  {
    title: 'How I Use Your Information',
    content: `I use the information I collect to provide, maintain, and improve my services, to communicate with you about projects, services, and occasional updates, to respond to your inquiries and provide customer support, to monitor and analyze usage and activity related to my services, and to detect, investigate, and prevent fraudulent activity.`,
  },
  {
    title: 'Information Sharing',
    content: `I do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this policy. I may share your information with service providers that help operate this website and run the business, when required by law or to respond to legal process, to protect rights, privacy, safety, or property, and in connection with a transfer of business assets.`,
  },
  {
    title: 'Data Security',
    content: `I implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure, and I cannot guarantee absolute security.`,
  },
  {
    title: 'Cookies and Tracking',
    content: `I use cookies and similar tracking technologies to track activity on this website and hold certain information. Cookies are files with a small amount of data which may include an anonymous unique identifier. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.`,
  },
  {
    title: 'Your Rights',
    content: `You have the right to access, correct, or delete your personal information. You may also object to or restrict certain processing of your information. To exercise these rights, please contact me at ${SUPPORT_EMAIL}.`,
  },
  {
    title: 'Changes to This Policy',
    content: `I may update this Privacy Policy from time to time. I will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.`,
  },
]

export default function Privacy() {
  return (
    <>
      <Seo
        title="Privacy Policy"
        description="How TaylorURL LLC collects, uses, and protects personal information from visitors and clients of taylorurl.com."
        path="/privacy"
      />
      <LegalPage
        title="Privacy Policy"
        description="How I collect, use, and protect your information."
        effectiveDate="Last Updated: February 1, 2026"
        introText='TaylorURL LLC is operated by Trenton Taylor ("I", "me", or "my"). I am committed to protecting your privacy. This Privacy Policy explains how I collect, use, disclose, and safeguard your information when you visit taylorurl.com.'
        sections={SECTIONS}
        footer={{
          heading: 'Questions?',
          body: (
            <>
              If you have any questions about this Privacy Policy, please contact me at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-600 underline">
                {SUPPORT_EMAIL}
              </a>
            </>
          ),
        }}
      />
    </>
  )
}
