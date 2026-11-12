import type { DailyPoint } from '@flaky-radar/shared';
import { percent } from '../lib/api';
export function Trend({ points }: { points: DailyPoint[] }) {
  const executions = points.reduce((s, p) => s + p.executions, 0),
    flakes = points.reduce((s, p) => s + p.flakyCount, 0);
  const active = points.filter((p) => p.flakeRate !== null);
  const max = Math.max(0.1, ...active.map((p) => p.flakeRate ?? 0));
  return (
    <section className="trend panel" aria-labelledby="trend-title">
      <div className="section-heading">
        <div>
          <h2 id="trend-title">Flake rate over time</h2>
          <p>Daily rate · Last 30 days · UTC</p>
        </div>
        <span className="legend">
          <i />
          Flaky or unstable
        </span>
      </div>
      {executions ? (
        <>
          <div className="chart">
            <span className="axis-max">{percent(max)}</span>
            <svg
              viewBox="0 0 900 130"
              role="img"
              aria-label={`Daily flake rate. ${flakes} flaky or unstable executions out of ${executions} in the last 30 days.`}
              preserveAspectRatio="none"
            >
              <line x1="0" y1="119" x2="900" y2="119" stroke="#d9e1e2" />
              {points.map((p, i) => (
                <rect
                  key={p.day}
                  x={i * 30 + 4}
                  y={119 - ((p.flakeRate ?? 0) / max) * 105}
                  width="18"
                  height={
                    p.executions
                      ? Math.max(2, ((p.flakeRate ?? 0) / max) * 105)
                      : 0
                  }
                  rx="2"
                  fill={p.flakyCount ? '#a76517' : '#a1c5be'}
                >
                  <title>
                    {p.day}: {percent(p.flakeRate)}, {p.executions} executions
                  </title>
                </rect>
              ))}
            </svg>
            <div className="axis-labels">
              <span>{points[0]?.day}</span>
              <span>{points.at(-1)?.day}</span>
            </div>
          </div>
          <p className="chart-summary">
            {flakes} flaky or unstable executions out of {executions}. Overall
            rate: <strong>{percent(flakes / executions)}</strong>.
          </p>
        </>
      ) : (
        <p className="chart-empty">
          Your daily trend will appear after the first tests execute.
        </p>
      )}
      <details className="chart-data">
        <summary>View daily values</summary>
        <div className="table-scroll">
          <table>
            <caption>Daily execution counts and flake rates</caption>
            <thead>
              <tr>
                <th>Date (UTC)</th>
                <th>Executions</th>
                <th>Flaky or unstable</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.day}>
                  <td>{p.day}</td>
                  <td>{p.executions}</td>
                  <td>{p.flakyCount}</td>
                  <td>{percent(p.flakeRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
