import React from "react";

type ReleaseLocation = { status: string; published_url: string | null };

export default function ResearchData({ release, scopeUrl }: { release: ReleaseLocation; scopeUrl: string }) {
  const published = release.status === "published" && Boolean(release.published_url);
  return (
    <section id="research-archive-download" className="r3-panel">
      <h2>Research Data &amp; Source Code</h2>
      <p>Explore the models, computational results and engineering schematics, or build the application from source.</p>
      <div className="r3-download-row">
        <a href="https://github.com/wlululu/cephalo-silk-structural-lab" target="_blank" rel="noreferrer">Source code on GitHub ↗</a>
        {published && <a href={release.published_url!}>Download research data ↗</a>}
      </div>
      <p><a href={scopeUrl}>Model assumptions and scientific scope</a></p>
    </section>
  );
}
