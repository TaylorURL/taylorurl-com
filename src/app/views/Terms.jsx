import LegalPage from '@components/LegalPage'
import Seo from '@components/Seo'
import { SUPPORT_EMAIL } from '@constants/navigation'

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    content: `By accessing and using the TaylorURL LLC website and services, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to abide by these terms, please do not use my services.`,
  },
  {
    title: '2. Services Description',
    content: `TaylorURL LLC provides custom website development, JavaScript application development, website redesigns, and ongoing website management services for local businesses, all performed by Trenton Taylor. The specific scope, deliverables, timeline, and terms for each project will be outlined in a separate project agreement or statement of work.`,
  },
  {
    title: '3. Client Responsibilities',
    content: `Clients are responsible for providing timely feedback, necessary content and assets, accurate information for their projects, and payment according to agreed-upon terms. Delays in providing required materials may result in project timeline adjustments.`,
  },
  {
    title: '4. Payment Terms',
    content: `Payment terms — including any one-time project fees, recurring maintenance fees, and pass-through charges for external services such as domains, API integrations, or advertising — are outlined in each individual project agreement. Late payments may incur additional fees as specified in that agreement.`,
  },
  {
    title: '5. Intellectual Property',
    content: `Upon full payment, clients receive ownership of the final deliverables created specifically for their project. TaylorURL LLC retains the right to use general techniques, skills, and non-confidential elements in future projects. I may display completed work in my portfolio unless otherwise agreed.`,
  },
  {
    title: '6. Confidentiality',
    content: `Both parties agree to keep confidential any proprietary information shared during the course of the project. This includes business strategies, technical specifications, and any information marked as confidential.`,
  },
  {
    title: '7. Limitation of Liability',
    content: `TaylorURL LLC shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of my services. Total liability shall not exceed the amount paid for the specific service giving rise to the claim.`,
  },
  {
    title: '8. Warranty Disclaimer',
    content: `Services are provided "as is" without warranties of any kind, either express or implied. I do not guarantee that my services will be uninterrupted, error-free, or meet your specific requirements beyond what is outlined in the project agreement.`,
  },
  {
    title: '9. Termination',
    content: `Either party may terminate services with written notice. Upon termination, the client is responsible for payment for all work completed up to the termination date. Any deposits or advance payments may be non-refundable depending on work already performed.`,
  },
  {
    title: '10. Modifications to Terms',
    content: `I reserve the right to modify these terms at any time. Changes will be effective immediately upon posting to this website. Your continued use of my services after changes constitutes acceptance of the modified terms.`,
  },
  {
    title: '11. Governing Law',
    content: `These terms shall be governed by and construed in accordance with the laws of the State of Texas, without regard to its conflict of law provisions. Any disputes shall be resolved in the courts of Harris County, Texas.`,
  },
]

export default function Terms() {
  return (
    <>
      <Seo
        title="Terms of Service"
        description="Terms and conditions for engaging TaylorURL's web development and maintenance services."
        path="/terms"
      />
      <LegalPage
        title="Terms of Service"
        description="Please read these terms carefully before using my services."
        effectiveDate="Effective Date: February 1, 2026"
        sections={SECTIONS}
        footer={{
          heading: 'Contact',
          body: (
            <>
              For questions about these Terms of Service, contact me at{' '}
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
