import { useState } from "react";
import OnboardingBookingModal from "../components/OnboardingBookingModal";
import HaasConfigurator from "../components/HaasConfigurator";
import { LandingContent, LandingFinal } from "./LandingContent";
import "./LandingPage.css";

type Lang = "es" | "en";

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>("es");
  const [openBooking, setOpenBooking] = useState(false);
  const [bookingType, setBookingType] = useState<"onboarding" | "demo">("onboarding");
  const es = lang === "es";
  function schedule(type: "onboarding" | "demo") {
    setBookingType(type);
    setOpenBooking(true);
  }
  return (
    <div className="pingo-landing" lang={lang}>
      <nav className="nav" aria-label={es ? "Navegación principal" : "Main navigation"}>
        <div className="nav-inner">
          <a className="brand nav-brand" href="#" aria-label="Pin&Go">
            <img className="site-logo" src="/pin-go-logo.png" alt="" />
            <span>Pin<span className="blue">&amp;</span>Go</span>
          </a>
          <div className="nav-links">
            <a href="#platform">{es ? "Plataforma" : "Platform"}</a>
            <a href="#pin-ai">Pin AI</a>
            <a href="#hardware">Hardware</a>
          </div>
          <div className="nav-actions">
            <div className="lang" aria-label={es ? "Idioma" : "Language"}>
              {(["es", "en"] as const).map((value) => <button key={value} type="button" className={lang === value ? "active" : ""} aria-pressed={lang === value} onClick={() => setLang(value)}>{value.toUpperCase()}</button>)}
            </div>
            <a className="button ghost" href="https://app.pin-ngo.com/login">{es ? "Iniciar sesión" : "Log in"}</a>
            <a className="button primary" href="https://app.pin-ngo.com/signup">{es ? "Crear cuenta" : "Create account"}</a>
          </div>
        </div>
      </nav>
      <main>
        <LandingContent lang={lang} />
        <div id="hardware">
          <HaasConfigurator lang={lang} pendingPlans onScheduleCall={() => schedule("demo")} />
        </div>
        <section className="section" id="setup">
          <div className="container">
            <div className="section-label">{es ? "CONFIGURACIÓN INICIAL" : "ONBOARDING"}</div>
            <h2 className="section-title">{es ? "¿Prefieres ayuda configurando Pin&Go?" : "Want help setting up Pin&Go?"}</h2>
            <p className="section-copy">{es ? "Nuestro equipo puede ayudarte a configurar tus propiedades, conectar canales y cerraduras compatibles, y preparar tus automatizaciones en una sesión guiada." : "Our team can help configure your properties, connect channels and compatible locks, and prepare your automations in a guided session."}</p>
            <div className="setup-actions">
              <button className="button primary" type="button" onClick={() => schedule("onboarding")}>{es ? "Agendar configuración" : "Book onboarding"}</button>
              <button className="button outline-dark" type="button" onClick={() => schedule("demo")}>{es ? "Agendar llamada" : "Book a call"}</button>
            </div>
          </div>
        </section>
        <LandingFinal lang={lang} />
      </main>
      <footer><div className="footer-inner">
        <div>© Pin&amp;Go · {es ? "Sistema de gestión de propiedades todo en uno" : "All In One Property Management System"}</div>
        <div className="footer-links">
          <a href="https://app.pin-ngo.com/legal/terms">{es ? "Términos" : "Terms"}</a>
          <a href="https://app.pin-ngo.com/legal/privacy">{es ? "Privacidad" : "Privacy"}</a>
          <a href="https://app.pin-ngo.com/legal/support-policy">{es ? "Soporte" : "Support"}</a>
          <a href="https://app.pin-ngo.com/legal/billing-policy">{es ? "Facturación" : "Billing"}</a>
        </div>
      </div></footer>
      <OnboardingBookingModal isOpen={openBooking} onClose={() => setOpenBooking(false)} lang={lang} bookingType={bookingType} />
    </div>
  );
}
