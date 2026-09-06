from pathlib import Path

path = Path("src/pages/public-booking/PublicPropertyDetailPage.tsx")
text = path.read_text()

old_blocked = '''useEffect(() => {
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
}, [property?.id]);'''

new_blocked = '''const refreshBlockedDates = useCallback(async () => {
  if (!property?.id) {
    setBlockedDates([]);
    return;
  }

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
        propertyId: property.id,
        from,
        to,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      setBlockedDates([]);
      return;
    }

    setBlockedDates(Array.isArray(data.blockedDates) ? data.blockedDates : []);
  } catch (err) {
    console.error("[blocked dates frontend error]", err);
    setBlockedDates([]);
  }
}, [property?.id]);

useEffect(() => {
  void refreshBlockedDates();
}, [refreshBlockedDates]);'''

if text.count(old_blocked) != 1:
    raise SystemExit(f"blocked dates anchor count={text.count(old_blocked)}")
text = text.replace(old_blocked, new_blocked, 1)

old_checkout = '''      const data = await res.json();

      if (!res.ok || !data.ok || !data.checkoutUrl) {
        throw new Error(
          data.error || copy.unableToCreateCheckout
        );
      }
      window.location.href = data.checkoutUrl;'''

new_checkout = '''      const data = await res.json();

      if (
        res.status === 409 &&
        data?.error === "Property is not available for the selected dates"
      ) {
        setPricing(null);
        await refreshBlockedDates();
        setBookingError(
          preferredLanguage === "es"
            ? "Estas fechas acaban de dejar de estar disponibles. Selecciona otras fechas para continuar."
            : "These dates just became unavailable. Select different dates to continue."
        );
        window.setTimeout(() => {
          document.getElementById("pbe-booking-title")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 0);
        return;
      }

      if (!res.ok || !data.ok || !data.checkoutUrl) {
        throw new Error(
          data.error || copy.unableToCreateCheckout
        );
      }
      window.location.href = data.checkoutUrl;'''

if text.count(old_checkout) != 1:
    raise SystemExit(f"checkout anchor count={text.count(old_checkout)}")
text = text.replace(old_checkout, new_checkout, 1)

path.write_text(text)
