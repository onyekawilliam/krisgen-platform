import { BUSINESS_NAME, CAC_NUMBER, BUSINESS_ADDRESS } from "../../config";

export default function About() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-14">
      <p className="eyebrow mb-3">About</p>
      <h1 className="page-title mb-6 md:text-4xl">{BUSINESS_NAME}</h1>
      <p className="mb-4 leading-relaxed text-ink-dim">
        Krisgen is a phone shop in Ankpa, Kogi State, selling genuine Tecno, Infinix, Redmi and Itel phones at
        dealer prices. Alongside the store, we run a free affiliate program that pays members a share of
        the profit on phone sales they help bring in.
      </p>
      <p className="leading-relaxed text-ink-dim">
        No registration fee, no required purchase to participate — just a referral link and commissions tied to
        real sales.
      </p>
      <dl className="card mt-8 grid gap-4 p-6 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink-faint">Registered business name</dt>
          <dd className="mt-1 text-ink">{BUSINESS_NAME}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">CAC registration number</dt>
          <dd className="mt-1 font-mono text-ink">{CAC_NUMBER}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-ink-faint">Shop address</dt>
          <dd className="mt-1 text-ink">{BUSINESS_ADDRESS}</dd>
        </div>
      </dl>
    </div>
  );
}
