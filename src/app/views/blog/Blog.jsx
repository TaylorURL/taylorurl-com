import { CallToAction, Grid, LinkCard, PageIntro, Section, SectionHead } from '@components/kit/Kit'
import Seo from '@components/Seo'
import { BLOG_POSTS, BLOG_SERIES_INDEX } from '@data/blog'
import { breadcrumbSchema, BUSINESS_ID, SITE_URL } from '@constants/seo'
import { postMeta } from './postMeta'

/**
 * The blog's front page.
 *
 * The running series first, because a series is the axis a reader follows -
 * the one that matches their problem - and then every article, newest first,
 * each under the series it belongs to and the day it was published.
 */
export default function Blog() {
  return (
    <>
      <Seo
        title="Website & Google Tips for Baytown Businesses"
        description="Plain-English notes on websites, Google, and getting more customers, written for small businesses around Baytown, Houston, and Southeast Texas."
        path="/blog"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Blog', path: '/blog' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Blog',
            name: 'TaylorURL Blog',
            url: `${SITE_URL}/blog`,
            description:
              'Plain-English notes on websites, Google, and getting more customers, written for small businesses in Baytown and the Houston area.',
            publisher: { '@id': BUSINESS_ID },
          },
        ]}
      />

      <PageIntro
        title="Straight answers about websites and Google."
        lead="Why customers can’t find you on Google, and what to fix first on the site they do land on."
        actions={false}
      />

      <Section label="Series" className="!pt-6">
        <SectionHead title="Series" />
        <Grid cols={3}>
          {BLOG_SERIES_INDEX.map(series => (
            <LinkCard
              key={series.slug}
              to={`/blog/series/${series.slug}`}
              meta={`${series.posts.length} ${series.posts.length === 1 ? 'article' : 'articles'}`}
              title={series.name}
              body={series.tagline}
            />
          ))}
        </Grid>
      </Section>

      <Section label="All articles">
        <SectionHead title="All articles" />
        <Grid cols={3}>
          {BLOG_POSTS.map(post => (
            <LinkCard
              key={post.slug}
              to={`/blog/${post.slug}`}
              meta={postMeta(post)}
              title={post.title}
            />
          ))}
        </Grid>
      </Section>

      <CallToAction title="Ready to fix your website?" />
    </>
  )
}
