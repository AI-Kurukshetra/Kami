import Link from 'next/link';

import { AuthActions } from '@/components/auth-actions';

const productHighlights = [
  {
    icon: 'IL',
    title: 'Interactive Learning',
    description:
      'Turn any document into an active learning space with annotation, collaboration, and guided review.'
  },
  {
    icon: 'UA',
    title: 'Universal Accessibility',
    description:
      'Built for diverse learners with flexible workflows that support language, reading, and confidence.'
  },
  {
    icon: 'AI',
    title: 'Actionable Insights',
    description:
      'Give teachers and leaders clear signals from student activity and progress in one platform.'
  }
];

const trustPills = [
  'Trusted classroom workflows',
  'Secure role-based access',
  'Fast onboarding for teams',
  'Built for MVP scale'
];

export default function LandingPage() {
  return (
    <main className="page landingPage">
      <section className="hero card landingHero">
        <p className="kicker">Kami Platform</p>
        <h1>Elevate instruction and collaboration in one elegant workspace</h1>
        <p className="subtitle">
          A modern learning and productivity platform designed to make resources interactive, accessible, and
          measurable across your organization.
        </p>

        <div className="heroActions">
          <AuthActions />
          <Link className="buttonLink" href="/documents">
            Try the Workspace
          </Link>
          <Link className="buttonLink secondary" href="/documents">
            See Documents
          </Link>
          <Link className="buttonLink secondary" href="/profiles">
            Open Profiles
          </Link>
        </div>

      </section>

      <section className="trustStrip card">
        {trustPills.map((item) => (
          <p key={item} className="trustItem">
            {item}
          </p>
        ))}
      </section>

      <section className="impactGrid">
        <article className="card impactCard">
          <p className="meta">Engagement Lift</p>
          <h2>94%</h2>
          <p className="meta">Teachers report stronger student participation.</p>
        </article>
        <article className="card impactCard">
          <p className="meta">Time Saved</p>
          <h2>7.8 hrs</h2>
          <p className="meta">Average weekly time reclaimed through digital workflows.</p>
        </article>
        <article className="card impactCard">
          <p className="meta">Adoption Ready</p>
          <h2>Fast</h2>
          <p className="meta">Designed for rollout across teams and institutions.</p>
        </article>
      </section>

      <section className="featureGrid">
        {productHighlights.map((feature) => (
          <article key={feature.title} className="card featureCard">
            <span className="featureIcon">{feature.icon}</span>
            <h2>{feature.title}</h2>
            <p className="meta">{feature.description}</p>
            <Link className="inlineLink" href="/documents">
              Learn more
            </Link>
          </article>
        ))}
      </section>

      <section className="card workflowCard">
        <h2>One platform, real impact</h2>
        <div className="workflowList">
          <p>
            <strong>1.</strong> Start from existing files and turn static content into interactive resources.
          </p>
          <p>
            <strong>2.</strong> Share instantly with role controls for owners, editors, and viewers.
          </p>
          <p>
            <strong>3.</strong> Track collaboration with activity timelines and smart notifications.
          </p>
          <p>
            <strong>4.</strong> Scale confidently with secure backend architecture and deployment-ready tooling.
          </p>
        </div>

        <div className="heroActions">
          <Link className="buttonLink" href="/auth">
            Start for Free
          </Link>
          <Link className="buttonLink secondary" href="/workspace">
            Go to Workspace
          </Link>
          <Link className="buttonLink secondary" href="/notifications">
            Open Notification Inbox
          </Link>
        </div>
      </section>
    </main>
  );
}
