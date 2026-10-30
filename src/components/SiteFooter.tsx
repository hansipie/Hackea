import Link from "next/link";
import Logo from "./Logo";
import { IArrowOut } from "./art/Icons";
import { GITHUB_REPO, GITHUB_URL, SCAN_ENABLED } from "@/lib/site";

export default function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="foot-card">
        <div className="foot-brand">
          <Logo size={30} />
          <p>Hack IKEA furniture into something new, and follow every step in 3D with your hands full. Free and open source.</p>
        </div>

        <nav className="foot-cols" aria-label="Footer">
          <div>
            <h2>Build</h2>
            <Link href="/browse">All guides</Link>
            <Link href="/size">Find by size</Link>
            <Link href="/builds">Workshop</Link>
            {SCAN_ENABLED && <Link href="/scan">Scan a manual</Link>}
          </div>
          <div>
            <h2>Project</h2>
            {GITHUB_REPO && (
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                Source code <IArrowOut size={14} />
              </a>
            )}
            <a href="https://openai.com/" target="_blank" rel="noreferrer">
              OpenAI <IArrowOut size={14} />
            </a>
            <Link href="/privacy">Privacy and terms</Link>
          </div>
        </nav>

        <div className="foot-credit">
          <p className="foot-credit-text">
            Built on{" "}
            <a href="https://github.com/Nutlope/bygga" target="_blank" rel="noreferrer">
              Bygga
            </a>
            , the open source assembly guides by the Bygga contributors (MIT license).
          </p>
        </div>
      </div>

      <div className="foot-base">
        <p>Hackea is an independent, unofficial project. It is not affiliated with, sponsored or endorsed by Inter IKEA Systems B.V. or any IKEA company. IKEA and IKEA product names are trademarks of their owners.</p>
        <a className="foot-powered" href="https://openai.com/" target="_blank" rel="noreferrer">
          <span>Powered by</span>
          <b>OpenAI</b>
        </a>
      </div>
    </footer>
  );
}
