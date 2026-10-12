import type { ReactNode } from "react";

/** Shared frame for legal/policy pages. Shows a clear draft notice until the owner marks policies as reviewed. */
export function PolicyShell({ title, reviewed, children }: { title: string; reviewed: boolean; children: ReactNode }) {
  return (
    <div className="wrap pb-20 pt-12 md:pt-20">
      <div className="max-w-4xl">
        <div className="mb-4 inline-flex items-center gap-2.5">
          <span className="h-0.5 w-8 bg-accent" aria-hidden="true" />
          <span className="eyebrow text-accent-text">Legal &amp; Policies</span>
        </div>
        <h1 className="h-display text-[clamp(2.6rem,6.5vw,4.8rem)]">{title}</h1>
        {!reviewed && (
          <div className="glass mt-8 flex max-w-2xl items-center gap-3 rounded-lg border hairline p-4 text-sm text-muted">
            <span className="eyebrow rounded bg-accent px-2 py-0.5 text-[0.65rem] font-bold text-accent-fg uppercase tracking-wider">Draft</span>
            <span>This page is a starting draft and has not yet been reviewed by the store owner or a legal adviser.</span>
          </div>
        )}
        <div className="section-line my-10" />
        <div className="glass rounded-2xl border hairline p-6 sm:p-10 shadow-xs">
          <div className="prose-policy space-y-6 text-lg leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  );
}

export const Text = ({ text }: { text: string }) => (
  <>{text.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</>
);
