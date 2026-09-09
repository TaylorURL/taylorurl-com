import LegalPage from '@components/page-bands/LegalPage'
import Seo from '@components/Seo'
import { breadcrumbSchema } from '@constants/seo'
import { BRAND_NAME, SUPPORT_EMAIL } from '@constants/navigation'

// What the license actually restrains, which is dealing in the codebase rather
// than running the business the site was built for. An earlier version of this
// page forbade commercial use outright, which is the one thing every client is
// here to do: a shop's website exists to take bookings and sell work. A license
// that reads as prohibiting the whole purpose of the thing being licensed is
// not a strict license, it is a wrong one, and it is exactly the sort of clause
// a reader is entitled to be confused by.
const RESTRICTIONS = [
  {
    title: 'No Copying The Codebase',
    description:
      'You may not copy, publish, or hand the source code or the platform to anyone else, or have another developer rebuild from it. This is about the code behind the site, not about your site being seen: the pages themselves are public and meant to be.',
  },
  {
    title: 'No Reselling Or Sublicensing',
    description:
      'You may not resell, rent, lease, or sublicense the platform, or offer it to others as a service of your own.',
  },
  {
    title: 'No Reverse Engineering',
    description:
      'You may not decompile, disassemble, or otherwise work backwards from the platform to reproduce how it is built.',
  },
  {
    title: 'Confidentiality Of The Platform',
    description:
      'Where you are shown how the platform works internally, that stays between us. This does not cover anything about your own business, your own content, or the pages your customers can already see.',
  },
]

const SECTIONS = [
  {
    title: 'What This Covers',
    content: `This page is about the code and the platform a site is built and served on. Both are owned by ${BRAND_NAME}, a Texas limited liability company, and both are protected by copyright. The company is the licensor and the party to this license, and every right and obligation on this page is the company's.

It is not about your business, your content, or your customers. The short version is on the Terms page and this is the same arrangement set out at length; where the two could be read differently, the Terms page governs.`,
  },
  {
    title: 'What You Own',
    content:
      'Your domain name is registered in your name and is yours to move to another registrar or provider whenever you like. Everything you supply stays yours: your text, your photographs, your logo and brand marks, your customer records, and anything you write into the site after launch. None of that is licensed to us and none of it is affected by this page. You may take copies of it at any time, and you do not need a reason or permission to ask.',
  },
  {
    title: 'What You Are Licensed To Do',
    content:
      'For as long as the monthly fee is current, you have the right to use your site to run your business, in whatever way a business normally uses its own website. That expressly includes selling, taking bookings and payments, advertising against it, and putting its address on anything you like. Where a site comes with an editor, using it to change your own text and photographs is part of that right, not an exception to it.',
  },
  {
    title: 'Restrictions',
    content: (
      <div className="space-y-3">
        {RESTRICTIONS.map((item, index) => (
          <div key={item.title} className="panel-static bg-paper p-5">
            <h3 className="section-label text-accent">
              <span className="tabular-nums">{index + 1}.</span> {item.title}
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed text-paper-soft">{item.description}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Components We Did Not Write',
    content:
      'The platform is built on open-source software written by other people, and each piece carries its own license, which continues to apply to it. Nothing on this page grants you rights over those components, and nothing on this page takes away rights their own licenses give you. Ask and we will tell you what a given site is built on.',
  },
  {
    title: 'If Your Business Changes Hands',
    content: `The license is for the business the site was built for. If you sell that business, tell us and the license moves to the buyer on these same terms, at no charge, so long as the monthly fee continues. What it does not do is pass to somebody who buys the code out from under the business, because the code is not yours to sell.`,
  },
  {
    title: 'When The License Ends',
    content: `The license runs with the monthly fee. If the fee stops, the site comes offline and the right to use the platform ends with it, which is the same thing the Terms page and the pricing page both say. What you own does not end with it: the domain stays yours to point anywhere, and the content you supplied stays yours to take. Ask at ${SUPPORT_EMAIL} and you will get copies of it, whatever the reason for stopping.`,
  },
  {
    title: 'Authorized Use',
    content: `Access to the platform is for clients with a current agreement with ${BRAND_NAME}. Reaching parts of it you were not given access to, or passing your access to somebody else, is not permitted.`,
  },
  {
    title: 'Disclaimer',
    content: `THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

The copyright holder is ${BRAND_NAME}. A claim under this license lies against the company, and the limits on liability set out on the Terms page apply to it and to the company's member, manager, employees and contractors.`,
  },
  {
    title: 'Enforcement',
    content: `A serious or repeated breach of the restrictions above can end the right to use the platform and may be pursued at law. It is not a hair trigger: you will be told what the problem is and given a fair chance to put it right before anything is withdrawn, unless the breach is one that cannot be undone. Nothing here removes a right you have under Texas or federal law, and if you think a decision is wrong, the complaints route on the Terms page is open to you.`,
  },
]

export default function License() {
  return (
    <>
      <Seo
        title="License and Ownership Terms"
        description="The license terms covering websites, code, and other deliverables TaylorURL LLC produces, and what a client may do with them after launch."
        path="/license"
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'License', path: '/license' },
        ])}
        noIndex
      />
      <LegalPage
        title="License"
        description="What you may do with the software behind your site, and what stays with us."
        eyebrow="License"
        effectiveDate="September 4, 2026"
        appliesTo="Clients with a current agreement"
        summary={[
          'Run your business on your site however you like: sell, take bookings and payments, advertise against it, print the address on a van.',
          'Your domain, your content and your customer records are yours and are not licensed to us.',
          'The code and the platform stay ours, licensed to you for as long as the monthly fee is current.',
          'What you may not do is copy, resell, sublicense or reverse engineer the codebase.',
          'Sell your business and the license moves to the buyer, free, on these same terms.',
        ]}
        sections={SECTIONS}
        footer={{
          heading: 'Licensing Inquiries',
          body: (
            <>
              For licensing questions or permissions, contact us at{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-accent underline transition-colors duration-200 hover:text-[color:var(--accent-hi)]"
              >
                {SUPPORT_EMAIL}
              </a>
            </>
          ),
        }}
      >
        <p className="border-hair-paper text-paper-faint mt-10 border-t pt-6 text-[13px] leading-relaxed">
          Copyright (c) 2026 TaylorURL LLC, a Texas limited liability company. All rights reserved.
        </p>
      </LegalPage>
    </>
  )
}
