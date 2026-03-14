import Link from 'next/link';

import { AuthActions } from '@/components/auth-actions';

const productHighlights = [
  {
    title: 'Annotate with purpose',
    description:
      'Turn worksheets, PDFs, and reading material into interactive lessons with comments, highlights, and guided tasks.'
  },
  {
    title: 'Collaborate in context',
    description:
      'Share documents with teacher, editor, or viewer access so every contributor knows exactly what they can do.'
  },
  {
    title: 'Manage classrooms faster',
    description:
      'Organize classrooms, assignments, and notifications in one workspace built for speed and clarity.'
  }
];

const outcomes = [
  {
    value: '94%',
    label: 'higher engagement reported by pilot educators'
  },
  {
    value: '7.8h',
    label: 'weekly admin time saved through shared workflows'
  },
  {
    value: '<2m',
    label: 'to create and share a classroom-ready document'
  }
];

export default function LandingPage() {
  return (
    <main className="page landingPage">
      <section className="landingHeroModern">
        <div className="heroCopy card">
          <p className="kicker">Kami Platform</p>
          <h1>Make learning materials truly interactive</h1>
          <p className="subtitle">
            Build a digital classroom experience where teachers can annotate, assign, and collaborate around every
            document in one elegant workflow.
          </p>
          <div className="heroActions">
            <AuthActions />
            <Link className="buttonLink secondary" href="/auth">
              Explore the Platform
            </Link>
          </div>
        </div>
        <aside className="card heroPanel">
          <p className="meta">Live Classroom Snapshot</p>
          <h2>Ready for instruction</h2>
          <div className="heroPanelGrid">
            <div>
              <p className="meta">Shared docs</p>
              <p className="panelValue">128</p>
            </div>
            <div>
              <p className="meta">Active collaborators</p>
              <p className="panelValue">43</p>
            </div>
            <div>
              <p className="meta">Unread updates</p>
              <p className="panelValue">9</p>
            </div>
            <div>
              <p className="meta">Assignments this week</p>
              <p className="panelValue">26</p>
            </div>
          </div>
        </aside>
      </section>

      <section className="brandStrip card">
        <p className="meta">Designed for schools, tutoring teams, and training organizations.</p>
        <div className="brandPills">
          <span>Classroom Ready</span>
          <span>Role Secure</span>
          <span>Mobile Responsive</span>
          <span>Vercel Deployed</span>
        </div>
      </section>

      <section className="outcomeGrid">
        {outcomes.map((item) => (
          <article key={item.value} className="card impactCard">
            <h2>{item.value}</h2>
            <p className="meta">{item.label}</p>
          </article>
        ))}
      </section>

      <section className="featureGrid">
        {productHighlights.map((feature) => (
          <article key={feature.title} className="card featureCard">
            <h2>{feature.title}</h2>
            <p className="meta">{feature.description}</p>
            <Link className="inlineLink" href="/auth">
              Learn more
            </Link>
          </article>
        ))}
      </section>

      <section className="card workflowCardModern">
        <h2>From static files to active learning in four steps</h2>
        <div className="workflowList">
          <p>
            <strong>1.</strong> Upload or import class materials in seconds.
          </p>
          <p>
            <strong>2.</strong> Add annotations, comments, and assignment context.
          </p>
          <p>
            <strong>3.</strong> Share with secure owner/editor/viewer permissions.
          </p>
          <p>
            <strong>4.</strong> Track updates and responses from one workspace.
          </p>
        </div>

        <div className="heroActions">
          <Link className="buttonLink" href="/auth">
            Start for Free
          </Link>
        </div>
      </section>
    </main>
  );
}
