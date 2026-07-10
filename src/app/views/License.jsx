import LegalPage from '@components/LegalPage'
import Seo from '@components/Seo'
import { SUPPORT_EMAIL } from '@constants/navigation'

const RESTRICTIONS = [
  {
    title: '1. No Copying or Distribution',
    description:
      'You may not copy, distribute, publish, or transfer the Software or any portion thereof to any third party without prior written consent from the copyright holder.',
  },
  {
    title: '2. No Modification',
    description:
      'You may not modify, adapt, translate, reverse engineer, decompile, disassemble, or create derivative works based on the Software.',
  },
  {
    title: '3. No Commercial Use',
    description:
      'You may not use the Software for commercial purposes without explicit written permission from the copyright holder.',
  },
  {
    title: '4. No Sublicensing',
    description: 'You may not sublicense, rent, lease, or lend the Software to any third party.',
  },
  {
    title: '5. Confidentiality',
    description:
      'The Software contains trade secrets and proprietary information. You agree to maintain the confidentiality of the Software and not disclose it to any third party.',
  },
]

const SECTIONS = [
  {
    title: 'Proprietary Software License',
    content:
      'This software and associated documentation files (the "Software") are the exclusive property of TaylorURL LLC and Trenton Taylor. The Software is protected by copyright laws and international treaty provisions.',
  },
  {
    title: 'Restrictions',
    content: (
      <div className="border-hair-paper bg-hair-paper space-y-px overflow-hidden border">
        {RESTRICTIONS.map(item => (
          <div key={item.title} className="bg-paper p-5">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
              {item.title}
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed text-paper-soft">{item.description}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Authorized Use',
    content:
      'Access to this Software is granted only to authorized clients who have entered into a service agreement with TaylorURL LLC. Unauthorized access, use, or distribution is strictly prohibited and may result in civil and criminal penalties.',
  },
  {
    title: 'Disclaimer',
    content:
      'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.',
  },
  {
    title: 'Enforcement',
    content:
      'Any violation of this license will result in immediate termination of your right to use the Software and may result in legal action to recover damages and seek injunctive relief.',
  },
]

export default function License() {
  return (
    <>
      <Seo
        title="License"
        description="License terms governing the use of TaylorURL LLC deliverables."
        path="/license"
        noIndex
      />
      <LegalPage
        title="License"
        description="Terms governing the use of my software and deliverables."
        eyebrow="// 01 — License"
        sections={SECTIONS}
        footer={{
          heading: 'Licensing inquiries',
          body: (
            <>
              For licensing questions or permissions, contact me at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent underline">
                {SUPPORT_EMAIL}
              </a>
            </>
          ),
        }}
      >
        <div className="border-hair-paper-strong mb-10 border p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
            // MIT License with additional restrictions
          </p>
          <p className="text-paper-faint mt-2 font-mono text-[12px] uppercase tracking-[0.18em]">
            Copyright (c) 2026 TaylorURL LLC · Trenton Taylor
          </p>
        </div>
      </LegalPage>
    </>
  )
}
