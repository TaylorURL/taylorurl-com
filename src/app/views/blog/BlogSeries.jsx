import { useParams } from 'react-router-dom'
import { CallToAction, Grid, LinkCard, PageIntro, Section, SectionHead } from '@components/kit/Kit'
import Seo from '@components/Seo'
import NotFound from '@views/NotFound'
import { breadcrumbSchema, SITE_URL } from '@constants/seo'
import { BLOG_SERIES_INDEX, findSeries } from '@data/blog'

/**
 * One running series: what it is about, every article in it newest first, and
 * the other series beside it.
 */
export default function BlogSeries() {
  const { slug } = useParams()
  const series = findSeries(slug)

  if (!series) return <NotFound />

  const others = BLOG_SERIES_INDEX.filter(other => other.slug !== series.slug)

  return (
    <>
      <Seo
        title={`${series.name}: ${series.tagline}`}
        description={series.description}
        path={`/blog/series/${series.slug}`}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Blog', path: '/blog' },
            { name: series.name, path: `/blog/series/${series.slug}` },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: series.name,
            description: series.description,
            url: `${SITE_URL}/blog/series/${series.slug}`,
            isPartOf: { '@type': 'Blog', name: 'TaylorURL Blog', url: `${SITE_URL}/blog` },
            mainEntity: {
              '@type': 'ItemList',
              numberOfItems: series.posts.length,
              itemListElement: series.posts.map((post, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                url: `${SITE_URL}/blog/${post.slug}`,
                name: post.title,
              })),
            },
          },
        ]}
      />

      <PageIntro title={series.name} lead={series.description} actions={false} />

      <Section label={`Articles in ${series.name}`} className="!pt-6">
        <SectionHead
          title={`${series.posts.length} ${series.posts.length === 1 ? 'article' : 'articles'}`}
        />
        <Grid cols={3}>
          {series.posts.map(post => (
            <LinkCard
              key={post.slug}
              to={`/blog/${post.slug}`}
              meta={`${post.date} · ${post.readTime}`}
              title={post.title}
              body={post.excerpt}
            />
          ))}
        </Grid>
      </Section>

      {others.length > 0 && (
        <Section label="Other series">
          <SectionHead title="Other series" link={{ to: '/blog', label: 'See All Articles' }} />
          <Grid cols={3}>
            {others.map(other => (
              <LinkCard
                key={other.slug}
                to={`/blog/series/${other.slug}`}
                meta={`${other.posts.length} ${other.posts.length === 1 ? 'article' : 'articles'}`}
                title={other.name}
                body={other.tagline}
              />
            ))}
          </Grid>
        </Section>
      )}

      <CallToAction title="Want this done on your site?" />
    </>
  )
}
