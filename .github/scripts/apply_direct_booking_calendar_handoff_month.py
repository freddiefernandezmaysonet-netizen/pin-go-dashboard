from pathlib import Path

path = Path('src/pages/public-booking/PublicPropertyDetailPage.tsx')
text = path.read_text()
old = '''    <DayPicker     
      mode="range"
      numberOfMonths={2}
      locale={preferredLanguage === "es" ? es : enUS}
'''
new = '''    <DayPicker     
      mode="range"
      numberOfMonths={2}
      defaultMonth={fromDateInputValue(checkIn)}
      locale={preferredLanguage === "es" ? es : enUS}
'''
if text.count(old) != 1:
    raise SystemExit(f'Expected exactly one DayPicker anchor, found {text.count(old)}')
path.write_text(text.replace(old, new, 1))
