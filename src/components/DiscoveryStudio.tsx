"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Product, Size } from "@/lib/types";
import { ProductImage } from "./ProductImage";
import { inr } from "@/lib/format";

type FinderProduct = Pick<Product, "id" | "slug" | "name" | "price" | "images" | "art" | "colors" | "tags">;

const STYLES = ["Old Money", "Minimalist", "Streetwear", "Casual Luxury"] as const;
const PALETTES = ["Light & neutral", "Earth & warm", "Dark & tonal", "Unexpected colour"] as const;
const MOMENTS = ["Every day", "Going out", "Work & study", "Anywhere, always"] as const;

export function StyleFinder({ products }: { products: FinderProduct[] }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const questions = [
    { label: "Choose your instinct", options: STYLES },
    { label: "Choose your palette", options: PALETTES },
    { label: "Where are we going?", options: MOMENTS },
  ] as const;
  const complete = step >= questions.length;
  const choiceScore = answers.reduce((sum, answer, index) => {
    const options = questions[index]?.options as readonly string[] | undefined;
    return sum + Math.max(0, options?.indexOf(answer) ?? 0);
  }, 0);
  const recommendation = products.length ? products[choiceScore % products.length] : undefined;
  const style = answers[0] || STYLES[0];

  const choose = (answer: string) => {
    const next = [...answers.slice(0, step), answer];
    setAnswers(next);
    setStep(step + 1);
  };
  const reset = () => { setAnswers([]); setStep(0); };

  return (
    <section className="style-finder" aria-labelledby="style-finder-title">
      <div className="style-finder-intro">
        <p className="experience-number">01 / Style finder</p>
        <h2 id="style-finder-title">Find your<br /><i>frequency.</i></h2>
        <p>A quick edit of instinct, palette and occasion. We&apos;ll match the mood to a piece from the current collection.</p>
      </div>
      <div className="finder-panel" aria-live="polite">
        <div className="finder-progress" aria-label={`Quiz progress: ${Math.min(step, 3)} of 3`}>
          {[0, 1, 2].map((index) => <i key={index} className={index < step ? "is-done" : index === step ? "is-current" : ""} />)}
        </div>
        {!complete ? (
          <div className="finder-question" key={step}>
            <p>Question {String(step + 1).padStart(2, "0")}</p>
            <h3>{questions[step].label}</h3>
            <div className="finder-options">
              {questions[step].options.map((option, index) => (
                <button type="button" key={option} onClick={() => choose(option)}><span>{String(index + 1).padStart(2, "0")}</span>{option}<span aria-hidden>↗</span></button>
              ))}
            </div>
          </div>
        ) : (
          <div className="finder-result">
            <div>
              <p>Your style direction</p>
              <h3>{style}</h3>
              <p>{recommendation ? "Your answers point to clean confidence with a little tension. Start here." : "Your edit is ready. Add products to the collection to unlock a direct match."}</p>
              <div className="finder-result-actions">
                {recommendation && <Link href={`/product/${recommendation.slug}`}>View recommendation <span aria-hidden>↗</span></Link>}
                <button type="button" onClick={reset}>Retake quiz</button>
              </div>
            </div>
            {recommendation && (
              <Link href={`/product/${recommendation.slug}`} className="finder-product">
                <div><ProductImage product={recommendation} sizes="(min-width:768px) 28vw, 70vw" /></div>
                <p><span>{recommendation.name}</span><span>{inr(recommendation.price)}</span></p>
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

const FITS = ["Oversized", "Regular Fit", "Relaxed Fit", "Slim Fit"] as const;
const SIZES: Size[] = ["XS", "S", "M", "L", "XL", "XXL"];

export function FitFinder() {
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [fit, setFit] = useState<(typeof FITS)[number]>("Regular Fit");
  const [showResult, setShowResult] = useState(false);

  const result = useMemo(() => {
    const h = Number(height), w = Number(weight);
    if (!h || !w || h < 130 || h > 220 || w < 35 || w > 180) return null;
    const score = w + (h - 170) * .32;
    let index = score < 52 ? 0 : score < 62 ? 1 : score < 74 ? 2 : score < 88 ? 3 : score < 105 ? 4 : 5;
    if (fit === "Oversized" || fit === "Relaxed Fit") index += 1;
    if (fit === "Slim Fit") index -= 1;
    return SIZES[Math.max(0, Math.min(SIZES.length - 1, index))];
  }, [fit, height, weight]);

  const submit = (event: React.FormEvent) => { event.preventDefault(); setShowResult(true); };

  return (
    <section className="fit-finder" aria-labelledby="fit-finder-title">
      <div className="fit-visual" aria-hidden="true">
        <span>02</span><div className="fit-outline"><i /><i /><i /></div><p>Built around you</p>
      </div>
      <div className="fit-content">
        <p className="experience-number">02 / Fit finder</p>
        <h2 id="fit-finder-title">Find your<br /><i>perfect fit.</i></h2>
        <p>Tell us your measurements and how you like to wear it. We&apos;ll suggest a starting size for the silhouette you want.</p>
        <form onSubmit={submit}>
          <div className="fit-measures">
            <label><span>Height</span><span><input inputMode="numeric" type="number" min="130" max="220" value={height} onChange={(event) => { setHeight(event.target.value); setShowResult(false); }} placeholder="175" required /> cm</span></label>
            <label><span>Weight</span><span><input inputMode="numeric" type="number" min="35" max="180" value={weight} onChange={(event) => { setWeight(event.target.value); setShowResult(false); }} placeholder="70" required /> kg</span></label>
          </div>
          <fieldset>
            <legend>Preferred silhouette</legend>
            <div className="fit-options">
              {FITS.map((option) => <button type="button" key={option} aria-pressed={fit === option} className={fit === option ? "is-selected" : ""} onClick={() => { setFit(option); setShowResult(false); }}>{option}</button>)}
            </div>
          </fieldset>
          <button className="fit-submit" type="submit">Find my size <span aria-hidden>→</span></button>
        </form>
        {showResult && (
          <div className="fit-result" aria-live="polite">
            {result ? <><p>Suggested starting size</p><strong>{result}</strong><span>For a {fit.toLowerCase()} silhouette</span></> : <p>Please enter a height between 130–220 cm and weight between 35–180 kg.</p>}
          </div>
        )}
        <small>This is a general starting suggestion. Always compare the measurements on the product page before ordering.</small>
      </div>
    </section>
  );
}
