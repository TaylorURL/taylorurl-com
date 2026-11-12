import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import { Band } from '@components/kit/Kit'
import { TYPE } from '@components/kit/styles'
import { BLOG_POSTS } from '@data/blog'

/**
 * The newest articles as a row of big white-on-dark cards that slide sideways,
 * after whatsapp.com's "Stay up to date": the heading and a line at the left,
 * two round arrows under them, the cards running off the right edge, and the
 * whole band tinted with its lower corners rounded over the footer.
 */
export default function BlogCarousel({ count = 6, last = false }) {
  const track = useRef(null)
  const posts = BLOG_POSTS.slice(0, count)
  if (posts.length === 0) return null
  const step = direction => {
    const row = track.current
    if (!row) return
    const card = row.querySelector('li')
    const distance = card ? card.getBoundingClientRect().width + 24 : row.clientWidth * 0.8
    row.scrollBy({ left: direction * distance, behavior: 'smooth' })
  }
  return (
    <Band label="From the blog" last={last}>
      {/* A fixed-width heading column rather than a share of a grid: the
          column starts at the page's content edge, so its inset grows with the
          window, and a grid track capped at 380px left a wide window (1700px
          and up) with a column all inset and no room for the words. */}
      <div className="flex flex-col gap-12 lg:flex-row lg:gap-10">
        <div className="wa-blog-head">
          <h2 className={TYPE.h2}>Keep up to date</h2>
          <p className={`${TYPE.body} mt-6 max-w-[340px] break-normal`}>
            Plain-English notes on websites, Google and getting more customers, for small businesses
            around Baytown and Houston.
          </p>
          <div className="mt-10 flex gap-3">
            <button
              type="button"
              className="wa-social"
              aria-label="Previous articles"
              onClick={() => step(-1)}
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="wa-social"
              aria-label="More articles"
              onClick={() => step(1)}
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
        <ul
          ref={track}
          className="wa-stagger flex min-w-0 snap-x snap-mandatory scroll-pl-5 gap-6 overflow-x-auto scroll-smooth px-5 pb-2 [scrollbar-width:none] sm:scroll-pl-8 sm:px-8 lg:flex-1 lg:scroll-pl-0 lg:pl-0 [&::-webkit-scrollbar]:hidden"
        >
          {posts.map(post => (
            <li key={post.slug} className="w-[76vw] max-w-[480px] shrink-0 snap-start sm:w-[480px]">
              {/* As tall as the tallest card in the row (the row stretches them),
                  never a fixed slab: a short excerpt cannot leave a card mostly
                  empty space with "Read More" stranded at its foot. */}
              <article className="wa-card flex h-full min-h-[360px] flex-col rounded-[15px] bg-[var(--paper)] px-6 py-8 sm:min-h-[420px] sm:rounded-[25px] sm:p-12 xl:p-[56px]">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(59_107_255/0.14)] text-[color:var(--blue-hi)]"
                    aria-hidden="true"
                  >
                    <BookOpen className="h-[18px] w-[18px]" strokeWidth={1.7} />
                  </span>
                  <p className="text-[13px] font-medium text-[color:var(--blue-hi)]">
                    {post.category}
                  </p>
                </div>
                <h3 className="mt-7 break-words text-[24px] font-normal leading-[1.08] tracking-[-0.01em] text-ink sm:text-[32px]">
                  {post.title}
                </h3>
                <p className={`${TYPE.small} mt-4 line-clamp-4`}>{post.excerpt}</p>
                <p className="mt-4 text-[13px] leading-[18px] text-ink-mute">
                  {post.date}
                  {post.readTime && <span aria-hidden="true"> · </span>}
                  {post.readTime}
                </p>
                <div className="mt-auto pt-8">
                  <Link
                    to={`/blog/${post.slug}`}
                    className="wa-btn wa-btn-outline"
                    aria-label={`Read more: ${post.title}`}
                  >
                    <span className="wa-btn-label">Read More</span>
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </Band>
  )
}
