import { Suspense } from "react";
import Logo from "./Logo";
import NavLinks from "./NavLinks";
import { IGithub } from "./art/Icons";
import { getStars } from "@/lib/github";
import { GITHUB_REPO, GITHUB_URL } from "@/lib/site";

export default function SiteHeader() {
  return (
    <header className="site-head">
      <div className="head-left">
        <Logo />
        <NavLinks />
      </div>
      {GITHUB_REPO && (
        <Suspense fallback={<GithubLink stars={null} />}>
          <GithubStars />
        </Suspense>
      )}
    </header>
  );
}

async function GithubStars() {
  const stars = await getStars();
  return <GithubLink stars={stars} />;
}

function GithubLink({ stars }: { stars: number | null }) {
  return (
    <a className="gh" href={GITHUB_URL} target="_blank" rel="noreferrer" aria-label={stars === null ? "Star Hackea on GitHub" : `Star Hackea on GitHub, ${stars} ${stars === 1 ? "star" : "stars"} so far`}>
      <span className="gh-main">
        <IGithub size={17} />
        <span className="gh-label">Star</span>
      </span>
      {stars !== null && (
        <span className="gh-count">
          <svg viewBox="0 0 24 24" width={15} height={15} className="gh-star" aria-hidden="true">
            <path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
          </svg>
          <span className="gh-n">{fmtStars(stars)}</span>
        </span>
      )}
    </a>
  );
}

function fmtStars(n: number) {
  if (n < 1000) return String(n);
  return (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, "") + "k";
}
