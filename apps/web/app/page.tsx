'use client';
import Link from 'next/link';
import { ChevronRightIcon, CubeIcon } from '@radix-ui/react-icons';
import type { ProjectSummary } from '@flaky-radar/shared';
import { useResource, percent } from '../lib/api';
import { Shell, Loading, ErrorState } from '../components/shell';
import { CreateProject } from '../components/create-project';
export default function Projects() {
  const resource = useResource<ProjectSummary[]>('/projects');
  return (
    <Shell>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Workspace</p>
          <h1>Projects</h1>
          <p>Keep an eye on the tests that won’t make up their mind.</p>
        </div>
        <CreateProject onCreated={resource.reload} />
      </div>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : resource.data?.length ? (
        <>
          <div className="section-heading">
            <h2>
              Your repositories{' '}
              <span className="count">{resource.data.length}</span>
            </h2>
            <span className="muted">Rates from the last 30 days</span>
          </div>
          <div className="project-list">
            {resource.data.map((p) => (
              <Link
                href={`/projects/${p.slug}`}
                className="project-row"
                key={p.id}
              >
                <span className="project-icon">
                  <CubeIcon width={25} height={25} />
                </span>
                <div className="project-name">
                  <h3>{p.name}</h3>
                  <span>{p.slug}</span>
                </div>
                <div>
                  <span className="metric-label">Flake rate</span>
                  <strong className={p.flakeRate ? 'warning-text' : ''}>
                    {percent(p.flakeRate)}
                  </strong>
                </div>
                <div>
                  <span className="metric-label">Uploads · 7 days</span>
                  <strong>{p.uploadsLast7Days}</strong>
                </div>
                <ChevronRightIcon className="row-arrow" />
              </Link>
            ))}
          </div>
          <p className="hint">
            Flake rate includes retries that recovered and conflicting results
            on the same commit. Skipped tests are excluded.
          </p>
        </>
      ) : (
        <div className="state">
          <CubeIcon width={36} height={36} />
          <h2>A clean slate</h2>
          <p>
            Create your first project, generate a token, and connect a
            Playwright workflow.
          </p>
        </div>
      )}
    </Shell>
  );
}
