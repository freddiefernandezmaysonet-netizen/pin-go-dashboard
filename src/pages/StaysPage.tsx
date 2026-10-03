import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./StaysPage.css";

type Lang = "es" | "en";

type PublicProperty = {
  id: string;
  name: string;
  slug: string | null;
  publicTitle?: string | null;
  publicDescription?: string | null;
  publicDescriptionEs?: string | null;
  publicPhotos?: unknown;
  maxGuests?: number | null;
  city?: string | null;
  region?: string | null;
};

type FeaturedProperty = PublicProperty & {
  organizationSlug: string;
  reviewCount: number;
  rating: number | null;
};

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  "https://api.pin-ngo.com";

// This curated registry can grow safely until a public cross-organization
// discovery endpoint becomes available.
const FEATURED_ORGANIZATION_SLUGS = ["remansodepaz"];

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

function getPhotoUrl(value: unknown) {
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : null;
}

function rotateWeekly(properties: FeaturedProperty[]) {
  if (properties.length < 2) return properties;
  const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const offset = week % properties.length;
  return [...properties.slice(offset), ...properties.slice(0, offset)];
}

export default function StaysPage() {
  const [lang, setLang] = useState<Lang>("es");
  const [featured, setFeatured] = useState<FeaturedProperty[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [failedPhotos, setFailedPhotos] = useState<string[]>([]);
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
            hosts: "Administrar propiedades",
            guests: "Buscar alojamiento",
            visitType: "Tipo de visita",
            eyebrow: "Properties Powered by Pin&Go",
            title: "Encuentra un lugar que se sienta tuyo.",
            description:
              "Estadías seleccionadas con reservación directa, información clara y una experiencia coordinada por Pin&Go.",
            location: "¿A dónde vas?",
            locationPlaceholder: "Ciudad o destino",
            checkIn: "Llegada",
            checkOut: "Salida",
            guestCount: "Huéspedes",
            search: "Buscar",
            prepared:
              "Búsqueda preparada. La disponibilidad por fecha se conectará en el próximo paso.",
            direct: "Reservación directa",
            transparent: "Información clara",
            coordinated: "Estadía coordinada",
            sectionEyebrow: "Descubre Pin&Go",
            sectionTitle: "Estadías destacadas",
            sectionText:
              "Propiedades reales disponibles para reservar directamente con sus anfitriones.",
            newLabel: "Nueva en Pin&Go",
            favoriteLabel: "Favorita de huéspedes",
            bookingLabel: "Direct Booking",
            sleeps: (count: number) =>
              count === 1 ? "1 huésped" : `Hasta ${count} huéspedes`,
            reviews: (count: number) =>
              count === 1 ? "1 review verificado" : `${count} reviews verificados`,
            viewProperty: "Ver disponibilidad y precio",
            loading: "Cargando estadías destacadas…",
            empty:
              "Las próximas propiedades públicas aparecerán aquí cuando activen Direct Booking.",
            hostLink: "¿Administras una propiedad? Conoce Pin&Go APMS",
            metaTitle: "Alojamientos | Properties Powered by Pin&Go",
            metaDescription:
              "Descubre propiedades reales con Direct Booking Powered by Pin&Go.",
          }
        : {
            hosts: "Manage properties",
            guests: "Find a stay",
            visitType: "Visit type",
            eyebrow: "Properties Powered by Pin&Go",
            title: "Find a place that feels like yours.",
            description:
              "Selected stays with direct booking, clear information, and an experience coordinated by Pin&Go.",
            location: "Where are you going?",
            locationPlaceholder: "City or destination",
            checkIn: "Check-in",
            checkOut: "Check-out",
            guestCount: "Guests",
            search: "Search",
            prepared:
              "Search prepared. Date-based availability will be connected in the next step.",
            direct: "Direct booking",
            transparent: "Clear information",
            coordinated: "Coordinated stay",
            sectionEyebrow: "Discover Pin&Go",
            sectionTitle: "Featured stays",
            sectionText:
              "Real properties available to book directly with their hosts.",
            newLabel: "New on Pin&Go",
            favoriteLabel: "Guest favorite",
            bookingLabel: "Direct Booking",
            sleeps: (count: number) =>
              count === 1 ? "1 guest" : `Up to ${count} guests`,
            reviews: (count: number) =>
              count === 1 ? "1 verified review" : `${count} verified reviews`,
            viewProperty: "View availability and price",
            loading: "Loading featured stays…",
            empty:
              "New public properties will appear here when they activate Direct Booking.",
            hostLink: "Manage a property? Explore Pin&Go APMS",
            metaTitle: "Stays | Properties Powered by Pin&Go",
            metaDescription:
              "Discover real properties with Direct Booking Powered by Pin&Go.",
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

  useEffect(() => {
    const controller = new AbortController();

    async function loadFeatured() {
      try {
        setFeaturedLoading(true);
        const organizations = await Promise.allSettled(
          FEATURED_ORGANIZATION_SLUGS.map(async (organizationSlug) => {
            const response = await fetch(
              `${API_BASE}/api/public-booking/${encodeURIComponent(organizationSlug)}`,
              { signal: controller.signal },
            );
            const payload = await response.json();
            if (!response.ok || !payload.ok || !payload.organization) {
              throw new Error("Public booking collection unavailable");
            }

            const properties = (payload.organization.properties ?? []) as PublicProperty[];
            return Promise.all(
              properties
                .filter((property) => property.slug)
                .map(async (property): Promise<FeaturedProperty> => {
                  let reviewCount = 0;
                  let rating: number | null = null;
                  try {
                    const reviewResponse = await fetch(
                      `${API_BASE}/api/public-reviews/property/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(property.slug ?? "")}?page=1&pageSize=1&sort=RECENT`,
                      { signal: controller.signal },
                    );
                    const reviewPayload = await reviewResponse.json();
                    if (reviewResponse.ok && reviewPayload.ok) {
                      reviewCount = Number(reviewPayload.total ?? 0);
                      const overall = Number(reviewPayload.averages?.overallRating);
                      rating = Number.isFinite(overall) && overall > 0 ? overall : null;
                    }
                  } catch (error) {
                    if (error instanceof DOMException && error.name === "AbortError") {
                      throw error;
                    }
                  }

                  return {
                    ...property,
                    organizationSlug,
                    reviewCount,
                    rating,
                  };
                }),
            );
          }),
        );

        const properties = organizations.flatMap((result) =>
          result.status === "fulfilled" ? result.value : [],
        );
        setFeatured(rotateWeekly(properties));
      } finally {
        if (!controller.signal.aborted) setFeaturedLoading(false);
      }
    }

    void loadFeatured();
    return () => controller.abort();
  }, []);

  const heroPhoto = getPhotoUrl(featured[0]?.publicPhotos);

  return (
    <div className="pg-stays-page">
      <header className="pg-stays-header">
        <div className="pg-stays-header-inner">
          <Link to="/home" className="pg-stays-brand" aria-label="Pin&Go">
            <img src="/pin-go-logo.png" alt="" />
            <span>
              <strong>Pin&Go</strong>
              <small>{t.eyebrow}</small>
            </span>
          </Link>

          <nav className="pg-stays-audience" aria-label={t.visitType}>
            <Link to="/home">{t.hosts}</Link>
            <Link to="/stays" className="is-active" aria-current="page">
              {t.guests}
            </Link>
          </nav>

          <div className="pg-stays-language" aria-label="Language">
            <button type="button" className={lang === "es" ? "is-active" : ""} onClick={() => setLang("es")}>ES</button>
            <button type="button" className={lang === "en" ? "is-active" : ""} onClick={() => setLang("en")}>EN</button>
          </div>
        </div>
      </header>

      <main>
        <section className="pg-stays-hero" aria-labelledby="stays-title">
          {heroPhoto && !failedPhotos.includes("hero") ? (
            <img className="pg-stays-hero-photo" src={heroPhoto} alt="" onError={() => setFailedPhotos((current) => [...current, "hero"])} />
          ) : null}
          <div className="pg-stays-hero-overlay" />
          <div className="pg-stays-hero-content">
            <div className="pg-stays-eyebrow"><Sparkles size={16} aria-hidden="true" />{t.eyebrow}</div>
            <h1 id="stays-title">{t.title}</h1>
            <p>{t.description}</p>

            <form className="pg-stays-search" onSubmit={(event) => { event.preventDefault(); setSearchPrepared(true); }}>
              <label className="pg-stays-search-field pg-stays-location">
                <MapPin size={18} aria-hidden="true" />
                <span><strong>{t.location}</strong><input type="search" value={search.location} placeholder={t.locationPlaceholder} onChange={(event) => { setSearch((current) => ({ ...current, location: event.target.value })); setSearchPrepared(false); }} required /></span>
              </label>
              <label className="pg-stays-search-field">
                <CalendarDays size={18} aria-hidden="true" />
                <span><strong>{t.checkIn}</strong><input type="date" min={today} value={search.checkIn} onChange={(event) => { const checkIn = event.target.value; setSearch((current) => ({ ...current, checkIn, checkOut: current.checkOut && current.checkOut < getFollowingDate(checkIn) ? "" : current.checkOut })); setSearchPrepared(false); }} required /></span>
              </label>
              <label className="pg-stays-search-field">
                <CalendarDays size={18} aria-hidden="true" />
                <span><strong>{t.checkOut}</strong><input type="date" min={minimumCheckOut} value={search.checkOut} onChange={(event) => { setSearch((current) => ({ ...current, checkOut: event.target.value })); setSearchPrepared(false); }} required /></span>
              </label>
              <label className="pg-stays-search-field">
                <Users size={18} aria-hidden="true" />
                <span><strong>{t.guestCount}</strong><input type="number" min="1" max="20" value={search.guests} onChange={(event) => { setSearch((current) => ({ ...current, guests: event.target.value })); setSearchPrepared(false); }} required /></span>
              </label>
              <button type="submit" className="pg-stays-search-button"><Search size={19} aria-hidden="true" /><span>{t.search}</span></button>
            </form>

            {searchPrepared ? <p className="pg-stays-search-status" role="status" aria-live="polite">{t.prepared}</p> : null}
          </div>
        </section>

        <section className="pg-stays-trust" aria-label={t.direct}>
          <span><ShieldCheck aria-hidden="true" />{t.direct}</span>
          <span><Sparkles aria-hidden="true" />{t.transparent}</span>
          <span><CalendarDays aria-hidden="true" />{t.coordinated}</span>
        </section>

        <section className="pg-stays-featured" aria-labelledby="featured-title">
          <div className="pg-stays-section-heading">
            <div><span>{t.sectionEyebrow}</span><h2 id="featured-title">{t.sectionTitle}</h2></div>
            <p>{t.sectionText}</p>
          </div>

          {featuredLoading ? (
            <div className="pg-stays-state" role="status">{t.loading}</div>
          ) : featured.length === 0 ? (
            <div className="pg-stays-state">{t.empty}</div>
          ) : (
            <div className={`pg-stays-property-grid${featured.length === 1 ? " is-single" : ""}`}>
              {featured.map((property) => {
                const photo = getPhotoUrl(property.publicPhotos);
                const title = property.publicTitle?.trim() || property.name;
                const description = (lang === "es" ? property.publicDescriptionEs : property.publicDescription) || property.publicDescription || property.publicDescriptionEs;
                const isFavorite = property.reviewCount >= 5 && property.rating !== null && property.rating >= 4.7;
                const badge = isFavorite ? t.favoriteLabel : property.reviewCount === 0 ? t.newLabel : t.bookingLabel;
                const propertyPath = `/book/${property.organizationSlug}/${property.slug}`;

                return (
                  <article className="pg-stays-property-card" key={property.id}>
                    <Link className="pg-stays-property-photo" to={propertyPath}>
                      {photo && !failedPhotos.includes(property.id) ? <img src={photo} alt={title} onError={() => setFailedPhotos((current) => [...current, property.id])} /> : <div className="pg-stays-photo-fallback" aria-hidden="true"><Sparkles /></div>}
                      <span className="pg-stays-property-badge">{badge}</span>
                    </Link>
                    <div className="pg-stays-property-body">
                      <div className="pg-stays-property-location"><MapPin size={15} aria-hidden="true" />{[property.city, property.region].filter(Boolean).join(", ")}</div>
                      <h3><Link to={propertyPath}>{title}</Link></h3>
                      {description ? <p>{description}</p> : null}
                      <div className="pg-stays-property-meta">
                        {property.maxGuests ? <span><Users size={16} aria-hidden="true" />{t.sleeps(property.maxGuests)}</span> : null}
                        {property.reviewCount > 0 && property.rating ? <span><Star size={16} fill="currentColor" aria-hidden="true" />{property.rating.toFixed(1)} · {t.reviews(property.reviewCount)}</span> : null}
                      </div>
                      <Link className="pg-stays-property-action" to={propertyPath}>{t.viewProperty}<ArrowRight size={17} aria-hidden="true" /></Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className="pg-stays-host-link"><Link to="/home">{t.hostLink}<ArrowRight size={17} aria-hidden="true" /></Link></div>
      </main>
    </div>
  );
}
