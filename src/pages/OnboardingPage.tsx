import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

type Step = {
  id: string;
  title: string;
  description: string;
  route: string;
  completed: boolean;
};

export default function OnboardingPage() {
  const navigate = useNavigate();

  // ⚠️ MVP: estado mock (luego lo conectamos a backend)
  const steps: Step[] = useMemo(
    () => [
      {
        id: "pms",
        title: "Connect PMS",
        description: "Connect Guesty, Hostaway or Lodgify",
        route: "/integrations/pms",
        completed: false,
      },
      {
        id: "ttlock",
        title: "Connect TTLock",
        description: "Link your locks to automate access",
        route: "/locks",
        completed: false,
      },
      {
        id: "property",
        title: "Add Property",
        description: "Create or sync your first property",
        route: "/properties",
        completed: false,
      },
      {
        id: "test",
        title: "Test Access",
        description: "Generate a test code and verify access",
        route: "/access",
        completed: false,
      },
      {
        id: "golive",
        title: "Go Live",
        description: "Activate automation for real reservations",
        route: "/dashboard",
        completed: false,
      },
    ],
    []
  );

  const progress =
    (steps.filter((s) => s.completed).length / steps.length) * 100;

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <h1 style={styles.title}>Welcome to Pin&Go 🚀</h1>
        <p style={styles.subtitle}>
          Let’s get your property fully automated step by step
        </p>
      </div>

      {/* PROGRESS BAR */}
      <div style={styles.progressContainer}>
        <div style={{ ...styles.progressBar, width: `${progress}%` }} />
      </div>
      <p style={styles.progressText}>
        {Math.round(progress)}% completed
      </p>

      {/* STEPS */}
      <div style={styles.stepsContainer}>
        {steps.map((step, index) => (
          <div key={step.id} style={styles.stepCard}>
            <div style={styles.stepHeader}>
              <div style={styles.stepNumber}>{index + 1}</div>
              <div>
                <h3 style={styles.stepTitle}>{step.title}</h3>
                <p style={styles.stepDescription}>{step.description}</p>
              </div>
            </div>

            <button
              style={styles.primaryButton}
              onClick={() => navigate(step.route)}
            >
              Go to step
            </button>
          </div>
        ))}
      </div>

      {/* CALENDLY BLOCK */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>📅 Schedule onboarding call</h2>
        <p style={styles.cardText}>
          We’ll help you connect PMS, TTLock, smart devices and automations.
        </p>

        <a
          href="https://calendly.com/YOUR-LINK"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.primaryButton}
        >
          Book a call
        </a>
      </div>

      {/* REMOTE ASSISTANCE */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>🖥 Remote assistance</h2>
        <p style={styles.cardText}>
          Need help? We can connect remotely and set everything up for you.
        </p>

        <a
          href="https://wa.me/17874294117"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.secondaryButton}
        >
          Request assistance
        </a>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "40px",
    maxWidth: "900px",
    margin: "0 auto",
  },
  header: {
    marginBottom: "20px",
  },
  title: {
    fontSize: "32px",
    marginBottom: "5px",
  },
  subtitle: {
    color: "#666",
  },
  progressContainer: {
    height: "8px",
    background: "#eee",
    borderRadius: "4px",
    overflow: "hidden",
    marginBottom: "10px",
  },
  progressBar: {
    height: "100%",
    background: "#4f46e5",
  },
  progressText: {
    fontSize: "14px",
    color: "#666",
    marginBottom: "30px",
  },
  stepsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
  },
  stepCard: {
    border: "1px solid #eee",
    borderRadius: "10px",
    padding: "20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stepHeader: {
    display: "flex",
    gap: "15px",
    alignItems: "center",
  },
  stepNumber: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "#4f46e5",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
  },
  stepTitle: {
    margin: 0,
  },
  stepDescription: {
    margin: 0,
    fontSize: "14px",
    color: "#666",
  },
  primaryButton: {
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    padding: "10px 15px",
    borderRadius: "8px",
    cursor: "pointer",
    textDecoration: "none",
  },
  secondaryButton: {
    background: "#111",
    color: "#fff",
    border: "none",
    padding: "10px 15px",
    borderRadius: "8px",
    cursor: "pointer",
    textDecoration: "none",
  },
  card: {
    marginTop: "30px",
    border: "1px solid #eee",
    borderRadius: "10px",
    padding: "20px",
  },
  cardTitle: {
    marginBottom: "10px",
  },
  cardText: {
    marginBottom: "15px",
    color: "#666",
  },
};