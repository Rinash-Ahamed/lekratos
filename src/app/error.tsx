"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="wrap grid min-h-[60vh] place-items-center py-20 text-center">
      <div role="alert">
        <h1 className="h-display text-[clamp(2.4rem,6vw,4rem)]">Something went wrong</h1>
        <p className="lede mx-auto mt-4">Please try again. If it keeps happening, contact us.</p>
        <button className="btn btn-solid mt-8" onClick={reset}>Try again</button>
      </div>
    </div>
  );
}
