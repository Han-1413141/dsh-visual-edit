import React, { useState } from "react";
export default function App() {
  const [active, setActive] = useState("Monthly");
  const [count, setCount] = useState(0);
  return (
    <main>
      <nav>
        <a href="#" className="brand">
          ✳ Northstar
        </a>
        <span>
          Product <b>·</b> Pricing <b>·</b> About
        </span>
        <button className="sign-in" onClick={() => setCount(count + 1)}>
          Sign in{count ? ` (${count})` : ""}
        </button>
      </nav>
      <div className="eyebrow">MADE FOR SMALL TEAMS</div>
      <h1>
        A little more focus.
        <br />A lot more progress.
      </h1>
      <p className="subtitle">
        One calm place for your team's next big idea.
        <br />
        Simple plans that grow with you.
      </p>
      <div className="billing" aria-label="Billing period">
        {["Monthly", "Yearly"].map((period) => (
          <button
            key={period}
            aria-pressed={active === period}
            onClick={() => setActive(period)}
          >
            {period}
            {period === "Yearly" && <small>−20%</small>}
          </button>
        ))}
      </div>
      <section className="plans">
        <article className="plan">
          <span className="plan-label">FOR THE FIRST STEP</span>
          <h2>Starter</h2>
          <p>A place to find your rhythm.</p>
          <div className="price">
            $0<span>/ month</span>
          </div>
          <ul>
            <li>3 projects</li>
            <li>Personal workspace</li>
            <li>Community support</li>
          </ul>
          <button className="secondary">Get started</button>
        </article>
        <article className="plan featured">
          <span className="popular">A little room to grow</span>
          <span className="plan-label">FOR YOUR NEXT CHAPTER</span>
          <h2>Studio</h2>
          <p>Your ideas, with room to grow.</p>
          <div className="price">
            ${active === "Monthly" ? "18" : "14"}
            <span>/ month</span>
          </div>
          <ul>
            <li>Unlimited projects</li>
            <li>Shared team workspace</li>
            <li>Priority support</li>
          </ul>
          <button
            id="studio-cta"
            className="cta"
            onClick={() => setCount(count + 1)}
          >
            Start your free trial today
          </button>
        </article>
        <article className="plan">
          <span className="plan-label">FOR THE WHOLE TEAM</span>
          <h2>Collective</h2>
          <p>Bring everyone along.</p>
          <div className="price">
            $42<span>/ month</span>
          </div>
          <ul>
            <li>Everything in Studio</li>
            <li>Advanced permissions</li>
            <li>Dedicated onboarding</li>
          </ul>
          <button className="secondary">Let's talk</button>
        </article>
      </section>
      <p className="footnote">
        No credit card required. A quieter way to work.
      </p>
      <section className="privacy-fixture">
        <label>
          Private demo field{" "}
          <input
            data-testid="private-input"
            defaultValue="private-demo-value"
          />
        </label>
        <p data-private>private-demo-text</p>
        <div contentEditable suppressContentEditableWarning>
          private-editable-text
        </div>
      </section>
    </main>
  );
}
