# 3D Structural Studio — Deployment Guide

## Build and release assets

The public name is 3D Structural Studio. Keep the existing GitHub repository, Pages subpath, downloadable filenames and historical scientific identifiers unchanged.

Use Node 24 and the committed lockfile. Follow the build and integrity checks in [Data and Reproducibility](../research/REPRODUCIBILITY.md). Review [Verification Coverage](../research/VERIFICATION.md) separately: static checks do not replace mechanics or browser regression.

`npm run package:research` creates `release-assets/cephalo-silk-research-data-minimal-v1.zip` and its `SHA256SUMS`. Publish these data assets with versioned release notes and record the exact source commit. The release assets are the data ZIP and its checksum file.

Publish and independently verify the data asset before enabling its website link. Set `public/research/release-location.json` to `status: "published"` and supply the verified GitHub Release asset URL in `published_url`. Until then, retain a null URL and the explicit unavailable state. After verifying the public asset, also update the availability statements in the README, data guide and release notes to match the published location. Rebuild and rerun integrity checks; the data archive hash must remain unchanged when only links and unindexed documentation change.

## GitHub Pages

The checked-in Pages workflow runs on a push to `main` or manual dispatch. It installs dependencies, packages data, builds the site, runs **`npm test` (including structural solvers)** and research checks, then deploys `dist/`. Merging a PR into `main` therefore triggers both numerical regression and deployment.

Record the source commit, workflow results and deployed commit. Check the deployed original-case and research routes, subpath assets, downloads and hashes. Browser verification must distinguish live case analyses from archived research records. A successful workflow does not establish WebGL correctness or physical engineering validation.

## Rollback

Retain the previous deployed commit and artifact identity. Revert the relevant release changes through a reviewed PR, preserving unrelated later work; the rollback merge runs the same tests and deployment workflow. If only an archive link is faulty, restore its explicit unavailable state. Publish changed scientific data under a new version and checksum rather than silently replacing an existing archive.
