import { useEffect, useMemo, useState } from "react";

type Lang = "es" | "en";

type Props = {
  lang: Lang;
};

const locks = [
  {
    id: "essential",
    nameEs: "Essential Lock",
    nameEn: "Essential Lock",
    badgeEs: "Ideal para comenzar",
    badgeEn: "Best starter option",
    price: 29.99,
    image: "/locks/essential-lock.png.jpg",
    descEs: "Cerradura inteligente confiable para propiedades pequeñas y medianas.",
    descEn: "Reliable smart lock for small and mid-size rental properties.",
  },
  {
    id: "pro",
    nameEs: "Pro Lock",
    nameEn: "Pro Lock",
    badgeEs: "Más popular",
    badgeEn: "Most popular",
    price: 39.99,
    image: "/locks/pro-lock.png.jpg",
    descEs: "Diseñada para mayor uso, rotación frecuente y operación profesional.",
    descEn: "Built for higher usage, frequent turnover, and professional operations.",
  },
  {
    id: "elite",
    nameEs: "Elite Lock",
    nameEn: "Elite Lock",
    badgeEs: "Premium",
    badgeEn: "Premium",
    price: 49.99,
    image: "/locks/elite-lock.png.jpg",
    descEs: "Opción premium para propiedades de alto valor y experiencia avanzada.",
    descEn: "Premium option for high-value properties and advanced guest experience.",
  },
];

const automationOptions = [
  {
    id: "none",
    labelEs: "Sin Smart Device",
    labelEn: "No Smart Device",
    price: 0,
    descEs: "Mantén solo el control de acceso inteligente con cerradura y plataforma.",
    descEn: "Keep smart access control only with lock and platform.",
    featuresEs: ["Acceso remoto", "Códigos automáticos", "Control por reserva"],
    featuresEn: ["Remote access", "Automatic codes", "Reservation-based control"],
  },
  {
    id: "one",
    labelEs: "1 Smart Device",
    labelEn: "1 Smart Device",
    price: 24.99,
    descEs: "Automatiza aire acondicionado, luces o un dispositivo inteligente clave.",
    descEn: "Automate AC, lights, or one key smart device.",
    featuresEs: ["Automatización inteligente", "Ahorro operativo", "Mejor experiencia"],
    featuresEn: ["Smart automation", "Operational savings", "Better experience"],
  },
  {
    id: "two",
    labelEs: "2 Smart Devices",
    labelEn: "2 Smart Devices",
    price: 39.99,
    descEs: "Crea una experiencia más completa automatizando múltiples dispositivos.",
    descEn: "Create a more complete experience by automating multiple devices.",
    featuresEs: ["Control ampliado", "Mayor eficiencia", "Operación más completa"],
    featuresEn: ["Expanded control", "Higher efficiency", "More complete operation"],
  },
];

export default function HaasConfigurator({ lang }: Props) {
  const [selectedLockId, setSelectedLockId] = useState("pro");
  const [selectedAutomationId, setSelectedAutomationId] = useState("one");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
  const check = () => setIsMobile(window.innerWidth < 900);
  check();

  window.addEventListener("resize", check);
  return () => window.removeEventListener("resize", check);
}, []);
  
  const selectedLock = useMemo(
    () => locks.find((lock) => lock.id === selectedLockId) ?? locks[1],
    [selectedLockId]
  );

  const selectedAutomation = useMemo(
    () =>
      automationOptions.find((option) => option.id === selectedAutomationId) ??
      automationOptions[1],
    [selectedAutomationId]
  );

  const total = selectedLock.price + selectedAutomation.price;
  const signupUrl = `/signup?plan=haas&lock=${selectedLock.id}&smartDevices=${selectedAutomation.id}`;
  
  return (
    <section style={styles.section}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.badge}>
            {lang === "es"
              ? "HARDWARE AS A SERVICE • CONTRATO 24 MESES"
              : "HARDWARE AS A SERVICE • 24-MONTH AGREEMENT"}
          </div>

          <h2 style={styles.title}>
            {lang === "es"
              ? "Construye tu paquete Smart Property"
              : "Build your Smart Property package"}
          </h2>

          <p style={styles.subtitle}>
           {lang === "es"
              ? "Escoge tu cerradura, añade automatización inteligente y opera tu propiedad con hardware, software, instalación y soporte incluidos."
              : "Choose your smart lock, add intelligent automation, and operate your property with hardware, software, installation, and support included."}
          </p>
        </div>
  <p style={styles.hardwareDisclaimer}>
  {lang === "es"
              ? "Las imágenes de hardware son ilustrativas. El modelo final puede variar según disponibilidad manteniendo funcionalidad y nivel de servicio equivalente."
              : "Hardware images are for illustrative purposes. Final hardware models may vary based on availability while maintaining equivalent functionality and service level."}
</p>

        <div
          style={{
            ...styles.layout,
            gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) 400px",
          }}
        >
          <div>
            <h3 style={styles.stepTitle}>
              {lang === "es" ? "1. Escoge tu cerradura" : "1. Choose your lock"}
            </h3>

            <div style={styles.lockGrid}>
              {locks.map((lock) => {
                const active = lock.id === selectedLockId;

                return (
                  <button
                    key={lock.id}
                    type="button"
                    onClick={() => setSelectedLockId(lock.id)}
                    style={{
                      ...styles.lockCard,
                      ...(active ? styles.lockCardActive : {}),
                    }}
                  >
                    <div style={styles.lockBadge}>
                      {lang === "es" ? lock.badgeEs : lock.badgeEn}
                    </div>

                    <div style={styles.imageWrap}>
                      <img
                        src={lock.image}
                        alt={lang === "es" ? lock.nameEs : lock.nameEn}
                        style={styles.lockImage}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display =
                            "none";
                        }}
                      />
                    </div>

                    <h4 style={styles.lockName}>
                      {lang === "es" ? lock.nameEs : lock.nameEn}
                    </h4>

                    <p style={styles.lockDesc}>
                      {lang === "es" ? lock.descEs : lock.descEn}
                    </p>

                    <div style={styles.lockPrice}>
                      ${lock.price.toFixed(2)}
                      <span style={styles.period}>
                        {lang === "es" ? " / mes" : " / mo"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <h3 style={{ ...styles.stepTitle, marginTop: 34 }}>
              {lang === "es"
                ? "2. Añade Smart Automation"
                : "2. Add Smart Automation"}
            </h3>

            <div style={styles.automationGrid}>
              {automationOptions.map((option) => {
                const active = option.id === selectedAutomationId;
                const features =
                  lang === "es" ? option.featuresEs : option.featuresEn;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedAutomationId(option.id)}
                    style={{
                      ...styles.automationCard,
                      ...(active ? styles.automationCardActive : {}),
                    }}
                  >
                    <div style={styles.automationLabel}>
                      {lang === "es" ? option.labelEs : option.labelEn}
                    </div>

                    <p style={styles.automationDesc}>
                      {lang === "es" ? option.descEs : option.descEn}
                    </p>

                    <div style={styles.automationPrice}>
                      {option.price === 0
                        ? lang === "es"
                          ? "Incluido"
                          : "Included"
                        : `+$${option.price.toFixed(2)}`}
                      <span style={styles.period}>
                        {option.price === 0
                          ? ""
                          : lang === "es"
                          ? " / mes"
                          : " / mo"}
                      </span>
                    </div>

                    <ul style={styles.automationFeatures}>
                      {features.map((feature) => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
          </div>

          <aside
            style={{
              ...styles.summaryCard,
              position: isMobile ? "relative" : "sticky",
              top: isMobile ? "auto" : 96,
            }}
          >
            <div style={styles.summaryLabel}>
              {lang === "es" ? "Tu plan mensual" : "Your monthly plan"}
            </div>

            <h3 style={styles.summaryTitle}>
              {lang === "es" ? selectedLock.nameEs : selectedLock.nameEn}
            </h3>

            <div style={styles.summaryRow}>
              <span>{lang === "es" ? "Cerradura" : "Lock"}</span>
              <strong>${selectedLock.price.toFixed(2)}</strong>
            </div>

            <div style={styles.summaryRow}>
              <span>
                {lang === "es"
                  ? selectedAutomation.labelEs
                  : selectedAutomation.labelEn}
              </span>
              <strong>${selectedAutomation.price.toFixed(2)}</strong>
            </div>

            <div style={styles.divider} />

            <div style={styles.totalRow}>
              <span>Total</span>
              <strong>${total.toFixed(2)}</strong>
            </div>

            <div style={styles.totalPeriod}>
              {lang === "es"
                ? "/ mes • contrato 24 meses"
                : "/ month • 24-month agreement"}
            </div>
            <div style={styles.savingsBox}>
  {lang === "es"
    ? "Evita grandes costos iniciales de hardware e instalación."
    : "Avoid large upfront hardware and installation costs."}
</div>
           <div style={styles.includedGrid}>
  <div style={styles.includedItem}>
    <span>✓</span>
    <span>
      {lang === "es"
        ? "Instalación incluida"
        : "Installation included"}
    </span>
  </div>

  <div style={styles.includedItem}>
    <span>✓</span>
    <span>
      {lang === "es"
        ? "Hardware incluido"
        : "Hardware included"}
    </span>
  </div>

 <div style={styles.includedItem}>
  <span>✓</span>
  <span>
    {lang === "es"
      ? "Software Pin&Go incluido"
      : "Pin&Go software included"}
  </span>
</div>

 <div style={styles.includedItem}>
    <span>✓</span>
    <span>
      {lang === "es"
        ? "Garantía de 2 años"
        : "2-year warranty"}
    </span>
  </div>

  <div style={styles.includedItem}>
    <span>✓</span>
    <span>
      {lang === "es"
        ? "Soporte técnico"
        : "Technical support"}
    </span>
  </div>

  <div style={styles.includedItem}>
    <span>✓</span>
    <span>
      {lang === "es"
        ? "Reemplazo de baterías"
        : "Battery replacement"}
    </span>
  </div>
</div>
            <a href={signupUrl} style={styles.cta}>
              {lang === "es" ? "Solicitar este plan" : "Request this plan"}
            </a>
          </aside>
        </div>
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    padding: "90px 20px",
    background:
      "linear-gradient(180deg, #ffffff 0%, #f8fafc 48%, #eef6ff 100%)",
  },
  container: {
    maxWidth: 1280,
    margin: "0 auto",
  },
  header: {
    textAlign: "center",
    maxWidth: 860,
    margin: "0 auto",
  },
  badge: {
    display: "inline-block",
    background: "#0f172a",
    color: "#fff",
    padding: "10px 18px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 0.4,
    marginBottom: 18,
  },
  title: {
    margin: 0,
    fontSize: "clamp(2rem, 4vw, 3rem)",
    fontWeight: 900,
    letterSpacing: "-0.04em",
  },
  subtitle: {
    margin: "18px auto 0",
    color: "#475569",
    fontSize: 18,
    lineHeight: 1.8,
  },
  hardwareDisclaimer: {
  marginTop: 14,
  fontSize: 12,
  color: "#64748b",
  lineHeight: 1.6,
  maxWidth: 760,
  marginInline: "auto",
},
layout: {
  marginTop: 46,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 400px",
  gap: 28,
  alignItems: "start",
},
  stepTitle: {
    margin: "0 0 18px",
    fontSize: 22,
    fontWeight: 850,
  },
  lockGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: 18,
  },
  lockCard: {
    position: "relative",
    textAlign: "left",
    border: "1px solid #dbe3ef",
    background: "#fff",
    borderRadius: 24,
    padding: 20,
    cursor: "pointer",
    boxShadow: "0 14px 34px rgba(15, 23, 42, 0.06)",
    transition: "all 0.2s ease",
  },
  lockCardActive: {
    border: "2px solid #2563eb",
    transform: "translateY(-2px)",
    boxShadow: "0 18px 40px rgba(37, 99, 235, 0.15)",
  },
  lockBadge: {
    display: "inline-block",
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    marginBottom: 14,
  },
  imageWrap: {
    height: 280,
    borderRadius: 18,
    background:
      "radial-gradient(circle at center, rgba(37,99,235,0.12), rgba(241,245,249,0.95))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    overflow: "hidden",
  },
  lockImage: {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
  },
  lockName: {
    margin: 0,
    fontSize: 21,
    fontWeight: 850,
  },
  lockDesc: {
    marginTop: 10,
    color: "#475569",
    lineHeight: 1.6,
    fontSize: 14,
    minHeight: 68,
  },
  lockPrice: {
    marginTop: 14,
    fontSize: 28,
    fontWeight: 900,
    color: "#0f172a",
  },
  period: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: 700,
  },
  automationGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 14,
  },
  automationCard: {
    textAlign: "left",
    background: "#fff",
    border: "1px solid #dbe3ef",
    borderRadius: 18,
    padding: 18,
    cursor: "pointer",
    boxShadow: "0 10px 26px rgba(15, 23, 42, 0.05)",
    transition: "all 0.2s ease",
  },
  automationCardActive: {
    border: "2px solid #2563eb",
    background: "#f8fbff",
    boxShadow: "0 16px 34px rgba(37, 99, 235, 0.12)",
  },
  automationLabel: {
    fontSize: 16,
    fontWeight: 850,
  },
  automationDesc: {
    marginTop: 8,
    marginBottom: 0,
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.5,
    minHeight: 40,
  },
  automationPrice: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: 900,
  },
  automationFeatures: {
    marginTop: 10,
    marginBottom: 0,
    paddingLeft: 18,
    fontSize: 12,
    color: "#334155",
    lineHeight: 1.7,
  },
  summaryCard: {
    position: "sticky",
    top: 96,
    alignSelf: "start",
    background: "#0f172a",
    color: "#fff",
    borderRadius: 28,
    padding: 28,
    boxShadow: "0 20px 46px rgba(15, 23, 42, 0.25)",
  },
  summaryLabel: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: 850,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  summaryTitle: {
    margin: "12px 0 22px",
    fontSize: 28,
    fontWeight: 900,
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 12,
    color: "#e2e8f0",
  },
  divider: {
    height: 1,
    background: "rgba(226,232,240,0.22)",
    margin: "22px 0",
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    fontSize: 20,
    fontWeight: 900,
  },
  totalPeriod: {
    marginTop: 6,
    color: "#cbd5e1",
    fontSize: 13,
  },
  savingsBox: {
  marginTop: 16,
  background: "rgba(59,130,246,0.12)",
  border: "1px solid rgba(147,197,253,0.25)",
  color: "#dbeafe",
  padding: "12px 14px",
  borderRadius: 14,
  fontSize: 13,
  lineHeight: 1.6,
},
 includedGrid: {
  marginTop: 24,
  display: "grid",
  gap: 12,
},

includedItem: {
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
  padding: "10px 12px",
  color: "#dbeafe",
  fontSize: 14,
},

  cta: {
    display: "block",
    textAlign: "center",
    textDecoration: "none",
    background: "#fff",
    color: "#0f172a",
    padding: "14px 18px",
    borderRadius: 14,
    fontWeight: 900,
  },
};