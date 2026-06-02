import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

type PublicProperty = {
  id: string;
  organizationId: string;
  name: string;
  slug: string | null;
  publicTitle?: string | null;
  publicDescription?: string | null;
  publicPhotos?: unknown;
  baseNightlyRate?: string | number | null;
  cleaningFee?: string | number | null;
  maxGuests?: number | null;
  minimumNights?: number | null;
  maximumNights?: number | null;
  address1?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  timezone?: string | null;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
};

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  "https://api.pin-ngo.com";

function getPhotoUrls(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return [];
}

function formatMoney(value: string | number | null | undefined) {
  const n = Number(value ?? 0);

  if (!Number.isFinite(n) || n <= 0) return "$0";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function diffNights(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0;

  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);

  const nights = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );

  return Number.isFinite(nights) && nights > 0 ? nights : 0;
}

export default function PublicPropertyDetailPage() {
  const { organizationSlug, propertySlug } = useParams();

  const [property, setProperty] = useState<PublicProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState<
    "idle" | "available" | "unavailable"
  >("idle");
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(
    null
  );

  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);

  const photos = useMemo(() => getPhotoUrls(property?.publicPhotos), [property]);
  const nights = useMemo(() => diffNights(checkIn, checkOut), [checkIn, checkOut]);

  const nightlyRate = Number(property?.baseNightlyRate ?? 0);
  const cleaningFee = Number(property?.cleaningFee ?? 0);
  const subtotal = nights * nightlyRate;
  const total = subtotal + cleaningFee;
  const totalGuests = adults + children;

  const location = [
    property?.address1,
    property?.city,
    property?.region,
    property?.country,
  ]
    .filter(Boolean)
    .join(", ");

  function updateAdults(nextValue: number) {
    const maxGuests = property?.maxGuests ?? 99;
    const safeValue = Math.max(1, Math.min(nextValue, maxGuests - children));
    setAdults(safeValue);
  }

  function updateChildren(nextValue: number) {
    const maxGuests = property?.maxGuests ?? 99;
    const safeValue = Math.max(0, Math.min(nextValue, maxGuests - adults));
    setChildren(safeValue);
  }

function formatDisplayTime(time?: string | null) {
  if (!time) return null;

  const parts = time.split(":");

  if (parts.length < 2) {
    return time;
  }

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  const date = new Date();
  date.setHours(hours);
  date.setMinutes(minutes);

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setPageError(null);

        const res = await fetch(
          `${API_BASE}/api/public-booking/${organizationSlug}/${propertySlug}`
        );

        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Property not found");
        }

        if (active) {
          setProperty(data.property);
        }
      } catch (err: any) {
        if (active) {
          setPageError(err?.message || "Failed to load property");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (organizationSlug && propertySlug) {
      load();
    }

    return () => {
      active = false;
    };
  }, [organizationSlug, propertySlug]);

  useEffect(() => {
    setAvailabilityStatus("idle");
    setAvailabilityMessage(null);
  }, [checkIn, checkOut]);

  async function handleCheckAvailability() {
    try {
      setCheckingAvailability(true);
      setAvailabilityStatus("idle");
      setAvailabilityMessage(null);
      setBookingError(null);

      if (!property) {
        throw new Error("Property not loaded");
      }

      if (!checkIn || !checkOut) {
        throw new Error("Please select check-in and check-out dates.");
      }

      if (nights <= 0) {
        throw new Error("Check-out must be after check-in.");
      }

      if (nights < (property.minimumNights ?? 1)) {
        throw new Error(
          `Minimum stay is ${property.minimumNights ?? 1} night(s).`
        );
      }

      if (property.maximumNights && nights > property.maximumNights) {
        throw new Error(`Maximum stay is ${property.maximumNights} night(s).`);
      }

      if (totalGuests < 1) {
        throw new Error("Please select at least one guest.");
      }

      if (property.maxGuests && totalGuests > property.maxGuests) {
        throw new Error(`Maximum guests allowed is ${property.maxGuests}.`);
      }

      const res = await fetch(`${API_BASE}/api/public-booking/check-availability`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          propertyId: property.id,
          checkIn,
          checkOut,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Unable to check availability.");
      }

      if (data.available) {
        setAvailabilityStatus("available");
        setAvailabilityMessage("Available for the selected dates.");
        return;
      }

      setAvailabilityStatus("unavailable");
      setAvailabilityMessage(
        "This property is not available for the selected dates."
      );
    } catch (err: any) {
      setAvailabilityStatus("unavailable");
      setAvailabilityMessage(err?.message || "Unable to check availability.");
    } finally {
      setCheckingAvailability(false);
    }
  }

  async function handleReserve(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSubmitting(true);
      setBookingError(null);

      if (!property) {
        throw new Error("Property not loaded");
      }

      if (availabilityStatus !== "available") {
        throw new Error("Please check availability before reserving.");
      }

      if (!checkIn || !checkOut || !guestName.trim() || !guestEmail.trim()) {
        throw new Error("Please complete check-in, check-out, name and email.");
      }

      if (nights <= 0) {
        throw new Error("Check-out must be after check-in.");
      }

      if (nights < (property.minimumNights ?? 1)) {
        throw new Error(
          `Minimum stay is ${property.minimumNights ?? 1} night(s).`
        );
      }

      if (property.maximumNights && nights > property.maximumNights) {
        throw new Error(`Maximum stay is ${property.maximumNights} night(s).`);
      }

      const res = await fetch(`${API_BASE}/api/public-booking/create-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          propertyId: property.id,
          checkIn,
          checkOut,
          guestName: guestName.trim(),
          adults,
          children,
          guestEmail: guestEmail.trim(),
          guestPhone: guestPhone.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Unable to create checkout.");
      }

      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      setBookingError(err?.message || "Unable to reserve this property.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <Link to={`/book/${organizationSlug}`} style={styles.brandWrap}>
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
        </div>
      </header>

      <main>
        {loading ? (
          <section style={styles.heroSection}>
            <div style={styles.heroContainer}>
              <h1 style={styles.heroTitle}>Loading property...</h1>
            </div>
          </section>
        ) : pageError || !property ? (
          <section style={styles.sectionAlt}>
            <div style={styles.container}>
              <div style={styles.errorBox}>{pageError || "Property not found"}</div>
            </div>
          </section>
        ) : (
          <>
            <section style={styles.heroSection}>
              <div style={styles.heroContainer}>
                <div style={styles.badge}>{property.organization.name}</div>

                <h1 style={styles.heroTitle}>
                  {property.publicTitle || property.name}
                </h1>

                <div style={styles.heroMeta}>
                  {location ? <span>📍 {location}</span> : null}

                  {property.maxGuests ? (
                    <span>👥 Up to {property.maxGuests} guests</span>
                  ) : null}

                  <span>🌙 Minimum {property.minimumNights ?? 1} night(s)</span>
                </div>

                <p style={styles.heroSubtitle}>
                  {property.publicDescription ||
                    "Book this property directly through Pin&Go."}
                </p>
              </div>
            </section>

            <section style={styles.sectionAlt}>
              <div style={styles.container}>
                <div style={styles.enterpriseGallery}>
                  {photos.length > 0 ? (
                    <>
                      <img
                        src={photos[0]}
                        alt={property.publicTitle || property.name}
                        style={styles.galleryMainImage}
                      />

                      <div style={styles.gallerySideGrid}>
                        {photos.slice(1, 5).map((photo) => (
                          <img
                            key={photo}
                            src={photo}
                            alt={property.publicTitle || property.name}
                            style={styles.gallerySideImage}
                          />
                        ))}

                        {photos.length === 1 ? (
                          <div style={styles.galleryEmpty}>Pin&Go Stay</div>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <div style={styles.photoPlaceholder}>
  <div style={styles.placeholderContent}>
    <div style={styles.placeholderBadge}>Direct Booking</div>
    <div>Premium stay powered by Pin&Go</div>
    <span style={styles.placeholderText}>
      Add property photos.
    </span>
  </div>
</div>
                  )}
                </div>

                <div style={styles.detailGrid}>
                     <div style={styles.leftColumn}>
  <div style={styles.infoCard}>
    <div style={styles.sectionEyebrow}>Property Overview</div>

    <h2 style={styles.sectionTitle}>
      {property.publicTitle || property.name}
    </h2>

    <p style={styles.overviewText}>
      {property.publicDescription ||
        "This property offers a modern and comfortable stay powered by Pin&Go."}
    </p>
  </div>

  <div style={styles.infoCard}>
    <div style={styles.sectionEyebrow}>Stay Details</div>

    <div style={styles.stayDetailsGrid}>
      <div style={styles.stayDetailItem}>
        <div style={styles.stayDetailIcon}>🕒</div>

        <div>
          <strong>Check-In</strong>
          <div>
            {formatDisplayTime(property.checkInTime) || "Configured by host"}
          </div>
        </div>
      </div>

      <div style={styles.stayDetailItem}>
        <div style={styles.stayDetailIcon}>🚪</div>

        <div>
          <strong>Check-Out</strong>
          <div>
            {formatDisplayTime(property.checkOutTime) || "11:00 AM"}
          </div>
        </div>
      </div>
    </div>
  </div>
                    <div style={styles.trustSection}>
  <div style={styles.sectionEyebrow}>Property Highlights</div>

  <h3 style={styles.trustTitle}>Designed for a smoother stay</h3>

  <div style={styles.trustGrid}>
    <div style={styles.trustCard}>
      <div style={styles.trustIcon}>🔐</div>
      <strong>Self check-in</strong>
      <span>Smart access prepared for your stay.</span>
    </div>

    <div style={styles.trustCard}>
      <div style={styles.trustIcon}>⚡</div>
      <strong>Fast confirmation</strong>
      <span>Reservation processed securely.</span>
    </div>

    <div style={styles.trustCard}>
      <div style={styles.trustIcon}>🏡</div>
      <strong>Guest-ready property</strong>
      <span>Designed for smooth arrivals.</span>
    </div>

    <div style={styles.trustCard}>
      <div style={styles.trustIcon}>💳</div>
      <strong>Secure checkout</strong>
      <span>Payment handled through Stripe.</span>
    </div>
  </div>
</div>
                      <div style={styles.trustSection}>
                      <div style={styles.sectionEyebrow}>Book Direct</div>
                      <h3 style={styles.trustTitle}>Why guests book direct</h3>

                      <div style={styles.trustGrid}>
                        <div style={styles.trustCard}>
                          <div style={styles.trustIcon}>🔒</div>
                          <strong>Secure payments</strong>
                          <span>Protected Stripe checkout.</span>
                        </div>

                        <div style={styles.trustCard}>
                          <div style={styles.trustIcon}>⚡</div>
                          <strong>Instant confirmation</strong>
                          <span>Fast reservation processing.</span>
                        </div>

                        <div style={styles.trustCard}>
                          <div style={styles.trustIcon}>📞</div>
                          <strong>Direct communication</strong>
                          <span>Stay connected with the host.</span>
                        </div>

                        <div style={styles.trustCard}>
                          <div style={styles.trustIcon}>🏠</div>
                          <strong>Smart check-in</strong>
                          <span>Modern guest experience.</span>
                        </div>
                      </div>
                    </div>

                    <div style={styles.pinGoPanel}>
                      <div>
                        <div style={styles.sectionEyebrow}>Powered by Pin&Go</div>
                        <h3 style={styles.pinGoTitle}>
                          Smart hospitality behind every stay
                        </h3>
                        <p style={styles.pinGoText}>
                          This reservation experience is powered by Pin&Go,
                          connecting secure payments, smart access, guest
                          messaging, and property automation into one seamless
                          stay.
                        </p>
                      </div>

                      <div style={styles.pinGoFeatureGrid}>
                        <div style={styles.pinGoFeature}>🔐 Smart access</div>
                        <div style={styles.pinGoFeature}>📲 Guest updates</div>
                        <div style={styles.pinGoFeature}>⚡ Contactless flow</div>
                        <div style={styles.pinGoFeature}>🏡 Smart property</div>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleReserve} style={styles.bookingCard}>
                    <div style={styles.bookingHeader}>
                      <div>
                        <div style={styles.bookingPrice}>
                          {formatMoney(property.baseNightlyRate)}
                          <span style={styles.bookingPriceUnit}> / night</span>
                        </div>
                        <div style={styles.bookingSubtitle}>
                          Book your stay securely
                        </div>
                      </div>

                      <div style={styles.bookingBadge}>Direct</div>
                    </div>

                    <label style={styles.field}>
                      <span>Check-in</span>
                      <input
                        type="date"
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span>Check-out</span>
                      <input
                        type="date"
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                        style={styles.input}
                      />
                    </label>

                    <div style={styles.guestSelector}>
                      <div style={styles.guestRow}>
                        <div>
                          <div style={styles.guestLabel}>Adults</div>
                          <div style={styles.guestHint}>Ages 13 or above</div>
                        </div>

                        <div style={styles.stepper}>
                          <button
                            type="button"
                            onClick={() => updateAdults(adults - 1)}
                            disabled={adults <= 1}
                            style={{
                              ...styles.stepperButton,
                              ...(adults <= 1 ? styles.stepperButtonDisabled : {}),
                            }}
                          >
                            −
                          </button>

                          <strong style={styles.stepperValue}>{adults}</strong>

                          <button
                            type="button"
                            onClick={() => updateAdults(adults + 1)}
                            disabled={
                              property.maxGuests
                                ? totalGuests >= property.maxGuests
                                : false
                            }
                            style={{
                              ...styles.stepperButton,
                              ...(property.maxGuests &&
                              totalGuests >= property.maxGuests
                                ? styles.stepperButtonDisabled
                                : {}),
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div style={styles.guestRowLast}>
                        <div>
                          <div style={styles.guestLabel}>Children</div>
                          <div style={styles.guestHint}>Ages 2–12</div>
                        </div>

                        <div style={styles.stepper}>
                          <button
                            type="button"
                            onClick={() => updateChildren(children - 1)}
                            disabled={children <= 0}
                            style={{
                              ...styles.stepperButton,
                              ...(children <= 0 ? styles.stepperButtonDisabled : {}),
                            }}
                          >
                            −
                          </button>

                          <strong style={styles.stepperValue}>{children}</strong>

                          <button
                            type="button"
                            onClick={() => updateChildren(children + 1)}
                            disabled={
                              property.maxGuests
                                ? totalGuests >= property.maxGuests
                                : false
                            }
                            style={{
                              ...styles.stepperButton,
                              ...(property.maxGuests &&
                              totalGuests >= property.maxGuests
                                ? styles.stepperButtonDisabled
                                : {}),
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleCheckAvailability}
                      disabled={checkingAvailability || !checkIn || !checkOut}
                      style={{
                        ...styles.secondaryButton,
                        ...(checkingAvailability || !checkIn || !checkOut
                          ? styles.secondaryButtonDisabled
                          : {}),
                      }}
                    >
                      {checkingAvailability ? "Checking..." : "Check availability"}
                    </button>

                    {availabilityMessage ? (
                      <div
                        style={{
                          ...styles.availabilityBox,
                          ...(availabilityStatus === "available"
                            ? styles.availabilityBoxSuccess
                            : styles.availabilityBoxError),
                        }}
                      >
                        {availabilityStatus === "available" ? "✅ " : "⚠️ "}
                        {availabilityMessage}
                      </div>
                    ) : null}

                    <label style={styles.field}>
                      <span>Full name</span>
                      <input
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Guest name"
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span>Email</span>
                      <input
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="guest@email.com"
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span>Phone</span>
                      <input
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder="+1..."
                        style={styles.input}
                      />
                    </label>

                    <div style={styles.priceBox}>
                      <div style={styles.priceBoxTitle}>Price details</div>

                      <div style={styles.priceRow}>
                        <span>Guests</span>
                        <strong>{totalGuests}</strong>
                      </div>

                      <div style={styles.priceRow}>
                        <span>
                          {formatMoney(property.baseNightlyRate)} × {nights || 0}{" "}
                          nights
                        </span>
                        <strong>{formatMoney(subtotal)}</strong>
                      </div>

                      <div style={styles.priceRow}>
                        <span>Cleaning fee</span>
                        <strong>{formatMoney(cleaningFee)}</strong>
                      </div>

                      <div style={styles.totalRow}>
                        <span>Total</span>
                        <strong>{formatMoney(total)}</strong>
                      </div>
                    </div>

                    {bookingError ? (
                      <div style={styles.inlineError}>{bookingError}</div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={submitting || availabilityStatus !== "available"}
                      style={{
                        ...styles.reserveButton,
                        ...(submitting || availabilityStatus !== "available"
                          ? styles.reserveButtonDisabled
                          : {}),
                      }}
                    >
                      {submitting ? "Preparing checkout..." : "Reserve now"}
                    </button>

                    <p style={styles.disclaimer}>
                      You will be redirected to Stripe Checkout to complete your
                      payment.
                    </p>
                  </form>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <footer style={styles.footer}>
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
    maxWidth: 1180,
    margin: "0 auto",
    padding: "14px 20px",
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
    fontWeight: 900,
    lineHeight: 1.1,
  },
  slogan: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
    fontWeight: 700,
  },
  heroSection: {
    padding: "76px 20px 56px",
    background:
      "radial-gradient(circle at 20% 0%, rgba(37,99,235,0.12), transparent 32%), linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  },
  heroContainer: {
     maxWidth: 1100,
     margin: "0 auto",
     textAlign: "center",
     padding: "0 20px",
    },
  badge: {
    display: "inline-block",
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "8px 14px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 900,
    marginBottom: 18,
    border: "1px solid #bfdbfe",
  },
  heroTitle: {
    fontSize: "clamp(2.8rem, 6vw, 5.5rem)",
    lineHeight: 1.02,
    fontWeight: 950,
    letterSpacing: "-0.055em",
    maxWidth: 900,
    margin: "0 auto",
  },
  heroMeta: {
    margin: "18px auto 0",
    display: "flex",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 10,
    color: "#334155",
    fontSize: 14,
    fontWeight: 850,
  },
  heroSubtitle: {
    maxWidth: 850,
    margin: "20px auto 0",
    fontSize: 20,
    lineHeight: 1.7,
    color: "#475569",
  },
  sectionAlt: {
    padding: "42px 20px 72px",
    background: "#f8fafc",
  },
  container: {
    maxWidth: 1320,
    margin: "0 auto",
  },
  enterpriseGallery: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.45fr) minmax(280px, 0.85fr)",
    gap: 14,
    marginBottom: 26,
    alignItems: "stretch",
  },
  galleryMainImage: {
    width: "100%",
    height: 440,
    objectFit: "cover",
    borderRadius: 28,
    border: "1px solid #e2e8f0",
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.10)",
  },
  gallerySideGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
  },
  gallerySideImage: {
    width: "100%",
    height: 213,
    objectFit: "cover",
    borderRadius: 24,
    border: "1px solid #e2e8f0",
  },
  galleryEmpty: {
    minHeight: 213,
    borderRadius: 24,
    display: "grid",
    placeItems: "center",
    color: "#64748b",
    fontWeight: 900,
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.08), rgba(59,130,246,0.12))",
    border: "1px solid #e2e8f0",
  },

 photoPlaceholder: {
  minHeight: "clamp(260px, 38vw, 430px)",
  borderRadius: 32,
  display: "grid",
  placeItems: "center",
  color: "#ffffff",
  fontWeight: 950,
  fontSize: 28,
  letterSpacing: "-0.04em",
  background:
    "linear-gradient(135deg, rgba(15,23,42,0.92), rgba(29,78,216,0.78)), radial-gradient(circle at 20% 20%, rgba(255,255,255,0.28), transparent 28%)",
  border: "1px solid rgba(255,255,255,0.18)",
  boxShadow: "0 24px 70px rgba(15,23,42,0.22)",
  gridColumn: "1 / -1",
},

placeholderContent: {
  textAlign: "center",
  display: "grid",
  gap: 12,
  padding: 24,
},

placeholderBadge: {
  justifySelf: "center",
  borderRadius: 999,
  padding: "8px 13px",
  background: "rgba(255,255,255,0.14)",
  border: "1px solid rgba(255,255,255,0.22)",
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
},

placeholderText: {
  maxWidth: 520,
  color: "rgba(255,255,255,0.76)",
  fontSize: 15,
  lineHeight: 1.6,
  fontWeight: 700,
},

detailGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 520px), 1fr))",
  gap: 24,
  alignItems: "start",
},  
  leftColumn: {
    display: "grid",
    gap: 20,
  },
  infoCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 28,
    padding: 30,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#2563eb",
    marginBottom: 10,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 30,
    fontWeight: 950,
    letterSpacing: "-0.035em",
  },
  
  infoList: {
    marginTop: 24,
    display: "grid",
    gap: 14,
  },
  infoItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: 14,
    color: "#334155",
    fontSize: 15,
  },
  trustSection: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 28,
    padding: 30,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },
  trustTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 950,
    letterSpacing: "-0.035em",
    color: "#0f172a",
  },
  trustGrid: {
    marginTop: 22,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
  },
  trustCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 18,
    display: "grid",
    gap: 8,
    color: "#0f172a",
  },
  trustIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    fontSize: 21,
  },
 
overviewText: {
  marginTop: 20,
  color: "#475569",
  lineHeight: 1.8,
  fontSize: 16,
},

stayDetailsGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
  gap: 16,
  marginTop: 20,
},

stayDetailItem: {
  display: "flex",
  gap: 14,
  alignItems: "center",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 18,
},

stayDetailIcon: {
  width: 44,
  height: 44,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  fontSize: 20,
},

pinGoPanel: {
  background:
    "radial-gradient(circle at 15% 20%, rgba(96,165,250,0.45), transparent 28%), linear-gradient(135deg, #020617 0%, #0f172a 48%, #1d4ed8 100%)",
  color: "#fff",
  borderRadius: 32,
  padding: 34,
  display: "grid",
  gap: 26,
  boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
  overflow: "hidden",
  position: "relative",
},

  pinGoTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 950,
    letterSpacing: "-0.035em",
  },
  pinGoText: {
    margin: "12px 0 0",
    color: "rgba(255,255,255,0.78)",
    lineHeight: 1.7,
    fontSize: 15,
  },
 pinGoFeatureGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 12,
},

  pinGoFeature: {
     background: "rgba(255,255,255,0.12)",
     border: "1px solid rgba(255,255,255,0.20)",
     borderRadius: 20,
     padding: "16px 15px",
     fontSize: 14,
     fontWeight: 950,
     backdropFilter: "blur(8px)",
     },

  bookingCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 28,
    padding: 28,
    boxShadow: "0 22px 60px rgba(15, 23, 42, 0.14)",
    position: "static",
    top: "auto",
  },
  bookingHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 22,
    paddingBottom: 18,
    borderBottom: "1px solid #e2e8f0",
  },
  bookingPrice: {
    fontSize: 38,
    fontWeight: 950,
    color: "#0f172a",
    lineHeight: 1.1,
    letterSpacing: "-0.04em",
  },
  bookingPriceUnit: {
    fontSize: 16,
    fontWeight: 800,
    color: "#64748b",
    letterSpacing: 0,
  },
 bookingSubtitle: {
  marginTop: 6,
  fontSize: 14,
  color: "#64748b",
  fontWeight: 700,
},

  bookingBadge: {
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "7px 11px",
    fontSize: 12,
    fontWeight: 950,
    border: "1px solid #bfdbfe",
  },
  field: {
    marginTop: 16,
    display: "grid",
    gap: 8,
    fontSize: 14,
    fontWeight: 800,
    color: "#334155",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 14px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    fontSize: 15,
    outline: "none",
    background: "#fff",
  },
  guestSelector: {
    marginTop: 16,
    border: "1px solid #cbd5e1",
    borderRadius: 18,
    overflow: "hidden",
    background: "#fff",
  },
  guestRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    padding: "16px 14px",
    borderBottom: "1px solid #e2e8f0",
  },
  guestRowLast: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    padding: "16px 14px",
  },
  guestLabel: {
    fontSize: 14,
    fontWeight: 900,
    color: "#0f172a",
  },
  guestHint: {
    marginTop: 3,
    fontSize: 12,
    color: "#64748b",
  },
  stepper: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 900,
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    lineHeight: 1,
  },
  stepperButtonDisabled: {
    opacity: 0.35,
    cursor: "not-allowed",
  },
  stepperValue: {
    minWidth: 18,
    textAlign: "center",
    fontSize: 16,
    color: "#0f172a",
  },
  secondaryButton: {
     marginTop: 16,
     width: "100%",
     border: "1px solid #16a34a",
     borderRadius: 18,
     background: "#16a34a",
    color: "#fff",
    padding: "14px 16px",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 10px 24px rgba(22,163,74,0.25)",
    },
  secondaryButtonDisabled: {
    opacity: 0.65,
    cursor: "not-allowed",
  },
  availabilityBox: {
    marginTop: 12,
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.5,
  },
  availabilityBoxSuccess: {
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    color: "#047857",
  },
  availabilityBoxError: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#9f1239",
  },
  priceBox: {
    marginTop: 18,
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 16,
    display: "grid",
    gap: 10,
    background: "#f8fafc",
  },
  priceBoxTitle: {
    fontSize: 13,
    fontWeight: 950,
    color: "#0f172a",
    marginBottom: 2,
  },
  priceRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    color: "#475569",
    fontSize: 14,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTop: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 20,
    fontWeight: 950,
    color: "#0f172a",
  },
  reserveButton: {
    marginTop: 18,
    width: "100%",
    border: "none",
    borderRadius: 18,
    background: "#1d4ed8",
    color: "#fff",
    padding: "15px 18px",
    fontWeight: 950,
    fontSize: 16,
    cursor: "pointer",
     boxShadow: "0 12px 28px rgba(29,78,216,0.28)",
  },
  reserveButtonDisabled: {
    opacity: 0.65,
    cursor: "not-allowed",
    boxShadow: "none",
  },
  disclaimer: {
    marginTop: 12,
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.5,
    textAlign: "center",
  },
  errorBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#9f1239",
    borderRadius: 18,
    padding: 24,
    textAlign: "center",
    fontWeight: 800,
  },
  inlineError: {
    marginTop: 14,
    background: "#fff1f2",
    color: "#9f1239",
    border: "1px solid #fecdd3",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontWeight: 800,
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