'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { TestDetail } from '@flaky-radar/shared';
import { useResource, date } from '../../../../../lib/api';
import { Shell, Loading, ErrorState } from '../../../../../components/shell';
import { Trend } from '../../../../../components/trend';
export default function TestPage() {
  const { slug, testId } = useParams<{ slug: string; testId: string }>();
  const resource = useResource<TestDetail>(`/projects/${slug}/tests/${testId}`);
  const data = resource.data;
  return (
    <Shell>
      <p className="breadcrumb">
        <Link href="/">Projects</Link>
        <span>/</span>
        <Link href={`/projects/${slug}`}>{slug}</Link>
        <span>/</span>Test detail
      </p>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : (
        data && (
          <>
            <div className="page-heading">
              <div>
                <h1 className="test-title">
                  {data.test.titlePath.join(' › ')}
                </h1>
                <p>
                  <code>{data.test.fileName}</code> ·{' '}
                  {data.test.playwrightProject}
                </p>
              </div>
            </div>
            <Trend points={data.trend} />
            <section className="tests-section">
              <div className="section-heading">
                <h2>Result history</h2>
                <span className="muted">Last 50 results</span>
              </div>
              {data.results.length ? (
                <div className="table-scroll panel">
                  <table>
                    <caption className="sr-only">
                      Recent test results with commits and errors
                    </caption>
                    <thead>
                      <tr>
                        <th>Outcome</th>
                        <th>Commit / branch</th>
                        <th>Started (UTC)</th>
                        <th>Duration</th>
                        <th>Retries</th>
                        <th>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.results.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <span className={`outcome ${r.outcome}`}>
                              {r.outcome}
                            </span>
                          </td>
                          <td>
                            <code>{r.testRun.commitSha.slice(0, 8)}</code>
                            <span className="file-name">
                              {r.testRun.branch}
                            </span>
                          </td>
                          <td>{date(r.testRun.startedAt)}</td>
                          <td>{(r.durationMs / 1000).toFixed(2)} s</td>
                          <td>{r.retries}</td>
                          <td>
                            {r.errorMessage ? (
                              <details>
                                <summary>View error</summary>
                                <pre className="error-message">
                                  {r.errorMessage}
                                </pre>
                              </details>
                            ) : (
                              <span className="muted">None</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="state">
                  <h3>No results yet</h3>
                  <p>The next processed upload will appear here.</p>
                </div>
              )}
            </section>
          </>
        )
      )}
    </Shell>
  );
}
