import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CalendarCheck2,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  KeyRound,
  MessageSquareText,
  RadioTower,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wrench,
} from "lucide-react";
import OnboardingBookingModal from "../components/OnboardingBookingModal";
import "./LandingPage.css";

type Lang = "es" | "en";
type BookingIntent = "demo" | "activation" | "hardware";

const capabilityIcons = [
  CalendarCheck2,
  CircleDollarSign,
  MessageSquareText,
  KeyRound,
  Wrench,
  Activity,
];

const content = {
  es: {
    metaTitle: "Pin&Go APMS | La rutina opera. Tú mantienes el control.",
    metaDescription:
      "Pin&Go es un APMS que coordina reservas, huéspedes, pagos directos, limpieza y acceso inteligente bajo las reglas de tu propiedad.",
    skip: "Saltar al contenido",
    navLabel: "Navegación principal",
    nav: {
      difference: "Por qué APMS",
      operation: "Cómo opera",
      capabilities: "Capacidades",
      pricing: "Precio",
    },
    login: "Iniciar sesión",
    navCta: "Solicitar demostración",
    menu: "Menú",
    language: "Seleccionar idioma",
    outcomesLabel: "Resultados principales de Pin&Go",
    hero: {
      eyebrow: "APMS · Autonomous Property Management System",
      title: "Pin&Go opera la rutina.",
      accent: "Tú mantienes el control.",
      subtitle:
        "Centraliza reservas directas, manuales y de canales conectados; coordina huéspedes, cobros directos, limpieza y acceso inteligente. Pin&Go opera dentro de tus reglas y te involucra cuando una excepción requiere criterio.",
      independent: "No necesitas otro PMS para comenzar.",
      primaryCta: "Ver Pin&Go en acción",
      secondaryCta: "Hablar de activación",
      price: "Software desde $39.99 USD al mes",
      priceNote: "Hardware opcional · Configuración guiada",
      outcomes: [
        ["Menos tareas manuales", "Pin&Go coordina el trabajo rutinario."],
        ["Resultados visibles", "Cada paso queda verificable en la operación."],
        ["Humano por excepción", "Intervienes cuando realmente hace falta."],
      ],
    },
    demo: {
      label: "DEMO SIMULADA · EJEMPLO DE RECORRIDO",
      property: "Propiedad demo",
      state: "Operación en curso",
      progress: "4 de 4 acciones coordinadas",
      steps: [
        ["Reserva detectada", "Activa"],
        ["Reglas verificadas", "Confirmado"],
        ["Acceso coordinado", "Listo"],
        ["Mensaje al huésped", "Programado"],
      ],
      footer: "Acciones rutinarias coordinadas",
    },
    intro: {
      eyebrow: "Una categoría distinta",
      title: "Un PMS organiza información. Un APMS coordina la operación.",
      text:
        "Pin&Go reúne contexto, reglas y acciones para que la propiedad avance sin depender de que una persona conecte cada paso manualmente.",
    },
    comparison: {
      feature: "En la operación diaria",
      pms: "PMS tradicional",
      apms: "Pin&Go APMS",
      pmsMobile: "PMS tradicional",
      apmsMobile: "Pin&Go APMS",
      rows: [
        ["Reservas", "Centraliza calendarios y datos.", "Detecta eventos y activa flujos definidos."],
        ["Trabajo operativo", "Te muestra lo que debes atender.", "Coordina acciones rutinarias dentro de tus reglas."],
        ["Herramientas", "Requiere operar varias piezas por separado.", "Conecta reservas, comunicaciones, limpieza y acceso."],
        ["Excepciones", "Dependen del seguimiento manual.", "Registra, intenta recuperar flujos elegibles y escala lo importante."],
      ],
    },
    cycle: {
      eyebrow: "El ciclo APMS",
      title: "De una señal a un resultado verificable",
      text:
        "Cada recorrido sigue un ciclo operativo trazable. Las reglas y las integraciones activas determinan qué puede ejecutarse automáticamente.",
      steps: [
        ["01", "Detecta", "Identifica una reserva, cambio o excepción."],
        ["02", "Decide", "Evalúa contexto, estado y reglas configuradas."],
        ["03", "Ejecuta", "Coordina la acción permitida para ese flujo."],
        ["04", "Verifica", "Confirma el resultado disponible."],
        ["05", "Recupera", "Reintenta de forma segura cuando el flujo es elegible."],
        ["06", "Registra", "Conserva evidencia para control y seguimiento."],
      ],
    },
    capabilities: {
      eyebrow: "Una operación conectada",
      title: "Las piezas esenciales, coordinadas desde un solo APMS",
      text:
        "Empieza con la operación directa de Pin&Go y añade conexiones compatibles según las necesidades de cada propiedad.",
      items: [
        ["Reservas y distribución", "Gestiona reservas directas y manuales; incorpora canales conectados cuando la distribución está activa y configurada."],
        ["Tarifas y pagos directos", "Aplica reglas de precios, prepara cotizaciones y procesa pagos directos mediante la configuración de Stripe."],
        ["Comunicación con huéspedes", "Coordina mensajes programados por email y SMS en los flujos que estén habilitados."],
        ["Acceso inteligente", "Programa códigos y recorridos NFC con cerraduras y hardware TTLock compatibles."],
        ["Coordinación de limpieza", "Organiza notificaciones, confirmaciones y acceso del personal según las reglas configuradas."],
        ["Mission Control", "Expone estado, incidencias, reintentos elegibles e historial para que sepas qué ocurrió."],
      ],
      note:
        "La disponibilidad de cada capacidad depende de la configuración, las integraciones activas, la conectividad y el hardware compatible.",
    },
    control: {
      eyebrow: "Autonomía gobernada",
      title: "Automatización con límites claros, evidencia y escalamiento",
      text:
        "La autonomía útil no significa perder el control. Significa definir cómo debe operar la propiedad y recibir atención solo cuando el sistema necesita una decisión humana.",
      principles: [
        ["Tus reglas primero", "La propiedad opera dentro de parámetros configurados."],
        ["Verificación después de actuar", "El sistema conserva el resultado disponible de cada paso."],
        ["Recuperación segura", "Los flujos elegibles pueden reintentarse sin duplicar acciones."],
        ["Escalamiento con contexto", "Las excepciones importantes llegan con información para decidir."],
      ],
      panelLabel: "VISTA ILUSTRATIVA · MISSION CONTROL",
      panelTitle: "La operación, explicada",
      panelSubtitle: "Propiedad demo · Última evaluación ahora",
      metrics: [
        ["Rutina", "Operando", "good"],
        ["Excepciones", "1 en revisión", "watch"],
        ["Evidencia", "Actualizada", "good"],
      ],
      issueLabel: "Requiere criterio humano",
      issueTitle: "Cambio de acceso fuera de la regla definida",
      issueText: "Pin&Go detuvo la acción y conservó el contexto para revisión.",
    },
    pricing: {
      eyebrow: "Precio claro para comenzar",
      title: "El APMS de Pin&Go desde $39.99 al mes",
      text: "Comienza con el software y configura el hardware solo cuando tu operación lo necesite.",
      plan: "Pin&Go APMS",
      from: "Desde",
      amount: "$39.99",
      period: "USD / mes",
      tax: "+ 11.5% de IVU en Puerto Rico",
      total: "Desde $44.59 USD mensuales con IVU",
      includesTitle: "Software base",
      includes: [
        "Operación directa sin requerir otro PMS",
        "Flujos APMS configurables",
        "Mission Control e historial operativo",
        "Onboarding guiado",
      ],
      primaryCta: "Hablar de activación",
      hardwareTitle: "Hardware opcional",
      hardwareText:
        "Cerraduras, tarjetas NFC, gateways e instalación se cotizan por separado según la propiedad y la compatibilidad requerida.",
      hardwareNote:
        "El precio del hardware puede variar. Servicios externos y cargos de proveedores no están incluidos en el software base.",
      hardwareCta: "Evaluar hardware",
    },
    faq: {
      eyebrow: "Respuestas directas",
      title: "Preguntas frecuentes",
      items: [
        ["¿Qué significa APMS?", "Es un Autonomous Property Management System: además de centralizar información, coordina acciones rutinarias, verifica resultados y eleva excepciones según reglas definidas."],
        ["¿Necesito contratar otro PMS?", "No para comenzar con reservas directas y manuales. Los canales externos requieren que la distribución compatible esté activa y configurada."],
        ["¿Pin&Go funciona con cualquier cerradura o canal?", "No de forma universal. El acceso requiere hardware TTLock compatible y la distribución depende de los canales e integraciones habilitados para la cuenta."],
        ["¿Qué permanece bajo mi control?", "Tú defines parámetros como reglas, políticas y decisiones críticas. Pin&Go coordina la rutina dentro de esos límites y te involucra ante excepciones."],
        ["¿Cuánto cuesta comenzar?", "El software comienza en $39.99 USD al mes, más 11.5% de IVU en Puerto Rico. El hardware es opcional y se cotiza por separado."],
      ],
    },
    final: {
      eyebrow: "Tu propiedad. Tus reglas. Menos rutina.",
      title: "Veamos si Pin&Go encaja con tu operación.",
      text: "Agenda una conversación guiada y recorre cómo un APMS puede coordinar el día a día de tu propiedad.",
      demoCta: "Solicitar demostración",
      activationCta: "Hablar de activación",
    },
    footer: {
      tagline: "APMS para operaciones modernas de renta a corto plazo.",
      terms: "Términos",
      privacy: "Privacidad",
      support: "Soporte",
      billing: "Facturación",
      rights: "Todos los derechos reservados.",
      legalLabel: "Enlaces legales",
    },
    bookingTopics: {
      demo: "Demostración del APMS de Pin&Go",
      activation: "Activación del software Pin&Go APMS",
      hardware: "Evaluación de hardware compatible para la propiedad",
    },
  },
  en: {
    metaTitle: "Pin&Go APMS | The routine runs. You stay in control.",
    metaDescription:
      "Pin&Go is an APMS that coordinates reservations, guests, direct payments, cleaning, and smart access under your property's rules.",
    skip: "Skip to content",
    navLabel: "Main navigation",
    nav: { difference: "Why APMS", operation: "How it works", capabilities: "Capabilities", pricing: "Pricing" },
    login: "Log in",
    navCta: "Request a demo",
    menu: "Menu",
    language: "Select language",
    outcomesLabel: "Key Pin&Go outcomes",
    hero: {
      eyebrow: "APMS · Autonomous Property Management System",
      title: "Pin&Go runs the routine.",
      accent: "You stay in control.",
      subtitle:
        "Centralize direct, manual, and connected-channel reservations; coordinate guests, direct payments, cleaning, and smart access. Pin&Go operates within your rules and brings you in when an exception requires judgment.",
      independent: "You do not need another PMS to get started.",
      primaryCta: "See Pin&Go in action",
      secondaryCta: "Discuss activation",
      price: "Software from $39.99 USD per month",
      priceNote: "Optional hardware · Guided setup",
      outcomes: [
        ["Fewer manual tasks", "Pin&Go coordinates routine work."],
        ["Visible outcomes", "Every step remains verifiable in the operation."],
        ["Human by exception", "You step in when it genuinely matters."],
      ],
    },
    demo: {
      label: "SIMULATED DEMO · EXAMPLE WORKFLOW",
      property: "Demo property",
      state: "Operation in progress",
      progress: "4 of 4 actions coordinated",
      steps: [
        ["Reservation detected", "Active"],
        ["Rules checked", "Confirmed"],
        ["Access coordinated", "Ready"],
        ["Guest message", "Scheduled"],
      ],
      footer: "Routine actions coordinated",
    },
    intro: {
      eyebrow: "A different category",
      title: "A PMS organizes information. An APMS coordinates the operation.",
      text: "Pin&Go brings context, rules, and actions together so the property can move forward without relying on a person to connect every step manually.",
    },
    comparison: {
      feature: "In daily operations",
      pms: "Traditional PMS",
      apms: "Pin&Go APMS",
      pmsMobile: "Traditional PMS",
      apmsMobile: "Pin&Go APMS",
      rows: [
        ["Reservations", "Centralizes calendars and data.", "Detects events and starts defined workflows."],
        ["Operational work", "Shows you what needs attention.", "Coordinates routine actions within your rules."],
        ["Tools", "Requires multiple pieces to be operated separately.", "Connects reservations, communications, cleaning, and access."],
        ["Exceptions", "Depend on manual follow-up.", "Records, attempts recovery for eligible flows, and escalates what matters."],
      ],
    },
    cycle: {
      eyebrow: "The APMS cycle",
      title: "From a signal to a verifiable outcome",
      text: "Every workflow follows a traceable operational cycle. Rules and active integrations determine what can be executed automatically.",
      steps: [
        ["01", "Detect", "Identify a reservation, change, or exception."],
        ["02", "Decide", "Evaluate context, state, and configured rules."],
        ["03", "Execute", "Coordinate the permitted action for that workflow."],
        ["04", "Verify", "Confirm the available result."],
        ["05", "Recover", "Retry safely when the workflow is eligible."],
        ["06", "Record", "Preserve evidence for control and follow-up."],
      ],
    },
    capabilities: {
      eyebrow: "A connected operation",
      title: "The essential pieces, coordinated from one APMS",
      text: "Start with Pin&Go's direct operation and add compatible connections based on each property's needs.",
      items: [
        ["Reservations and distribution", "Manage direct and manual reservations; add connected channels when distribution is active and configured."],
        ["Rates and direct payments", "Apply pricing rules, prepare quotes, and process direct payments through the Stripe configuration."],
        ["Guest communications", "Coordinate scheduled email and SMS messages for enabled workflows."],
        ["Smart access", "Schedule codes and NFC workflows with compatible TTLock locks and hardware."],
        ["Cleaning coordination", "Organize notifications, confirmations, and staff access according to configured rules."],
        ["Mission Control", "Surface status, issues, eligible retries, and history so you know what happened."],
      ],
      note: "Availability of each capability depends on configuration, active integrations, connectivity, and compatible hardware.",
    },
    control: {
      eyebrow: "Governed autonomy",
      title: "Automation with clear limits, evidence, and escalation",
      text: "Useful autonomy does not mean losing control. It means defining how the property should operate and being called in only when the system needs a human decision.",
      principles: [
        ["Your rules first", "The property operates within configured parameters."],
        ["Verification after action", "The system retains the available outcome of each step."],
        ["Safe recovery", "Eligible workflows can retry without duplicating actions."],
        ["Escalation with context", "Important exceptions arrive with information for a decision."],
      ],
      panelLabel: "ILLUSTRATIVE VIEW · MISSION CONTROL",
      panelTitle: "The operation, explained",
      panelSubtitle: "Demo property · Last evaluation just now",
      metrics: [
        ["Routine", "Operating", "good"],
        ["Exceptions", "1 under review", "watch"],
        ["Evidence", "Current", "good"],
      ],
      issueLabel: "Human judgment required",
      issueTitle: "Access change outside the defined rule",
      issueText: "Pin&Go stopped the action and retained context for review.",
    },
    pricing: {
      eyebrow: "Clear starting price",
      title: "Pin&Go APMS from $39.99 per month",
      text: "Start with the software and configure hardware only when your operation needs it.",
      plan: "Pin&Go APMS",
      from: "From",
      amount: "$39.99",
      period: "USD / month",
      tax: "+ 11.5% Puerto Rico sales and use tax",
      total: "From $44.59 USD monthly with Puerto Rico tax",
      includesTitle: "Core software",
      includes: [
        "Direct operation without requiring another PMS",
        "Configurable APMS workflows",
        "Mission Control and operational history",
        "Guided onboarding",
      ],
      primaryCta: "Discuss activation",
      hardwareTitle: "Optional hardware",
      hardwareText: "Locks, NFC cards, gateways, and installation are quoted separately based on the property and required compatibility.",
      hardwareNote: "Hardware pricing may vary. External services and provider fees are not included in the core software.",
      hardwareCta: "Evaluate hardware",
    },
    faq: {
      eyebrow: "Straight answers",
      title: "Frequently asked questions",
      items: [
        ["What does APMS mean?", "It is an Autonomous Property Management System: beyond centralizing information, it coordinates routine actions, verifies outcomes, and raises exceptions according to defined rules."],
        ["Do I need another PMS?", "Not to start with direct and manual reservations. External channels require compatible distribution to be active and configured."],
        ["Does Pin&Go work with every lock or channel?", "Not universally. Access requires compatible TTLock hardware, and distribution depends on the channels and integrations enabled for the account."],
        ["What remains under my control?", "You define parameters such as rules, policies, and critical decisions. Pin&Go coordinates the routine within those limits and brings you in for exceptions."],
        ["How much does it cost to start?", "Software starts at $39.99 USD per month, plus 11.5% sales and use tax in Puerto Rico. Hardware is optional and quoted separately."],
      ],
    },
    final: {
      eyebrow: "Your property. Your rules. Less routine.",
      title: "Let's see whether Pin&Go fits your operation.",
      text: "Schedule a guided conversation and explore how an APMS can coordinate your property's day-to-day work.",
      demoCta: "Request a demo",
      activationCta: "Discuss activation",
    },
    footer: {
      tagline: "APMS for modern short-term rental operations.",
      terms: "Terms",
      privacy: "Privacy",
      support: "Support",
      billing: "Billing",
      rights: "All rights reserved.",
      legalLabel: "Legal links",
    },
    bookingTopics: {
      demo: "Pin&Go APMS demonstration",
      activation: "Pin&Go APMS software activation",
      hardware: "Compatible hardware assessment for the property",
    },
  },
} as const;

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>("es");
  const [openBooking, setOpenBooking] = useState(false);
  const [bookingIntent, setBookingIntent] = useState<BookingIntent>("demo");
  const [bookingSession, setBookingSession] = useState(0);
  const t = useMemo(() => content[lang], [lang]);
  const isVisualPreview =
    import.meta.env.DEV ||
    (typeof window !== "undefined" &&
      window.location.hostname.endsWith(".vercel.app"));

  useEffect(() => {
    const previousTitle = document.title;
    const previousLang = document.documentElement.lang;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.content;

    document.title = t.metaTitle;
    document.documentElement.lang = lang;

    let landingDescription = description;
    if (!landingDescription) {
      landingDescription = document.createElement("meta");
      landingDescription.name = "description";
      landingDescription.dataset.pgLanding = "true";
      document.head.appendChild(landingDescription);
    }
    landingDescription.content = t.metaDescription;

    return () => {
      document.title = previousTitle;
      document.documentElement.lang = previousLang;
      if (landingDescription?.dataset.pgLanding === "true") {
        landingDescription.remove();
      } else if (landingDescription && previousDescription !== undefined) {
        landingDescription.content = previousDescription;
      }
    };
  }, [lang, t.metaDescription, t.metaTitle]);

  const openCall = (intent: BookingIntent) => {
    setBookingIntent(intent);
    setBookingSession((current) => current + 1);
    setOpenBooking(true);
  };

  const closeMobileMenu = (event: React.MouseEvent<HTMLElement>) => {
    event.currentTarget.closest("details")?.removeAttribute("open");
  };

  return (
    <div className="pg-landing">
      <a className="pg-skip-link" href="#pg-main">{t.skip}</a>

      <header className="pg-header">
        <div className="pg-shell pg-header-inner">
          <a className="pg-brand" href="#pg-main" aria-label="Pin&Go">
            <img src="/pin-go-logo.png" alt="" aria-hidden="true" />
            <span><strong>Pin&amp;Go</strong><small>Autonomous Property Management</small></span>
          </a>

          <nav className="pg-desktop-nav" aria-label={t.navLabel}>
            <a href="#pg-difference">{t.nav.difference}</a>
            <a href="#pg-operation">{t.nav.operation}</a>
            <a href="#pg-capabilities">{t.nav.capabilities}</a>
            <a href="#pg-pricing">{t.nav.pricing}</a>
          </nav>

          <div className="pg-header-actions">
            <div className="pg-lang-switcher" aria-label={t.language} role="group">
              <button type="button" aria-pressed={lang === "es"} onClick={() => setLang("es")}>ES</button>
              <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
            </div>
            <a className="pg-login-link" href="https://app.pin-ngo.com/login">{t.login}</a>
            <button className="pg-button pg-button-small" type="button" onClick={() => openCall("demo")}>{t.navCta}</button>
          </div>

          <details className="pg-mobile-menu">
            <summary aria-label={t.menu}><span>{t.menu}</span><ChevronDown aria-hidden="true" /></summary>
            <div className="pg-mobile-menu-panel">
              <nav aria-label={t.navLabel}>
                <a href="#pg-difference" onClick={closeMobileMenu}>{t.nav.difference}</a>
                <a href="#pg-operation" onClick={closeMobileMenu}>{t.nav.operation}</a>
                <a href="#pg-capabilities" onClick={closeMobileMenu}>{t.nav.capabilities}</a>
                <a href="#pg-pricing" onClick={closeMobileMenu}>{t.nav.pricing}</a>
              </nav>
              <div className="pg-mobile-menu-bottom">
                <a href="https://app.pin-ngo.com/login">{t.login}</a>
                <button
                  type="button"
                  onClick={(event) => {
                    closeMobileMenu(event);
                    openCall("demo");
                  }}
                >
                  {t.navCta}
                </button>
              </div>
            </div>
          </details>
        </div>
      </header>

      <main id="pg-main" tabIndex={-1}>
        <section className="pg-hero" aria-labelledby="pg-hero-title">
          <div className="pg-hero-glow" aria-hidden="true" />
          <div className="pg-shell pg-hero-grid">
            <div className="pg-hero-copy">
              <p className="pg-eyebrow"><Sparkles aria-hidden="true" /> {t.hero.eyebrow}</p>
              <h1 id="pg-hero-title">{t.hero.title} <span>{t.hero.accent}</span></h1>
              <p className="pg-hero-subtitle">{t.hero.subtitle}</p>
              <p className="pg-independence"><ShieldCheck aria-hidden="true" />{t.hero.independent}</p>

              <div className="pg-hero-outcomes" aria-label={t.outcomesLabel}>
                {t.hero.outcomes.map(([title, text]) => (
                  <div key={title}>
                    <CheckCircle2 aria-hidden="true" />
                    <span><strong>{title}</strong><small>{text}</small></span>
                  </div>
                ))}
              </div>

              <div className="pg-hero-cta-row">
                <button className="pg-button" type="button" onClick={() => openCall("demo")}>{t.hero.primaryCta}<ArrowRight aria-hidden="true" /></button>
                <button className="pg-button pg-button-secondary" type="button" onClick={() => openCall("activation")}>{t.hero.secondaryCta}</button>
              </div>
              <div className="pg-price-signal"><strong>{t.hero.price}</strong><span>{t.hero.priceNote}</span></div>
            </div>

            <div className="pg-ops-demo" aria-label={t.demo.label}>
              <div className="pg-ops-demo-topline"><span>{t.demo.label}</span><i aria-hidden="true" /></div>
              <div className="pg-ops-demo-header">
                <div><p>{t.demo.property}</p><h2>{t.demo.state}</h2></div>
                <div className="pg-live-state"><RadioTower aria-hidden="true" /> APMS</div>
              </div>
              <div className="pg-progress-block">
                <div><span>{t.demo.progress}</span><strong>100%</strong></div>
                <div className="pg-progress-track"><i /></div>
              </div>
              <div className="pg-demo-steps">
                {t.demo.steps.map(([label, state], index) => (
                  <div key={label}>
                    <span className="pg-step-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="pg-step-name">{label}</span>
                    <strong><Check aria-hidden="true" />{state}</strong>
                  </div>
                ))}
              </div>
              <div className="pg-demo-footer"><ClipboardCheck aria-hidden="true" /><span>{t.demo.footer}</span><small>APMS-0428</small></div>
            </div>
          </div>
        </section>

        <section className="pg-section pg-comparison-section" id="pg-difference" aria-labelledby="pg-comparison-title">
          <div className="pg-shell">
            <div className="pg-section-heading pg-section-heading-centered">
              <p className="pg-eyebrow">{t.intro.eyebrow}</p>
              <h2 id="pg-comparison-title">{t.intro.title}</h2>
              <p>{t.intro.text}</p>
            </div>
            <div className="pg-comparison" role="table" aria-label={t.intro.title}>
              <div className="pg-comparison-row pg-comparison-head" role="row">
                <div role="columnheader">{t.comparison.feature}</div>
                <div role="columnheader">{t.comparison.pms}</div>
                <div role="columnheader"><Sparkles aria-hidden="true" />{t.comparison.apms}</div>
              </div>
              {t.comparison.rows.map(([feature, pms, apms]) => (
                <div className="pg-comparison-row" role="row" key={feature}>
                  <div role="rowheader">{feature}</div>
                  <div role="cell"><small>{t.comparison.pmsMobile}</small>{pms}</div>
                  <div role="cell"><small>{t.comparison.apmsMobile}</small><CheckCircle2 aria-hidden="true" />{apms}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pg-section pg-cycle-section" id="pg-operation" aria-labelledby="pg-cycle-title">
          <div className="pg-shell">
            <div className="pg-section-heading">
              <p className="pg-eyebrow">{t.cycle.eyebrow}</p>
              <h2 id="pg-cycle-title">{t.cycle.title}</h2>
              <p>{t.cycle.text}</p>
            </div>
            <ol className="pg-cycle-list">
              {t.cycle.steps.map(([number, title, text]) => (
                <li key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></li>
              ))}
            </ol>
          </div>
        </section>

        <section className="pg-section pg-capabilities-section" id="pg-capabilities" aria-labelledby="pg-capabilities-title">
          <div className="pg-shell">
            <div className="pg-section-heading pg-section-heading-split">
              <div><p className="pg-eyebrow">{t.capabilities.eyebrow}</p><h2 id="pg-capabilities-title">{t.capabilities.title}</h2></div>
              <p>{t.capabilities.text}</p>
            </div>
            <div className="pg-capabilities-grid">
              {t.capabilities.items.map(([title, text], index) => {
                const Icon = capabilityIcons[index];
                return <article key={title}><div className="pg-icon-box"><Icon aria-hidden="true" /></div><h3>{title}</h3><p>{text}</p></article>;
              })}
            </div>
            <p className="pg-capability-note"><ShieldCheck aria-hidden="true" />{t.capabilities.note}</p>
          </div>
        </section>

        <section className="pg-section pg-control-section" id="pg-control" aria-labelledby="pg-control-title">
          <div className="pg-shell pg-control-grid">
            <div className="pg-control-copy">
              <div className="pg-section-heading">
                <p className="pg-eyebrow">{t.control.eyebrow}</p>
                <h2 id="pg-control-title">{t.control.title}</h2>
                <p>{t.control.text}</p>
              </div>
              <div className="pg-principles">
                {t.control.principles.map(([title, text], index) => (
                  <div key={title}><span>{String(index + 1).padStart(2, "0")}</span><p><strong>{title}</strong><small>{text}</small></p></div>
                ))}
              </div>
            </div>
            <div className="pg-mission-panel" aria-label={t.control.panelLabel}>
              <div className="pg-mission-label">{t.control.panelLabel}</div>
              <div className="pg-mission-heading">
                <div><h3>{t.control.panelTitle}</h3><p>{t.control.panelSubtitle}</p></div>
                <SlidersHorizontal aria-hidden="true" />
              </div>
              <div className="pg-mission-metrics">
                {t.control.metrics.map(([label, value, status]) => (
                  <div key={label}><span>{label}</span><strong className={`pg-status-${status}`}><i aria-hidden="true" />{value}</strong></div>
                ))}
              </div>
              <div className="pg-mission-issue">
                <span><Activity aria-hidden="true" />{t.control.issueLabel}</span>
                <h4>{t.control.issueTitle}</h4>
                <p>{t.control.issueText}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="pg-section pg-pricing-section" id="pg-pricing" aria-labelledby="pg-pricing-title">
          <div className="pg-shell">
            <div className="pg-section-heading pg-section-heading-centered">
              <p className="pg-eyebrow">{t.pricing.eyebrow}</p>
              <h2 id="pg-pricing-title">{t.pricing.title}</h2>
              <p>{t.pricing.text}</p>
            </div>
            <div className="pg-pricing-grid">
              <article className="pg-price-card pg-price-card-main">
                <div className="pg-price-card-label">{t.pricing.plan}</div>
                <p className="pg-price-from">{t.pricing.from}</p>
                <div className="pg-price"><strong>{t.pricing.amount}</strong><span>{t.pricing.period}</span></div>
                <p className="pg-tax">{t.pricing.tax}</p>
                <p className="pg-total">{t.pricing.total}</p>
                <div className="pg-includes">
                  <h3>{t.pricing.includesTitle}</h3>
                  <ul>{t.pricing.includes.map((item) => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul>
                </div>
                <button className="pg-button" type="button" onClick={() => openCall("activation")}>{t.pricing.primaryCta}<ArrowRight aria-hidden="true" /></button>
              </article>
              <article className="pg-price-card pg-hardware-card">
                <div className="pg-hardware-icon"><KeyRound aria-hidden="true" /></div>
                <h3>{t.pricing.hardwareTitle}</h3>
                <p>{t.pricing.hardwareText}</p>
                <p className="pg-hardware-note">{t.pricing.hardwareNote}</p>
                <button className="pg-button pg-button-secondary" type="button" onClick={() => openCall("hardware")}>{t.pricing.hardwareCta}</button>
              </article>
            </div>
          </div>
        </section>

        <section className="pg-section pg-faq-section" aria-labelledby="pg-faq-title">
          <div className="pg-shell pg-faq-grid">
            <div className="pg-section-heading"><p className="pg-eyebrow">{t.faq.eyebrow}</p><h2 id="pg-faq-title">{t.faq.title}</h2></div>
            <div className="pg-faq-list">
              {t.faq.items.map(([question, answer], index) => (
                <details key={question} open={index === 0 ? true : undefined}>
                  <summary>{question}<ChevronDown aria-hidden="true" /></summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="pg-final-cta" aria-labelledby="pg-final-title">
          <div className="pg-shell pg-final-inner">
            <div><p className="pg-eyebrow">{t.final.eyebrow}</p><h2 id="pg-final-title">{t.final.title}</h2><p>{t.final.text}</p></div>
            <div>
              <button className="pg-button pg-button-light" type="button" onClick={() => openCall("demo")}>{t.final.demoCta}<ArrowRight aria-hidden="true" /></button>
              <button className="pg-button pg-button-outline-light" type="button" onClick={() => openCall("activation")}>{t.final.activationCta}</button>
            </div>
          </div>
        </section>
      </main>

      <footer className="pg-footer">
        <div className="pg-shell pg-footer-top">
          <a className="pg-brand" href="#pg-main" aria-label="Pin&Go">
            <img src="/pin-go-logo.png" alt="" aria-hidden="true" />
            <span><strong>Pin&amp;Go</strong><small>{t.footer.tagline}</small></span>
          </a>
          <nav aria-label={t.footer.legalLabel}>
            <Link to="/legal/terms">{t.footer.terms}</Link>
            <Link to="/legal/privacy">{t.footer.privacy}</Link>
            <Link to="/legal/support-policy">{t.footer.support}</Link>
            <Link to="/legal/billing-policy">{t.footer.billing}</Link>
          </nav>
        </div>
        <div className="pg-shell pg-footer-bottom">
          <span>© {new Date().getFullYear()} Pin&amp;Go. {t.footer.rights}</span>
          <span>APMS · Puerto Rico</span>
        </div>
      </footer>

      <OnboardingBookingModal
        key={bookingSession}
        isOpen={openBooking}
        onClose={() => setOpenBooking(false)}
        lang={lang}
        bookingType="demo"
        initialTopic={t.bookingTopics[bookingIntent]}
        previewOnly={isVisualPreview}
      />
    </div>
  );
}
