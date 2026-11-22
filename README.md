# ILION v5 — Public Lab

**A browser-based, synthetic research demonstration of deterministic pre-execution authorization for AI agents.**

The lab illustrates five architectural perspectives:

1. **CAP** — context source, freshness and request-bound fields, represented by demonstrative comparisons.
2. **CGC** — structural coherence of synthetic identity and delegation claims.
3. **PCL** — explicit policy and destination constraints.
4. **Gate** — public role/action and target compatibility check (not the research vector-space Gate).
5. **SRM\*** — a simplified two-export session budget (not the research SRM algorithm).

All data is fictional. `ALLOW` creates a synthetic entry in an in-browser ledger; `BLOCK` adds no execution effect. No production systems, real credentials, cryptographic attestation, API keys or private engines are used.

## Live demo and research

- Public lab: https://ilion-project.org/lab/
- ILION v5 architecture video demonstration: https://zenodo.org/records/23017604
- Additional research: https://zenodo.org/records/23960729

## Run locally

Open `index.html` in a browser, or host these static files using a local web server. The page loads only local `styles.css`, `engine.js`, and `app.js`; external links are optional navigation, not runtime dependencies.

To run the engine regression checks (Node.js 18+):

```bash
node --test tests/engine.test.cjs
```

## Boundaries and limitations

- This is **illustrative source code**, not the full ILION v5 system.
- CAP performs literal issuer, age, and field comparison rather than cryptographic verification.
- CGC performs simplified claim matching, not the non-public implementation.
- PCL implements a small synthetic policy profile.
- Gate is a role/action allowlist illustration, not the research Gate metrics/algorithm.
- SRM\* is a configurable counter, not the research temporal authorization mechanism.
- The browser and its local effects ledger are **not a trusted enforcement boundary**; the visitor controls the code and session state.
- The lab does **not** establish production safety, comparative superiority, or independent validation.

## Feedback

Please open a GitHub issue with a reproducible synthetic input and expected/observed output. Do not share credentials, personal data, unpublished research implementations, or other confidential information.

## License and scope

The public, illustrative code in this repository is offered under the **MIT License** (see [`LICENSE`](LICENSE)). This grant applies to the files published here; the repository does **not** include the non-public ILION v5 research engines, private extensions, credentials, or protected implementation details. The demo's illustrative rules should not be mistaken for the research implementations or a production security boundary.

Publication of this demonstrator does not imply that separate ILION research materials, trademarks, or other codebases are open-source. Patent-related questions should be reviewed separately by qualified counsel.
