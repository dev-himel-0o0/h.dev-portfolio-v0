# H.dev — Full-Stack Software Engineer Portfolio

The personal portfolio of **Shahadat Himel**, a Full-Stack Software Engineer with 4+ years of experience based in Dhaka, Bangladesh. The site is built to win freelance projects and remote roles by demonstrating motion craftsmanship in the first seconds — the interface itself is the proof.

**Live:** [h-dev-portfolio-v0.vercel.app](https://h-dev-portfolio-v0.vercel.app)

## About the project

A pure black-and-white, editorial portfolio: white canvas, black type, neutral grays, and hairline borders — no gradients, accent colors, or decorative noise. Large display typography sets the pace, generous whitespace does the framing, and GSAP-driven motion carries the experience.

The page is composed of a preloader, hero, about, selected projects, services, stack, process, and contact footer, with a fullscreen numbered menu and a desktop-only custom cursor layered on top.

## Design direction

- **Monochrome only** — white background, black text, neutral grays.
- **Type system** — General Sans for display headings, Montserrat for body, labels, and numbers.
- **Editorial restraint** — hairline dividers (`border-black/10`), oversized type, calm pacing.
- **Motion with intent** — GSAP + ScrollTrigger for reveals, pinning, and choreography; Lenis for smooth scroll; Motion for hover and micro-interactions.

## Tech stack

| Area      | Tools                                               |
| --------- | --------------------------------------------------- |
| Framework | Next.js 16 (App Router), React 19, TypeScript       |
| Styling   | Tailwind CSS v4, shadcn/ui, Base UI, tw-animate-css |
| Motion    | GSAP + `@gsap/react`, ScrollTrigger, Lenis, Motion  |
| Icons     | Phosphor Icons                                      |
| Testing   | Playwright (E2E)                                    |
| Deploy    | Vercel                                              |

## Getting started

Requires Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command                | Description                      |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Start the development server     |
| `npm run build`        | Create a production build        |
| `npm run start`        | Serve the production build       |
| `npm run lint`         | Lint `src` and `e2e`             |
| `npm run format`       | Format the project with Prettier |
| `npm run format:check` | Check formatting without writing |
| `npm run test:e2e`     | Run Playwright end-to-end tests  |
| `npm run test:e2e:ui`  | Run Playwright in UI mode        |

## Project structure

```text
src/
├── app/                  # App Router entry (layout, page, not-found, globals)
├── components/
│   ├── home-experience.tsx  # Composes the single-page experience
│   ├── sections/            # Preloader, hero, about, work, services, stack, process, footer
│   └── ui/                  # Reusable animation and interaction primitives
├── fonts/                # Self-hosted General Sans woff2 files
└── lib/
    ├── data.ts           # Single source of truth for all site content
    ├── navigation.ts     # Navigation and transition state helpers
    └── utils.ts          # Shared utilities
```

## Content

All copy, projects, services, stack items, process steps, stats, and social links live in [`src/lib/data.ts`](./src/lib/data.ts). Update that file rather than editing components.

Some entries are deliberate placeholders until real content is supplied — projects, services, stack details, and social URLs. Real projects, clients, metrics, and testimonials must never be invented.

Design tokens, gutters, and global styles are defined in [`src/app/globals.css`](./src/app/globals.css).

## Accessibility & performance

- Full `prefers-reduced-motion` support — animations are disabled, content remains visible.
- Custom cursor is desktop-only and never rendered on touch devices.
- Animation loops pause while the tab is hidden.
- Keyboard-accessible navigation and focus states throughout.
- Mobile and touch are treated as first-class evaluation surfaces.

## Deployment

The site deploys on Vercel. Set the project root and build with the default Next.js settings — no custom environment variables are required.

## License

MIT © 2026 Shahadat Himel. See [LICENSE](./LICENSE).
