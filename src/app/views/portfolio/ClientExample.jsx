import { DeviceShowcase, Grid, Section, TextLink, WorkCard } from '@components/kit/Kit'
import { TYPE } from '@components/kit/styles'
import { detailOf, studyHref } from './work'

/**
 * One client site shown as the example a trade or a town page leans on: what
 * it is in a sentence or two beside the site itself on a laptop and a phone,
 * the way in to its case study and to the live site, and any further sites
 * for the same trade or town as cards under it.
 *
 * Nothing sits over the heading. The heading or the sentence under it names
 * the client, which is the caller's to write, and the address bar on the
 * laptop names the site.
 */
export default function ClientExample({ project, title, body, more = [], moreTitle, label }) {
  return (
    <Section label={label}>
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-14">
        <div className="min-w-0">
          <h2 className={TYPE.h2}>{title}</h2>
          {body && <p className={`${TYPE.body} mt-4`}>{body}</p>}
          <div className="mt-7 flex flex-wrap gap-x-7 gap-y-3">
            {project.hasStudy && <TextLink to={studyHref(project)} label="Read the Case Study" />}
            <TextLink href={project.url} label="Visit the Site" />
          </div>
        </div>
        <div className="min-w-0">
          <DeviceShowcase project={project} />
        </div>
      </div>

      {more.length > 0 && (
        <div className="mt-16 sm:mt-20">
          {moreTitle && <h3 className={`${TYPE.h3} mb-6`}>{moreTitle}</h3>}
          <Grid cols={3}>
            {more.map(site => (
              <WorkCard
                key={site.slug}
                project={site}
                to={studyHref(site)}
                detail={detailOf(site)}
              />
            ))}
          </Grid>
        </div>
      )}
    </Section>
  )
}
