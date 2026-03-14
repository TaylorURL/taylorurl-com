import { Link, useParams, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Calendar, Clock, Tag } from 'lucide-react'
import Seo from '@components/Seo'
import { BLOG_POSTS } from '@data/blog'

export default function BlogPost() {
  const { slug } = useParams()
  const post = BLOG_POSTS.find(p => p.slug === slug)

  if (!post) return <Navigate to="/blog" replace />

  return (
    <div>
      <Seo title={post.title} description={post.excerpt} path={`/blog/${slug}`} />

      <article className="relative overflow-hidden bg-white py-20">
        <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
        <div className="relative mx-auto max-w-3xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Link
              to="/blog"
              className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-blue-600"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Blog
            </Link>

            <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                <Tag className="h-3 w-3" />
                {post.category}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {post.date}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {post.readTime}
              </span>
            </div>

            <h1 className="mb-10 text-3xl font-bold text-gray-900 sm:text-4xl">
              {post.title}
            </h1>

            <div className="space-y-5">
              {post.content.map((block, i) => {
                if (block.type === 'h2') {
                  return (
                    <h2 key={i} className="mt-8 text-xl font-bold text-gray-900">
                      {block.text}
                    </h2>
                  )
                }
                return (
                  <p
                    key={i}
                    className="text-base leading-relaxed text-gray-600"
                    dangerouslySetInnerHTML={{ __html: block.text }}
                  />
                )
              })}
            </div>
          </motion.div>
        </div>
      </article>

      <section className="border-t border-gray-200 bg-gray-950 py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="mb-3 text-2xl font-bold text-white">
            Need Help With <span className="logo-wave">Your Website</span>?
          </h2>
          <p className="mb-6 text-gray-400">
            We build fast, custom websites for local businesses. No templates, no page builders.
          </p>
          <Link
            to="/pricing"
            className="group inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition-all hover:bg-blue-500"
          >
            Get a Quote
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>
    </div>
  )
}
