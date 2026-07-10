import { Link, useParams, Navigate } from 'react-router-dom'
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { ArrowLeft, ArrowUpRight, Calendar, Clock, Tag } from 'lucide-react'
import Seo from '@components/Seo'
import { BLOG_POSTS } from '@data/blog'
import { sanitizeBlogHtml } from '@utils/sanitizeBlogHtml'
import { fadeInUp } from '@constants/animations'
import { breadcrumbSchema } from '@constants/seo'
import { useScrollParallax } from '@hooks/useScrollParallax'

const MAX_DESCRIPTION_LENGTH = 155

function clampDescription(text) {
  if (!text || text.length <= MAX_DESCRIPTION_LENGTH) return text
  return `${text.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd()}…`
}

export default function BlogPost() {
  const { slug } = useParams()
  const post = BLOG_POSTS.find(p => p.slug === slug)

  // Scroll-driven hero — the headline column rises and softens as the user
  // scrolls into the article body, with the blueprint grid drifting slower
  // behind it for depth. Reduced-motion users see no transform.
  const reduced = useReducedMotion()
  const heroRef = useRef(null)
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const rawHeroOpacity = useTransform(scrollYProgress, [0, 0.85], [1, reduced ? 1 : 0.25])
  const heroOpacity = useSpring(rawHeroOpacity, { stiffness: 140, damping: 32, mass: 0.4 })
  const { ref: gridRef, transform: gridTransform } = useScrollParallax({
    range: [0, reduced ? 0 : -50],
  })
  const { ref: copyRef, transform: copyTransform } = useScrollParallax({
    range: [0, reduced ? 0 : -90],
  })

  if (!post) return <Navigate to="/blog" replace />

  const publishedTime = new Date(post.date).toISOString()
  const description = clampDescription(post.excerpt)

  return (
    <div>
      <Seo
        title={post.title}
        description={description}
        path={`/blog/${slug}`}
        ogType="article"
        article={{
          publishedTime,
          section: post.category,
        }}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Blog', path: '/blog' },
            { name: post.title, path: `/blog/${slug}` },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.excerpt,
            datePublished: publishedTime,
            articleSection: post.category,
            author: {
              '@type': 'Person',
              name: 'Trenton Taylor',
              url: 'https://taylorurl.com/about',
            },
            publisher: {
              '@type': 'Organization',
              name: 'TaylorURL LLC',
              legalName: 'TaylorURL LLC',
              founder: {
                '@type': 'Person',
                name: 'Trenton Taylor',
              },
              logo: {
                '@type': 'ImageObject',
                url: 'https://taylorurl.com/images/TaylorURL-Logo.png',
              },
            },
            mainEntityOfPage: `https://taylorurl.com/blog/${slug}`,
          },
        ]}
      />

      {/* Hero band — dark, mono header strip */}
      <section
        ref={heroRef}
        className="relative overflow-hidden bg-bg pb-16 pt-32 text-ink sm:pb-24 sm:pt-44"
      >
        <motion.div
          ref={gridRef}
          style={{ transform: gridTransform }}
          className="grid-blueprint absolute inset-0 opacity-55 will-change-transform"
          aria-hidden="true"
        />
        <motion.div
          ref={copyRef}
          style={{ transform: copyTransform, opacity: heroOpacity }}
          className="relative mx-auto w-full max-w-[1080px] px-6 will-change-transform sm:px-10 lg:px-16"
        >
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Link
              to="/blog"
              className="group inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft transition-colors hover:text-accent"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              Back to the blog
            </Link>

            <div className="border-hair mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-b pb-6 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
              <span className="flex items-center gap-2 text-accent">
                <Tag className="h-3 w-3" />
                {post.category}
              </span>
              <span className="flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                {post.date}
              </span>
              <span className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                {post.readTime}
              </span>
            </div>

            <h1 className="mt-8 text-[clamp(2rem,5.4vw,3.8rem)] font-semibold leading-[1.04] tracking-tightest text-ink">
              {post.title}
            </h1>
          </motion.div>
        </motion.div>
      </section>

      {/* Body — paper, prose rail */}
      <article className="relative overflow-hidden bg-paper py-20 sm:py-28">
        <div className="grid-blueprint-paper-fine absolute inset-0 opacity-30" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[760px] px-6 sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="space-y-7"
          >
            {post.content.map((block, i) => {
              if (block.type === 'h2') {
                return (
                  <h2
                    key={i}
                    className="mt-12 text-[24px] font-semibold tracking-tight text-ink-paper sm:text-[28px]"
                  >
                    <span className="mr-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
                      §
                    </span>
                    {block.text}
                  </h2>
                )
              }
              return (
                <p
                  key={i}
                  className="text-[17px] leading-[1.65] text-paper-soft"
                  dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(block.text) }}
                />
              )
            })}
          </motion.div>
        </div>
      </article>

      <section className="border-hair relative overflow-hidden border-t bg-bg py-24 text-ink sm:py-32">
        <div className="grid-blueprint absolute inset-0 opacity-60" aria-hidden="true" />
        <motion.div
          {...fadeInUp}
          className="relative mx-auto w-full max-w-[1280px] px-6 text-center sm:px-10 lg:px-16"
        >
          <p className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
            <span className="h-px w-8 bg-accent" />
            // Next
            <span className="h-px w-8 bg-accent" />
          </p>
          <h2 className="mx-auto max-w-2xl text-[clamp(2rem,4.6vw,3.2rem)] font-semibold leading-[1.05] tracking-tightest text-ink">
            Need help with <span className="text-accent">your website</span>?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed text-ink-soft">
            I build custom websites for local businesses. Made from scratch, looked after by me, and
            a direct line to call whenever something needs to change.
          </p>
          <Link
            to="/contact"
            className="group mt-10 inline-flex items-center gap-2.5 rounded-sm bg-accent px-7 py-4 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-white transition duration-200 ease-out hover:bg-[color:var(--accent-hi)] active:scale-[0.98]"
          >
            Get in touch
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </motion.div>
      </section>
    </div>
  )
}
