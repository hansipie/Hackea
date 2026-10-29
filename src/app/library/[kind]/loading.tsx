import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function Loading() {
  return (
    <div className="site">
      <SiteHeader />
      <main className="browse library" aria-busy="true">
        <header className="page-head">
          <h1>Piece library</h1>
          <p className="lead" role="status">Loading pieces...</p>
        </header>
      </main>
      <SiteFooter />
    </div>
  );
}
