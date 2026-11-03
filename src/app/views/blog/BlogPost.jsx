import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CallToAction, Grid, LinkCard, PageIntro, Section, SectionHead } from '@components/kit/Kit'
import { TYPE } from '@components/kit/styles'
import Seo from '@components/Seo'
import NotFound from '@views/NotFound'
import ShareBar from '@components/article/ShareBar'
import ArticleBody from '@components/article/ArticleBody'
import { BLOG_POSTS, findSeries, relatedPosts } from '@data/blog'
import { articleFrame } from '@utils/articleLayout'
import { breadcrumbSchema, SITE_URL } from '@constants/seo'
import { postMeta } from './postMeta'

const MAX_DESCRIPTION_LENGTH = 160

function clampDescription(text) {
  if (!text || text.length <= MAX_DESCRIPTION_LENGTH) return text
  const cut = text.slice(0, MAX_DESCRIPTION_LENGTH - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ')).trimEnd()}…`
}

/**
 * One article, read as a document: the headline with its answer in a sentence,
 * then the date, the read time and the series it belongs to over the text in
 * one narrow column, then where to share it and what to read next.
 *
 * The page carries no rail, gauge or pinned contents. The headings keep their
 * addresses, so a link into a section still lands on it.
 */
function Article({ post }) {
  const frame = useMemo(() => articleFrame(post), [post])
  const series = findSeries(post.series)
  const related = relatedPosts(post)
  const publishedTime = new Date(post.date).toISOString()

  return (
    <>
      <Seo
        title={post.title}
        description={clampDescription(post.excerpt)}
        path={`/blog/${post.slug}`}
        ogType="article"
        article={{
          publishedTime,
          section: post.category,
        }}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Blog', path: '/blog' },
            { name: post.title, path: `/blog/${post.slug}` },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.excerpt,
            datePublished: publishedTime,
            articleSection: post.category,
            wordCount: frame.words,
            author: {
              '@type': 'Person',
              name: 'Trenton Taylor',
              url: `${SITE_URL}/about`,
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
                url: `${SITE_URL}/images/TaylorURL-Logo.png`,
              },
            },
            mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
            ...(series
              ? {
                  isPartOf: {
                    '@type': 'CreativeWorkSeries',
                    name: series.name,
                    url: `${SITE_URL}/blog/series/${series.slug}`,
                  },
                }
              : {}),
          },
        ]}
      />

      <PageIntro title={post.title} lead={post.excerpt} actions={false} />

      {/* The reading column is the narrow measure, held to the left edge the
          headline above it starts from rather than centred away from it. */}
      <Section className="!pt-2" label="Article">
        <article className="max-w-[720px]">
          <p className={TYPE.small}>
            {post.date} · {post.readTime}
            {series && (
              <>
                {' · '}
                <Link
                  to={`/blog/series/${series.slug}`}
                  className="text-[color:var(--link)] transition-colors duration-150 hover:text-ink"
                >
                  {series.name}
                </Link>
              </>
            )}
          </p>
          <div className="mt-8">
            <ArticleBody post={post} sections={frame.sections} />
          </div>
          <div className="mt-14">
            <ShareBar title={post.title} path={`/blog/${post.slug}`} />
          </div>
        </article>
      </Section>

      {related.length > 0 && (
        <Section label="Read next">
          <SectionHead title="Read next" link={{ to: '/blog', label: 'See All Articles' }} />
          <Grid cols={3}>
            {related.map(next => (
              <LinkCard
                key={next.slug}
                to={`/blog/${next.slug}`}
                meta={postMeta(next)}
                title={next.title}
              />
            ))}
          </Grid>
        </Section>
      )}

      <CallToAction title="Need help with your website?" />
    </>
  )
}

export default function BlogPost() {
  const { slug } = useParams()
  const post = BLOG_POSTS.find(entry => entry.slug === slug)

  if (!post) return <NotFound />

  // Keyed on the slug so that moving between two articles rebuilds the page
  // rather than carrying one article's state into the next.
  return <Article key={post.slug} post={post} />
}
