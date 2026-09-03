import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import OnboardingBookingModal from "../components/OnboardingBookingModal";
import HaasConfigurator from "../components/HaasConfigurator";

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

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>("es");
  const [openBooking, setOpenBooking] = useState(false);
  const [bookingType, setBookingType] = useState<"onboarding" | "demo">("onboarding");
  const [staySearch, setStaySearch] = useState({
    location: "",
    checkIn: "",
    checkOut: "",
    guests: "2",
  });
  const [searchPrepared, setSearchPrepared] = useState(false);
  const today = getLocalToday();
  const minimumCheckOut = staySearch.checkIn
    ? getFollowingDate(staySearch.checkIn)
    : today;

  const t = useMemo(() => {
    return lang === "es"
      ? {
          navLogin: "Iniciar sesión",
          navSignup: "Crear cuenta",
          metaTitle: "Pin&Go APMS | Operación y hardware bajo tu control",
          metaDescription:
            "Pin&Go es un APMS que coordina reservas, acceso inteligente, huéspedes y automatización con hardware compatible.",
          heroBadge: "APMS para rentas a corto plazo",
          heroTitle: "Pin&Go opera tu propiedad. Tú mantienes el control.",
          heroSubtitle:
            "Coordina reservas, accesos, huéspedes y automatizaciones desde un solo sistema. Pin&Go ejecuta la rutina dentro de tus reglas y te involucra cuando una excepción requiere criterio.",
          heroOutcomes: [
            ["Reserva a acción", "Coordina el trabajo operativo sin pasos sueltos."],
            ["Acceso y hardware", "Conecta cerraduras, NFC y dispositivos compatibles."],
            ["Control por excepción", "Intervienes cuando realmente hace falta."],
          ],
          heroPricePrefix: "Desde",
          heroPriceLocks: "$14.99 / cerradura / mes",
          heroPriceSmart: "$14.99 / propiedad inteligente / mes",
          heroCtaPrimary: "Empezar ahora",
          heroCtaSecondary: "Iniciar sesión",
          heroTrust: "Hardware compatible • Configuración guiada",

          searchEyebrow: "Properties Powered by Pin&Go",
          searchTitle: "Encuentra propiedades disponibles",
          searchText:
            "Indica dónde y cuándo deseas hospedarte. Pin&Go mostrará únicamente propiedades disponibles para tu estadía.",
          searchLocation: "Ubicación",
          searchLocationPlaceholder: "Destino o ubicación",
          searchCheckIn: "Check-in",
          searchCheckOut: "Check-out",
          searchGuests: "Huéspedes",
          searchCta: "Buscar propiedades",
          searchPrepared:
            "Criterios preparados. En el próximo paso conectaremos los resultados disponibles.",

          slogan: "Autonomous Property Management",

          sectionBenefitsTitle: "La operación y el hardware, coordinados",
          benefit1Title: "🔐 Control de acceso ",
          benefit1Text:
            "Códigos automáticos por reserva, NFC y revocación automática al check-out.",
          benefit2Title: "🏨 Reservas e integraciones",
          benefit2Text:
            "Opera reservas directas y conecta PMS compatibles cuando tu propiedad lo necesite.",
          benefit3Title: "🤖 Automatización inteligente",
          benefit3Text:
            "Automatiza aire acondicionado, luces y alarmas según la reserva.",
          benefit4Title: "📩 Mensajería",
          benefit4Text:
            "Mensajes automáticos pre-check-in, check-in y check-out para el huésped.",

          sectionDifferentiationTitle: "Un APMS, no solo otra herramienta",
          sectionDifferentiationText:
            "Pin&Go convierte reservas y reglas en acciones verificables. Coordina el ciclo de acceso, tarjetas NFC, hardware inteligente, mensajes y automatizaciones sin exigir otro PMS para comenzar.",

          sectionPainTitle: "Diseñado para resolver problemas reales",
          pain1: "Huéspedes que no pueden entrar a la propiedad",
          pain2: "Llamadas a cualquier hora por códigos o accesos",
          pain3: "Check-ins manuales y operaciones desorganizadas",
          pain4: "Múltiples herramientas que no se comunican entre sí",

          sectionPricingTitle: "Hardware y automatización que crecen contigo",
          pricingLocksTitle: "🔐 Access Control",
          pricingLocksPrice: "$14.99",
          pricingLocksPeriod: "/ cerradura / mes",
          pricingLocksFeature1: "Códigos automáticos por reserva",
          pricingLocksFeature2: " Acceso tarjeta NFC",
          pricingLocksFeature3: "Check-in / check-out automático",
          pricingLocksFeature4: "Coordinación con reservas",
          pricingLocksFeature5: "Reduce llamadas de huéspedes",
          pricingLocksCta: "Activar",

          pricingSmartTitle: "🤖 Smart Automation",
          pricingSmartPrice: "$14.99",
          pricingSmartPeriod: "/ propiedad / mes",
          pricingSmartFeature1: "Control de dispositivos",
          pricingSmartFeature2: "Automatización por reserva",
          pricingSmartFeature3: "Experiencia premium del huésped",
          pricingSmartFeature4: "Integración con control de acceso",
          pricingSmartFeature5: "Mayor eficiencia operativa",
          pricingSmartCta: "Activar",

          exampleTitle: "Ejemplo de facturación",
          exampleText1: "2 cerraduras = $29.98 / mes",
          exampleText2: "1 propiedad inteligentes = $14.99 / mes",
          exampleText3: "Total = $44.97 / mes",

          faqTitle: "Preguntas frecuentes",
          faq1Q: "¿Necesito hardware especial?",
          faq1A:
            "Pin&Go está diseñado para integrarse con cerraduras inteligentes y flujos de acceso compatibles con TTLock.",
          faq2Q: "¿Necesito otro PMS?",
          faq2A:
            "No para comenzar. Pin&Go puede operar directamente y también conectarse con integraciones PMS compatibles cuando ya forman parte de tu operación.",
          faq3Q: "¿Puedo cancelar cuando quiera?",
          faq3A: "Sí. Puedes ajustar o cancelar tu servicio según tu operación.",
          faq4Q: "¿Es difícil configurarlo?",
          faq4A: "No. El flujo está pensado para una configuración rápida y fácil de operar.",
          finalTitle: "Pon tu operación en modo APMS",
          finalSubtitle:
            "Automatiza la rutina sin renunciar al control, al acceso inteligente ni al hardware de tu propiedad.",
          finalCta: "Crear cuenta",
          footerText: "© Pin&Go. APMS y hardware inteligente para operaciones modernas.",
        }
      : {
          navLogin: "Log in",
          navSignup: "Create account",
          metaTitle: "Pin&Go APMS | Operations and hardware under your control",
          metaDescription:
            "Pin&Go is an APMS that coordinates reservations, smart access, guests, and automation with compatible hardware.",
          heroBadge: "APMS for short-term rentals",
          heroTitle: "Pin&Go runs your property. You stay in control.",
          heroSubtitle:
            "Coordinate reservations, access, guests, and automations from one system. Pin&Go runs the routine within your rules and brings you in when an exception requires judgment.",
          heroOutcomes: [
            ["Reservation to action", "Coordinate operational work without disconnected steps."],
            ["Access and hardware", "Connect compatible locks, NFC, and smart devices."],
            ["Human by exception", "Step in only when judgment is actually needed."],
          ],
          heroPricePrefix: "Starting at",
          heroPriceLocks: "$14.99 / lock / month",
          heroPriceSmart: "$14.99 / smart property / month",
          heroCtaPrimary: "Get started",
          heroCtaSecondary: "Log in",
          heroTrust: "Compatible hardware • Guided setup",

          searchEyebrow: "Properties Powered by Pin&Go",
          searchTitle: "Find available properties",
          searchText:
            "Tell us where and when you want to stay. Pin&Go will show only properties available for your trip.",
          searchLocation: "Location",
          searchLocationPlaceholder: "Destination or location",
          searchCheckIn: "Check-in",
          searchCheckOut: "Check-out",
          searchGuests: "Guests",
          searchCta: "Search properties",
          searchPrepared:
            "Search criteria prepared. Available results will be connected in the next step.",

          slogan: "Autonomous Property Management",

          sectionBenefitsTitle: "Operations and hardware, coordinated",
          benefit1Title: "🔐 Access Control",
          benefit1Text:
            "Automatic reservation-based codes, NFC, and automatic checkout revocation.",
          benefit2Title: "🏨 Reservations and integrations",
          benefit2Text:
            "Run direct reservations and connect compatible PMS integrations when your property needs them.",
          benefit3Title: "🤖 Smart Automation",
          benefit3Text:
            "Automate AC, lights, and alarms based on reservation activity.",
          benefit4Title: "📩 Messaging",
          benefit4Text:
            "Automatic pre-check-in, check-in, and checkout messaging for guests.",

          sectionDifferentiationTitle: "An APMS, not just another tool",
          sectionDifferentiationText:
            "Pin&Go turns reservations and rules into verifiable actions. It coordinates access, NFC cards, smart hardware, messages, and automations without requiring another PMS to get started.",

          sectionPainTitle: "Built to solve real problems",
          pain1: "Guests unable to enter the property",
          pain2: "Late-night calls about codes and access",
          pain3: "Manual check-ins and disorganized operations",
          pain4: "Multiple disconnected tools",

          sectionPricingTitle: "Hardware and automation that grow with you",
          pricingLocksTitle: "🔐 Access Control",
          pricingLocksPrice: "$14.99",
          pricingLocksPeriod: "/ lock / month",
          pricingLocksFeature1: "Automatic reservation-based codes",
          pricingLocksFeature2: "NFC access",
          pricingLocksFeature3: "Automatic check-in / check-out flow",
          pricingLocksFeature4: "Reservation coordination",
          pricingLocksFeature5: "Reduce guest support calls",
          pricingLocksCta: "Start now",

          pricingSmartTitle: "🤖 Smart Automation",
          pricingSmartPrice: "$14.99",
          pricingSmartPeriod: "/ property / month",
          pricingSmartFeature1: "Device control",
          pricingSmartFeature2: "Reservation-based automation",
          pricingSmartFeature3: "Premium guest experience",
          pricingSmartFeature4: "Access control integration",
          pricingSmartFeature5: "Higher operational efficiency",
          pricingSmartCta: "Activate",

          exampleTitle: "Billing example",
          exampleText1: "2 locks = $29.98 / month",
          exampleText2: "1 smart property = $14.99 / month",
          exampleText3: "Total = $44.97 / month",

          faqTitle: "Frequently asked questions",
          faq1Q: "Do I need special hardware?",
          faq1A:
            "Pin&Go is designed to integrate with smart lock workflows compatible with TTLock.",
          faq2Q: "Do I need another PMS?",
          faq2A:
            "Not to get started. Pin&Go can operate directly and can also connect compatible PMS integrations when they are already part of your operation.",
          faq3Q: "Can I cancel anytime?",
          faq3A: "Yes. You can adjust or cancel your service based on your operation.",
          faq4Q: "Is setup difficult?",
          faq4A: "No. The flow is designed for fast setup and easy operation.",

          finalTitle: "Put your operation in APMS mode",
          finalSubtitle:
            "Automate the routine without giving up control, smart access, or your property's hardware.",
          finalCta: "Create account",
          footerText: "© Pin&Go. APMS and smart hardware for modern operations.",
        };
  }, [lang]);

  const isVisualPreview =
    import.meta.env.DEV ||
    (typeof window !== "undefined" &&
      window.location.hostname.endsWith(".vercel.app"));

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
          <div style={styles.brandWrap}>
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
              <div style={styles.slogan}>{t.slogan}</div>
            </div>
          </div>

          <div style={styles.headerActions}>
            <div style={styles.langSwitcher}>
              <button
                type="button"
                onClick={() => setLang("es")}
                style={{
                  ...styles.langButton,
                  ...(lang === "es" ? styles.langButtonActive : {}),
                }}
              >
                ES
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                style={{
                  ...styles.langButton,
                  ...(lang === "en" ? styles.langButtonActive : {}),
                }}
              >
                EN
              </button>
            </div>

            <a href="https://app.pin-ngo.com/login" style={styles.linkGhost}>
              {t.navLogin}
            </a>

            <a href="https://app.pin-ngo.com/signup" style={styles.linkPrimary}>
              {t.navSignup}
            </a>
          </div>
        </div>
      </header>

      <main>
        <section style={styles.heroSection}>
          <div style={styles.heroContainer}>
            <div style={styles.badge}>{t.heroBadge}</div>

            <h1 style={styles.heroTitle}>{t.heroTitle}</h1>

            <p style={styles.heroSubtitle}>{t.heroSubtitle}</p>

            <div style={styles.heroOutcomeGrid} aria-label={t.heroBadge}>
              {t.heroOutcomes.map(([title, text]) => (
                <div key={title} style={styles.heroOutcomeCard}>
                  <strong style={styles.heroOutcomeTitle}>{title}</strong>
                  <span style={styles.heroOutcomeText}>{text}</span>
                </div>
              ))}
            </div>

            <div style={styles.priceGroup}>
              <div style={styles.priceLine}>
                {t.heroPricePrefix} <strong>{t.heroPriceLocks}</strong>
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  color: "#059669",
                  fontWeight: 700,
                }}
              >
                {lang === "es"
                  ? "Ahorra 20% con facturación anual"
                  : "Save 20% with yearly billing"}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  color: "#047857",
                  fontWeight: 600,
                }}
              >
                {lang === "es"
                  ? "$36 por cerradura al año"
                  : "$36 per lock per year"}
              </div>

              <div style={{ marginTop: 12 }}>
                <div
                  style={{
                    fontSize: 15,
                    color: "#475569",
                    marginBottom: 6,
                  }}
                >
                  {lang === "es"
                    ? "Convierte cada propiedad en una operación inteligente: controla aire acondicionado, luces y                alarmas automáticamente según la reserva."
                    : "Turn every property into a smart operation: automate AC, lights, and alarms based on reservations."}
                </div>

                <div style={styles.priceLineSecondary}>
                  {t.heroPriceSmart}
                </div>
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: "#6b7280",
                }}
              >
                {lang === "es"
                  ? "Puedes comenzar directamente con Pin&Go o conectar un PMS compatible si ya lo utilizas."
                  : "Start directly with Pin&Go or connect a compatible PMS if you already use one."}
              </div>
            </div>

            <div style={styles.ctaRow}>
              <a href="https://app.pin-ngo.com/signup" style={styles.ctaPrimary}>
                {t.heroCtaPrimary}
              </a>

              <a href="https://app.pin-ngo.com/login" style={styles.ctaSecondary}>
                {t.heroCtaSecondary}
              </a>
            </div>

            <p style={styles.heroTrust}>{t.heroTrust}</p>
          </div>
        </section>

        <section style={styles.searchSection} aria-labelledby="stay-search-title">
          <div style={styles.searchPanel}>
            <div style={styles.searchHeading}>
              <div style={styles.searchEyebrow}>{t.searchEyebrow}</div>
              <h2 id="stay-search-title" style={styles.searchTitle}>
                {t.searchTitle}
              </h2>
              <p style={styles.searchText}>{t.searchText}</p>
            </div>

            <form
              style={styles.searchForm}
              onSubmit={(event) => {
                event.preventDefault();
                setSearchPrepared(true);
              }}
            >
              <label style={styles.searchField}>
                <span style={styles.searchLabel}>{t.searchLocation}</span>
                <input
                  type="search"
                  value={staySearch.location}
                  placeholder={t.searchLocationPlaceholder}
                  onChange={(event) => {
                    setStaySearch((current) => ({
                      ...current,
                      location: event.target.value,
                    }));
                    setSearchPrepared(false);
                  }}
                  style={styles.searchInput}
                  required
                />
              </label>

              <label style={styles.searchField}>
                <span style={styles.searchLabel}>{t.searchCheckIn}</span>
                <input
                  type="date"
                  min={today}
                  value={staySearch.checkIn}
                  onChange={(event) => {
                    const checkIn = event.target.value;
                    setStaySearch((current) => ({
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
                  style={styles.searchInput}
                  required
                />
              </label>

              <label style={styles.searchField}>
                <span style={styles.searchLabel}>{t.searchCheckOut}</span>
                <input
                  type="date"
                  min={minimumCheckOut}
                  value={staySearch.checkOut}
                  onChange={(event) => {
                    setStaySearch((current) => ({
                      ...current,
                      checkOut: event.target.value,
                    }));
                    setSearchPrepared(false);
                  }}
                  style={styles.searchInput}
                  required
                />
              </label>

              <label style={styles.searchField}>
                <span style={styles.searchLabel}>{t.searchGuests}</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={staySearch.guests}
                  onChange={(event) => {
                    setStaySearch((current) => ({
                      ...current,
                      guests: event.target.value,
                    }));
                    setSearchPrepared(false);
                  }}
                  style={styles.searchInput}
                  required
                />
              </label>

              <button type="submit" style={styles.searchButton}>
                {t.searchCta}
              </button>
            </form>

            {searchPrepared && (
              <p role="status" aria-live="polite" style={styles.searchStatus}>
                {t.searchPrepared}
              </p>
            )}
          </div>
        </section>

        <section style={styles.sectionAlt}>
          <div style={styles.containerNarrow}>
            <h2 style={styles.sectionTitle}>
              {lang === "es"
                ? "¿Prefieres ayuda configurando Pin&Go?"
                : "Prefer help setting up Pin&Go?"}
            </h2>

            <p style={styles.sectionText}>
              {lang === "es"
                ? "Nuestro equipo puede ayudarte a configurar Pin&Go, TTLock, propiedades, dispositivos inteligentes, automatizaciones y cualquier integración compatible que ya utilices."
                : "Our team can help configure Pin&Go, TTLock, properties, smart devices, automations, and any compatible integration you already use."}
            </p>

             <div
  style={{
    marginTop: 24,
    display: "flex",
    gap: 12,
    justifyContent: "center",
    flexWrap: "wrap",
  }}
>
 <button
  onClick={() => {
    setBookingType("onboarding");
    setOpenBooking(true);
  }}
  style={styles.ctaPrimary}
>
  {lang === "es" ? "Agendar onboarding" : "Book onboarding"}
</button>

<button
  onClick={() => {
    setBookingType("demo");
    setOpenBooking(true);
  }}
  style={styles.ctaSecondary}
>
  {lang === "es"
    ? "Agendar llamada"
    : "Book call"}
</button>
</div>

         </div>
        </section>

        <section style={styles.sectionAlt}>
          <div style={styles.container}>
            <h2 style={styles.sectionTitle}>{t.sectionBenefitsTitle}</h2>

            <div style={styles.featureGrid}>
              <FeatureCard title={t.benefit1Title} text={t.benefit1Text} />
              <FeatureCard title={t.benefit2Title} text={t.benefit2Text} />
              <FeatureCard title={t.benefit3Title} text={t.benefit3Text} />
              <FeatureCard title={t.benefit4Title} text={t.benefit4Text} />
            </div>
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.containerNarrow}>
            <h2 style={styles.sectionTitle}>{t.sectionDifferentiationTitle}</h2>
            <p style={styles.sectionText}>{t.sectionDifferentiationText}</p>
          </div>
        </section>

        <section style={styles.sectionAlt}>
          <div style={styles.container}>
            <h2 style={styles.sectionTitle}>{t.sectionPainTitle}</h2>

            <div style={styles.painGrid}>
              <PainCard text={t.pain1} />
              <PainCard text={t.pain2} />
              <PainCard text={t.pain3} />
              <PainCard text={t.pain4} />
            </div>
          </div>
        </section>
       <section style={styles.section}>
  <div style={styles.container}>
    <h2 style={styles.sectionTitle}>{t.sectionPricingTitle}</h2>

    <div style={styles.pricingGrid}>
      <div style={styles.pricingCard}>
        <h3 style={styles.pricingTitle}>{t.pricingLocksTitle}</h3>
        <div style={styles.pricingPrice}>{t.pricingLocksPrice}</div>
        <div style={styles.pricingPeriod}>{t.pricingLocksPeriod}</div>

        <ul style={styles.featureList}>
          <li>{t.pricingLocksFeature1}</li>
          <li>{t.pricingLocksFeature2}</li>
          <li>{t.pricingLocksFeature3}</li>
          <li>{t.pricingLocksFeature4}</li>
          <li style={styles.highlightListItem}>{t.pricingLocksFeature5}</li>
        </ul>

        <a href="https://app.pin-ngo.com/signup" style={styles.cardButton}>
          {t.pricingLocksCta}
        </a>
      </div>

      <div style={styles.pricingCard}>
        <h3 style={styles.pricingTitle}>{t.pricingSmartTitle}</h3>
        <div style={styles.pricingPrice}>{t.pricingSmartPrice}</div>
        <div style={styles.pricingPeriod}>{t.pricingSmartPeriod}</div>

        <ul style={styles.featureList}>
          <li>{t.pricingSmartFeature1}</li>
          <li>{t.pricingSmartFeature2}</li>
          <li>{t.pricingSmartFeature3}</li>
          <li>{t.pricingSmartFeature4}</li>
          <li style={styles.highlightListItem}>{t.pricingSmartFeature5}</li>
        </ul>

        <a href="https://app.pin-ngo.com/signup" style={styles.cardButton}>
          {t.pricingSmartCta}
        </a>
      </div>
    </div>

   <p style={styles.compatibilityNote}>
  {lang === "es"
    ? "Las funciones de automatización inteligente de Pin&Go requieren cerraduras inteligentes y hardware compatibles."
    : "Pin&Go smart automation features require compatible smart locks and supported hardware integrations."}
</p>
    <div style={styles.exampleBox}>
      <h3 style={styles.exampleTitle}>{t.exampleTitle}</h3>
      <p style={styles.exampleText}>
        {lang === "es"
          ? "2 cerraduras = $29.98 / mes"
          : "2 locks = $29.98 / month"}
      </p>

      <p style={styles.exampleText}>
        {lang === "es"
          ? "1 propiedad inteligente = $14.99 / mes"
          : "1 smart property = $14.99 / month"}
      </p>

      <p style={styles.exampleTotal}>
        {lang === "es"
          ? "Total = $44.97 / mes"
          : "Total = $44.97 / month"}
      </p>
    </div>
  </div>
</section>

      <HaasConfigurator
  lang={lang}
  onScheduleCall={() => {
    setBookingType("demo");
    setOpenBooking(true);
  }}
/>
         <section style={styles.sectionAlt}>
          <div style={styles.containerNarrow}>
            <h2 style={styles.sectionTitle}>{t.faqTitle}</h2>

            <div style={styles.faqList}>
              <FaqItem question={t.faq1Q} answer={t.faq1A} />
              <FaqItem question={t.faq2Q} answer={t.faq2A} />
              <FaqItem question={t.faq3Q} answer={t.faq3A} />
              <FaqItem question={t.faq4Q} answer={t.faq4A} />
            </div>
          </div>
        </section>

        <section style={styles.finalSection}>
          <div style={styles.containerNarrow}>
            <h2 style={styles.finalTitle}>{t.finalTitle}</h2>
            <p style={styles.finalSubtitle}>{t.finalSubtitle}</p>

            <a href="https://app.pin-ngo.com/signup" style={styles.finalButton}>
              {t.finalCta}
            </a>
          </div>
        </section>
      </main>
   <footer style={styles.footer}>
  <div style={styles.container}>
    <div>{t.footerText}</div>

    <div
      style={{
        marginTop: 8,
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        justifyContent: "center",
      }}
    >
      <Link
        to="/legal/terms"
        style={{
          color: "#64748b",
          textDecoration: "none",
        }}
      >
        Terms
      </Link>

      <Link
        to="/legal/privacy"
        style={{
          color: "#64748b",
          textDecoration: "none",
        }}
      >
        Privacy
      </Link>

      <Link
        to="/legal/support-policy"
        style={{
          color: "#64748b",
          textDecoration: "none",
        }}
      >
        Support Policy
      </Link>

      <Link
        to="/legal/billing-policy"
        style={{
          color: "#64748b",
          textDecoration: "none",
        }}
      >
        Billing Policy
      </Link>
    </div>
  </div>

  <OnboardingBookingModal
    isOpen={openBooking}
    onClose={() => setOpenBooking(false)}
    lang={lang}
    bookingType={bookingType}
    initialTopic={
      bookingType === "demo"
        ? lang === "es"
          ? "Demostración de Pin&Go APMS y hardware"
          : "Pin&Go APMS and hardware demonstration"
        : lang === "es"
          ? "Configuración de Pin&Go, TTLock y hardware"
          : "Pin&Go, TTLock, and hardware setup"
    }
    previewOnly={isVisualPreview}
  />
</footer>
     </div>
  );
}
function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div style={styles.featureCard}>
      <h3 style={styles.featureTitle}>{title}</h3>
      <p style={styles.featureText}>{text}</p>
    </div>
  );
}

function PainCard({ text }: { text: string }) {
  return (
    <div style={styles.painCard}>
      <span style={styles.painIcon}>•</span>
      <span>{text}</span>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div style={styles.faqItem}>
      <h3 style={styles.faqQuestion}>{question}</h3>
      <p style={styles.faqAnswer}>{answer}</p>
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
    flexWrap: "wrap",
  },
  brandWrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
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
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  langSwitcher: {
    display: "flex",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    overflow: "hidden",
  },
  langButton: {
    padding: "8px 12px",
    border: "none",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    color: "#334155",
  },
  langButtonActive: {
    background: "#0f172a",
    color: "#fff",
  },
  linkGhost: {
    textDecoration: "none",
    color: "#0f172a",
    padding: "10px 14px",
    borderRadius: 10,
    fontWeight: 600,
  },
  linkPrimary: {
    textDecoration: "none",
    background: "#0f172a",
    color: "#ffffff",
    padding: "10px 16px",
    borderRadius: 10,
    fontWeight: 700,
  },
  heroSection: {
    padding: "84px 20px 72px",
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
    fontSize: "clamp(2.2rem, 5vw, 4rem)",
    lineHeight: 1.05,
    fontWeight: 800,
    margin: 0,
  },
  heroSubtitle: {
    maxWidth: 760,
    margin: "22px auto 0",
    fontSize: 19,
    lineHeight: 1.7,
    color: "#475569",
  },
  heroOutcomeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 12,
    marginTop: 28,
    textAlign: "left",
  },
  heroOutcomeCard: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    border: "1px solid #dbe5eb",
    borderRadius: 14,
    background: "rgba(255, 255, 255, 0.82)",
    padding: "16px 18px",
    boxShadow: "0 10px 28px rgba(15, 23, 42, 0.045)",
  },
  heroOutcomeTitle: {
    color: "#0f766e",
    fontSize: 15,
    fontWeight: 800,
  },
  heroOutcomeText: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.55,
  },
  priceGroup: {
    marginTop: 28,
  },
  priceLine: {
    fontSize: 24,
    color: "#0f172a",
  },
  priceLineSecondary: {
    marginTop: 8,
    fontSize: 18,
    color: "#475569",
  },
  ctaRow: {
    marginTop: 30,
    display: "flex",
    justifyContent: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  ctaPrimary: {
    textDecoration: "none",
    background: "#0f172a",
    color: "#fff",
    padding: "14px 22px",
    borderRadius: 12,
    fontWeight: 700,
  },
  ctaSecondary: {
    textDecoration: "none",
    background: "#fff",
    color: "#0f172a",
    padding: "14px 22px",
    borderRadius: 12,
    fontWeight: 700,
    border: "1px solid #cbd5e1",
  },
  heroTrust: {
    marginTop: 14,
    color: "#64748b",
    fontSize: 14,
  },
  searchSection: {
    padding: "0 20px 34px",
    background: "#f8fafc",
  },
  searchPanel: {
    maxWidth: 1120,
    margin: "0 auto",
    border: "1px solid #dbe5eb",
    borderRadius: 22,
    background: "#ffffff",
    padding: "28px clamp(20px, 4vw, 38px)",
    boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
  },
  searchHeading: {
    maxWidth: 720,
  },
  searchEyebrow: {
    color: "#047857",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  searchTitle: {
    margin: "8px 0 0",
    color: "#0f172a",
    fontSize: "clamp(1.7rem, 3vw, 2.25rem)",
    lineHeight: 1.15,
  },
  searchText: {
    margin: "10px 0 0",
    color: "#475569",
    fontSize: 16,
    lineHeight: 1.65,
  },
  searchForm: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    alignItems: "end",
    gap: 12,
    marginTop: 24,
  },
  searchField: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
  searchLabel: {
    color: "#334155",
    fontSize: 14,
    fontWeight: 700,
  },
  searchInput: {
    boxSizing: "border-box",
    width: "100%",
    minHeight: 48,
    border: "1px solid #cbd5e1",
    borderRadius: 11,
    background: "#ffffff",
    padding: "11px 13px",
    color: "#0f172a",
    fontSize: 16,
  },
  searchButton: {
    minHeight: 48,
    border: 0,
    borderRadius: 11,
    background: "#0f172a",
    padding: "12px 18px",
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
  },
  searchStatus: {
    margin: "14px 0 0",
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.5,
  },
  section: {
    padding: "80px 20px",
  },
  sectionAlt: {
    padding: "80px 20px",
    background: "#f8fafc",
  },
  container: {
    maxWidth: 1200,
    margin: "0 auto",
  },
  containerNarrow: {
    maxWidth: 860,
    margin: "0 auto",
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: "clamp(1.8rem, 4vw, 2.4rem)",
    fontWeight: 800,
    margin: 0,
    textAlign: "center",
  },
  sectionText: {
    fontSize: 18,
    lineHeight: 1.8,
    color: "#475569",
    marginTop: 18,
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 20,
    marginTop: 36,
  },
  featureCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 24,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
  },
  featureTitle: {
    margin: 0,
    fontSize: 20,
  },
  featureText: {
    marginTop: 12,
    color: "#475569",
    lineHeight: 1.7,
    fontSize: 15,
  },
  painGrid: {
    marginTop: 36,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
  },
  painCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 18,
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    lineHeight: 1.6,
  },
  painIcon: {
    color: "#dc2626",
    fontWeight: 700,
    fontSize: 20,
    lineHeight: 1,
  },
 pricingGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 520px))",
  gap: 24,
  marginTop: 40,
  justifyContent: "center",
},
  pricingCard: {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 32,
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
  textAlign: "center",
},
  pricingTitle: {
    fontSize: 24,
    margin: 0,
  },
  pricingPrice: {
    marginTop: 18,
    fontSize: 42,
    fontWeight: 800,
  },
  pricingPeriod: {
    marginTop: 4,
    color: "#64748b",
  },
  featureList: {
    marginTop: 22,
    marginBottom: 24,
    paddingLeft: 18,
    color: "#334155",
    lineHeight: 1.9,
    listStylePosition: "inside",
    textAlign: "left",
    maxWidth: 320,
    marginInline: "auto",
  },
  highlightListItem: {
    color: "#16a34a",
    fontWeight: 700,
  },
  cardButton: {
    display: "inline-block",
    textDecoration: "none",
    background: "#0f172a",
    color: "#fff",
    padding: "12px 18px",
    borderRadius: 12,
    fontWeight: 700,
  },
  exampleBox: {
    marginTop: 34,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 18,
    padding: 24,
    textAlign: "center",
    maxWidth: 720,
    marginInline: "auto",
  },
  exampleTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
  },
  exampleText: {
    margin: "10px 0 0",
    color: "#334155",
    fontSize: 17,
  },
  exampleTotal: {
    margin: "14px 0 0",
    fontSize: 20,
    fontWeight: 800,
    color: "#0f172a",
  },
  compatibilityNote: {
  marginTop: 28,
  marginBottom: 0,
  textAlign: "center",
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.7,
  maxWidth: 760,
  marginInline: "auto",
},
  faqList: {
    marginTop: 36,
    display: "grid",
    gap: 18,
    textAlign: "left",
  },
  faqItem: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 22,
  },
  faqQuestion: {
    margin: 0,
    fontSize: 18,
  },
  faqAnswer: {
    marginTop: 10,
    color: "#475569",
    lineHeight: 1.7,
  },
  finalSection: {
    padding: "90px 20px",
    background: "#0f172a",
    color: "#fff",
    textAlign: "center",
  },
  finalTitle: {
    margin: 0,
    fontSize: "clamp(2rem, 4vw, 3rem)",
    fontWeight: 800,
  },
  finalSubtitle: {
    marginTop: 16,
    color: "#cbd5e1",
    fontSize: 18,
    lineHeight: 1.7,
  },
  finalButton: {
    display: "inline-block",
    marginTop: 26,
    textDecoration: "none",
    background: "#fff",
    color: "#0f172a",
    padding: "14px 24px",
    borderRadius: 12,
    fontWeight: 800,
  },
  footer: {
    borderTop: "1px solid #e2e8f0",
    padding: "24px 20px",
    color: "#64748b",
    fontSize: 14,
    background: "#fff",
  },
};
