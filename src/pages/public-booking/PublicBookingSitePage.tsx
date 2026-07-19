import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "./PublicBookingExperience.css";

type PublicProperty = {
  id: string;
  name: string;
  slug: string | null;
  publicTitle?: string | null;
  publicDescription?: string | null;
  publicPhotos?: unknown;
  baseNightlyRate?: string | number | null;
  cleaningFee?: string | number | null;
  maxGuests?: number | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
};

type PublicOrganization = {
  id: string;
  name: string;
  slug: string;
  properties: PublicProperty[];
};

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  "https://api.pin-ngo.com";

function getPhotoUrl(value: unknown) {
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return null;
}

function formatMoney(value: string | number | null | undefined) {
  const n = Number(value ?? 0);

  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function PublicBookingSitePage() {
  const { organizationSlug } = useParams();
  const [organization, setOrganization] = useState<PublicOrganization | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferredLanguage, setPreferredLanguage] = useState<"en" | "es">(() => {
    try {
      return window.localStorage.getItem("pingo_guest_preferred_language") === "es"
        ? "es"
        : "en";
    } catch {
      return "en";
    }
  });
  const isSpanish = preferredLanguage === "es";

  const title = useMemo(() => {
    if (!organization) return isSpanish ? "Reserva tu estadía" : "Book your stay";
    return isSpanish
      ? `Descubre ${organization.name}`
      : `Discover ${organization.name}`;
  }, [isSpanish, organization]);

  function changeLanguage(language: "en" | "es") {
    setPreferredLanguage(language);
    try {
      window.localStorage.setItem("pingo_guest_preferred_language", language);
    } catch {
      // The booking experience remains usable without browser persistence.
    }
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `${API_BASE}/api/public-booking/${organizationSlug}`
        );

        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Booking site not found");
        }

        if (active) {
          setOrganization(data.organization);
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message || "Failed to load booking site");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (organizationSlug) {
      load();
    }

    return () => {
      active = false;
    };
  }, [organizationSlug]);

  return (
    <div className="pbe-collection-page" style={styles.page}>
      <header className="pbe-collection-header" style={styles.header}>
        <div className="pbe-collection-header-inner" style={styles.headerInner}>
          <Link className="pbe-collection-brand" to="/home" style={styles.brandWrap}>
            <img
              src="/pin-go-logo.png"
              alt="Pin&Go logo"
              style={styles.logo}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <div>
              <div style={styles.brandName}>Pin&Go</div>
              <div style={styles.slogan}>Direct Booking</div>
            </div>
          </Link>
          <div className="pbe-collection-language" role="group" aria-label="Guest language">
            <button type="button" aria-pressed={!isSpanish} onClick={() => changeLanguage("en")}>EN</button>
            <button type="button" aria-pressed={isSpanish} onClick={() => changeLanguage("es")}>ES</button>
          </div>
        </div>
      </header>

      <main>
        <section className="pbe-collection-hero" style={styles.heroSection}>
          {getPhotoUrl(organization?.properties?.[0]?.publicPhotos) ? (
            <img
              src={getPhotoUrl(organization?.properties?.[0]?.publicPhotos) || ""}
              alt=""
              aria-hidden="true"
            />
          ) : null}
          <div className="pbe-collection-hero-shade" aria-hidden="true" />
          <div className="pbe-collection-hero-copy" style={styles.heroContainer}>
            <div style={styles.badge}>{isSpanish ? "RESERVA DIRECTA" : "DIRECT BOOKING"}</div>

            <h1 style={styles.heroTitle}>
              {loading ? (isSpanish ? "Preparando la colección..." : "Preparing the collection...") : title}
            </h1>

            <p style={styles.heroSubtitle}>
              {isSpanish
                ? "Estadías excepcionales con una llegada segura, fluida y sin llaves, impulsada por Pin&Go."
                : "Exceptional stays with a secure, seamless and keyless arrival, powered by Pin&Go."}
            </p>
          </div>
        </section>

        <section className="pbe-collection-section" style={styles.sectionAlt}>
          <div style={styles.container}>
            {loading ? (
              <div style={styles.stateBox}>Loading properties...</div>
            ) : error ? (
              <div style={styles.errorBox}>{error}</div>
            ) : !organization?.properties?.length ? (
              <div style={styles.stateBox}>
                No public properties are available right now.
              </div>
            ) : (
              <>
                <div className="pbe-collection-heading">
                  <span>{isSpanish ? "LA COLECCIÓN" : "THE COLLECTION"}</span>
                  <h2 style={styles.sectionTitle}>
                    {isSpanish ? "Elige tu próxima estadía" : "Choose your next stay"}
                  </h2>
                </div>

                <div className="pbe-collection-grid" style={styles.propertyGrid}>
                  {organization.properties.map((property) => {
                    const photoUrl = getPhotoUrl(property.publicPhotos);
                    const nightlyRate = formatMoney(property.baseNightlyRate);
                    const location = [property.city, property.region, property.country]
                      .filter(Boolean)
                      .join(", ");

                    const propertyUrl = property.slug
                      ? `/book/${organization.slug}/${property.slug}`
                      : "#";

                    return (
                      <Link
                        className="pbe-collection-card"
                        key={property.id}
                        to={propertyUrl}
                        style={{
                          ...styles.propertyCard,
                          ...(property.slug ? {} : styles.disabledCard),
                        }}
                      >
                        <div className="pbe-collection-photo" style={styles.photoWrap}>
                          {photoUrl ? (
                            <img
                              src={photoUrl}
                              alt={property.publicTitle || property.name}
                              style={styles.photo}
                            />
                          ) : (
                           <div style={styles.photoPlaceholder}>
  <div style={styles.placeholderIcon}>⌂</div>
  <div style={styles.placeholderTitle}>Property Preview</div>
  <div style={styles.placeholderText}>Direct Booking</div>
</div>

                          )}
                        </div>

                        <div className="pbe-collection-card-body" style={styles.cardBody}>
                          <div style={styles.cardMeta}>
                            {location || "Direct booking property"}
                          </div>

                          <h3 style={styles.cardTitle}>
                            {property.publicTitle || property.name}
                          </h3>

                          {property.publicDescription ? (
                            <p style={styles.cardText}>
                              {property.publicDescription}
                            </p>
                          ) : (
                            <p style={styles.cardText}>
                              Book this property directly through Pin&Go.
                            </p>
                          )}

                          <div style={styles.cardFooter}>
                            <div>
                              {nightlyRate ? (
                                <>
                                  <strong>{nightlyRate}</strong>{" "}
                                  <span style={styles.muted}>{isSpanish ? "/ noche" : "/ night"}</span>
                                </>
                              ) : (
                                <span style={styles.muted}>Rate available soon</span>
                              )}
                            </div>
                           
                              {property.maxGuests ? (
                              <div style={styles.muted}>
                                {isSpanish ? "Hasta" : "Up to"} {property.maxGuests} {isSpanish ? "huéspedes" : "guests"}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      <footer className="pbe-collection-footer" style={styles.footer}>
        <div style={styles.container}>
          © Pin&Go. Direct booking powered by autonomous property operations.
        </div>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: "#0f172a",
    backgroundColor: "#ffffff",
    minHeight: "100vh",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid #e2e8f0",
  },
  headerInner: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "14px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  brandWrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    textDecoration: "none",
    color: "#0f172a",
  },
  logo: {
    width: 48,
    height: 48,
    objectFit: "contain",
    borderRadius: 10,
  },
  brandName: {
    fontSize: 22,
    fontWeight: 800,
    lineHeight: 1.1,
  },
  slogan: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  heroSection: {
    padding: "76px 20px 64px",
    background:
      "radial-gradient(circle at top, rgba(59,130,246,0.08), transparent 35%), linear-gradient(to bottom, #ffffff, #f8fafc)",
  },
  heroContainer: {
    maxWidth: 900,
    margin: "0 auto",
    textAlign: "center",
  },
  badge: {
    display: "inline-block",
    background: "#e2e8f0",
    color: "#0f172a",
    padding: "8px 14px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: "clamp(2rem, 5vw, 3.4rem)",
    lineHeight: 1.05,
    fontWeight: 800,
    margin: 0,
  },
  heroSubtitle: {
    maxWidth: 760,
    margin: "20px auto 0",
    fontSize: 18,
    lineHeight: 1.7,
    color: "#475569",
  },
  sectionAlt: {
    padding: "70px 20px",
    background: "#f8fafc",
  },
  container: {
    maxWidth: 1200,
    margin: "0 auto",
  },
  sectionTitle: {
    fontSize: "clamp(1.7rem, 4vw, 2.3rem)",
    fontWeight: 800,
    margin: 0,
    textAlign: "center",
  },
  propertyGrid: {
    marginTop: 36,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 22,
  },
 propertyCard: {
  overflow: "hidden",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
  textDecoration: "none",
  color: "#0f172a",
  display: "flex",
  flexDirection: "column",
  cursor: "pointer",
  transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
  },
 
  disabledCard: {
    pointerEvents: "none",
    opacity: 0.65,
  },
  photoWrap: {
    height: 220,
    background: "#e2e8f0",
  },
  photo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  photoPlaceholder: {
    height: "100%",
    display: "grid",
    placeItems: "center",
    color: "#64748b",
    fontWeight: 800,
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.08), rgba(59,130,246,0.12))",
  },
  cardBody: {
    padding: 22,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    flex: 1,
  },
  cardMeta: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: 700,
  },
  cardTitle: {
    margin: 0,
    fontSize: 22,
    lineHeight: 1.2,
  },
 cardText: {
  margin: 0,
  color: "#475569",
  lineHeight: 1.6,
  fontSize: 15,
  flex: 1,
  overflow: "hidden",
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
},
  cardFooter: {
    marginTop: 12,
    paddingTop: 14,
    borderTop: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  muted: {
    color: "#64748b",
    fontSize: 14,
  },
  stateBox: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 24,
    textAlign: "center",
    color: "#475569",
  },
  errorBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#9f1239",
    borderRadius: 18,
    padding: 24,
    textAlign: "center",
    fontWeight: 700,
  },
 
placeholderIcon: {
  width: 54,
  height: 54,
  borderRadius: 18,
  display: "grid",
  placeItems: "center",
  margin: "0 auto 12px",
  background: "rgba(255,255,255,0.75)",
  color: "#1d4ed8",
  fontSize: 28,
  boxShadow: "0 12px 28px rgba(15,23,42,0.10)",
},

placeholderTitle: {
  fontSize: 18,
  fontWeight: 900,
  color: "#0f172a",
},

placeholderText: {
  marginTop: 4,
  fontSize: 13,
  fontWeight: 700,
  color: "#64748b",
},

 footer: {
    borderTop: "1px solid #e2e8f0",
    padding: "24px 20px",
    color: "#64748b",
    fontSize: 14,
    background: "#fff",
    textAlign: "center",
  },
};
