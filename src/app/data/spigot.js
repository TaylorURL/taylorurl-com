import { Boxes, Coins, Gamepad2, Gauge, Terminal, Webhook } from 'lucide-react'

/**
 * Content for the (unlisted) /spigot page — a soft-launch showcase for
 * Minecraft server plugin work. Kept as data so the view stays a thin mapper,
 * matching how @views/Services and @views/Portfolio are structured.
 *
 * Nothing here invents client names or metrics; copy describes real
 * capabilities so the page can grow into a services sub-site honestly.
 */

/**
 * What a commissioned plugin can be. Rendered as an engineering spec grid; each
 * card carries one of the three brand colours so the spectrum stays balanced
 * across the grid rather than leaning on any single hue.
 */
export const SPIGOT_CAPABILITIES = [
  {
    icon: Boxes,
    color: 'var(--c-blue)',
    title: 'Custom gameplay',
    description:
      'Bespoke mechanics, items, abilities, and world interactions built from a blank slate — the systems that make a server feel like nowhere else.',
  },
  {
    icon: Gamepad2,
    color: 'var(--c-green)',
    title: 'Minigames & modes',
    description:
      'Arenas, lobbies, matchmaking, scoreboards, and round logic. Self-contained game modes that spin up, run clean, and reset on their own.',
  },
  {
    icon: Coins,
    color: 'var(--c-orange)',
    title: 'Economy & progression',
    description:
      'Currencies, shops, ranks, quests, and leaderboards backed by a real database — progression that survives restarts and scales with your players.',
  },
  {
    icon: Webhook,
    color: 'var(--c-blue)',
    title: 'APIs & integrations',
    description:
      'Discord bridges, web dashboards, REST endpoints, PlaceholderAPI, and Vault hooks — your server talking to the tools you already run.',
  },
  {
    icon: Gauge,
    color: 'var(--c-green)',
    title: 'Performance work',
    description:
      'Async I/O, chunk-safe access, and profiling to pull heavy logic off the main thread. Plugins that hold their MSPT when the server fills up.',
  },
  {
    icon: Terminal,
    color: 'var(--c-orange)',
    title: 'Admin & tooling',
    description:
      'Moderation suites, permission-aware commands, config-driven behavior, and clean in-game GUIs so your staff can run things without touching code.',
  },
]

/** Stack chips — the tools these builds are made with. */
export const SPIGOT_STACK = [
  'Java 21',
  'Kotlin',
  'Paper API',
  'Spigot',
  'Bukkit',
  'Folia',
  'NMS',
  'Adventure',
  'ProtocolLib',
  'PlaceholderAPI',
  'Vault',
  'Maven',
  'Gradle',
  'MySQL',
  'Redis',
  'MongoDB',
  'JUnit',
  'Git',
]

/**
 * The relationship story, told in three nodes — the spine of the page's
 * tri-colour system. Each stage owns one brand colour.
 */
export const SPIGOT_STORY = [
  {
    color: 'var(--c-blue)',
    label: 'TaylorURL',
    role: 'The studio',
    description:
      'One developer, custom software. The same practice behind TaylorURL websites, pointed at Minecraft.',
  },
  {
    color: 'var(--c-green)',
    label: 'Minecraft',
    role: 'The platform',
    description:
      'Where your community already plays. A living world that server-side code can reshape end to end.',
  },
  {
    color: 'var(--c-orange)',
    label: 'Spigot / Paper',
    role: 'The tool',
    description:
      'The high-performance server API the plugins run on — the layer where bespoke gameplay is actually built.',
  },
]

/** How a build goes, start to finish. */
export const SPIGOT_PROCESS = [
  {
    title: 'Spec & scope',
    description:
      'We nail down the mechanics, commands, permissions, and data model before a line is written — so we build the right thing once.',
  },
  {
    title: 'Build & iterate',
    description:
      'Implemented against the Paper API and tested on a live dev server. You see working builds early and steer as it takes shape.',
  },
  {
    title: 'Harden',
    description:
      'Async I/O, edge cases, config, and permissions — every heavy path pulled off the main thread so nothing stalls your tick loop.',
  },
  {
    title: 'Ship & support',
    description:
      'A versioned, documented jar built for your server version, plus updates and fixes as your community grows.',
  },
]

/** Straight answers to the questions that come up first. */
export const SPIGOT_FAQ = [
  {
    q: 'Which versions do you support?',
    a: 'From 1.8 through the latest release. Builds target Paper/Spigot and are Purpur- and Folia-aware where it matters — tell me your server version and I match it.',
  },
  {
    q: 'Do you work from an idea or a full spec?',
    a: 'Either. Bring a one-line concept and we scope it together, or hand over a detailed design doc and I build to it. Most projects start somewhere in between.',
  },
  {
    q: 'Can you take over an existing plugin?',
    a: 'Yes. I can extend, fix, optimize, or port plugins you already run — including untangling code someone else left behind.',
  },
  {
    q: 'Do I own the code?',
    a: 'You do. Every commission ships with full source, so you are never locked to me. Keep it, hand it off, or bring me back for the next feature.',
  },
  {
    q: 'How are updates handled?',
    a: 'Jars are versioned and documented. When Minecraft updates or your needs change, I roll forward — with an agreed support window on larger builds.',
  },
]
