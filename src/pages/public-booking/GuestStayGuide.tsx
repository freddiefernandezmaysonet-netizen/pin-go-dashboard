import "./GuestStayGuide.css";

type GuideProps = Readonly<{ language: "en" | "es"; enabled?: boolean }>;

export function PinAIUsageGuide({ language, enabled = false }: GuideProps) {
  if (enabled !== true) return null;
  const es = language === "es";
  return (
    <div className="pg-stay-guide-ai">
      <p className="pg-stay-guide-eyebrow">PIN AI</p>
      <h3>{es ? "Conoce al asistente de tu estadía" : "Meet your stay assistant"}</h3>
      <p>{es
        ? "Tu alojamiento tiene Pin AI activo. Puedes conversar con este asistente de inteligencia artificial sobre tu reserva, la llegada y dudas durante la estadía."
        : "Your accommodation has Pin AI enabled. You can chat with this AI assistant about your reservation, arrival, and questions during your stay."}</p>
      <details>
        <summary>{es ? "Cómo abrir Pin AI y qué puedes preguntarle" : "How to open Pin AI and what to ask"}</summary>
        <ol>
          <li>{es
            ? "Abre el enlace Administrar reservación del correo de confirmación. Puedes usarlo desde el navegador, sin instalar una aplicación."
            : "Open the Manage reservation link in your confirmation email. You can use it in your browser without installing an app."}</li>
          <li>{es
            ? "Busca Pin AI y escribe tu pregunta en español o inglés. La conversación está vinculada a tu reservación."
            : "Find Pin AI and type your question in English or Spanish. The conversation is linked to your reservation."}</li>
          <li>{es
            ? "Describe lo que necesitas y sigue las indicaciones. Si reportas un problema, revisa la respuesta y las actualizaciones para saber si se ha avisado al anfitrión."
            : "Describe what you need and follow the guidance. If you report a problem, check the reply and updates to see whether the host has been notified."}</li>
        </ol>
        <p><strong>{es ? "Prueba con estas preguntas:" : "Try these questions:"}</strong></p>
        <ul>
          <li>{es ? "¿Cuál es mi hora de entrada y cómo accedo al alojamiento?" : "What time is check-in and how do I access the accommodation?"}</li>
          <li>{es ? "¿Cómo me conecto al Wi-Fi?" : "How do I connect to Wi-Fi?"}</li>
          <li>{es ? "La televisión no funciona. ¿Me ayudas?" : "The TV is not working. Can you help?"}</li>
          <li>{es ? "¿Puedo solicitar una salida más tarde?" : "Can I request a later checkout?"}</li>
        </ul>
        <p>{es
          ? "Las respuestas sobre el alojamiento dependen de la información proporcionada por el anfitrión. Las solicitudes de cambios o de horarios están sujetas a disponibilidad, condiciones y posibles cargos. Revisa la propuesta y su confirmación antes de dar un cambio por hecho."
          : "Answers about the accommodation depend on information supplied by the host. Reservation or time changes are subject to availability, conditions, and possible charges. Review the proposal and its confirmation before treating a change as final."}</p>
      </details>
      <p className="pg-stay-guide-note">{es
        ? "Pin AI está disponible en alojamientos participantes desde 24 horas antes de la entrada hasta 24 horas después de la salida. Si no aparece o necesitas ayuda fuera de ese período, utiliza el contacto indicado en tu confirmación."
        : "Pin AI is available at participating accommodations from 24 hours before check-in until 24 hours after checkout. If it does not appear or you need help outside that period, use the contact in your confirmation."}</p>
    </div>
  );
}

export function GuestStayGuide({ language, enabled = false }: GuideProps) {
  const es = language === "es";
  const steps = es ? [
    ["Elige y reserva", "Selecciona tus fechas y huéspedes. Revisa el precio total, los cargos, las reglas y la política de cancelación antes de pagar."],
    ["Prepara tu llegada", "En el correo de confirmación encontrarás el enlace para administrar tu reserva. Completa el acuerdo del huésped y la verificación de identidad cuando sean requeridos."],
    ["Consulta tu acceso", "Sigue las instrucciones de llegada de tu alojamiento. El acceso se habilita según los requisitos y horarios de tu reserva; recibir una confirmación no significa que ya puedas entrar."],
    ["Disfruta y organiza tu salida", "Consulta los detalles de tu reserva, pide ayuda si la necesitas y revisa las instrucciones de salida. Los cambios y cancelaciones dependen de las condiciones de tu reserva."],
  ] : [
    ["Choose and book", "Select your dates and guests. Review the total price, charges, house rules, and cancellation policy before paying."],
    ["Prepare for arrival", "Your confirmation email includes a link to manage your reservation. Complete the guest agreement and identity verification when required."],
    ["Check your access", "Follow your accommodation’s arrival instructions. Access is enabled according to your reservation’s requirements and times; confirmation does not mean you can enter immediately."],
    ["Enjoy your stay and plan checkout", "Review your reservation details, ask for help when needed, and check departure instructions. Changes and cancellations depend on your reservation’s conditions."],
  ];
  return (
    <section className="pg-stay-guide" aria-label={es ? "Cómo será tu estadía" : "Your stay, step by step"}>
      <p className="pg-stay-guide-eyebrow">{es ? "RESERVA DIRECTA, PASO A PASO" : "DIRECT BOOKING, STEP BY STEP"}</p>
      <h2>{es ? "Desde tu reserva hasta la salida" : "From booking to checkout"}</h2>
      <p>{es
        ? "Reserva directamente con el alojamiento a través de Pin&Go y conoce qué esperar en cada momento."
        : "Book directly with the accommodation through Pin&Go and know what to expect at each stage."}</p>
      <ol className="pg-stay-guide-steps">
        {steps.map(([title, description], index) => (
          <li key={title}>
            <span aria-hidden="true">{index + 1}</span>
            <div><h3>{title}</h3><p>{description}</p></div>
          </li>
        ))}
      </ol>
      <PinAIUsageGuide language={language} enabled={enabled} />
    </section>
  );
}
