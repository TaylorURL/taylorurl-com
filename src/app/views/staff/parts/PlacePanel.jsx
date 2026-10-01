import { usePlacePhotos } from '@hooks/console/usePlacePhotos'
import { mapFrameHref, mapQuery } from '@lib/outreach/prospects/map.js'

/** The tiles drawn while the photos load, which is the two-by-two grid they land in. */
const WAITING_TILES = 4

/**
 * What the business looks like and where it is: its photos off the Google
 * listing, and a map open on it.
 *
 * Both are there for the caller to look at before dialling. A storefront, a
 * fleet of trucks or a kitchen says what size of business is about to answer,
 * and the map says where it sits against the towns the studio has built for -
 * the two things a caller otherwise learns ten seconds into the call.
 *
 * Every nothing says which nothing it is. A business added by hand has no
 * listing to take photos from, which is a different fact from a listing with no
 * photos on it, and both are different from a read that failed.
 *
 * @param {{row: object, token: string|null}} props
 */
export default function PlacePanel({ row, token }) {
  const shots = usePlacePhotos({ token, id: row.id })
  const query = mapQuery(row)

  return (
    <div className="staff-place">
      <div className="staff-part">
        <h3>Photos</h3>
        {shots.loading ? (
          <div className="staff-photos" aria-busy="true" aria-label="Loading photos">
            {Array.from({ length: WAITING_TILES }, (_, at) => (
              <span key={at} className="staff-photo" data-empty="true" />
            ))}
          </div>
        ) : shots.error ? (
          <p className="staff-read">{shots.error}</p>
        ) : !shots.listed ? (
          <p className="staff-read">No Google listing on file.</p>
        ) : !shots.photos.length ? (
          <p className="staff-read">The Google listing has no photos.</p>
        ) : (
          <>
            <div className="staff-photos">
              {shots.photos.map((photo, at) => (
                <a
                  key={photo.uri}
                  className="staff-photo"
                  href={photo.uri}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    src={photo.uri}
                    alt={`Photo ${at + 1} of ${row.name}`}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </a>
              ))}
            </div>
            <Credit photos={shots.photos} />
          </>
        )}
      </div>

      <div className="staff-part">
        <h3>Map</h3>
        {query ? (
          <iframe
            key={row.id}
            className="staff-map"
            title={`Map of ${row.name}`}
            src={mapFrameHref(query)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <p className="staff-read">No address on file.</p>
        )}
      </div>
    </div>
  )
}

/**
 * Who took the photos, each name linked where Google gave a link.
 *
 * Google asks that its photos are shown with their authors, so this line is
 * not optional. A name that appears on two photos is named once.
 */
function Credit({ photos }) {
  const seen = new Map()
  for (const photo of photos) {
    for (const author of photo.by) if (!seen.has(author.name)) seen.set(author.name, author)
  }
  const authors = [...seen.values()]
  if (!authors.length) return <p className="staff-read">From the Google listing.</p>
  return (
    <p className="staff-read">
      {'Photos by '}
      {authors.map((author, at) => (
        <span key={author.name}>
          {at > 0 ? (at === authors.length - 1 ? ' and ' : ', ') : ''}
          {author.uri ? (
            <a href={author.uri} target="_blank" rel="noreferrer">
              {author.name}
            </a>
          ) : (
            author.name
          )}
        </span>
      ))}
      {' on Google Maps.'}
    </p>
  )
}
