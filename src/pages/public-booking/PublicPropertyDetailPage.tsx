import { useEffect, useMemo, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { addDays, format } from "date-fns";
import "react-day-picker/style.css";
import { Link, useParams } from "react-router-dom";
import "./PublicBookingExperience.css";

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
  cancellationPolicy?: PublicCancellationPolicy | null;
  cancellationPolicyPresentation?:
  | PublicCancellationPolicyPresentation
  | null;
  amenities?: Array<{
  id: string;
  name: string;
  description?: string | null;
  chargeMode: "INCLUDED" | "REQUIRED" | "OPTIONAL";
  feeType: "PER_STAY" | "PER_NIGHT";
  amount: string | number;
  }>;
  taxes?: Array<{
    id: string;
    name: string;
    percentage: string | number;
  }>;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
};

type PublicCancellationRefundRule = {
  minHoursBeforeCheckIn: number;
  refundPercent: number;
  label: string;
  description?: string | null;
};

type PublicNonRefundableScenario =
  | "EARLY_DEPARTURE"
  | "DELAYED_ARRIVAL"
  | "REDUCED_NIGHTS"
  | "WEATHER_RE_SCHEDULE"
  | "OTHER";

type PublicCancellationPolicy = {
  policyId: string | null;
  name: string;
  type:
    | "FLEXIBLE"
    | "MODERATE"
    | "FIRM"
    | "STRICT"
    | "CUSTOM"
    | "NON_REFUNDABLE";
  source: string;
  guestSelfCancellationEnabled: boolean;
  autoRefundEligibleCancellations: boolean;
  requireHostApprovalOutsidePolicy: boolean;
  freeCancellationHoursBeforeCheckIn: number;
  refundBasis:
    | "TOTAL_AMOUNT"
    | "NIGHTLY_SUBTOTAL"
    | "NIGHTLY_PLUS_CLEANING"
    | "CUSTOM";
  refundPercentBeforeDeadline: number;
  refundPercentAfterDeadline: number;
  refundRules?: PublicCancellationRefundRule[] | null;
  nonRefundableScenarios?: PublicNonRefundableScenario[] | null;
  guestFacingSummary?: string | null;
  cleaningFeeRefundable: boolean;
  amenitiesRefundable: boolean;
  taxesRefundable: boolean;
  nonRefundableDiscountPercent: number | null;
  description: string | null;
  snapshotAt: string;
};

type GuestLanguage = "en" | "es";

type PublicCancellationPolicyPresentation = {
  language: GuestLanguage;
  title: string;
  headline: string;
  summary: string;

  timeline: Array<{
    minHoursBeforeCheckIn: number;
    maxHoursBeforeCheckIn: number | null;
    refundPercent: number;
    title: string;
    description: string;
  }>;

  rules: Array<{
    minHoursBeforeCheckIn: number;
    refundPercent: number;
    label: string;
    windowLabel: string;
    description: string;
  }>;

  nonRefundableScenarios: Array<{
    code: PublicNonRefundableScenario;
    label: string;
    description: string;
  }>;

  nonRefundableScenarioDisclosure: string | null;
  refundBasisDisclosure: string;
  approvalNote: string | null;
  automationNote: string | null;
  selfCancellationNote: string | null;
  feeDisclosure: string;
  acceptanceText: string;
  checkIn: string | null;
};


const GUEST_LANGUAGE_STORAGE_KEY =
  "pingo_guest_preferred_language";

const PUBLIC_PROPERTY_COPY = {
 en: {
  directBooking: "Direct Booking",
  guestLanguage: "Guest language",
  loadingProperty: "Loading property...",
  propertyNotFound: "Property not found",
  failedToLoadProperty: "Failed to load property",
  upToGuests: "Up to",
  guests: "guests",
  minimum: "Minimum",
  nights: "night(s)",
  propertyOverview: "Property Overview",
  defaultPropertyDescription:
    "This property offers a modern and comfortable stay powered by Pin&Go.",
  stayDetails: "Stay Details",
  checkIn: "Check-In",
  checkOut: "Check-Out",
  configuredByHost: "Configured by host",
  startingAt: "Starting at",
  perNight: "/ night",
  bookYourStaySecurely: "Book your stay securely",
  direct: "Direct",
  checkInDate: "Check-in",
  checkOutDate: "Check-out",
  addDate: "Add date",
  adults: "Adults",
  adultsHint: "Ages 13 or above",
  children: "Children",
  childrenHint: "Ages 2–12",
  fullName: "Full name",
  guestNamePlaceholder: "Guest name",
  email: "Email",
  phone: "Phone",
  completeRequiredFields:
    "Please complete check-in, check-out, name and email.",
  checkOutAfterCheckIn:
    "Check-out must be after check-in.",
  securePreCheckinRequiredError:
    "Please confirm that you understand the Secure Pre-check-in requirement before continuing.",
  cancellationTermsRequiredError:
    "Please review and accept the cancellation terms to continue.",
  minimumStayPrefix: "Minimum stay is",
  maximumStayPrefix: "Maximum stay is",
  nightCountSuffix: "night(s).",
  propertyNotLoaded: "Property not loaded",
  unableToCreateCheckout: "Unable to create checkout.",
  unableToReserveProperty:
    "Unable to reserve this property.",
  smsUpdatesTitle:
    "Pin&Go Smart Stay SMS Updates (Optional)",
  smsUpdatesDescription:
    "Receive important updates about your stay, including your booking confirmation, smart lock access code, check- in instructions, check-out reminders, and important property alerts.",
  smsUpdatesLegal:
    "Message frequency varies. Message & data rates may apply. Reply STOP to opt out and HELP for assistance.",
  smsUpdatesOptionalNotice:
    "SMS consent is optional and is not required to complete this reservation. Reservation confirmation and check-i  in instructions will also be delivered by email.",
  securePaymentsPoweredBy:
    "Secure payments powered by",
  redirectToStripe:
    "You will be redirected to Stripe Checkout to complete your payment.",
  legalAgreementPrefix:
    "By completing your reservation, you agree to Pin&Go's",
  termsOfService: "Terms of Service",
  privacyPolicy: "Privacy Policy",
  legalAnd: "and",
  preparingCheckout: "Preparing checkout...",
  reserveNow: "Reserve now",
  optionalAddOns: "Optional add-ons",
  perNightFee: "Per night",
  perStayFee: "Per stay",
  priceDetails: "Price details",
  guestCountLabel: "Guests",
  nightlyRates: "Nightly rates",
  cleaningFeeLabel: "Cleaning fee",
  totalLabel: "Total",
  includedWithStay: "Included with your stay",
  secureArrivalProcess:
    "Secure arrival process",
  securePreCheckinTitle:
    "Secure Pre-check-in Required",
  securePreCheckinIntro:
    "After booking, the primary guest must complete Identity Check and accept the Guest Agreement before Pin&Go  releases access credentials.",
  reservationConfirmedStep:
    "Reservation confirmed",
  identityCheckStep:
    "Identity Check",
  guestAgreementStep:
    "Guest Agreement",
  accessReleasedStep:
    "Access automatically released",
  usuallyCompletedQuickly:
    "Usually completed in just a few minutes.",
  reservationConfirmedNotice:
    "Your reservation is confirmed immediately after payment. Pin&Go will automatically deliver your access   credentials once Secure Pre-check-in has been completed.",
  securePreCheckinAcceptanceTitle:
    "I understand that Secure Pre-check-in is required before I receive access.",
  securePreCheckinAcceptanceText:
    "The primary guest must complete Identity Check and accept the Guest Agreement. Payment confirms the  reservation, but does not complete these requirements or release access credentials.",
cancellationPolicyLabel: "Cancellation policy",
importantNonRefundableCases:
  "Important non-refundable cases",
cancellationTermsAgreement:
  "I have reviewed and agree to the cancellation terms.",
eligibleRefundNotice:
  "I understand that any eligible refund will be calculated according to the policy shown above.",
refundCalculation:
  "Refund calculation",
  propertyHighlights: {
    eyebrow: "Property Highlights",
    title: "Designed for a smoother stay",
    items: [
      { icon: "access", title: "Smart access", description: "Digital access prepared for your stay." },
      { icon: "confirmation", title: "Instant confirmation", description: "Booking details delivered after payment." },
      { icon: "checkout", title: "Secure checkout", description: "Protected payment through Stripe." },
      { icon: "communication", title: "Direct communication", description: "Stay connected with the host." },
    ],
  },
  pinGoPanel: {
    eyebrow: "Powered by Pin&Go",
    title: "Smart hospitality behind every stay",
    description: "This reservation experience is powered by Pin&Go, connecting secure payments, smart access, guest messaging, and property automation into one seamless stay.",
    features: [
      { icon: "access", label: "Smart access" },
      { icon: "updates", label: "Guest updates" },
      { icon: "flow", label: "Contactless flow" },
      { icon: "property", label: "Smart property" },
    ],
  },
},
  es: {
  directBooking: "Reservación directa",
  guestLanguage: "Idioma del huésped",
  loadingProperty: "Cargando propiedad...",
  propertyNotFound: "Propiedad no encontrada",
  failedToLoadProperty: "No se pudo cargar la propiedad",
  upToGuests: "Hasta",
  guests: "huéspedes",
  minimum: "Mínimo",
  nights: "noche(s)",
  propertyOverview: "Descripción de la propiedad",
  defaultPropertyDescription:
    "Esta propiedad ofrece una estadía moderna y cómoda, gestionada por Pin&Go.",
  stayDetails: "Detalles de la estadía",
  checkIn: "Entrada",
  checkOut: "Salida",
  configuredByHost: "Configurado por el anfitrión",
  startingAt: "Desde",
  perNight: "/ noche",
  bookYourStaySecurely: "Reserve su estadía de forma segura",
  direct: "Directa",
  checkInDate: "Entrada",
  checkOutDate: "Salida",
  addDate: "Agregar fecha",
  adults: "Adultos",
  adultsHint: "13 años o más",
  children: "Niños",
  childrenHint: "De 2 a 12 años",
  fullName: "Nombre completo",
  guestNamePlaceholder: "Nombre del huésped",
  email: "Correo electrónico",
  phone: "Teléfono",
  completeRequiredFields:
    "Complete las fechas de entrada y salida, el nombre y el correo electrónico.",
  checkOutAfterCheckIn:
    "La fecha de salida debe ser posterior a la fecha de entrada.",
  securePreCheckinRequiredError:
    "Confirme que entiende el requisito de Registro Seguro antes de continuar.",
  cancellationTermsRequiredError:
    "Revise y acepte los términos de cancelación para continuar.",
  minimumStayPrefix: "La estadía mínima es de",
  maximumStayPrefix: "La estadía máxima es de",
  nightCountSuffix: "noche(s).",
  propertyNotLoaded: "La propiedad no está disponible",
  unableToCreateCheckout:
    "No se pudo preparar el pago.",
  unableToReserveProperty:
    "No se pudo reservar esta propiedad.",
  smsUpdatesTitle:
  "Actualizaciones SMS de Pin&Go Smart Stay (Opcional)",
  smsUpdatesDescription:
    "Reciba actualizaciones importantes sobre su estadía, incluyendo la confirmación de la reservación, el código  de acceso de la cerradura inteligente, instrucciones de entrada, recordatorios de salida y alertas importantes de  la propiedad.",
  smsUpdatesLegal:
    "La frecuencia de mensajes puede variar. Pueden aplicar tarifas de mensajes y datos. Responda STOP para  cancelar y HELP para recibir ayuda.",
  smsUpdatesOptionalNotice:
    "El consentimiento para recibir SMS es opcional y no es obligatorio para completar esta reservación. La   confirmación de la reservación y las instrucciones de entrada también se enviarán por correo electrónico.",
  securePaymentsPoweredBy:
    "Pagos seguros procesados por",
  redirectToStripe:
    "Será redirigido a Stripe Checkout para completar su pago.",
  legalAgreementPrefix:
    "Al completar su reservación, acepta los",
  termsOfService: "Términos de Servicio",
  privacyPolicy: "Política de Privacidad",
  legalAnd: "y",
  preparingCheckout: "Preparando el pago...",
  reserveNow: "Reservar ahora",
  optionalAddOns: "Cargos adicionales opcionales",
  perNightFee: "Por noche",
  perStayFee: "Por estadía",
  priceDetails: "Detalles del precio",
  guestCountLabel: "Huéspedes",
  nightlyRates: "Tarifas por noche",
  cleaningFeeLabel: "Cargo de limpieza",
  totalLabel: "Total",
  includedWithStay: "Incluido con su estadía",
  secureArrivalProcess:
    "Proceso de llegada segura",
  securePreCheckinTitle:
    "Registro Seguro Requerido",
  securePreCheckinIntro:
    "Después de reservar, el huésped principal deberá completar la Verificación de Identidad y aceptar el Acuerdo  del Huésped antes de que Pin&Go libere las credenciales de acceso.",
  reservationConfirmedStep:
    "Reservación confirmada",
  identityCheckStep:
    "Verificación de identidad",
  guestAgreementStep:
    "Acuerdo del huésped",
  accessReleasedStep:
    "Acceso liberado automáticamente",
  usuallyCompletedQuickly:
    "Normalmente se completa en solo unos minutos.",
  reservationConfirmedNotice:
    "Su reservación queda confirmada inmediatamente después del pago. Pin&Go entregará automáticamente sus   credenciales de acceso una vez completado el Registro Seguro.",
  securePreCheckinAcceptanceTitle:
    "Entiendo que el Registro Seguro es obligatorio antes de recibir acceso.",
  securePreCheckinAcceptanceText:
    "El huésped principal debe completar la Verificación de Identidad y aceptar el Acuerdo del Huésped. El pago   confirma la reservación, pero no completa estos requisitos ni libera las credenciales de acceso.",
cancellationPolicyLabel: "Política de cancelación",
importantNonRefundableCases:
  "Casos importantes no reembolsables",
cancellationTermsAgreement:
  "He revisado y acepto los términos de cancelación.",
eligibleRefundNotice:
  "Entiendo que cualquier reembolso elegible se calculará de acuerdo con la política mostrada anteriormente.",
refundCalculation:
  "Cálculo del reembolso",
  propertyHighlights: {
    eyebrow: "Aspectos destacados de la propiedad",
    title: "Diseñada para una estadía más sencilla",
    items: [
      { icon: "access", title: "Acceso inteligente", description: "Acceso digital preparado para su estadía." },
      { icon: "confirmation", title: "Confirmación inmediata", description: "Detalles de la reservación enviados después del pago." },
      { icon: "checkout", title: "Pago seguro", description: "Pago protegido a través de Stripe." },
      { icon: "communication", title: "Comunicación directa", description: "Manténgase en contacto con el anfitrión." },
    ],
  },
  pinGoPanel: {
    eyebrow: "Impulsado por Pin&Go",
    title: "Hospitalidad inteligente detrás de cada estadía",
    description: "Esta experiencia de reservación es impulsada por Pin&Go, conectando pagos seguros, acceso inteligente, comunicación con el huésped y automatización de la propiedad en una sola estadía fluida.",
    features: [
      { icon: "access", label: "Acceso inteligente" },
      { icon: "updates", label: "Actualizaciones al huésped" },
      { icon: "flow", label: "Proceso sin contacto" },
      { icon: "property", label: "Propiedad inteligente" },
    ],
  },
},

} as const;

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
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(n);
}

function formatNightlyDisplayMoney(value: string | number | null | undefined) {
  const n = Number(value ?? 0);

  if (!Number.isFinite(n) || n <= 0) return "$0";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

function formatCancellationWindow(
  hours: number,
  language: GuestLanguage
) {
  if (!Number.isFinite(hours) || hours <= 0) {
    return language === "es"
      ? "después del último periodo de reembolso"
      : "after the last refund window";
  }

  const days = hours / 24;

  if (Number.isInteger(days) && days >= 1) {
    if (language === "es") {
      return `${days} día${days === 1 ? "" : "s"}`;
    }

    return `${days} day${days === 1 ? "" : "s"}`;
  }

  if (language === "es") {
    return `${hours} hora${hours === 1 ? "" : "s"}`;
  }

  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

function formatRefundPercent(value: number) {
  const n = Number(value);

  if (!Number.isFinite(n)) return "0%";

  return `${Math.max(0, Math.min(100, n))}%`;
}

function getCancellationDeadlineDate(checkIn: string, hours: number) {
  if (!checkIn || !Number.isFinite(hours) || hours <= 0) {
    return null;
  }

  const date = new Date(`${checkIn}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(date.getHours() - hours);

  return format(date, "MMM d, yyyy");
}

function getScenarioLabel(
  scenario: PublicNonRefundableScenario,
  language: GuestLanguage
) {
  if (language === "es") {
    if (scenario === "EARLY_DEPARTURE") {
      return "Salidas anticipadas";
    }

    if (scenario === "DELAYED_ARRIVAL") {
      return "Llegadas retrasadas";
    }

    if (scenario === "REDUCED_NIGHTS") {
      return "Reducción de noches reservadas";
    }

    if (scenario === "WEATHER_RE_SCHEDULE") {
      return "Cambios de fecha relacionados con el clima";
    }

    return "Otros cambios posteriores a la reservación";
  }

  if (scenario === "EARLY_DEPARTURE") {
    return "Early departures";
  }

  if (scenario === "DELAYED_ARRIVAL") {
    return "Delayed arrivals";
  }

  if (scenario === "REDUCED_NIGHTS") {
    return "Reducing reserved nights";
  }

  if (scenario === "WEATHER_RE_SCHEDULE") {
    return "Weather-related reschedules";
  }

  return "Other post-booking changes";
}

function normalizeCancellationRefundRules(
  policy: PublicCancellationPolicy,
  language: GuestLanguage
): PublicCancellationRefundRule[] {
  if (
    Array.isArray(policy.refundRules) &&
    policy.refundRules.length > 0
  ) {
    return policy.refundRules
      .map((rule) => ({
        minHoursBeforeCheckIn: Math.max(
          0,
          Math.round(
            Number(rule.minHoursBeforeCheckIn ?? 0)
          )
        ),
        refundPercent: Math.max(
          0,
          Math.min(
            100,
            Number(rule.refundPercent ?? 0)
          )
        ),
        label:
          rule.label ||
          (language === "es"
            ? `${rule.refundPercent}% de reembolso`
            : `${rule.refundPercent}% refund`),
        description: rule.description ?? null,
      }))
      .sort(
        (a, b) =>
          b.minHoursBeforeCheckIn -
          a.minHoursBeforeCheckIn
      );
  }

  if (policy.type === "NON_REFUNDABLE") {
    return [
      {
        minHoursBeforeCheckIn: 0,
        refundPercent: 0,
        label:
          language === "es"
            ? "Sin reembolso"
            : "No refund",
        description:
          language === "es"
            ? "Esta reservación no es reembolsable después de confirmarse."
            : "This reservation is non-refundable after booking.",
      },
    ];
  }

  return [
    {
      minHoursBeforeCheckIn:
        policy.freeCancellationHoursBeforeCheckIn,
      refundPercent:
        policy.refundPercentBeforeDeadline,
      label:
        policy.refundPercentBeforeDeadline >= 100
          ? language === "es"
            ? "Reembolso completo"
            : "Full refund"
          : language === "es"
          ? "Reembolso antes de la fecha límite"
          : "Refund before deadline",
      description:
        language === "es"
          ? `${formatRefundPercent(
              policy.refundPercentBeforeDeadline
            )} de reembolso antes de la fecha límite de cancelación.`
          : `${formatRefundPercent(
              policy.refundPercentBeforeDeadline
            )} refund before the cancellation deadline.`,
    },
    {
      minHoursBeforeCheckIn: 0,
      refundPercent:
        policy.refundPercentAfterDeadline,
      label:
        policy.refundPercentAfterDeadline > 0
          ? language === "es"
            ? "Reembolso parcial"
            : "Partial refund"
          : language === "es"
          ? "Sin reembolso"
          : "No refund",
      description:
        language === "es"
          ? `${formatRefundPercent(
              policy.refundPercentAfterDeadline
            )} de reembolso después de la fecha límite de cancelación.`
          : `${formatRefundPercent(
              policy.refundPercentAfterDeadline
            )} refund after the cancellation deadline.`,
    },
  ].sort(
    (a, b) =>
      b.minHoursBeforeCheckIn -
      a.minHoursBeforeCheckIn
  );
}

function getRuleWindowLabel(
  rule: PublicCancellationRefundRule,
  index: number,
  rules: PublicCancellationRefundRule[],
  language: GuestLanguage
) {
  const previousRule =
    index > 0 ? rules[index - 1] : null;

  if (
    index === 0 &&
    rule.minHoursBeforeCheckIn > 0
  ) {
    const window = formatCancellationWindow(
      rule.minHoursBeforeCheckIn,
      language
    );

    return language === "es"
      ? `${window} o más antes de la entrada`
      : `${window}+ before check-in`;
  }

  if (
    rule.minHoursBeforeCheckIn > 0 &&
    previousRule
  ) {
    const currentWindow =
      formatCancellationWindow(
        rule.minHoursBeforeCheckIn,
        language
      );

    const previousWindow =
      formatCancellationWindow(
        previousRule.minHoursBeforeCheckIn,
        language
      );

    return language === "es"
      ? `De ${currentWindow} a ${previousWindow} antes de la entrada`
      : `${currentWindow} to ${previousWindow} before check-in`;
  }

  if (previousRule) {
    const previousWindow =
      formatCancellationWindow(
        previousRule.minHoursBeforeCheckIn,
        language
      );

    return language === "es"
      ? `Menos de ${previousWindow} antes de la entrada`
      : `Less than ${previousWindow} before check-in`;
  }

  return language === "es"
    ? "Después de confirmar la reservación"
    : "After booking confirmation";
}

function getRuleDateLabel({
  rule,
  index,
  rules,
  checkIn,
  language,
}: {
  rule: PublicCancellationRefundRule;
  index: number;
  rules: PublicCancellationRefundRule[];
  checkIn: string;
  language: GuestLanguage;
}) {
  if (!checkIn) return null;

  const previousRule =
    index > 0 ? rules[index - 1] : null;

  if (rule.minHoursBeforeCheckIn > 0) {
    const dateLabel = getCancellationDeadlineDate(
      checkIn,
      rule.minHoursBeforeCheckIn
    );

    if (!dateLabel) {
      return null;
    }

    return language === "es"
      ? `Hasta ${dateLabel}`
      : `Until ${dateLabel}`;
  }

  if (previousRule) {
    const dateLabel = getCancellationDeadlineDate(
      checkIn,
      previousRule.minHoursBeforeCheckIn
    );

    if (!dateLabel) {
      return null;
    }

    return language === "es"
      ? `Después de ${dateLabel}`
      : `After ${dateLabel}`;
  }

  return null;
}

function getPolicyTypeLabel(
  type: PublicCancellationPolicy["type"],
  language: GuestLanguage
) {
  if (type === "NON_REFUNDABLE") {
    return language === "es"
      ? "Reservación no reembolsable"
      : "Non-refundable reservation";
  }

  return language === "es"
    ? "Términos de reembolso para esta estadía"
    : "Refund terms for this stay";
}

function formatDateLabelForSentence(
  label: string | null | undefined,
  language: GuestLanguage
) {
  if (!label) return "";

  if (language === "es") {
    return label
      .replace(/^Hasta\s+/i, "hasta ")
      .replace(/^Después de\s+/i, "después de ");
  }

  return label
    .replace(/^Until\s+/i, "until ")
    .replace(/^After\s+/i, "after ");
}

function getCancellationPolicySummary(
  policy: PublicCancellationPolicy | null | undefined,
  checkIn: string,
  language: GuestLanguage
) {
  if (!policy) return null;

  const rules = normalizeCancellationRefundRules(
    policy,
    language
  );

  const scenarios = Array.isArray(
    policy.nonRefundableScenarios
  )
    ? policy.nonRefundableScenarios
    : [];

  const displayRules = rules.map((rule, index) => ({
    ...rule,
    windowLabel: getRuleWindowLabel(
      rule,
      index,
      rules,
      language
    ),
    dateLabel: getRuleDateLabel({
      rule,
      index,
      rules,
      checkIn,
      language,
    }),
    tone:
      rule.refundPercent >= 100
        ? "success"
        : rule.refundPercent > 0
        ? "warning"
        : "danger",
  }));

  const firstRefundRule = displayRules.find(
    (rule) => rule.refundPercent > 0
  );

  const firstNoRefundRule = displayRules.find(
    (rule) => rule.refundPercent <= 0
  );

  const headline =
    policy.type === "NON_REFUNDABLE"
      ? language === "es"
        ? "Esta reservación no es reembolsable."
        : "This reservation is non-refundable."
      : firstRefundRule?.dateLabel
      ? language === "es"
        ? `${formatRefundPercent(
            firstRefundRule.refundPercent
          )} de reembolso ${formatDateLabelForSentence(
            firstRefundRule.dateLabel,
            language
          )}.`
        : `${formatRefundPercent(
            firstRefundRule.refundPercent
          )} refund ${formatDateLabelForSentence(
            firstRefundRule.dateLabel,
            language
          )}.`
      : firstRefundRule
      ? language === "es"
        ? `${formatRefundPercent(
            firstRefundRule.refundPercent
          )} de reembolso: ${
            firstRefundRule.windowLabel
          }.`
        : `${formatRefundPercent(
            firstRefundRule.refundPercent
          )} refund ${
            firstRefundRule.windowLabel
          }.`
      : language === "es"
      ? "Los términos de cancelación aplican a esta reservación."
      : "Cancellation terms apply to this reservation.";

  const selectedDateSummary =
    checkIn &&
    displayRules.some((rule) => rule.dateLabel)
      ? language === "es"
        ? `Para las fechas seleccionadas: ${displayRules
            .filter((rule) => rule.dateLabel)
            .map((rule) => {
              const dateLabel =
                formatDateLabelForSentence(
                  rule.dateLabel,
                  language
                );

              if (rule.refundPercent >= 100) {
                return `reembolso completo ${dateLabel}`;
              }

              if (rule.refundPercent > 0) {
                return `${formatRefundPercent(
                  rule.refundPercent
                )} de reembolso ${dateLabel}`;
              }

              return `sin reembolso ${dateLabel}`;
            })
            .join("; ")}.`
        : `For your selected dates: ${displayRules
            .filter((rule) => rule.dateLabel)
            .map((rule) => {
              const dateLabel =
                formatDateLabelForSentence(
                  rule.dateLabel,
                  language
                );

              if (rule.refundPercent >= 100) {
                return `full refund ${dateLabel}`;
              }

              if (rule.refundPercent > 0) {
                return `${formatRefundPercent(
                  rule.refundPercent
                )} refund ${dateLabel}`;
              }

              return `no refund ${dateLabel}`;
            })
            .join("; ")}.`
      : "";

  return {
    title: getPolicyTypeLabel(
      policy.type,
      language
    ),
    headline,
    summaryText:
      selectedDateSummary ||
      policy.guestFacingSummary?.trim() ||
      policy.description ||
      (language === "es"
        ? "Revise los periodos de reembolso antes de completar su reservación."
        : "Review the refund windows below before completing your reservation."),
    rules: displayRules,
    scenarios,
    approvalNote:
      policy.requireHostApprovalOutsidePolicy
        ? language === "es"
          ? "Las cancelaciones fuera de la política de reembolso pueden requerir aprobación del anfitrión."
          : "Cancellations outside the refund policy may require host approval."
        : language === "es"
        ? "Pin&Go puede procesar automáticamente las cancelaciones elegibles."
        : "Eligible cancellations can be processed automatically by Pin&Go.",
    noRefundLabel: firstNoRefundRule
      ? firstNoRefundRule.windowLabel
      : null,
  };
}

function getRefundBasisDisclosure(
  policy: PublicCancellationPolicy | null | undefined,
  language: GuestLanguage
) {
  if (!policy) return null;

  if (policy.refundBasis === "NIGHTLY_SUBTOTAL") {
    return language === "es"
      ? "Los porcentajes de reembolso aplican únicamente al subtotal de las noches. Otros cargos, como limpieza, servicio, impuestos, complementos u otros cargos no nocturnos, podrían no ser reembolsables salvo que la ley o esta política indiquen lo contrario."
      : "Refund percentages apply to the nightly subtotal only. Other charges such as cleaning fees, service fees, taxes, add-ons, or other non-nightly charges may not be refundable unless required by law or specifically stated in this policy.";
  }

  if (policy.refundBasis === "NIGHTLY_PLUS_CLEANING") {
    return language === "es"
      ? "Los porcentajes de reembolso aplican al subtotal de las noches más el cargo de limpieza. Los impuestos, complementos, cargos de servicio u otros cargos no nocturnos podrían no ser reembolsables salvo que la ley o esta política indiquen lo contrario."
      : "Refund percentages apply to the nightly subtotal plus cleaning fee. Taxes, add-ons, service fees, or other non-nightly charges may not be refundable unless required by law or specifically stated in this policy.";
  }

  if (policy.refundBasis === "TOTAL_AMOUNT") {
    return language === "es"
      ? "Los porcentajes de reembolso aplican al importe elegible de la reservación, de acuerdo con la política de cancelación mostrada para esta estadía."
      : "Refund percentages apply to the eligible reservation amount according to the cancellation policy shown for this stay.";
  }

  if (policy.refundBasis === "CUSTOM") {
    return language === "es"
      ? "La elegibilidad del reembolso se calcula utilizando la base personalizada configurada para esta propiedad y mostrada en esta política."
      : "Refund eligibility is calculated using the custom refund basis configured for this property and shown in this policy.";
  }

  return null;
}

function buildCancellationTermsAcceptanceText(
  policy: PublicCancellationPolicy | null | undefined,
  summary: ReturnType<typeof getCancellationPolicySummary>
) {
  if (!policy || !summary) return "";

  const refundBasisDisclosure = getRefundBasisDisclosure(policy);

  const refundTimelineText = summary.rules
    .map((rule) => {
      const ruleWindow = rule.dateLabel || rule.windowLabel;

      return `${rule.label}: ${formatRefundPercent(
        rule.refundPercent
      )} refund - ${ruleWindow}`;
    })
    .join(" | ");

  const scenarioText =
    summary.scenarios.length > 0
      ? `Important non-refundable cases: ${summary.scenarios
          .map((scenario) => getScenarioLabel(scenario))
          .join(", ")}.`
      : "";

  return [
    "I understand and agree to the cancellation terms shown above, including how any eligible refund is calculated.",
    `Cancellation policy: ${summary.title}.`,
    summary.headline,
    summary.summaryText,
    refundBasisDisclosure ? `Refund basis: ${refundBasisDisclosure}` : "",
    refundTimelineText ? `Refund timeline: ${refundTimelineText}.` : "",
    scenarioText,
    summary.approvalNote,
  ]
    .filter(Boolean)
    .join("\n");
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


function toDateInputValue(date: Date | undefined) {
  if (!date) return "";
  return format(date, "yyyy-MM-dd");
}

function fromDateInputValue(value: string) {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00`);
}

function toLocalDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function calculateAmenityAmount(
  amenity: NonNullable<PublicProperty["amenities"]>[number],
  nights: number
) {
  const amount = Number(amenity.amount ?? 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return amenity.feeType === "PER_NIGHT" ? amount * nights : amount;
}

type AmenityIconKey =
  | "wifi"
  | "parking"
  | "pool"
  | "beach"
  | "hotTub"
  | "bath"
  | "grill"
  | "outdoor"
  | "kitchen"
  | "coffee"
  | "gym"
  | "tv"
  | "ac"
  | "laundry"
  | "pet"
  | "workspace"
  | "fireplace"
  | "bike"
  | "boat"
  | "games"
  | "elevator"
  | "lock"
  | "baby"
  | "bed"
  | "breakfast"
  | "camera"
  | "ev"
  | "default";

const AMENITY_ICONS: Array<[string[], AmenityIconKey]> = [
  [["wifi", "wi-fi", "internet"], "wifi"],
  [["parking", "garage", "estacionamiento", "garaje"], "parking"],
  [["pool", "swimming", "piscina", "alberca"], "pool"],
  [["beach", "beachfront", "ocean", "playa", "océano", "oceano"], "beach"],
  [["bath", "bathroom", "shower", "tub", "baño", "ducha", "bañera"], "bath"],
  [["hot tub", "jacuzzi", "spa", "hidromasaje"], "hotTub"],
  [["bbq", "grill", "barbecue", "parrilla", "barbacoa"], "grill"],
  [["outdoor", "patio", "terrace", "deck", "balcony", "yard", "garden", "terraza", "balcón", "balcon", "jardín", "jardin", "exterior"], "outdoor"],
  [["kitchen", "cook", "cocina", "kitchenette"], "kitchen"],
  [["coffee", "espresso", "café", "cafe", "cafetera"], "coffee"],
  [["gym", "fitness", "gimnasio"], "gym"],
  [["smart tv", "tv", "television", "televisión", "cinema", "cine"], "tv"],
  [["air conditioning", "a/c", "air conditioner", "aire acondicionado", "climatizado"], "ac"],
  [["washer", "dryer", "laundry", "washing machine", "lavadora", "secadora", "lavandería", "lavanderia"], "laundry"],
  [["pet", "dog", "cat", "mascota", "perro", "gato"], "pet"],
  [["workspace", "desk", "office", "espacio de trabajo", "escritorio", "oficina"], "workspace"],
  [["fireplace", "chimenea"], "fireplace"],
  [["bike", "bicycle", "bicicleta"], "bike"],
  [["dock", "marina", "boat", "muelle", "bote", "barco"], "boat"],
  [["game room", "games", "arcade", "pool table", "billiard", "juegos", "billar"], "games"],
  [["elevator", "lift", "ascensor"], "elevator"],
  [["smart lock", "self check-in", "keyless", "safe", "cerradura inteligente", "sin llave", "caja fuerte"], "lock"],
  [["crib", "baby", "infant", "cuna", "bebé", "bebe"], "baby"],
  [["king bed", "queen bed", "bed", "cama"], "bed"],
  [["breakfast", "desayuno"], "breakfast"],
  [["security camera", "camera", "cámara", "camara", "seguridad"], "camera"],
  [["ev charger", "electric vehicle", "cargador eléctrico", "cargador electrico", "vehículo eléctrico", "vehiculo electrico"], "ev"],
];

function getAmenityIconKey(name: string): AmenityIconKey {
  const value = name.toLowerCase();

  for (const [keywords, icon] of AMENITY_ICONS) {
    if (keywords.some((keyword) => value.includes(keyword))) {
      return icon;
    }
  }

  return "default";
}

function AmenityIcon({ name }: { name: string }) {
  const icon = getAmenityIconKey(name);

  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const shellStyle: React.CSSProperties = {
    width: 30,
    height: 30,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#0f172a",
    flexShrink: 0,
  };

  return (
    <span style={shellStyle} aria-hidden="true">
      {icon === "wifi" ? (
        <svg {...common}>
          <path d="M5 13a10 10 0 0 1 14 0" />
          <path d="M8.5 16.5a5 5 0 0 1 7 0" />
          <path d="M12 20h.01" />
        </svg>
      ) : icon === "parking" ? (
        <svg {...common}>
          <path d="M9 19V5h5a4 4 0 0 1 0 8H9" />
          <path d="M9 13h5" />
        </svg>
      ) : icon === "pool" || icon === "beach" || icon === "hotTub" ? (
        <svg {...common}>
          <path d="M3 16c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 2-1" />
          <path d="M3 20c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 2-1" />
          <path d="M7 12V5h10v7" />
        </svg>
      ) : icon === "bath" ? (
        <svg {...common}>
          <path d="M4 11h16" />
          <path d="M5 11v3a5 5 0 0 0 5 5h4a5 5 0 0 0 5-5v-3" />
          <path d="M7 19l-1 2" />
          <path d="M18 19l1 2" />
          <path d="M8 11V6a3 3 0 0 1 3-3h1" />
          <path d="M12 4h4" />
          <path d="M16 4v3" />
        </svg>
      ) : icon === "grill" || icon === "fireplace" ? (
        <svg {...common}>
          <path d="M8 14a4 4 0 0 1 8 0" />
          <path d="M6 14h12" />
          <path d="M8 18h8" />
          <path d="M9 22l1-4" />
          <path d="M15 22l-1-4" />
          <path d="M12 3c1.5 1.5 1.5 3 0 4.5" />
        </svg>
      ) : icon === "outdoor" ? (
        <svg {...common}>
          <path d="M12 22V12" />
          <path d="M12 12c-4 0-7-2.5-8-7 4 0 7 2.5 8 7Z" />
          <path d="M12 12c4 0 7-2.5 8-7-4 0-7 2.5-8 7Z" />
        </svg>
      ) : icon === "kitchen" ? (
        <svg {...common}>
          <path d="M7 3v18" />
          <path d="M4 3v6a3 3 0 0 0 6 0V3" />
          <path d="M17 3v18" />
          <path d="M14 7h6" />
        </svg>
      ) : icon === "coffee" || icon === "breakfast" ? (
        <svg {...common}>
          <path d="M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z" />
          <path d="M16 10h2a2 2 0 0 1 0 4h-2" />
          <path d="M6 3v2" />
          <path d="M10 3v2" />
          <path d="M14 3v2" />
        </svg>
      ) : icon === "gym" ? (
        <svg {...common}>
          <path d="M6 6v12" />
          <path d="M18 6v12" />
          <path d="M3 9v6" />
          <path d="M21 9v6" />
          <path d="M6 12h12" />
        </svg>
      ) : icon === "tv" || icon === "workspace" ? (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="11" rx="2" />
          <path d="M8 21h8" />
          <path d="M12 16v5" />
        </svg>
      ) : icon === "ac" ? (
        <svg {...common}>
          <path d="M12 3v18" />
          <path d="M5 6l14 12" />
          <path d="M19 6L5 18" />
          <path d="M8 3l4 4 4-4" />
          <path d="M8 21l4-4 4 4" />
        </svg>
      ) : icon === "laundry" ? (
        <svg {...common}>
          <rect x="6" y="3" width="12" height="18" rx="2" />
          <circle cx="12" cy="13" r="4" />
          <path d="M9 7h.01" />
        </svg>
      ) : icon === "pet" ? (
        <svg {...common}>
          <circle cx="6" cy="9" r="2" />
          <circle cx="18" cy="9" r="2" />
          <circle cx="9" cy="5" r="2" />
          <circle cx="15" cy="5" r="2" />
          <path d="M8 16c0-2 2-4 4-4s4 2 4 4c0 1.5-1 3-4 3s-4-1.5-4-3Z" />
        </svg>
      ) : icon === "bike" ? (
        <svg {...common}>
          <circle cx="6" cy="17" r="3" />
          <circle cx="18" cy="17" r="3" />
          <path d="M8.5 17 12 9l3.5 8" />
          <path d="M10 9h4" />
          <path d="M14 6h2" />
        </svg>
      ) : icon === "boat" ? (
        <svg {...common}>
          <path d="M4 17h16l-2 4H6l-2-4Z" />
          <path d="M12 3v14" />
          <path d="M12 5 7 13h5" />
          <path d="M12 5l5 8h-5" />
        </svg>
      ) : icon === "games" ? (
        <svg {...common}>
          <rect x="4" y="8" width="16" height="9" rx="4" />
          <path d="M8 12h4" />
          <path d="M10 10v4" />
          <path d="M16 12h.01" />
          <path d="M18 14h.01" />
        </svg>
      ) : icon === "elevator" ? (
        <svg {...common}>
          <rect x="6" y="3" width="12" height="18" rx="2" />
          <path d="M10 8l2-2 2 2" />
          <path d="M10 16l2 2 2-2" />
        </svg>
      ) : icon === "lock" ? (
        <svg {...common}>
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          <path d="M12 14v2" />
        </svg>
      ) : icon === "baby" ? (
        <svg {...common}>
          <path d="M7 10h10l-1 9H8l-1-9Z" />
          <path d="M9 10V7a3 3 0 0 1 6 0v3" />
          <path d="M9 19l-2 2" />
          <path d="M15 19l2 2" />
        </svg>
      ) : icon === "bed" ? (
        <svg {...common}>
          <path d="M4 11V5" />
          <path d="M20 19v-6a2 2 0 0 0-2-2H4v8" />
          <path d="M4 15h16" />
          <path d="M8 11V9h4v2" />
        </svg>
      ) : icon === "camera" ? (
        <svg {...common}>
          <rect x="4" y="7" width="16" height="12" rx="2" />
          <circle cx="12" cy="13" r="3" />
          <path d="M9 7l1.5-2h3L15 7" />
        </svg>
      ) : icon === "ev" ? (
        <svg {...common}>
          <path d="M7 2v8" />
          <path d="M11 2v8" />
          <path d="M7 10h4a3 3 0 0 1 3 3v1" />
          <path d="M14 14h3a3 3 0 0 1 3 3v5" />
          <path d="M6 22h8" />
        </svg>
      ) : (
        <svg {...common}>
          <path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />
        </svg>
      )}
    </span>
  );
}

type PublicFeatureIconType =
  | "access"
  | "confirmation"
  | "checkout"
  | "communication";

function PublicFeatureIcon({ type }: { type: PublicFeatureIconType }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <span style={styles.trustIcon} aria-hidden="true">
      <svg {...common}>
        {type === "access" ? (
          <>
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            <path d="M12 14v2" />
          </>
        ) : type === "confirmation" ? (
          <>
            <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
          </>
        ) : type === "checkout" ? (
          <>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 10h18" />
            <path d="M7 15h3" />
            <path d="M14 15h3" />
          </>
        ) : (
          <>
            <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />
            <path d="M8 9h8" />
            <path d="M8 13h5" />
          </>
        )}
      </svg>
    </span>
  );
}

type PinGoPanelIconType =
  | "access"
  | "updates"
  | "flow"
  | "property";

function PinGoPanelIcon({ type }: { type: PinGoPanelIconType }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <span style={styles.pinGoFeatureIcon} aria-hidden="true">
      <svg {...common}>
        {type === "access" ? (
          <>
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            <path d="M12 14v2" />
          </>
        ) : type === "updates" ? (
          <>
            <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />
            <path d="M8 9h8" />
            <path d="M8 13h5" />
          </>
        ) : type === "flow" ? (
          <>
            <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
          </>
        ) : (
          <>
            <path d="M3 11 12 4l9 7" />
            <path d="M5 10v10h14V10" />
            <path d="M9 20v-6h6v6" />
          </>
        )}
      </svg>
    </span>
  );
}

type StayDetailIconType = "checkIn" | "checkOut";

function StayDetailIcon({ type }: { type: StayDetailIconType }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <span style={styles.stayDetailIcon} aria-hidden="true">
      <svg {...common}>
        {type === "checkIn" ? (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </>
        ) : (
          <>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </>
        )}
      </svg>
    </span>
  );
}

function SmartStayIcon() {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <span style={styles.smartStayIcon} aria-hidden="true">
      <svg {...common}>
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M11 18h2" />
        <path d="M9 6h6" />
        <path d="M9.5 11.5 11.5 13.5 15 10" />
      </svg>
    </span>
  );
}

const SECURE_PRE_CHECKIN_DISCLOSURE_VERSION = "SECURE_PRECHECKIN_DISCLOSURE_V1";

const SECURE_PRE_CHECKIN_DISCLOSURE_TEXT =
  "Secure Pre-check-in is required before access credentials are released. " +
  "The primary guest must complete Identity Check and accept the Guest Agreement. " +
  "The reservation may be confirmed after payment, but access remains pending until all required steps are completed. " +
  "El Registro Seguro es obligatorio antes de que se liberen las credenciales de acceso. " +
  "El huésped principal debe completar la Verificación de Identidad y aceptar el Acuerdo del Huésped. " +
  "La reservación puede quedar confirmada después del pago, pero el acceso permanece pendiente hasta completar todos los requisitos.";

export default function PublicPropertyDetailPage() {
  const { organizationSlug, propertySlug } = useParams();

  const [property, setProperty] = useState<PublicProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
   const [preferredLanguage, setPreferredLanguage] =
  useState<GuestLanguage>(() => {
    try {
      const storedLanguage = window.localStorage
        .getItem(GUEST_LANGUAGE_STORAGE_KEY)
        ?.trim()
        .toLowerCase();

      return storedLanguage === "es" ? "es" : "en";
    } catch {
      return "en";
    }
  }); 
  
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [stayNotificationsConsent, setStayNotificationsConsent] = useState(false);  
  const [cancellationTermsAccepted, setCancellationTermsAccepted] = useState(false);
  const [
  securePreCheckinRequirementAccepted,
  setSecurePreCheckinRequirementAccepted,
] = useState(false);
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<string[]>([]);
  const [pricing, setPricing] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

 
  const [blockedDates, setBlockedDates] = useState<string[]>([]);

  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [checkoutStarted, setCheckoutStarted] = useState(false);
  const [confirmationStarted, setConfirmationStarted] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  
  function handlePreferredLanguageChange(
  language: GuestLanguage
) {
  setPreferredLanguage(language);

  try {
    window.localStorage.setItem(
      GUEST_LANGUAGE_STORAGE_KEY,
      language
    );
  } catch {
    // The guest experience can continue without browser persistence.
  }
}

  const copy = PUBLIC_PROPERTY_COPY[preferredLanguage];
  const photos = useMemo(() => getPhotoUrls(property?.publicPhotos), [property]);
  const nights = useMemo(() => diffNights(checkIn, checkOut), [checkIn, checkOut]);

const localCancellationPolicySummary = useMemo(
  () =>
    getCancellationPolicySummary(
      property?.cancellationPolicy,
      checkIn,
      preferredLanguage
    ),
  [
    property?.cancellationPolicy,
    checkIn,
    preferredLanguage,
  ]
);

const cancellationPolicySummary = useMemo(() => {
  const presentation =
    property?.cancellationPolicyPresentation;

  if (!presentation) {
    return localCancellationPolicySummary;
  }

  const localRules =
    localCancellationPolicySummary?.rules ?? [];

  return {
    title: presentation.title,
    headline: presentation.headline,
    summaryText: presentation.summary,

    rules: presentation.rules.map((rule, index) => {
      const localRule = localRules[index];

      return {
        minHoursBeforeCheckIn:
          rule.minHoursBeforeCheckIn,
        refundPercent: rule.refundPercent,
        label: rule.label,
        description: rule.description,
        windowLabel: rule.windowLabel,
        dateLabel: localRule?.dateLabel ?? null,
        tone:
          rule.refundPercent >= 100
            ? "success"
            : rule.refundPercent > 0
            ? "warning"
            : "danger",
      };
    }),

    scenarios: presentation.nonRefundableScenarios.map(
      (scenario) => scenario.code
    ),

    approvalNote:
      presentation.approvalNote ??
      presentation.automationNote ??
      "",

    noRefundLabel:
      presentation.rules.find(
        (rule) => rule.refundPercent <= 0
      )?.windowLabel ?? null,
  };
}, [
  property?.cancellationPolicyPresentation,
  localCancellationPolicySummary,
]);
const cancellationRefundBasisDisclosure = useMemo(
  () =>
    property?.cancellationPolicyPresentation
      ?.refundBasisDisclosure ??
    getRefundBasisDisclosure(
      property?.cancellationPolicy,
      preferredLanguage
    ),
  [
    property?.cancellationPolicyPresentation,
    property?.cancellationPolicy,
    preferredLanguage,
  ]
);

const cancellationTermsAcceptanceText = useMemo(
  () =>
    property?.cancellationPolicyPresentation
      ?.acceptanceText ??
    buildCancellationTermsAcceptanceText(
      property?.cancellationPolicy,
      cancellationPolicySummary
    ),
  [
    property?.cancellationPolicyPresentation,
    property?.cancellationPolicy,
    cancellationPolicySummary,
  ]
);

const requiresCancellationTermsAcceptance = Boolean(cancellationPolicySummary);

const reserveButtonDisabled =
  submitting ||
  !checkIn ||
  !checkOut ||
  !securePreCheckinRequirementAccepted ||
  (requiresCancellationTermsAcceptance && !cancellationTermsAccepted);
  const blockedDateObjects = useMemo(
    () =>
      blockedDates
      .map((dateKey) => fromDateInputValue(dateKey))
      .filter((date): date is Date => Boolean(date)),
  [blockedDates]
);

  const nightlyRate = Number(property?.baseNightlyRate ?? 0);
  const cleaningFee = Number(property?.cleaningFee ?? 0);
  const subtotal = nights * nightlyRate;
  const totalGuests = adults + children;

  const optionalAmenities =
    property?.amenities?.filter((a) => a.chargeMode === "OPTIONAL") ?? [];

  const requiredAmenities =
    property?.amenities?.filter((a) => a.chargeMode === "REQUIRED") ?? [];

  const includedAmenities =
    property?.amenities?.filter((a) => a.chargeMode === "INCLUDED") ?? [];

  const requiredAmenitiesTotal = requiredAmenities.reduce(
    (sum, amenity) => sum + calculateAmenityAmount(amenity, nights),
    0
  );

 const optionalAmenitiesTotal = optionalAmenities.reduce((sum, amenity) => {
  if (!selectedAmenityIds.includes(amenity.id)) {
    return sum;
  }

  return sum + calculateAmenityAmount(amenity, nights);
}, 0);

const taxableSubtotal =
  subtotal +
  cleaningFee +
  requiredAmenitiesTotal +
  optionalAmenitiesTotal;

const taxesTotal = (property?.taxes ?? []).reduce((sum, tax) => {
  const percentage = Number(tax.percentage ?? 0);

  if (!Number.isFinite(percentage) || percentage <= 0) {
    return sum;
  }

  return sum + taxableSubtotal * (percentage / 100);
}, 0);

const total =
  pricing?.totalAmount ??
  taxableSubtotal + taxesTotal;
  
const displayNightlySubtotal = pricing?.nightlySubtotal ?? subtotal;
const displayCleaningFee = pricing?.cleaningFee ?? cleaningFee;
const displayTotal = pricing?.totalAmount ?? total;

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
         `${API_BASE}/api/public-booking/${organizationSlug}/${propertySlug}?lang=${preferredLanguage}`
       );

        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Property not found");
        }

        if (active) {
          setProperty(data.property ?? data.item);
        }
      } catch (err: any) {
        if (active) {
          setPageError(
            err?.message || copy.failedToLoadProperty
          );
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
  }, [
  organizationSlug,
  propertySlug,
  copy.failedToLoadProperty,
  preferredLanguage,
]);

useEffect(() => {
  if (!property?.id) return;

  let active = true;

  async function loadBlockedDates() {
    try {
      const today = new Date();
      const from = toDateInputValue(today);
      const to = toDateInputValue(addDays(today, 365));

      const res = await fetch(`${API_BASE}/api/public-booking/blocked-dates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          propertyId: property?.id,
          from,
          to,
        }),
      });

      const data = await res.json();

      if (!active) return;

      if (!res.ok || !data.ok) {
        setBlockedDates([]);
        return;
      }

      setBlockedDates(Array.isArray(data.blockedDates) ? data.blockedDates : []);
    } catch (err) {
  console.error("[blocked dates frontend error]", err);
  if (active) {
    setBlockedDates([]);
  }
}

  }

  loadBlockedDates();

  return () => {
    active = false;
  };
}, [property?.id]);

useEffect(() => {
  let active = true;

  async function loadPricing() {
    try {
      if (!property?.id || !checkIn || !checkOut || nights <= 0) {
        setPricing(null);
        return;
      }

      const res = await fetch(`${API_BASE}/api/public-booking/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          propertyId: property.id,
          checkIn,
          checkOut,
          selectedAmenityIds,
        }),
      });

      const data = await res.json();

      if (!active) return;

      if (!res.ok || !data.ok) {
        setPricing(null);
        return;
      }

      setPricing(data.pricing);
    } catch (err) {
      console.error("[pricing quote error]", err);

      if (active) {
        setPricing(null);
      }
    }
  }

  loadPricing();

  return () => {
    active = false;
  };
}, [
  property?.id,
  checkIn,
  checkOut,
  selectedAmenityIds,
  nights,
]);

useEffect(() => {
  setCancellationTermsAccepted(false);
  setConfirmationStarted(false);
}, [
  checkIn,
  checkOut,
  property?.cancellationPolicy?.policyId,
  property?.cancellationPolicy?.snapshotAt,
  property?.cancellationPolicy?.refundBasis,
]); 
 
useEffect(() => {
  setSecurePreCheckinRequirementAccepted(false);
}, [checkIn, checkOut, property?.id]);

  async function handleReserve(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSubmitting(true);
      setBookingError(null);

      if (!property) {
        throw new Error(copy.propertyNotLoaded);
      }
      if (
     !checkIn ||
     !checkOut ||
     !guestName.trim() ||
     !guestEmail.trim()
   ) {
     throw new Error(copy.completeRequiredFields);
   }
      if (nights <= 0) {
  throw new Error(copy.checkOutAfterCheckIn);
}
      if (!securePreCheckinRequirementAccepted) {
        throw new Error(
          copy.securePreCheckinRequiredError
       );
     }
      if (
        requiresCancellationTermsAcceptance &&
        !cancellationTermsAccepted
      ) {
        throw new Error(
          copy.cancellationTermsRequiredError
        );
      }
      if (nights < (property.minimumNights ?? 1)) {
        throw new Error(
          `${copy.minimumStayPrefix} ${
            property.minimumNights ?? 1
          } ${copy.nightCountSuffix}`
        );
      }
      if (
        property.maximumNights &&
        nights > property.maximumNights
      ) {
        throw new Error(
          `${copy.maximumStayPrefix} ${
            property.maximumNights
          } ${copy.nightCountSuffix}`
        );
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
  preferredLanguage,
  stayNotificationsConsent,
  guestAcceptedSecurePreCheckinRequirement:
  securePreCheckinRequirementAccepted,

guestAcceptedSecurePreCheckinRequirementAt:
  securePreCheckinRequirementAccepted
    ? new Date().toISOString()
    : null,

guestAcceptedSecurePreCheckinRequirementText:
  SECURE_PRE_CHECKIN_DISCLOSURE_TEXT,

guestAcceptedSecurePreCheckinRequirementVersion:
  SECURE_PRE_CHECKIN_DISCLOSURE_VERSION,

guestAcceptedSecurePreCheckinRequirementSource:
  "DIRECT_BOOKING_CHECKOUT",
  guestAcceptedCancellationTerms: cancellationTermsAccepted,
  guestAcceptedCancellationTermsAt: cancellationTermsAccepted
    ? new Date().toISOString()
    : null,
  guestAcceptedCancellationTermsText: cancellationTermsAcceptanceText,
  cancellationPolicyRefundBasis: property.cancellationPolicy?.refundBasis ?? null,
  selectedAmenityIds,
}),
      });

      const data = await res.json();

      if (!res.ok || !data.ok || !data.checkoutUrl) {
        throw new Error(
          data.error || copy.unableToCreateCheckout
        );
      }
      window.location.href = data.checkoutUrl;
      } catch (err: any) {
        setBookingError(err?.message || "Unable to reserve this property.");
      } finally {
      setSubmitting(false);
    }
  }

return (
  <div className="pbe-page" style={styles.page}>
    <header className="pbe-header" style={styles.header}>
      <div className="pbe-header-inner" style={styles.headerInner}>
        <Link
          to={`/book/${organizationSlug}`}
          className="pbe-brand"
          style={styles.brandWrap}
        >
          <img
            src="/pin-go-logo.png"
            alt="Pin&Go logo"
            style={styles.logo}
            onError={(e) => {
              (
                e.currentTarget as HTMLImageElement
              ).style.display = "none";
            }}
          />

          <div>
            <div style={styles.brandName}>Pin&Go</div>
            <div style={styles.slogan}>
              {copy.directBooking}
            </div>
          </div>
        </Link>

        <div
          role="group"
          aria-label={copy.guestLanguage}
          className="pbe-language"
          style={styles.languageSelector}
        >
          <button
            type="button"
            onClick={() =>
              handlePreferredLanguageChange("en")
            }
            aria-pressed={
              preferredLanguage === "en"
            }
            style={{
              ...styles.languageButton,
              ...(preferredLanguage === "en"
                ? styles.languageButtonActive
                : {}),
            }}
          >
            English
          </button>

          <button
            type="button"
            onClick={() =>
              handlePreferredLanguageChange("es")
            }
            aria-pressed={
              preferredLanguage === "es"
            }
            style={{
              ...styles.languageButton,
              ...(preferredLanguage === "es"
                ? styles.languageButtonActive
                : {}),
            }}
          >
            Español
          </button>
        </div>
      </div>
    </header>
      <main>
        {loading ? (
          <section style={styles.heroSection}>
            <div style={styles.heroContainer}>
              <h1 style={styles.heroTitle}>
                {copy.loadingProperty}
              </h1>
            </div>
          </section>
        ) : pageError || !property ? (
          <section style={styles.sectionAlt}>
            <div style={styles.container}>
              <div style={styles.errorBox}>
                {pageError || copy.propertyNotFound}
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="pbe-rescue-hero" style={styles.heroSection}>
              {photos[0] ? (
                <img
                  className="pbe-rescue-hero-image"
                  src={photos[0]}
                  alt=""
                  aria-hidden="true"
                />
              ) : null}
              <div className="pbe-rescue-hero-shade" aria-hidden="true" />
              <div className="pbe-rescue-hero-content" style={styles.heroContainer}>
                <div className="pbe-rescue-eyebrow" style={styles.badge}>
                  {property.organization.name}
                </div>

                <h1 className="pbe-rescue-title" style={styles.heroTitle}>
                  {property.publicTitle || property.name}
                </h1>

                <div className="pbe-rescue-accent" aria-hidden="true" />

                <div className="pbe-rescue-meta" style={styles.heroMeta}>
                  {location ? <span>📍 {location}</span> : null}

                  {property.maxGuests ? (
                    <span>
                      👥 {copy.upToGuests} {property.maxGuests} {copy.guests}
                    </span>
                  ) : null}
                  <span>
                    🌙 {copy.minimum} {property.minimumNights ?? 1}{" "}
                    {copy.nights}
                  </span>
                </div>

                {photos.length > 1 ? (
                  <button
                    className="pbe-rescue-gallery-action"
                    type="button"
                    onClick={() => setSelectedPhotoIndex(0)}
                  >
                    {preferredLanguage === "es"
                      ? `Ver las ${photos.length} fotos`
                      : `View all ${photos.length} photos`}
                    <span aria-hidden="true">↗</span>
                  </button>
                ) : null}
              </div>
            </section>
<section style={styles.sectionAlt}>
  <div style={styles.container}>
    <div className="pbe-retired-experience" aria-hidden="true" style={styles.topBookingGrid}>
      <div style={styles.topBookingLeft}>
        <div className="pbe-legacy-gallery" style={styles.enterpriseGallery}>
          {photos.length > 1 ? (
            <button
              type="button"
              style={styles.showAllPhotosButton}
              onClick={() => setSelectedPhotoIndex(0)}
            >
              📷 Show all {photos.length} photos
            </button>
          ) : null}

          {photos.length > 0 ? (
            <>
              <img
         
  src={photos[0]}
  alt={property.publicTitle || property.name}
  style={{
    ...styles.galleryMainImage,
    cursor: "pointer",
  }}
  onClick={() => setSelectedPhotoIndex(0)}
/>
                      <div style={styles.gallerySideGrid}>
                        {photos.slice(1, 5).map((photo, index) => (
  <img
    key={photo}
    src={photo}
    alt={property.publicTitle || property.name}
    style={{
      ...styles.gallerySideImage,
      cursor: "pointer",
    }}
    onClick={() => setSelectedPhotoIndex(index + 1)}
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
      </div>

      {/* aquí va el form bookingCard movido */}
    </div>

                <section className="pbe-section pbe-story" aria-labelledby="pbe-story-title">
                  <div className="pbe-story-copy">
                    <p className="pbe-kicker">
                      {preferredLanguage === "es" ? "LA EXPERIENCIA" : "THE EXPERIENCE"}
                    </p>
                    <h2 id="pbe-story-title">
                      {preferredLanguage === "es"
                        ? "Un lugar que se siente especial antes de llegar."
                        : "A place that feels special before you arrive."}
                    </h2>
                    <p className="pbe-lead">
                      {property.publicDescription || copy.defaultPropertyDescription}
                    </p>
                    <div className="pbe-trust-list">
                      <span>{preferredLanguage === "es" ? "Reserva directa y segura" : "Secure direct booking"}</span>
                      <span>{preferredLanguage === "es" ? "Llegada autónoma y protegida" : "Protected, autonomous arrival"}</span>
                      <span>{preferredLanguage === "es" ? "Experiencia operada por Pin&Go" : "Experience operated by Pin&Go"}</span>
                    </div>
                  </div>
                  {photos[1] || photos[0] ? (
                    <button
                      className="pbe-editorial-photo"
                      type="button"
                      onClick={() => setSelectedPhotoIndex(photos[1] ? 1 : 0)}
                      aria-label={preferredLanguage === "es" ? "Abrir fotografía de la propiedad" : "Open property photo"}
                    >
                      <img src={photos[1] || photos[0]} alt={property.publicTitle || property.name} />
                    </button>
                  ) : null}
                </section>

                {photos.length > 1 ? (
                  <section className="pbe-section pbe-gallery" aria-labelledby="pbe-gallery-title">
                    <div className="pbe-gallery-heading">
                      <div>
                        <p className="pbe-kicker">{preferredLanguage === "es" ? "DESCUBRE EL ESPACIO" : "DISCOVER THE SPACE"}</p>
                        <h2 id="pbe-gallery-title">
                          {preferredLanguage === "es" ? "Una estadía que comienza con la vista." : "A stay that begins with the view."}
                        </h2>
                      </div>
                      <p className="pbe-lead">
                        {preferredLanguage === "es"
                          ? "Recorre cada detalle antes de elegir tus fechas."
                          : "Explore every detail before choosing your dates."}
                      </p>
                    </div>
                    <div className={`pbe-gallery-grid pbe-gallery-grid--${Math.min(photos.length, 5)}`}>
                      {photos.slice(0, 5).map((photo, index) => (
                        <button
                          key={`${photo}-${index}`}
                          type="button"
                          onClick={() => setSelectedPhotoIndex(index)}
                          aria-label={`${preferredLanguage === "es" ? "Abrir fotografía" : "Open photo"} ${index + 1}`}
                        >
                          <img src={photo} alt={`${property.publicTitle || property.name} ${index + 1}`} />
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="pbe-section pbe-description" aria-labelledby="pbe-description-title">
                  <div className="pbe-description-intro">
                    <p className="pbe-kicker">
                      {preferredLanguage === "es" ? "CONOCE LA PROPIEDAD" : "DISCOVER THE PROPERTY"}
                    </p>
                    <h2 id="pbe-description-title">
                      {preferredLanguage === "es" ? "Cada detalle tiene una intención." : "Every detail has a purpose."}
                    </h2>
                    <p className="pbe-lead">
                      {preferredLanguage === "es"
                        ? "Explora la historia completa cuando quieras; la decisión de reservar permanece simple."
                        : "Explore the full story when you want; the decision to book stays simple."}
                    </p>
                  </div>
                  <div className="pbe-description-list">
                    <details open>
                      <summary>
                        <span>01</span>
                        <strong>{preferredLanguage === "es" ? "La propiedad" : "The property"}</strong>
                        <i aria-hidden="true">+</i>
                      </summary>
                      <p>{property.publicDescription || copy.defaultPropertyDescription}</p>
                    </details>
                    <details>
                      <summary>
                        <span>02</span>
                        <strong>{preferredLanguage === "es" ? "Llegada y salida" : "Arrival and departure"}</strong>
                        <i aria-hidden="true">+</i>
                      </summary>
                      <p>
                        {preferredLanguage === "es"
                          ? `Check-in ${formatDisplayTime(property.checkInTime) || copy.configuredByHost}. Check-out ${formatDisplayTime(property.checkOutTime) || "11:00 AM"}.`
                          : `Check-in ${formatDisplayTime(property.checkInTime) || copy.configuredByHost}. Check-out ${formatDisplayTime(property.checkOutTime) || "11:00 AM"}.`}
                      </p>
                    </details>
                    <details>
                      <summary>
                        <span>03</span>
                        <strong>{preferredLanguage === "es" ? "Llegada segura" : "Secure arrival"}</strong>
                        <i aria-hidden="true">+</i>
                      </summary>
                      <p>{copy.securePreCheckinIntro}</p>
                    </details>
                  </div>
                </section>

                <section className="pbe-section pbe-amenities" aria-labelledby="pbe-amenities-title">
                  <div className="pbe-section-heading">
                    <p className="pbe-kicker">{preferredLanguage === "es" ? "AMENIDADES" : "AMENITIES"}</p>
                    <h2 id="pbe-amenities-title">
                      {preferredLanguage === "es" ? "Todo lo esencial. Y algo más." : "Everything essential. And more."}
                    </h2>
                    <p className="pbe-lead">
                      {preferredLanguage === "es"
                        ? "Comodidades seleccionadas para que la estadía se sienta natural desde el primer momento."
                        : "Thoughtful comforts that make the stay feel effortless from the first moment."}
                    </p>
                  </div>
                  <div className="pbe-amenity-grid">
                    {[...includedAmenities, ...copy.propertyHighlights.items].slice(0, 8).map((item: any) => (
                      <article className="pbe-amenity-card" key={item.id || item.icon || item.title}>
                        <div className="pbe-amenity-icon">
                          <AmenityIcon name={item.name || item.title} />
                        </div>
                        <h3>{item.name || item.title}</h3>
                        <p>{item.description || (preferredLanguage === "es" ? "Incluido con tu estadía." : "Included with your stay.")}</p>
                      </article>
                    ))}
                  </div>
                </section>

                {location ? (
                  <section className="pbe-section pbe-location" aria-labelledby="pbe-new-location-title">
                    <div>
                      <p className="pbe-kicker">{preferredLanguage === "es" ? "LOCALIZACIÓN" : "LOCATION"}</p>
                      <h2 id="pbe-new-location-title">
                        {preferredLanguage === "es" ? "Cerca de todo. Lejos de lo ordinario." : "Close to everything. Far from ordinary."}
                      </h2>
                      <p className="pbe-lead">{location}</p>
                      <a
                        className="pbe-outline-action"
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {preferredLanguage === "es" ? "Explorar ubicación" : "Explore location"}
                        <span aria-hidden="true">↗</span>
                      </a>
                    </div>
                    <div className="pbe-map" aria-hidden="true">
                      <div className="pbe-map-pin">
                        <strong>{property.publicTitle || property.name}</strong>
                        <small>{property.city || property.region || property.country}</small>
                      </div>
                    </div>
                  </section>
                ) : null}

                {cancellationPolicySummary ? (
                  <section className="pbe-section pbe-policies" id="booking-policies" aria-labelledby="pbe-policies-title">
                    <div className="pbe-section-heading">
                      <p className="pbe-kicker">{preferredLanguage === "es" ? "ANTES DE RESERVAR" : "BEFORE YOU BOOK"}</p>
                      <h2 id="pbe-policies-title">
                        {preferredLanguage === "es" ? "Claridad antes de decidir." : "Clarity before you decide."}
                      </h2>
                      <p className="pbe-lead">{cancellationPolicySummary.summaryText}</p>
                    </div>
                    <div className="pbe-policy-list">
                      <details>
                        <summary>
                          <strong>{cancellationPolicySummary.title}</strong>
                          <span>{preferredLanguage === "es" ? "Leer política completa" : "Read full policy"} ＋</span>
                        </summary>
                        <p>{cancellationPolicySummary.headline}</p>
                        {cancellationPolicySummary.rules.map((rule, index) => (
                          <p key={`${rule.label}-${index}`}>
                            <strong>{rule.label} · {formatRefundPercent(rule.refundPercent)}</strong><br />
                            {rule.windowLabel}{rule.description ? ` — ${rule.description}` : ""}
                          </p>
                        ))}
                        <p>{cancellationPolicySummary.approvalNote}</p>
                      </details>
                      <details id="identity-check-policy">
                        <summary>
                          <strong>{copy.identityCheckStep}</strong>
                          <span>{preferredLanguage === "es" ? "Cómo funciona" : "How it works"} ＋</span>
                        </summary>
                        <p>{copy.securePreCheckinIntro}</p>
                        <p>{copy.securePreCheckinAcceptanceText}</p>
                      </details>
                    </div>
                  </section>
                ) : null}

                <section className="pbe-section pbe-booking-section" aria-labelledby="pbe-booking-title">
                  <div className="pbe-booking-intro">
                    <p className="pbe-kicker">{preferredLanguage === "es" ? "TU ESTADÍA" : "YOUR STAY"}</p>
                    <h2 id="pbe-booking-title">
                      {preferredLanguage === "es" ? "Elige cuándo quieres escapar." : "Choose when you want to get away."}
                    </h2>
                    <p className="pbe-lead">
                      {preferredLanguage === "es"
                        ? "Solo se muestran fechas disponibles. Confirmaremos el precio antes del pago."
                        : "Only available dates are shown. We will confirm the price before payment."}
                    </p>
                  </div>
                  <div className="pbe-booking-layout" style={styles.detailGrid}>
                     <div className="pbe-retired-experience" aria-hidden="true" style={styles.leftColumn}>
  <div className="pbe-legacy-overview" style={styles.infoCard}>
    <div style={styles.sectionEyebrow}>
      {copy.propertyOverview}
    </div>

    <h2 style={styles.sectionTitle}>
      {property.publicTitle || property.name}
    </h2>

    <div
      className={`pbe-long-description${descriptionExpanded ? " is-expanded" : ""}`}
      style={styles.overviewText}
    >
      {property.publicDescription || copy.defaultPropertyDescription}
    </div>
    {(property.publicDescription?.length ?? 0) > 520 ? (
      <button
        className="pbe-description-toggle"
        type="button"
        onClick={() => setDescriptionExpanded((current) => !current)}
        aria-expanded={descriptionExpanded}
      >
        {descriptionExpanded
          ? preferredLanguage === "es" ? "Mostrar menos" : "Show less"
          : preferredLanguage === "es" ? "Leer la historia completa" : "Read the full story"}
        <span aria-hidden="true">{descriptionExpanded ? "↑" : "↓"}</span>
      </button>
    ) : null}
  </div>

  <div style={styles.infoCard}>
    <div style={styles.sectionEyebrow}>
  {copy.stayDetails}
</div>

    <div style={styles.stayDetailsGrid}>
      <div style={styles.stayDetailItem}>
        <StayDetailIcon type="checkIn" />

        <div>
  <strong>{copy.checkIn}</strong>
  <div>
    {formatDisplayTime(property.checkInTime) ||
      copy.configuredByHost}
  </div>
</div>
      </div>

      <div style={styles.stayDetailItem}>
        <StayDetailIcon type="checkOut" />

       <div>
  <strong>{copy.checkOut}</strong>
  <div>
    {formatDisplayTime(property.checkOutTime) || "11:00 AM"}
  </div>
</div>
      </div>
    </div>
  </div>
                  
<div className="pbe-legacy-arrival" style={styles.securePreCheckinDisclosure}>
  <div style={styles.securePreCheckinDisclosureHeader}>
    <div style={styles.securePreCheckinDisclosureIcon} aria-hidden="true">
      🛡️
    </div>

    <div>
    <div style={styles.securePreCheckinDisclosureEyebrow}>
  {copy.secureArrivalProcess}
</div>

<h3 style={styles.securePreCheckinDisclosureTitle}>
  {copy.securePreCheckinTitle}
</h3>
    </div>
  </div>

  <div style={styles.securePreCheckinDisclosureText}>
  <p style={styles.securePreCheckinDisclosureParagraph}>
    {copy.securePreCheckinIntro}
  </p>
</div>
  <div style={styles.securePreCheckinSteps}>
    <div style={styles.securePreCheckinStep}>
      <span style={styles.securePreCheckinStepNumber}>1</span>
      <span>{copy.reservationConfirmedStep}</span>
    </div>

    <div style={styles.securePreCheckinStep}>
      <span style={styles.securePreCheckinStepNumber}>2</span>
      <span>{copy.identityCheckStep}</span>
    </div>

    <div style={styles.securePreCheckinStep}>
      <span style={styles.securePreCheckinStepNumber}>3</span>
      <span>{copy.guestAgreementStep}</span>
    </div>

    <div style={styles.securePreCheckinStep}>
  <span style={styles.securePreCheckinStepNumber}>4</span>
 <span>
  {copy.accessReleasedStep}
</span>
</div>
  </div>

  <div style={styles.securePreCheckinCompletionNote}>
  {copy.usuallyCompletedQuickly}
</div>
 <div style={styles.securePreCheckinDisclosureNotice}>
  {copy.reservationConfirmedNotice}
</div>
</div>

  <div className="pbe-legacy-amenities" style={styles.trustSection}>
    <div style={styles.sectionEyebrow}>
      {copy.propertyHighlights.eyebrow}
    </div>

    <h3 style={styles.trustTitle}>
      {copy.propertyHighlights.title}
    </h3>

    <div style={styles.trustGrid}>
      {copy.propertyHighlights.items.map((item) => (
        <div className="pbe-rescue-highlight" key={item.icon} style={styles.trustCard}>
          <PublicFeatureIcon type={item.icon} />
          <strong>{item.title}</strong>
          <span>{item.description}</span>
        </div>
      ))}
    </div>
 {includedAmenities.length > 0 ? (
    <div style={styles.includedAmenitiesBox}>
      <div style={styles.includedAmenitiesTitle}>
  {copy.includedWithStay}
</div>

      <div style={styles.includedAmenitiesGrid}>
        {includedAmenities.map((amenity) => (
         <div className="pbe-rescue-amenity" key={amenity.id} style={styles.includedAmenityPill}>
  <AmenityIcon name={amenity.name} />
  <span>{amenity.name}</span>
</div>
       
        ))}
      </div>
    </div>
  ) : null}
</div>

                    {location ? (
                      <section className="pbe-rescue-location" aria-labelledby="pbe-location-title">
                        <div className="pbe-rescue-location-copy">
                          <span>
                            {preferredLanguage === "es" ? "LOCALIZACIÓN" : "LOCATION"}
                          </span>
                          <h3 id="pbe-location-title">
                            {preferredLanguage === "es"
                              ? "Cerca de todo. Lejos de lo ordinario."
                              : "Close to everything. Far from ordinary."}
                          </h3>
                          <p>{location}</p>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {preferredLanguage === "es" ? "Explorar ubicación" : "Explore location"}
                            <span aria-hidden="true">↗</span>
                          </a>
                        </div>
                        <div className="pbe-rescue-map" aria-hidden="true">
                          <div className="pbe-rescue-map-water" />
                          <div className="pbe-rescue-map-road pbe-rescue-map-road-one" />
                          <div className="pbe-rescue-map-road pbe-rescue-map-road-two" />
                          <div className="pbe-rescue-map-marker">
                            <span>●</span>
                            <strong>{property.publicTitle || property.name}</strong>
                            <small>{property.city || property.region || property.country}</small>
                          </div>
                        </div>
                      </section>
                    ) : null}

                    <div className="pbe-legacy-pingo" style={styles.pinGoPanel}>
                      <div>
                        <div style={styles.sectionEyebrow}>
                          {copy.pinGoPanel.eyebrow}
                        </div>

                        <h3 style={styles.pinGoTitle}>
                          {copy.pinGoPanel.title}
                        </h3>

                        <p style={styles.pinGoText}>
                          {copy.pinGoPanel.description}
                        </p>
                      </div>

                      <div style={styles.pinGoFeatureGrid}>
                        {copy.pinGoPanel.features.map((feature) => (
                          <div key={feature.icon} style={styles.pinGoFeature}>
                            <PinGoPanelIcon type={feature.icon} />
                            <span>{feature.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <form className="pbe-legacy-booking pbe-reservation-flow" onSubmit={handleReserve} style={styles.bookingCard}>
                    <div style={styles.bookingHeader}>
                      <div>
                        <div style={styles.bookingPrice}>
  <div style={styles.bookingPricePrefix}>
  {copy.startingAt}
</div>
  {formatNightlyDisplayMoney(property.baseNightlyRate)}

 <span style={styles.bookingPriceUnit}>
  {copy.perNight}
</span>
</div>
                        
                        <div style={styles.bookingSubtitle}>
                          {copy.bookYourStaySecurely}
                        </div>
                      </div>

                      <div style={styles.bookingBadge}>
                        {copy.direct}
                      </div>
                    </div>

                  <div className="pbe-legacy-calendar pbe-calendar-stage" style={styles.calendarBox}>
  <div className="pbe-date-summary" style={styles.calendarHeader}>
    <div className="pbe-date-summary-card" style={styles.calendarDatePanel}>
  <div style={styles.calendarLabel}>
    {copy.checkInDate}
  </div>

  <div style={styles.calendarValue}>
    {checkIn
      ? format(fromDateInputValue(checkIn)!, "MMM d, yyyy")
      : copy.addDate}
  </div>
</div>
   <div className="pbe-date-summary-card" style={styles.calendarDatePanel}>
  <div style={styles.calendarLabel}>
    {copy.checkOutDate}
  </div>

  <div style={styles.calendarValue}>
    {checkOut
      ? format(fromDateInputValue(checkOut)!, "MMM d, yyyy")
      : copy.addDate}
  </div>
</div>
  </div>

 <div style={styles.calendarShell}>
    <DayPicker     
      mode="range"
      numberOfMonths={2}
      selected={{
        from: fromDateInputValue(checkIn),
        to: fromDateInputValue(checkOut),
      }}
      onSelect={(range: DateRange | undefined) => {
        setCheckIn(toDateInputValue(range?.from));
        setCheckOut(toDateInputValue(range?.to));
      }}  
      disabled={(date) =>
        date < new Date(new Date().setHours(0, 0, 0, 0)) ||
        blockedDates.includes(toLocalDateKey(date))
      }

     />
  </div>
</div>
                        <div className="pbe-legacy-guests pbe-guest-stage" style={styles.guestSelector}>
                      <div style={styles.guestRow}>
                        <div>
  <div style={styles.guestLabel}>
    {copy.adults}
  </div>

  <div style={styles.guestHint}>
    {copy.adultsHint}
  </div>
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
  <div style={styles.guestLabel}>
    {copy.children}
  </div>

  <div style={styles.guestHint}>
    {copy.childrenHint}
  </div>
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

                    {!checkoutStarted ? (
                      <>
                        <button
                          className="pbe-primary pbe-continue-action"
                          type="button"
                          disabled={!checkIn || !checkOut}
                          onClick={() => setCheckoutStarted(true)}
                        >
                          {preferredLanguage === "es"
                            ? "Confirmar fechas y continuar"
                            : "Confirm dates and continue"}
                          <span aria-hidden="true">→</span>
                        </button>
                        <p className="pbe-secure-note">
                          {preferredLanguage === "es"
                            ? "Todavía no se realizará ningún cargo."
                            : "You will not be charged yet."}
                        </p>
                      </>
                    ) : (
                      <div className="pbe-checkout-stage pbe-client-stage">
                        <div className="pbe-checkout-stage-heading">
                          <div>
                            <span>
                              {preferredLanguage === "es" ? "PASO FINAL" : "FINAL STEP"}
                            </span>
                            <h2>
                              {preferredLanguage === "es"
                                ? "Confirma tu estadía"
                                : "Confirm your stay"}
                            </h2>
                            <p>
                              {preferredLanguage === "es"
                                ? "Primero tu información; luego continuarás al pago seguro con Stripe."
                                : "Your information comes first; secure payment with Stripe follows."}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setCheckoutStarted(false);
                              setConfirmationStarted(false);
                            }}
                          >
                            {preferredLanguage === "es" ? "Editar fechas" : "Edit dates"}
                          </button>
                        </div>

                    {!confirmationStarted ? (
                      <>
                    <div className="pbe-client-fields">
                    <label className="pbe-client-field" style={styles.field}>
                      <span>{copy.fullName}</span>

                      <input
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder={copy.guestNamePlaceholder}
                        style={styles.input}
                      />
                    </label>
                    <label className="pbe-client-field" style={styles.field}>
                      <span>{copy.email}</span>

                      <input
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="guest@email.com"
                        style={styles.input}
                      />
                    </label>
                     <label className="pbe-client-field" style={styles.field}>
                       <span>{copy.phone}</span>

                       <input
                         value={guestPhone}
                         onChange={(e) => setGuestPhone(e.target.value)}
                         placeholder="+1..."
                         style={styles.input}
                       />
                     </label>
                    </div>
                <div className="pbe-notification-option" style={styles.stayNotificationsCard}>
  <label style={styles.stayNotificationsLabel}>
    <input
      type="checkbox"
      checked={stayNotificationsConsent}
      onChange={(e) => setStayNotificationsConsent(e.target.checked)}
      style={styles.stayNotificationsCheckbox}
    />

    <div>
      <div style={styles.stayNotificationsTitle}>
        <SmartStayIcon />
        <span>{copy.smsUpdatesTitle}</span>
      </div>

      <div style={styles.stayNotificationsText}>
        {copy.smsUpdatesDescription}
      </div>
      <div style={styles.stayNotificationsLegal}>
        {copy.smsUpdatesLegal}
      </div>
      
      <div style={styles.stayNotificationsLegal}>
        {copy.smsUpdatesOptionalNotice}
      </div>
    </div>
  </label>
</div>
                    {optionalAmenities.length > 0 ? (
                      <div className="pbe-addons" style={styles.addOnsBox}>
                        <div style={styles.addOnsTitle}>
                          {copy.optionalAddOns}
                        </div>

                        {optionalAmenities.map((amenity) => {
                          const amenityAmount = calculateAmenityAmount(amenity, nights);
                          const checked = selectedAmenityIds.includes(amenity.id);

                          return (
                            <label key={amenity.id} style={styles.addOnItem}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedAmenityIds((prev) =>
                                      prev.includes(amenity.id)
                                        ? prev
                                        : [...prev, amenity.id]
                                    );
                                  } else {
                                    setSelectedAmenityIds((prev) =>
                                      prev.filter((id) => id !== amenity.id)
                                    );
                                  }
                                }}
                                style={styles.addOnCheckbox}
                              />

                              <div style={{ flex: 1 }}>
                                <div style={styles.addOnHeader}>
                                  <strong>{amenity.name}</strong>
                                  <span>{formatMoney(amenityAmount)}</span>
                                </div>

                                {amenity.description ? (
                                  <div style={styles.addOnDescription}>
                                    {amenity.description}
                                  </div>
                                ) : null}

                               <div style={styles.addOnMeta}>
  {amenity.feeType === "PER_NIGHT"
    ? copy.perNightFee
    : copy.perStayFee}
</div>
</div>
</label>
);
})}
</div>
) : null}

                        <button
                          className="pbe-primary pbe-review-action"
                          type="button"
                          disabled={!guestName.trim() || !guestEmail.trim()}
                          onClick={() => setConfirmationStarted(true)}
                        >
                          {preferredLanguage === "es" ? "Revisar estadía y acuerdos" : "Review stay and agreements"}
                          <span aria-hidden="true">→</span>
                        </button>
                        <p className="pbe-secure-note">
                          {preferredLanguage === "es"
                            ? "El pago seguro con Stripe será el próximo paso."
                            : "Secure payment with Stripe will be the next step."}
                        </p>
                      </>
                    ) : (
                      <div className="pbe-confirmation-stage">
                        <div className="pbe-confirmation-heading">
                          <div>
                            <span>{preferredLanguage === "es" ? "REVISIÓN FINAL" : "FINAL REVIEW"}</span>
                            <h3>{preferredLanguage === "es" ? "Resumen y acuerdos" : "Summary and agreements"}</h3>
                          </div>
                          <button type="button" onClick={() => setConfirmationStarted(false)}>
                            {preferredLanguage === "es" ? "Editar información" : "Edit information"}
                          </button>
                        </div>
<div className="pbe-legacy-price pbe-price-summary" style={styles.priceBox}>
  <div style={styles.priceBoxTitle}>
    {copy.priceDetails}
  </div>

  <div style={styles.priceRow}>
    <span>{copy.guestCountLabel}</span>
    <strong>{totalGuests}</strong>
  </div>

  <div style={styles.priceRow}>
    <span>
      {pricing?.nightlyRates?.length
        ? copy.nightlyRates
        : `${formatMoney(property.baseNightlyRate)} × ${
            nights || 0
          } ${copy.nights}`}
    </span>

    <strong>
      {formatNightlyDisplayMoney(
        displayNightlySubtotal
      )}
    </strong>
  </div>

  {pricing?.nightlyRates?.length ? (
    <div style={styles.nightlyRatesBreakdown}>
      {pricing.nightlyRates.map((item: any) => (
        <div
          key={item.date}
          style={styles.nightlyRateItem}
        >
          <span>
            {format(
              fromDateInputValue(item.date)!,
              "MMM d, yyyy"
            )}
          </span>

          <strong>
            {formatNightlyDisplayMoney(item.rate)}
          </strong>
        </div>
      ))}
    </div>
  ) : null}
                       <div style={styles.priceRow}>
                         <span>{copy.cleaningFeeLabel}</span>
                         <strong>{formatMoney(displayCleaningFee)}</strong>
                       </div>
                      {requiredAmenities.map((amenity) => (
                        <div key={amenity.id} style={styles.priceRow}>
                          <span>{amenity.name}</span>
                          <strong>
                            {formatMoney(calculateAmenityAmount(amenity, nights))}
                          </strong>
                        </div>
                      ))}

                      {optionalAmenities
                        .filter((amenity) => selectedAmenityIds.includes(amenity.id))
                        .map((amenity) => (
                          <div key={amenity.id} style={styles.priceRow}>
                            <span>{amenity.name}</span>
                            <strong>
                              {formatMoney(calculateAmenityAmount(amenity, nights))}
                            </strong>
                          </div>
                        ))}

                      
                       {(property?.taxes ?? []).map((tax) => {
  const percentage = Number(tax.percentage ?? 0);

  const amount = taxableSubtotal * (percentage / 100);

  return (
    <div key={tax.id} style={styles.priceRow}>
      <span>
        {tax.name} ({percentage}%)
      </span>
      <strong>{formatMoney(amount)}</strong>
    </div>
  );
})}

                     <div style={styles.totalRow}>
  <span>{copy.totalLabel}</span>
  <strong>{formatMoney(displayTotal)}</strong>
</div>
                    </div>

     <div className="pbe-agreement-card pbe-agreement-card--identity" style={styles.securePreCheckinAcceptanceCard}>
  <label style={styles.securePreCheckinAcceptanceLabel}>
    <input
      type="checkbox"
      checked={securePreCheckinRequirementAccepted}
      onChange={(e) =>
        setSecurePreCheckinRequirementAccepted(e.target.checked)
      }
      style={styles.securePreCheckinAcceptanceCheckbox}
    />

    <div>
     <div style={styles.securePreCheckinAcceptanceTitle}>
  {copy.securePreCheckinAcceptanceTitle}
</div>

<div style={styles.securePreCheckinAcceptanceText}>
  {copy.securePreCheckinAcceptanceText}
  <a className="pbe-inline-document" href="#identity-check-policy">
    {preferredLanguage === "es" ? "Leer requisitos completos" : "Read full requirements"}
  </a>
</div>
    </div>
  </label>
</div>

            {cancellationPolicySummary ? (
  <div className="pbe-legacy-policy" style={styles.cancellationPolicyBox}>
    <div style={styles.cancellationPolicyHeader}>
      <span style={styles.cancellationPolicyIcon}>
        ↩
      </span>

      <div>
        <div style={styles.cancellationPolicyEyebrow}>
          {copy.cancellationPolicyLabel}
        </div>

        <div style={styles.cancellationPolicyTitle}>
          {cancellationPolicySummary.title}
        </div>
      </div>
    </div>

    <div style={styles.cancellationPolicyHeadline}>
      {cancellationPolicySummary.headline}
    </div>

    <p style={styles.cancellationPolicyText}>
      {cancellationPolicySummary.summaryText}
    </p>

    <div style={styles.cancellationTimeline}>
      {cancellationPolicySummary.rules.map(
        (rule, index) => (
          <div
            key={`${rule.label}-${rule.minHoursBeforeCheckIn}-${index}`}
            style={styles.cancellationTimelineItem}
          >
            <div
              style={{
                ...styles.cancellationTimelineMarker,
                ...(rule.tone === "success"
                  ? styles.cancellationTimelineMarkerSuccess
                  : rule.tone === "warning"
                  ? styles.cancellationTimelineMarkerWarning
                  : styles.cancellationTimelineMarkerDanger),
              }}
            >
              {rule.refundPercent >= 100
                ? "✓"
                : rule.refundPercent > 0
                ? "%"
                : "×"}
            </div>

            <div
              style={
                styles.cancellationTimelineContent
              }
            >
              <div
                style={
                  styles.cancellationTimelineTopRow
                }
              >
                <strong>{rule.label}</strong>

                <span
                  style={{
                    ...styles.cancellationRefundBadge,
                    ...(rule.tone === "success"
                      ? styles.cancellationRefundBadgeSuccess
                      : rule.tone === "warning"
                      ? styles.cancellationRefundBadgeWarning
                      : styles.cancellationRefundBadgeDanger),
                  }}
                >
                  {formatRefundPercent(
                    rule.refundPercent
                  )}
                </span>
              </div>

              <div
                style={
                  styles.cancellationTimelineWindow
                }
              >
                {rule.windowLabel}
              </div>

              {rule.dateLabel ? (
                <div
                  style={
                    styles.cancellationTimelineDate
                  }
                >
                  {rule.dateLabel}
                </div>
              ) : null}

              {rule.description ? (
                <div
                  style={
                    styles.cancellationTimelineDescription
                  }
                >
                  {rule.description}
                </div>
              ) : null}
            </div>
          </div>
        )
      )}
    </div>

    {cancellationPolicySummary.scenarios.length >
    0 ? (
      <div style={styles.cancellationExceptionsBox}>
        <div
          style={styles.cancellationExceptionsTitle}
        >
          {copy.importantNonRefundableCases}
        </div>

        <div
          style={styles.cancellationScenarioGrid}
        >
          {cancellationPolicySummary.scenarios.map(
            (scenario) => (
              <span
                key={scenario}
                style={
                  styles.cancellationScenarioPill
                }
              >
                {getScenarioLabel(
                  scenario,
                  preferredLanguage
                )}
              </span>
            )
          )}
        </div>
      </div>
    ) : null}

    <div style={styles.cancellationPolicyNote}>
      {cancellationPolicySummary.approvalNote}
    </div>
  </div>
) : null}     
            
                   {cancellationPolicySummary ? (
  <div
    className="pbe-agreement-card"
    style={
      styles.cancellationTermsAcknowledgmentCard
    }
  >
    <label
      style={
        styles.cancellationTermsAcknowledgmentLabel
      }
    >
      <input
        type="checkbox"
        checked={cancellationTermsAccepted}
        onChange={(e) =>
          setCancellationTermsAccepted(
            e.target.checked
          )
        }
        style={styles.cancellationTermsCheckbox}
      />

      <div>
        <div style={styles.cancellationTermsTitle}>
          {copy.cancellationTermsAgreement}
        </div>

        <div style={styles.cancellationTermsText}>
          {copy.eligibleRefundNotice}
          <a className="pbe-inline-document" href="#booking-policies">
            {preferredLanguage === "es" ? "Leer política completa" : "Read full policy"}
          </a>
        </div>

        {cancellationRefundBasisDisclosure ? (
          <div style={styles.refundBasisDisclosure}>
            <strong
              style={
                styles.refundBasisDisclosureTitle
              }
            >
              {copy.refundCalculation}
            </strong>

            <span
              style={
                styles.refundBasisDisclosureText
              }
            >
              {cancellationRefundBasisDisclosure}
            </span>
          </div>
        ) : null}
      </div>
    </label>
  </div>
) : null}
                    {bookingError ? (
                      <div style={styles.inlineError}>{bookingError}</div>
                    ) : null}

                    <button
                      className="pbe-primary"
                      type="submit"
                      disabled={reserveButtonDisabled}
                      style={{
                        ...styles.reserveButton,
                        ...(reserveButtonDisabled
  ? styles.reserveButtonDisabled
  : {}),

                      }}
                    >
                      {submitting
                        ? copy.preparingCheckout
                        : copy.reserveNow}
                    </button>

                 <div className="pbe-secure-payment" style={styles.paymentMethods}>
  <div style={styles.paymentTrustRow}>
    <span style={styles.paymentTrustIcon}>🔒</span>
    <span>
  {copy.securePaymentsPoweredBy}{" "}
  <strong style={styles.stripeText}>Stripe</strong>
</span>
  </div>
<div style={styles.paymentLogosRow}>
  <img src="/payments/visa.svg" alt="Visa" style={styles.paymentLogo} />
  <img src="/payments/mastercard.svg" alt="Mastercard" style={styles.paymentLogo} />
  <img src="/payments/amex.svg" alt="American Express" style={styles.paymentLogo} />
  <img src="/payments/apple-pay.svg" alt="Apple Pay" style={styles.paymentLogo} />
  <img src="/payments/google-pay.svg" alt="Google Pay" style={styles.paymentLogo} />
  <img src="/payments/klarna.svg" alt="Klarna" style={styles.paymentLogo} />
  <img src="/payments/amazon-pay.svg" alt="Amazon Pay" style={styles.paymentLogo} />
</div>
</div>

                   <p style={styles.disclaimer}>
                    {copy.redirectToStripe}
                  </p>
                <div style={styles.legalLinks}>
                  <span>
                    {copy.legalAgreementPrefix}{" "}
                    <Link to="/legal/terms" style={styles.legalLink}>
                      {copy.termsOfService}
                    </Link>{" "}
                    {copy.legalAnd}{" "}
                    <Link to="/legal/privacy" style={styles.legalLink}>
                      {copy.privacyPolicy}
                    </Link>
                    .
                  </span>
                </div>
                      </div>
                    )}
                      </div>
                    )}
                  </form>
                  </div>
                </section>
              </div>
            </section>

            <section className="pbe-section pbe-guest-services" aria-labelledby="pbe-guest-services-title">
              <div className="pbe-guest-services-copy">
                <p className="pbe-kicker">PIN&amp;GO GUEST SERVICES</p>
                <h2 id="pbe-guest-services-title">
                  {preferredLanguage === "es" ? "Estamos aquí antes de tu llegada." : "We are here before you arrive."}
                </h2>
                <p className="pbe-lead">
                  {preferredLanguage === "es"
                    ? "¿Tienes preguntas sobre la propiedad, sus amenidades, la ubicación o el proceso de reserva? Nuestro equipo puede orientarte sin necesidad de contactar directamente al anfitrión."
                    : "Questions about the property, amenities, location, or booking process? Our team can guide you without requiring direct host contact."}
                </p>
              </div>
              <div className="pbe-guest-services-actions">
                <a
                  className="pbe-service-card"
                  href={`mailto:support@pin-ngo.com?subject=${encodeURIComponent(`Direct Booking · ${property.publicTitle || property.name}`)}`}
                >
                  <span aria-hidden="true">✉</span>
                  <div>
                    <small>{preferredLanguage === "es" ? "CONTACTAR" : "CONTACT"}</small>
                    <strong>support@pin-ngo.com</strong>
                    <p>{preferredLanguage === "es" ? "Ayuda antes y después de reservar" : "Help before and after booking"}</p>
                  </div>
                  <b aria-hidden="true">↗</b>
                </a>
                <Link className="pbe-service-card" to="/legal/support-policy">
                  <span aria-hidden="true">◎</span>
                  <div>
                    <small>{preferredLanguage === "es" ? "SERVICIO" : "SERVICE"}</small>
                    <strong>{preferredLanguage === "es" ? "Cómo podemos ayudarte" : "How we can help"}</strong>
                    <p>{preferredLanguage === "es" ? "Consulta nuestra política de soporte" : "Read our support policy"}</p>
                  </div>
                  <b aria-hidden="true">→</b>
                </Link>
              </div>
              <p className="pbe-pin-ai-note">
                <span aria-hidden="true">✦</span>
                {preferredLanguage === "es"
                  ? "Preparado para asistencia conversacional de Pin AI."
                  : "Ready for conversational assistance from Pin AI."}
              </p>
            </section>
          </>
        )}
      </main>
{selectedPhotoIndex !== null && photos[selectedPhotoIndex] && (
  <div
    style={styles.lightboxOverlay}
    onClick={() => setSelectedPhotoIndex(null)}
  >
    <div
      style={styles.lightboxContent}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        style={styles.lightboxClose}
        onClick={() => setSelectedPhotoIndex(null)}
      >
        ✕
      </button>

      <img
        src={photos[selectedPhotoIndex]}
        alt="Property"
        style={styles.lightboxImage}
      />

      {photos.length > 1 && (
        <>
          <button
            type="button"
            style={styles.lightboxPrev}
            onClick={() =>
              setSelectedPhotoIndex(
                selectedPhotoIndex === 0
                  ? photos.length - 1
                  : selectedPhotoIndex - 1
              )
            }
          >
            ‹
          </button>

          <button
            type="button"
            style={styles.lightboxNext}
            onClick={() =>
              setSelectedPhotoIndex(
                selectedPhotoIndex === photos.length - 1
                  ? 0
                  : selectedPhotoIndex + 1
              )
            }
          >
            ›
          </button>
        </>
      )}
    </div>
  </div>
)}

      <footer className="pbe-footer" style={styles.footer}>
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
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
}, 
languageSelector: {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: 4,
  border: "1px solid #dbe3ee",
  borderRadius: 12,
  background: "#ffffff",
  flexShrink: 0,
},

languageButton: {
  appearance: "none",
  border: "none",
  borderRadius: 8,
  padding: "8px 12px",
  background: "transparent",
  color: "#475569",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
},

languageButtonActive: {
  background: "#0f172a",
  color: "#ffffff",
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
    position: "relative",
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
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 18,
},

trustCard: {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 24,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 12,
  color: "#0f172a",
},
   
trustIcon: {
  width: 44,
  height: 44,
  borderRadius: 16,
  display: "grid",
  placeItems: "center",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  color: "#1d4ed8",
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",

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
  color: "#1d4ed8",
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
  flexShrink: 0,
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
  padding: "14px 15px",
  fontSize: 14,
  fontWeight: 950,
  backdropFilter: "blur(8px)",
  display: "flex",
  alignItems: "center",
  gap: 10,
},

pinGoFeatureIcon: {
  width: 32,
  height: 32,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.22)",
  color: "#ffffff",
  flexShrink: 0,
},
 
  securePreCheckinDisclosure: {
  marginTop: 24,
  padding: 24,
  borderRadius: 22,
  border: "1px solid #bfdbfe",
  background:
    "linear-gradient(135deg, rgba(239,246,255,0.96), rgba(248,250,252,0.98))",
  boxShadow: "0 14px 36px rgba(15, 23, 42, 0.07)",
},

securePreCheckinDisclosureHeader: {
  display: "flex",
  alignItems: "flex-start",
  gap: 14,
},

securePreCheckinDisclosureIcon: {
  width: 46,
  height: 46,
  borderRadius: 15,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  background: "#dbeafe",
  border: "1px solid #bfdbfe",
  fontSize: 22,
},

securePreCheckinDisclosureEyebrow: {
  color: "#1d4ed8",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
},

securePreCheckinDisclosureTitle: {
  margin: "5px 0 0",
  color: "#0f172a",
  fontSize: 22,
  lineHeight: 1.2,
  fontWeight: 950,
  letterSpacing: "-0.025em",
},

securePreCheckinDisclosureSpanishTitle: {
  marginTop: 4,
  color: "#334155",
  fontSize: 16,
  fontWeight: 850,
},

securePreCheckinDisclosureText: {
  marginTop: 18,
  color: "#334155",
  fontSize: 14,
  lineHeight: 1.65,
},

securePreCheckinDisclosureParagraph: {
  margin: "0 0 10px",
},

securePreCheckinSteps: {
  marginTop: 18,
  display: "grid",
  gap: 10,
},

securePreCheckinStep: {
  display: "flex",
  alignItems: "center",
  gap: 11,
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 800,
},

securePreCheckinStepNumber: {
  width: 28,
  height: 28,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  background: "#ffffff",
  border: "1px solid #93c5fd",
  color: "#1d4ed8",
  fontSize: 12,
  fontWeight: 950,
},

securePreCheckinDisclosureNotice: {
  marginTop: 18,
  paddingTop: 16,
  borderTop: "1px solid #bfdbfe",
  color: "#1e3a8a",
  fontSize: 13,
  lineHeight: 1.6,
  fontWeight: 800,
},

securePreCheckinCompletionNote: {
  marginTop: 14,
  color: "#475569",
  fontSize: 12,
  lineHeight: 1.55,
  fontWeight: 750,
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
 bookingPricePrefix: {
  display: "block",
  fontSize: 13,
  fontWeight: 900,
  color: "#64748b",
  letterSpacing: "0.02em",
  marginBottom: 4,
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
  addOnsBox: {
    marginTop: 18,
    border: "1px solid #dbeafe",
    borderRadius: 18,
    padding: 16,
    display: "grid",
    gap: 10,
    background: "#eff6ff",
  },
  addOnsTitle: {
    fontSize: 13,
    fontWeight: 950,
    color: "#0f172a",
    marginBottom: 2,
  },
  addOnItem: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    background: "#ffffff",
    border: "1px solid #bfdbfe",
    borderRadius: 14,
    padding: 12,
    cursor: "pointer",
  },
  addOnCheckbox: {
    marginTop: 3,
  },
  addOnHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    color: "#0f172a",
    fontSize: 14,
  },
  addOnDescription: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.5,
  },
  addOnMeta: {
    marginTop: 4,
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 900,
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
  nightlyRatesBreakdown: {
  display: "grid",
  gap: 8,
  padding: "10px 0 4px",
  borderBottom: "1px solid #e2e8f0",
},

nightlyRateItem: {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  color: "#64748b",
  fontSize: 13,
},

includedAmenitiesRow: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.5,
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
 includedAmenitiesBox: {
  marginTop: 22,
  borderTop: "1px solid #e2e8f0",
  paddingTop: 18,
},

includedAmenitiesTitle: {
  fontSize: 15,
  fontWeight: 900,
  color: "#0f172a",
  marginBottom: 14,
},

includedAmenitiesGrid: {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
},

includedAmenityPill: {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  borderRadius: 18,
  padding: "9px 13px 9px 9px",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 850,
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
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
lightboxOverlay: {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.92)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
},

lightboxContent: {
  position: "relative",
  width: "100%",
  maxWidth: 1400,
},

lightboxImage: {
  width: "100%",
  maxHeight: "90vh",
  objectFit: "contain",
  borderRadius: 20,
},

lightboxClose: {
  position: "absolute",
  top: -50,
  right: 0,
  width: 42,
  height: 42,
  borderRadius: "50%",
  border: "none",
  background: "#fff",
  cursor: "pointer",
  fontSize: 18,
  fontWeight: 900,
},

lightboxPrev: {
  position: "absolute",
  left: 20,
  top: "50%",
  transform: "translateY(-50%)",
  width: 54,
  height: 54,
  borderRadius: "50%",
  border: "none",
  cursor: "pointer",
  fontSize: 34,
  fontWeight: 900,
},

lightboxNext: {
  position: "absolute",
  right: 20,
  top: "50%",
  transform: "translateY(-50%)",
  width: 54,
  height: 54,
  borderRadius: "50%",
  border: "none",
  cursor: "pointer",
  fontSize: 34,
  fontWeight: 900,
},

showAllPhotosButton: {
  position: "absolute",
  right: 24,
  bottom: 24,
  zIndex: 5,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: 14,
  padding: "12px 16px",
  fontWeight: 900,
  fontSize: 14,
  cursor: "pointer",
  boxShadow: "0 10px 30px rgba(15,23,42,0.12)",
},

securePreCheckinAcceptanceCard: {
  marginTop: 18,
  padding: 18,
  borderRadius: 18,
  border: "1px solid #93c5fd",
  background: "#eff6ff",
},

securePreCheckinAcceptanceLabel: {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  cursor: "pointer",
},

securePreCheckinAcceptanceCheckbox: {
  width: 18,
  height: 18,
  marginTop: 3,
  flexShrink: 0,
  accentColor: "#1d4ed8",
},

securePreCheckinAcceptanceTitle: {
  color: "#0f172a",
  fontSize: 14,
  lineHeight: 1.45,
  fontWeight: 900,
},

securePreCheckinAcceptanceSpanishTitle: {
  marginTop: 4,
  color: "#1e3a8a",
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 850,
},

securePreCheckinAcceptanceText: {
  marginTop: 8,
  color: "#475569",
  fontSize: 12,
  lineHeight: 1.55,
  fontWeight: 650,
},

cancellationTermsAcknowledgmentCard: {
  marginTop: 14,
  border: "1px solid #bfdbfe",
  borderRadius: 18,
  padding: 15,
  background: "#eff6ff",
},

cancellationTermsAcknowledgmentLabel: {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  cursor: "pointer",
},

cancellationTermsCheckbox: {
  marginTop: 4,
  width: 18,
  height: 18,
  cursor: "pointer",
  flexShrink: 0,
},

cancellationTermsTitle: {
  fontSize: 14,
  fontWeight: 950,
  color: "#0f172a",
  lineHeight: 1.35,
},

cancellationTermsText: {
  marginTop: 5,
  color: "#334155",
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 750,
},

refundBasisDisclosure: {
  marginTop: 11,
  border: "1px solid #bfdbfe",
  borderRadius: 14,
  padding: "10px 11px",
  background: "#ffffff",
  display: "grid",
  gap: 4,
},

refundBasisDisclosureTitle: {
  color: "#1d4ed8",
  fontSize: 11,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
},

refundBasisDisclosureText: {
  color: "#334155",
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 700,
},

paymentMethods: {
  marginTop: 18,
  paddingTop: 18,
  borderTop: "1px solid #e2e8f0",
},

paymentTrustRow: {
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "#334155",
  fontSize: 14,
  fontWeight: 800,
},
paymentTrustIcon: {
  width: 34,
  height: 34,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  fontSize: 16,
},

stripeText: {
  color: "#1d4ed8",
  fontWeight: 950,
},

paymentLogosRow: {
  marginTop: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 18,
  flexWrap: "wrap",
},

paymentLogo: {
  maxHeight: 45,
  maxWidth: 150,
  objectFit: "contain",
},
calendarBox: {
  marginTop: 16,
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  padding: 16,
  background: "#ffffff",
  boxShadow: "0 16px 42px rgba(15,23,42,0.08)",
  overflow: "hidden",
},

calendarHeader: {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginBottom: 14,
},

calendarDatePanel: {
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: "13px 14px",
  background: "#f8fafc",
},

calendarLabel: {
  fontSize: 11,
  fontWeight: 950,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.09em",
},

calendarValue: {
  marginTop: 5,
  fontSize: 15,
  fontWeight: 950,
  color: "#0f172a",
},

calendarShell: {
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: "12px 8px",
  background:
    "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  overflowX: "auto",
  maxWidth: "100%",
},
calendarInner: {
  minWidth: 0,
  width: "max-content",
  maxWidth: "100%",
  margin: "0 auto",
},
stayNotificationsCard: {
  marginTop: 16,
  border: "1px solid #bfdbfe",
  borderRadius: 18,
  padding: 16,
  background: "#eff6ff",
},

stayNotificationsLabel: {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  cursor: "pointer",
},

stayNotificationsCheckbox: {
  marginTop: 4,
  width: 18,
  height: 18,
  cursor: "pointer",
},

stayNotificationsTitle: {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 15,
  fontWeight: 950,
  color: "#0f172a",
  marginBottom: 6,
},

smartStayIcon: {
  width: 34,
  height: 34,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  background: "#ffffff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
  flexShrink: 0,
},
stayNotificationsText: {
  fontSize: 13,
  lineHeight: 1.55,
  color: "#334155",
  fontWeight: 700,
},

stayNotificationsLegal: {
  marginTop: 8,
  fontSize: 11,
  lineHeight: 1.5,
  color: "#64748b",
  fontWeight: 700,
},

legalLinks: {
  marginTop: 14,
  textAlign: "center",
  fontSize: 12,
  color: "#64748b",
  lineHeight: 1.6,
},

legalLink: {
  color: "#2563eb",
  fontWeight: 800,
  textDecoration: "none",
},

cancellationPolicyBox: {
  marginTop: 18,
  border: "1px solid #bbf7d0",
  borderRadius: 20,
  padding: 16,
  background:
    "linear-gradient(135deg, rgba(240,253,244,0.94), rgba(255,255,255,0.96))",
  display: "grid",
  gap: 12,
},

cancellationPolicyHeader: {
  display: "flex",
  alignItems: "center",
  gap: 12,
},

cancellationPolicyIcon: {
  width: 38,
  height: 38,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: "#ffffff",
  border: "1px solid #bbf7d0",
  color: "#15803d",
  fontSize: 20,
  fontWeight: 950,
  flexShrink: 0,
},

cancellationPolicyEyebrow: {
  fontSize: 11,
  fontWeight: 950,
  color: "#15803d",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
},

cancellationPolicyTitle: {
  marginTop: 3,
  fontSize: 16,
  fontWeight: 950,
  color: "#0f172a",
},

cancellationPolicyHeadline: {
  fontSize: 14,
  fontWeight: 950,
  color: "#14532d",
  lineHeight: 1.45,
},

cancellationPolicyText: {
  margin: 0,
  color: "#334155",
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 700,
},

cancellationPolicyGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 10,
},

cancellationPolicyMetric: {
  border: "1px solid #dcfce7",
  background: "#ffffff",
  borderRadius: 14,
  padding: "10px 12px",
  display: "grid",
  gap: 4,
  color: "#64748b",
  fontSize: 11,
  fontWeight: 900,
},

cancellationPolicyNote: {
  borderTop: "1px solid #dcfce7",
  paddingTop: 10,
  color: "#166534",
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 850,
},

cancellationTimeline: {
  display: "grid",
  gap: 12,
},

cancellationTimelineItem: {
  display: "grid",
  gridTemplateColumns: "38px 1fr",
  gap: 12,
  alignItems: "start",
},

cancellationTimelineMarker: {
  width: 34,
  height: 34,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  fontSize: 15,
  fontWeight: 950,
  border: "1px solid",
},

cancellationTimelineMarkerSuccess: {
  background: "#dcfce7",
  borderColor: "#bbf7d0",
  color: "#15803d",
},

cancellationTimelineMarkerWarning: {
  background: "#fef3c7",
  borderColor: "#fde68a",
  color: "#92400e",
},

cancellationTimelineMarkerDanger: {
  background: "#fee2e2",
  borderColor: "#fecaca",
  color: "#991b1b",
},

cancellationTimelineContent: {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: "12px 13px",
  background: "#ffffff",
  display: "grid",
  gap: 5,
},

cancellationTimelineTopRow: {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
  color: "#0f172a",
  fontSize: 14,
},

cancellationRefundBadge: {
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 12,
  fontWeight: 950,
  border: "1px solid",
  whiteSpace: "nowrap",
},

cancellationRefundBadgeSuccess: {
  background: "#f0fdf4",
  borderColor: "#bbf7d0",
  color: "#15803d",
},

cancellationRefundBadgeWarning: {
  background: "#fffbeb",
  borderColor: "#fde68a",
  color: "#92400e",
},

cancellationRefundBadgeDanger: {
  background: "#fef2f2",
  borderColor: "#fecaca",
  color: "#991b1b",
},

cancellationTimelineWindow: {
  color: "#334155",
  fontSize: 13,
  fontWeight: 850,
},

cancellationTimelineDate: {
  color: "#2563eb",
  fontSize: 12,
  fontWeight: 900,
},

cancellationTimelineDescription: {
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 700,
},

cancellationExceptionsBox: {
  borderTop: "1px solid #dcfce7",
  paddingTop: 12,
  display: "grid",
  gap: 10,
},

cancellationExceptionsTitle: {
  color: "#14532d",
  fontSize: 12,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
},

cancellationScenarioGrid: {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
},

cancellationScenarioPill: {
  borderRadius: 999,
  padding: "6px 9px",
  background: "#ffffff",
  border: "1px solid #dcfce7",
  color: "#166534",
  fontSize: 11,
  fontWeight: 900,
},

};
