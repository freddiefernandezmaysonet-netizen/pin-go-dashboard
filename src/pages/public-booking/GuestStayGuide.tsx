import "./GuestStayGuide.css";

type GuideProps = Readonly<{ language: "en" | "es"; enabled?: boolean }>;

export function GuestAppUsageGuide({ language, enabled = false }: GuideProps) {
  const es = language === "es";
  return (
    <section className="pg-stay-guide-ai" aria-label={es ? "Cómo usar Pin&Go Guest" : "How to use Pin&Go Guest"}>
      <p className="pg-stay-guide-eyebrow">PIN&amp;GO GUEST</p>
      <h3>{es ? "Tu reservación en tu teléfono" : "Your reservation on your phone"}</h3>
      <p>{es
        ? "La app Pin&Go Guest es opcional. Su descarga pública para iPhone y Android estará disponible cuando se complete la aprobación en App Store y Google Play. Mientras tanto, administra tu estadía desde el enlace seguro de tu correo, en el navegador."
        : "The Pin&Go Guest app is optional. Public downloads for iPhone and Android will be available once App Store and Google Play approval is complete. Meanwhile, manage your stay in your browser using the secure link in your email."}</p>
      <ol>
        <li>{es
          ? "Cuando esté publicada, descarga Pin&Go Guest desde App Store en iPhone o Google Play en Android. Si ya la tienes instalada, continúa con el siguiente paso."
          : "Once published, download Pin&Go Guest from the App Store on iPhone or Google Play on Android. If it is already installed, continue to the next step."}</li>
        <li>{es
          ? "Desde el teléfono donde instalaste la app, abre el enlace de registro o acceso de tu reservación y selecciona Usar Pin&Go Guest. Solicita el código de verificación, revísalo en el correo de tu reservación y confirma tu dispositivo. Ese código no es el PIN de la puerta."
          : "On the phone where you installed the app, open your reservation’s registration or access link and select Use Pin&Go Guest. Request the verification code, check your reservation email, and confirm your device. This code is not your door PIN."}</li>
        <li>{es
          ? "Pulsa Abrir en Pin&Go Guest para vincular tu estadía. En Stay consulta tu reserva; en Access revisa el acceso y su horario; en Help busca ayuda."
          : "Tap Open in Pin&Go Guest to link your stay. Use Stay to review your reservation, Access to check entry details and times, and Help for assistance."}</li>
        <li>{es
          ? "Si Access muestra una llave Bluetooth, activa Bluetooth, permite los permisos que solicite la app y acércate a la cerradura para abrir desde Access. Su disponibilidad depende del alojamiento, de completar el registro y del horario autorizado de tu reserva."
          : "If Access shows a Bluetooth key, turn on Bluetooth, allow the permissions requested by the app, and stand near the lock to unlock from Access. Availability depends on the accommodation, completed registration, and your reservation’s authorized access times."}</li>
        {enabled === true ? <li>{es
          ? "En Pin AI puedes conversar con el asistente de tu estadía durante su período de atención."
          : "Use Pin AI to chat with your stay assistant during its service window."}</li> : null}
      </ol>
      <p className="pg-stay-guide-note">{es
        ? "Guarda tu correo. Si la app no abre, continúa en el navegador y vuelve al enlace de tu reservación cuando la tengas instalada. No compartas tus enlaces, códigos de verificación ni credenciales de acceso."
        : "Keep your email. If the app does not open, continue in your browser and return to your reservation link after installing it. Do not share your links, verification codes, or access credentials."}</p>
    </section>
  );
}

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
