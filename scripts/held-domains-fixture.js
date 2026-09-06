/**
 * The held-domain list the checks run against.
 *
 * Who has actually asked the studio to stop writing to them is a fact about
 * those businesses. This repository is public, a list of companies that
 * objected to being contacted is the last thing that belongs in one, and the
 * real list lives in `outreach_held_domains` where only a service-role client
 * reads it.
 *
 * So the checks state their own. Every domain here sits under the reserved
 * `.example` top level, which nobody can register, so no fixture can name a
 * real company by accident however it is edited later.
 *
 * The rules refuse to judge any domain until a list has been installed - an
 * empty list and a list that was never read are different things, and only one
 * of them is safe - so a check that reaches the shape rules, the row rules or
 * the queue installs this first.
 */

import { installHeldDomains } from '../lib/outreach/exclusions.js'

/** Domains the fixture holds off outreach, standing in for the real list. */
export const HELD_FIXTURE = Object.freeze([
  'readymixyard.example',
  'heldplumbing.example',
  'heldstorage.example',
  'fencecraft.example',
  'helddentistry.example',
  'heldpainting.example',
  'heldlogistics.example',
  'heldmaterials.example',
])

/** Install the fixture list, so the rules will answer. */
export function installFixtureHeldDomains() {
  installHeldDomains([...HELD_FIXTURE])
}
