"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="wrap grid min-h-[70vh] place-items-center py-24 text-center">
      <div role="alert">
        <p className="eyebrow text-accent-text">Something went wrong</p>
        <h1 className="h-display mt-5 text-[clamp(2.2rem,5vw,3.8rem)]">We hit a snag</h1>
        <p className="lede mx-auto mt-5">Please try again. If it keeps happening, contact us.</p>
        <button className="btn btn-solid mt-10" onClick={reset}>Try again</button>
      </div>
    </div>
  );
}
