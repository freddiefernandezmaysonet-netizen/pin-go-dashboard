import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";

type Lang = "es" | "en";

function getLocalToday() {
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localNow.toISOString().slice(0, 10);
}

function getFollowingDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export default function StaysPage() {
  const [lang, setLang] = useState<Lang>("es");
  const [search, setSearch] = useState({
    location: "",
    checkIn: "",
    checkOut: "",
    guests: "2",
  });
  const [searchPrepared, setSearchPrepared] = useState(false);
  const today = getLocalToday();
  const minimumCheckOut = search.checkIn
    ? getFollowingDate(search.checkIn)
    : today;

  const t = useMemo(
    () =>
      lang === "es"
        ? {
            title: "Encuentra propiedades disponibles",
            description:
              "Busca alojamientos que operan con Direct Booking de Pin&Go.",
            hosts: "Administrar propiedades",
            guests: "Buscar alojamiento",
            visitType: "Tipo de visita",
            location: "Ubicación",
            locationPlaceholder: "Destino o ubicación",
            checkIn: "Check-in",
            checkOut: "Check-out",
            guestCount: "Huéspedes",
            search: "Buscar propiedades",
            prepared:
              "Criterios preparados. En el próximo paso conectaremos las propiedades disponibles.",
            powered: "Properties Powered by Pin&Go",
            back: "Conoce Pin&Go para anfitriones",
            metaTitle: "Buscar alojamiento | Properties Powered by Pin&Go",
            metaDescription:
              "Busca propiedades disponibles con Direct Booking Powered by Pin&Go.",
          }
        : {
            title: "Find available properties",
            description:
              "Search stays powered by Pin&Go Direct Booking.",
            hosts: "Manage properties",
            guests: "Find a stay",
            visitType: "Visit type",
            location: "Location",
            locationPlaceholder: "Destination or location",
            checkIn: "Check-in",
            checkOut: "Check-out",
            guestCount: "Guests",
            search: "Search properties",
            prepared:
              "Search criteria prepared. Available properties will be connected in the next step.",
            powered: "Properties Powered by Pin&Go",
            back: "Explore Pin&Go for hosts",
            metaTitle: "Find a stay | Properties Powered by Pin&Go",
            metaDescription:
              "Search available properties with Direct Booking Powered by Pin&Go.",
          },
    [lang],
  );

  useEffect(() => {
    document.title = t.metaTitle;
    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    if (description) description.content = t.metaDescription;
  }, [t.metaDescription, t.metaTitle]);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <Link to="/home" style={styles.brand} aria-label="Pin&Go">
            <img
              src="/pin-go-logo.png"
              alt=""
              style={styles.logo}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
            <span>
              <strong style={styles.brandName}>Pin&Go</strong>
              <span style={styles.brandCaption}>{t.powered}</span>
            </span>
          </Link>

          <nav style={styles.audienceNav} aria-label={t.visitType}>
            <Link to="/home" style={styles.audienceLink}>
              {t.hosts}
            </Link>
            <Link
              to="/stays"
              style={{ ...styles.audienceLink, ...styles.audienceLinkActive }}
              aria-current="page"
            >
              {t.guests}
            </Link>
          </nav>

          <div style={styles.language}>
            <button
              type="button"
              onClick={() => setLang("es")}
              style={{
                ...styles.languageButton,
                ...(lang === "es" ? styles.languageButtonActive : {}),
              }}
            >
              ES
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              style={{
                ...styles.languageButton,
                ...(lang === "en" ? styles.languageButtonActive : {}),
              }}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        <section style={styles.hero} aria-labelledby="stays-title">
          <div style={styles.eyebrow}>{t.powered}</div>
          <h1 id="stays-title" style={styles.title}>
            {t.title}
          </h1>
          <p style={styles.description}>{t.description}</p>

          <form
            style={styles.searchForm}
            onSubmit={(event) => {
              event.preventDefault();
              setSearchPrepared(true);
            }}
          >
            <label style={styles.field}>
              <span style={styles.label}>{t.location}</span>
              <input
                type="search"
                value={search.location}
                placeholder={t.locationPlaceholder}
                onChange={(event) => {
                  setSearch((current) => ({
                    ...current,
                    location: event.target.value,
                  }));
                  setSearchPrepared(false);
                }}
                style={styles.input}
                required
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>{t.checkIn}</span>
              <input
                type="date"
                min={today}
                value={search.checkIn}
                onChange={(event) => {
                  const checkIn = event.target.value;
                  setSearch((current) => ({
                    ...current,
                    checkIn,
                    checkOut:
                      current.checkOut &&
                      current.checkOut < getFollowingDate(checkIn)
                        ? ""
                        : current.checkOut,
                  }));
                  setSearchPrepared(false);
                }}
                style={styles.input}
                required
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>{t.checkOut}</span>
              <input
                type="date"
                min={minimumCheckOut}
                value={search.checkOut}
                onChange={(event) => {
                  setSearch((current) => ({
                    ...current,
                    checkOut: event.target.value,
                  }));
                  setSearchPrepared(false);
                }}
                style={styles.input}
                required
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>{t.guestCount}</span>
              <input
                type="number"
                min="1"
                max="20"
                value={search.guests}
                onChange={(event) => {
                  setSearch((current) => ({
                    ...current,
                    guests: event.target.value,
                  }));
                  setSearchPrepared(false);
                }}
                style={styles.input}
                required
              />
            </label>

            <button type="submit" style={styles.searchButton}>
              {t.search}
            </button>
          </form>

          {searchPrepared && (
            <p role="status" aria-live="polite" style={styles.status}>
              {t.prepared}
            </p>
          )}
        </section>

        <Link to="/home" style={styles.backLink}>
          {t.back}
        </Link>
      </main>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.12), transparent 35%), #f8fafc",
    color: "#0f172a",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  header: {
    borderBottom: "1px solid #e2e8f0",
    background: "rgba(255, 255, 255, 0.94)",
    backdropFilter: "blur(10px)",
  },
  headerInner: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "14px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 11,
    color: "#0f172a",
    textDecoration: "none",
  },
  logo: { width: 46, height: 46, objectFit: "contain", borderRadius: 10 },
  brandName: { display: "block", fontSize: 21, lineHeight: 1.1 },
  brandCaption: {
    display: "block",
    marginTop: 3,
    color: "#64748b",
    fontSize: 12,
  },
  audienceNav: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: 4,
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    background: "#f8fafc",
  },
  audienceLink: {
    padding: "9px 13px",
    borderRadius: 9,
    color: "#475569",
    fontSize: 14,
    fontWeight: 700,
    textDecoration: "none",
    whiteSpace: "nowrap",
  },
  audienceLinkActive: {
    background: "#ffffff",
    color: "#0f172a",
    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.08)",
  },
  language: {
    display: "flex",
    overflow: "hidden",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
  },
  languageButton: {
    border: 0,
    background: "#ffffff",
    padding: "8px 12px",
    color: "#334155",
    cursor: "pointer",
    fontWeight: 700,
  },
  languageButtonActive: { background: "#0f172a", color: "#ffffff" },
  main: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "clamp(56px, 9vw, 104px) 20px 48px",
  },
  hero: {
    border: "1px solid #dbe5eb",
    borderRadius: 24,
    background: "rgba(255, 255, 255, 0.96)",
    padding: "clamp(26px, 5vw, 52px)",
    boxShadow: "0 28px 80px rgba(15, 23, 42, 0.1)",
  },
  eyebrow: {
    color: "#047857",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  title: {
    maxWidth: 760,
    margin: "12px 0 0",
    fontSize: "clamp(2.2rem, 5vw, 4rem)",
    lineHeight: 1.05,
  },
  description: {
    margin: "18px 0 0",
    color: "#475569",
    fontSize: 18,
    lineHeight: 1.65,
  },
  searchForm: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    alignItems: "end",
    gap: 12,
    marginTop: 34,
  },
  field: { display: "flex", flexDirection: "column", gap: 7 },
  label: { color: "#334155", fontSize: 14, fontWeight: 700 },
  input: {
    boxSizing: "border-box",
    width: "100%",
    minHeight: 50,
    border: "1px solid #cbd5e1",
    borderRadius: 11,
    background: "#ffffff",
    padding: "11px 13px",
    color: "#0f172a",
    fontSize: 16,
  },
  searchButton: {
    minHeight: 50,
    border: 0,
    borderRadius: 11,
    background: "#0f172a",
    padding: "12px 18px",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 800,
  },
  status: {
    margin: "15px 0 0",
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.5,
  },
  backLink: {
    display: "inline-block",
    marginTop: 24,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 700,
  },
};
