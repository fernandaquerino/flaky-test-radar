'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { TestsResponse, TestQuery } from '@flaky-radar/shared';
import { useResource, percent, date } from '../../../lib/api';
import { Shell, Loading, ErrorState } from '../../../components/shell';
import { Trend } from '../../../components/trend';
import { Setup } from '../../../components/setup';
export default function Project() {
  const { slug } = useParams<{ slug: string }>();
  const [window, setWindow] = useState('30d'),
    [page, setPage] = useState(1),
    [sort, setSort] = useState<TestQuery['sort']>('flakeRate'),
    [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const resource = useResource<TestsResponse>(
    `/projects/${slug}/tests?window=${window}&page=${page}&sort=${sort}&direction=${direction}`,
  );
  const data = resource.data;
  function changeSort(value: TestQuery['sort']) {
    setDirection(sort === value && direction === 'desc' ? 'asc' : 'desc');
    setSort(value);
    setPage(1);
  }
  return (
    <Shell>
      <p className="breadcrumb">
        <Link href="/">Projects</Link>
        <span>/</span>
        {data?.project.name ?? slug}
      </p>
      <div className="page-heading">
        <div>
          <h1>{data?.project.name ?? 'Project'}</h1>
          <p>Find the failures worth fixing.</p>
        </div>
        <a className="button secondary" href="#setup">
          Set up CI
        </a>
      </div>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : (
        data && (
          <>
            {(data.uploads.received > 0 || data.uploads.failed > 0) && (
              <p className="notice" role="status">
                {data.uploads.received} uploads awaiting processing.{' '}
                {data.uploads.failed} failed uploads.{' '}
                <button className="quiet" onClick={resource.reload}>
                  Refresh
                </button>
              </p>
            )}
            <Trend points={data.trend} />
            <section className="tests-section">
              <div className="section-heading">
                <div>
                  <h2>
                    Tests to watch <span className="count">{data.total}</span>
                  </h2>
                  <p>Ranked by flaky and unstable executions.</p>
                </div>
                <label className="window-label">
                  Window
                  <select
                    value={window}
                    onChange={(event) => {
                      setWindow(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                  </select>
                </label>
              </div>
              {data.total ? (
                <>
                  <div className="table-scroll panel">
                    <table>
                      <caption className="sr-only">
                        Tests ranked by flake rate
                      </caption>
                      <thead>
                        <tr>
                          {[
                            ['name', 'Test'],
                            ['flakeRate', 'Flake rate'],
                            ['executions', 'Executions'],
                            ['failedCount', 'Failures'],
                          ].map(([key, label]) => (
                            <th
                              key={key}
                              aria-sort={
                                sort === key
                                  ? direction === 'desc'
                                    ? 'descending'
                                    : 'ascending'
                                  : 'none'
                              }
                            >
                              <button
                                className="table-sort"
                                onClick={() =>
                                  changeSort(key as TestQuery['sort'])
                                }
                              >
                                {label}
                                {sort === key
                                  ? direction === 'desc'
                                    ? ' ↓'
                                    : ' ↑'
                                  : ''}
                              </button>
                            </th>
                          ))}
                          <th>Last flaky</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.items.map((t) => (
                          <tr key={t.id}>
                            <td>
                              <Link
                                className="test-link"
                                href={`/projects/${slug}/tests/${t.id}`}
                              >
                                {t.titlePath.join(' › ')}
                              </Link>
                              <span className="file-name">
                                {t.fileName} · {t.playwrightProject}
                              </span>
                            </td>
                            <td>
                              <span
                                className={
                                  t.flakeRate ? 'rate warning' : 'rate'
                                }
                              >
                                {percent(t.flakeRate)}
                              </span>
                            </td>
                            <td>{t.executions}</td>
                            <td>{t.failedCount}</td>
                            <td className="muted">
                              {t.lastFlakyAt ? date(t.lastFlakyAt) : 'Never'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="pagination">
                    <p>
                      {data.total} tests · Page {page} of{' '}
                      {Math.max(1, Math.ceil(data.total / data.pageSize))}
                    </p>
                    <div>
                      <button
                        className="secondary"
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        Previous
                      </button>
                      <button
                        className="secondary"
                        disabled={page * data.pageSize >= data.total}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="state empty-upload">
                  <h3>No uploads yet</h3>
                  <p>
                    Create a project token below and add the upload step to your
                    CI. Results will appear here after processing.
                  </p>
                  <a href="#setup">Connect your first workflow</a>
                </div>
              )}
            </section>
          </>
        )
      )}
      {!resource.error && <Setup slug={slug} />}
    </Shell>
  );
}
