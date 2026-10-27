import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Emits a flat, stable results file the sanity-check agent reads:
 *   e2e/results/checks.json
 *
 * Each spec's describe block is titled "[check:NN] <name>"; this reporter parses
 * NN to key the 12 checks regardless of Playwright's internal JSON layout. A
 * single check may contain MORE than one test (e.g. check 3 = single + bulk
 * assign) — a check is "passed" only if all of its tests passed. Retries are
 * collapsed via `test.outcome()` ('flaky' counts as passed).
 *
 * The agent reads `checks.json`, and for any non-`passed` check uses `error` +
 * the retained trace (playwright-report/) + service logs to triage.
 */
interface CheckRow {
  id: number;
  name: string;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  error: string | null;
}

interface PerTest {
  checkId: number;
  name: string;
  outcome: ReturnType<TestCase["outcome"]>;
  durationMs: number;
  error: string | null;
}

const stripAnsi = (s: string) => s.replace(/\[[0-9;]*m/g, "");

export default class CheckReporter implements Reporter {
  private readonly outputFile: string;
  private readonly perTest = new Map<string, PerTest>();
  private startedAt = "";

  constructor(options: { outputFile?: string } = {}) {
    this.outputFile = path.resolve(
      process.cwd(),
      options.outputFile ?? "e2e/results/checks.json"
    );
  }

  onBegin(): void {
    this.startedAt = new Date().toISOString();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const fullTitle = test.titlePath().join(" ");
    const m = fullTitle.match(/\[check:(\d+)\]\s*([^›]+?)(?:\s*›|$)/);
    const checkId = m ? parseInt(m[1], 10) : NaN;
    if (Number.isNaN(checkId)) return; // not a check spec
    const name = (m?.[2] ?? "").trim();
    const error =
      result.error?.message && result.status !== "passed"
        ? stripAnsi(result.error.message).split("\n").slice(0, 6).join("\n")
        : null;
    // Keyed by test id: the final attempt overwrites earlier retries; test.outcome()
    // is retry-aware so 'flaky' (failed-then-passed) resolves to passed below.
    this.perTest.set(test.id, {
      checkId,
      name,
      outcome: test.outcome(),
      durationMs: result.duration,
      error,
    });
  }

  onEnd(result: FullResult): void {
    // aggregate per-test results into one row per check id
    const byCheck = new Map<number, CheckRow>();
    for (const t of this.perTest.values()) {
      const testPassed = t.outcome === "expected" || t.outcome === "flaky";
      const prev = byCheck.get(t.checkId);
      if (!prev) {
        byCheck.set(t.checkId, {
          id: t.checkId,
          name: t.name,
          status: t.outcome === "skipped" ? "skipped" : testPassed ? "passed" : "failed",
          durationMs: t.durationMs,
          error: testPassed ? null : t.error,
        });
        continue;
      }
      prev.durationMs += t.durationMs;
      if (!testPassed && t.outcome !== "skipped") {
        prev.status = "failed";
        prev.error = prev.error ?? t.error;
      } else if (prev.status !== "failed" && testPassed) {
        prev.status = "passed";
      }
    }

    const checks = [...byCheck.values()].sort((a, b) => a.id - b.id);
    const summary = {
      total: checks.length,
      passed: checks.filter((c) => c.status === "passed").length,
      failed: checks.filter((c) => c.status === "failed").length,
      skipped: checks.filter((c) => c.status === "skipped").length,
    };
    const payload = {
      runId: this.startedAt.replace(/[:.]/g, "-"),
      startedAt: this.startedAt,
      endedAt: new Date().toISOString(),
      overallStatus: result.status,
      durationMs: result.duration,
      summary,
      checks,
    };
    fs.mkdirSync(path.dirname(this.outputFile), { recursive: true });
    fs.writeFileSync(this.outputFile, JSON.stringify(payload, null, 2));
    // eslint-disable-next-line no-console
    console.log(
      `\n[check-reporter] ${summary.passed}/${summary.total} checks passed → ${this.outputFile}`
    );
  }
}
