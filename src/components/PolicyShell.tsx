import type { ReactNode } from "react";

/** Shared frame for legal/policy pages. Shows a clear draft notice until the owner marks policies as reviewed. */
export function PolicyShell({ title, reviewed, children }: { title: string; reviewed: boolean; children: ReactNode }) {
  return (
    <div className="wrap pb-10 pt-12 md:pt-16">
      <h1 className="h-display text-[clamp(2.4rem,6vw,4.5rem)]">{title}</h1>
      {!reviewed && (
        <p className="mt-6 max-w-2xl border border-dashed border-line p-4 text-sm text-muted">
          <span className="eyebrow mr-2 bg-accent px-2 py-1 text-accent-fg">Draft</span>
          This page is a starting draft and has not yet been reviewed by the store owner or a legal adviser.
        </p>
      )}
      <div className="prose-policy mt-10 space-y-4 text-lg leading-relaxed">{children}</div>
    </div>
  );
}

export const Text = ({ text }: { text: string }) => (
  <>{text.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</>
);
