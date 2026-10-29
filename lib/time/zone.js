/**
 * The zone every time in this project is read in.
 *
 * It lives in chainwork now, because the sending schedule and the ramp are
 * there and a day they lay out has to be the same day everything else reads
 * back. The path stays so nothing that imports it has to move, and the zone
 * itself is unchanged: Central, named rather than offset, because the offset
 * moves twice a year.
 *
 * Nothing is decided here any more. This file is the path, and chainwork is
 * the code; see chainwork/core/zone.js.
 */

export * from 'chainwork/core/zone.js'
