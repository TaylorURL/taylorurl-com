# Changelog

All notable changes to TaylorURL will be documented in this file.

## [4.3.6] - 2026-04-03

- TaylorURL Release v4.3.6

## [4.3.5] - 2026-04-03

- TaylorURL Release v4.3.5

## [4.3.4] - 2026-04-02

- TaylorURL Release v4.3.4

## [4.3.3] - 2026-04-02

- TaylorURL Release v4.3.3

## [4.3.2] - 2026-04-02

- TaylorURL Release v4.3.2

## [4.3.1] - 2026-04-02

- TaylorURL Release v4.3.1

## [4.3.1] - 2026-04-02

- Add Error Tracker page (staff/admin only) with real-time Supabase updates, GitHub issue links, and fix commit links
- Fix signup 500 error caused by rogue `on_auth_user_updated` trigger referencing non-existent profile columns
- Fix AuthContext race condition where profile wasn't loaded before role checks ran
- Fix CORS credentials error on error-reporting-service edge function
- Replace sendBeacon with fetch+keepalive in ErrorReporterUtility to fix silent error dropping
- Add role management UI in Admin panel
- Update license files

## [4.3] - 2026-04-01

- Reformatted the Supabase missing environment variable error to use multi-line throw syntax for better readability

## [4.2] - 2026-03-15

- Added admin panel with full CRUD management for client websites and user roles
- Introduced role-based access control with client, staff, and admin roles
- Added profiles table to the database schema with automatic profile creation on signup via trigger
- AuthContext now loads user profiles and exposes isStaff() and isAdmin() helper functions
- Added websites and website_stats tables with row-level security policies
- Created migration script for adding roles, profiles columns, and new tables to existing databases
- Added protected /admin route in the app router
- Dashboard now shows an Admin Panel link for staff and admin users
- Added SQL helper script to promote a user to admin role

## [4.1] - 2026-03-15

- Add Supabase authentication with sign in, sign up, password reset, and session management
- Create AuthContext provider with useAuth hook for app-wide auth state
- Initialize Supabase client library with environment variable configuration
- Enable sign up flow on the auth page, replacing the previous "Registration Closed" placeholder
- Wire up the auth form to actually authenticate against Supabase instead of being a static placeholder
- Add forgot password flow with email reset link support
- Add loading and error states with inline validation to the auth forms
- Create a protected Dashboard view for authenticated clients with website status, analytics, and uptime tracking
- Add ProtectedRoute component that redirects unauthenticated users to the auth page
- Add database schema with websites and website_stats tables, row-level security policies, and auto-updating timestamps
- Update navigation to show "Dashboard" instead of "Client Portal" when the user is signed in, linking to the dashboard route

## [4.0] - 2026-03-15

- Added new dashboard variant to the browser mockup with animated stat cards for visitors, leads, and revenue, a gradient chart area, and animated progress bars
- Replaced the code mockup with the dashboard mockup in the carousel rotation
- Increased the carousel dimensions and spacing for a larger, more spread-out layout
- Removed unused AnimatePresence import from the carousel component

## [3.9] - 2026-03-15

- Add MockupCarousel component that rotates between default, analytics, and code browser mockups in a 3D orbit layout with smooth Framer Motion transitions every 3.5 seconds
- Replace the static single BrowserMockup in HeroSection with the new MockupCarousel
- Update HeroSection desktop layout to use flexbox centering for the carousel

## [3.8] - 2026-03-15

- Added a Client Portal link to the desktop navigation bar next to Get a Quote
- Renamed "Sign In" to "Client Portal" in the mobile navigation menu

## [3.7] - 2026-03-15

- Reduced mobile navbar padding and added overflow hidden to tighten up the header layout
- Scaled down the mobile logo from h-24 to h-20 and added a negative bottom margin to fine-tune its positioning

## [3.6] - 2026-03-15

- Replaced framer-motion page transitions in Layout with a plain main element
- Rewrote ScrollProgress to use a native scroll listener and direct DOM updates instead of framer-motion springs
- Swapped framer-motion animated marquee in LogoMarquee for a CSS keyframe animation
- Switched SectionIndicator from scroll-based offset calculation to IntersectionObserver for detecting the active section
- Added responsive top padding to the Auth view for smaller screens
- Added marquee keyframe animation and utility class in index.css

## [3.5] - 2026-03-15

- Increased top padding on blog post article from pt-32 to pt-40 for more breathing room

## [3.4] - 2026-03-15

- Adjusted blog post article spacing by replacing uniform vertical padding with separate top and bottom values for better content positioning

## [3.3] - 2026-03-15

- Replaced the mobile dropdown menu with a slide-in drawer that enters from the right side of the screen
- Added a drawer header with the TaylorURL logo and a close button
- Changed mobile navigation layout from a 2-column grid to a vertical list with section labels ("Navigation" and "Account")
- Added active-state indicator dots next to the current page link in mobile nav
- Updated active link styling from dark background (gray-900) to a blue highlight (blue-50 with blue text)
- Moved the "Get a Quote" CTA to a pinned section at the bottom of the drawer
- Changed link animations from scale-in to slide-in-from-right
- Increased backdrop opacity from 30% to 50% and raised z-index values for proper layering
- Moved "Sign In" into its own "Account" section within the drawer instead of sharing a row with "Get a Quote"

## [3.2] - 2026-03-15

- Fix navigation background detection on mobile by using the mobile logo element when it's visible instead of always using the desktop logo
- Add separate refs for the mobile nav bar and mobile logo link so background checks target the correct element per viewport
- Update getBackgroundAtPoint to accept multiple elements to ignore via rest params, so both desktop and mobile nav are excluded from background sampling

## [3.1] - 2026-03-14

- Removed CLAUDE.md configuration file from the project

## [3.0] - 2026-03-14

- Overhauled SEO across all pages with location-targeted meta titles and descriptions mentioning Baytown, Houston, and surrounding Texas cities
- Added structured data (JSON-LD) for LocalBusiness and WebSite schemas in index.html, with service area coverage for 12 Texas cities
- Added BlogPosting schema markup to individual blog post pages
- Added FAQPage schema markup to the FAQ page
- Added robots.txt with crawl rules and sitemap reference
- Added sitemap.xml covering all public routes with priority and change frequency
- Updated the Seo component to support custom structured data via a new schema prop, and added og:site_name, og:image, and twitter card meta tags
- Expanded the Footer with a "Serving" section listing 17 Texas cities
- Updated Footer description to highlight specific service areas instead of generic tagline
- Simplified the Status page by removing degraded/down states and multi-status logic, keeping all services hardcoded as operational
- Renamed and shortened service names and descriptions on the Status page for clarity
- Changed Status page data granularity from time-slot-based to day-based consistency
- Removed Leaflet CSS dependency from index.html
- Added canonical URL and geo meta tags to the HTML head
- Added CLAUDE.md with project overview and key conventions

## [2.9] - 2026-03-14

- Removed client logo images (CT, DBF, Hypixel, Mineplex, SRM, Speedway146)

## [2.8] - 2026-03-14

- Increased logo size in the navigation and footer for better visibility
- Migrated release tooling from turl-release to nit release
- Replaced turl.json config with nit.json
- Applied consistent code formatting across all components, views, and blog data files

## [2.7] - 2026-03-04

- Restructured project directory by moving components and views under the `app` folder for better organization, updating related paths in `jsconfig.json` to reflect the new structure.
- Added a new `CtaBanner` component with customizable call-to-action banners, supporting light and dark variants, animated transitions, and configurable button links.
- Introduced a modern `Footer` component with navigation links, contact information, and a responsive grid layout for improved user experience.
- Created a reusable `LegalPage` component to standardize the structure of legal content pages like Terms and Privacy.
- Implemented a new `Navigation` component with enhanced styling and routing for primary site navigation.
- Refreshed the `PageHero` component with updated styling for consistent page headers across the site.
- Added comprehensive new views for key pages including `About`, `Pricing`, `Services`, `Work`, `License`, `Privacy`, and `Terms`, each with tailored content and layouts.
- Updated the `Home` view with revised content and structure for a more engaging landing page experience.
- Removed outdated components such as `Clients`, `ContactModal`, `Hero`, `Navbar`, `Offerings`, `ParticleBackground`, and `Process` to streamline the codebase.
- Deleted legacy views for `About`, `Pricing`, `Services`, `Work`, `License`, `Privacy`, and `Terms` as they were replaced with new implementations under the `app` directory.
- Eliminated unused hooks like `useActiveSection`, `useClipboard`, and `useReveal` to reduce complexity.
- Removed the `ErrorBoundary` component as part of codebase cleanup.
- Added preconnect links for Google Fonts in `index.html` to improve font loading performance.

## [2.6] - 2026-02-04

- Updated the Prettier configuration in .prettierrc to format the plugins list as an array with proper indentation for better readability.
- Adjusted the Tailwind configuration in tailwind.config.js with extensive updates to custom colors, breakpoints, and other styling properties to align with the latest design requirements.
- Made minor structural updates to various components and views including App.jsx, Footer.jsx, Navigation.jsx, About.jsx, Auth.jsx, Home.jsx, Pricing.jsx, Services.jsx, and Work.jsx to ensure consistency and compatibility with the updated styling.
- Enhanced the Home view with refined content and layout adjustments for improved user experience and visual flow.
- Updated the main application entry in main.jsx to include a small but necessary code addition for proper initialization.
- Revised the PostCSS configuration in postcss.config.js to optimize the build process with updated settings.
- Improved the index.html file with updated metadata and structural changes for better performance and accessibility.

## [2.5] - 2026-02-04

- Removed the Contact page and its associated route from the application, simplifying the navigation structure.
- Revamped the Footer component with a new design, featuring a gradient background, a semi-transparent black card with
  backdrop blur, and updated styling for icons and text with hover effects.
- Updated the Footer content by removing the Services category from navigation links and simplifying the Company links,
  while adjusting the layout for better responsiveness.
- Enhanced the Navigation component with a redesigned mobile menu, including a smooth animation for the menu toggle and
  improved accessibility with ARIA attributes.
- Improved the PageHero component by adding new styling for hero sections with better typography and responsive
  adjustments.
- Overhauled the Home view with updated content structure, focusing on clearer messaging and refined visual hierarchy
  for key sections.
- Redesigned the About view with expanded content, improved layout for readability, and updated imagery for a more
  engaging presentation.
- Updated the Work view with a refreshed portfolio display, featuring improved spacing and hover interactions for
  project cards.
- Completely redesigned the Pricing view with a modern card-based layout, enhanced comparison tables, and improved
  call-to-action buttons for better user engagement.
- Made minor styling updates to the Services view, adjusting spacing and typography for consistency with the overall
  design refresh.
- Applied a global design refresh in index.css, introducing new utility classes, refined animations, and consistent
  spacing and typography across the application.
- Adjusted the Clients component layout by updating the container class for better width control with max-w-6xl.
- Updated Tailwind configuration with new customizations for colors and breakpoints to support the design overhaul.

## [2.4] - 2026-02-04

- Updated the About page to reflect a shift from an individual focus to a business entity, TaylorURL, now described as a
  web development agency based in Houston specializing in local businesses.
- Revised the About page content to emphasize affordable pricing and reliable service for local businesses needing an
  online presence.
- Replaced the "Core Skills" section with "What We Do" on the About page, listing specific services like Custom Website
  Development, E-Commerce Solutions, and Mobile-Responsive Design.
- Expanded the values section on the About page, adding new values such as "Results Driven," "Client Focused," and "
  Reliable Support," with updated descriptions to align with a business-oriented approach.
- Changed pronouns and messaging throughout the About page from "I" to "We" to represent a team perspective.
- Updated icons on the About page, adding Target and Clock icons while maintaining existing ones like Zap and Users for
  visual representation of values.
- Adjusted the layout of the values grid on the About page to support a responsive design with up to three columns on
  larger screens.
- Removed the testimonials section from the Home page, eliminating customer quotes and related content to streamline the
  page.
- Removed unused icon imports from the Home page, such as Code, TrendingUp, Star, and Mail, to clean up the codebase.
- Simplified content in the Services and Work pages by removing or adjusting minor elements, though specific details are
  less extensive compared to About page updates.

## [2.3] - 2026-02-02

- Updated package.json to replace custom release and cleanup scripts with "turl-release" command
- Added new public/turl.json file with version and project metadata
- Removed public/version.json file with old version metadata
- Deleted scripts/cleanup.js file
- Deleted scripts/release.js file
- Minor update to src/views/Auth.jsx file with unspecified changes

## [2.2] - 2026-02-01

- Added new Auth view component at src/views/Auth.jsx
- Added new License view component at src/views/License.jsx
- Added new Privacy view component at src/views/Privacy.jsx
- Added new Terms view component at src/views/Terms.jsx

## [2.1] - 2026-02-01

- Added new configuration file vercel.json for deployment settings

## [2.0] - 2026-02-01

- Updated `max_tokens` from 400 to 1000 for changelog generation in `scripts/release.js`.
- Updated `max_tokens` from 500 to 1000 for commit message generation in `scripts/release.js`.
- Adjusted padding and container classes in `Footer.jsx` to be responsive with `px-4 sm:px-6` and `py-12 sm:py-16`.
- Modified logo text size in `Footer.jsx` to be responsive with `text-xl sm:text-2xl`.
- Updated description text size in `Footer.jsx` to be responsive with `text-sm sm:text-base`.
- Changed copyright text size in `Footer.jsx` to be responsive with `text-xs sm:text-sm`.
- Adjusted padding for copyright section in `Footer.jsx` to `pt-6 sm:pt-8`.
- Updated layout structure in `Footer.jsx` by changing margin-bottom classes to `mb-8 sm:mb-12`.
- Modified padding and container classes in `PageHero.jsx` to be responsive with `px-4 sm:px-6` and
  `pb-12 sm:pb-16 sm:pt-24 sm:pt-32`.
- Adjusted title text size in `PageHero.jsx` to be responsive with `text-3xl sm:text-4xl md:text-5xl`.
- Updated description text size in `PageHero.jsx` to be responsive with `text-base sm:text-lg`.
- Adjusted padding in `Contact.jsx` to be responsive with `py-12 sm:py-16`.
- Updated container padding in `Contact.jsx` to be responsive with `px-4 sm:px-6`.
- Changed grid layout in `Contact.jsx` for contact methods to be responsive with `mb-8 sm:mb-12 sm:grid-cols-2`.
- Adjusted padding for message form container in `Contact.jsx` to be responsive with `p-4 sm:p-6`.
- Added `logo-wave-dark` class to "Send a Message" heading in `Contact.jsx`.
- Updated form input layout in `Contact.jsx` to be responsive with `grid gap-4 sm:grid-cols-2`.
- Adjusted heading text size in `Home.jsx` to be responsive with `text-4xl sm:text-5xl md:text-6xl lg:text-7xl`.
- Updated description text size in `Home.jsx` to be responsive with `text-lg sm:text-xl`.

## [1.9] - 2026-02-01

- Added new ScrollToTop.jsx component file
- Initial setup of ScrollToTop component structure

## [1.8] - 2026-02-01

- Updated README.md to add a smiley face to the personal note.

## [1.7] - 2026-02-01

- Version update

## [1.6] - 2026-02-01

- Version update

## [1.5] - 2026-02-01

- Version update

## [1.4] - 2026-02-01

- Version update

## [1.3] - 2026-02-01

- Version update

## [1.2] - 2026-02-01

- Version update

## [1.1] - 2026-02-01

- Version update

## [1.8] - 2026-02-01

- Version update

## [1.7] - 2026-02-01

- Version update

## [1.6] - 2026-02-01

- Version update
