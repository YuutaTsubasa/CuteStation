# Conventions & Automation

Use the convention checker to validate repository naming rules and asset placement. It only reports issues; it never auto-fixes.

## Commands

- `npm run convention:check`: generates reports and exits non-zero if error-level issues exist.
- `npm run convention:report`: generates reports but always exits 0.

Reports are written to:
- `reports/convention-report.json`
- `reports/convention-report.md`
