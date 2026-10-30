import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import HeroStart from "@/components/home/HeroStart";
import FeaturedHack from "@/components/home/FeaturedHack";
import HackCards from "@/components/home/HackCards";
import { IArrowOut, IArrowRight, IScan } from "@/components/art/Icons";
import { SCAN_ENABLED } from "@/lib/site";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return (
    <div className="site">
      <SiteHeader />

      <section className="hero">
        <div className="hero-copy">
          <a className="tg-pill" href="https://openai.com/" target="_blank" rel="noreferrer">
            <span className="tg-badge">
              <span aria-hidden="true">AI</span>
            </span>
            <span className="tg-text">
              Powered by <b>OpenAI</b>
            </span>
            <IArrowOut size={14} className="tg-go" />
          </a>
          <h1>
            Hack IKEA furniture,
            <br />
            step by step.
          </h1>
          <p className="lead">Turn IKEA pieces into something new. Each hack lists what to buy and what to change, then plays every step in 3D and reads it out loud. Or type the name from a box to build it as it comes.</p>
          <h2 className="hero-ask">Make a hack</h2>
          <HeroStart />
          {SCAN_ENABLED && (
            <Link href="/scan" className="scan-link">
              <IScan size={17} />
              <span>
                Not from IKEA? <u>Scan its paper manual</u>
              </span>
            </Link>
          )}
        </div>
      </section>

      <FeaturedHack />

      <section className="popular" id="hacks">
        <div className="sec-head">
          <h2 className="sec-title">Hacks</h2>
          <Link href="/hacks" className="sec-link">
            All hacks <IArrowRight size={15} />
          </Link>
        </div>
        <HackCards limit={3} />
      </section>

      <SiteFooter />
    </div>
  );
}
