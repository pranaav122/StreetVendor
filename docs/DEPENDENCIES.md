# Dependency review — 4 November 2026

`npm audit` reported **5 moderate, 0 high and 0 critical findings** in the installed lockfile. These are two underlying advisories and three affected dependents, not five independently demonstrated application exploits:

| Installed dependency | Advisory and patched release | Dependency path |
|---|---|---|
| `glob` 13.0.6 | [Cancellation can continue filesystem traversal](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), patched in 14.0.2 | Expo CLI and fingerprint tooling |
| `minimatch` 10.2.6 | [Pattern amplification can consume CPU/memory](https://github.com/advisories/GHSA-g3hv-75wg-m249), patched in 11.0.1 | Glob and Expo fingerprint tooling |

The installed tree comes from Expo 58.0.23, CLI 58.1.19 and fingerprint 0.21.9. The affected code handles build-time filesystem patterns; application HTTP handlers do not accept glob patterns. That observation does not establish that every third-party caller is safe. The source security scan excluded installed dependency implementations/advisory exploitability.

The registry offered glob 14.0.3 and minimatch 11.0.4. They are outside the versions requested by these Expo packages. Scoped and global override experiments with npm 11.13.0 left the actual installed tree unchanged; they were removed rather than committed as a fix. The audit's automatic force option proposed downgrading Expo to older SDKs, which would break this workspace's verified native dependency alignment. No force downgrade was performed.

These alerts remain open. Before distributing signed releases, move to a vendor-compatible patched toolchain or validate an explicit replacement against installation, both Expo Doctors, fingerprint generation, web/native exports and signed device builds. Do not run build tools against untrusted source trees or accept arbitrary filesystem patterns. Recheck the advisories and installed tree rather than assuming the counts stay current.

```powershell
npm audit
npm ls glob minimatch --all
./.venv/Scripts/python.exe -m pip check
```

The audit commands return a nonzero exit code while the known alerts remain. This is a recorded dependency gate, separate from passing application tests; it is not a clean-audit claim. Python package consistency checks also do not establish absence of security advisories.
