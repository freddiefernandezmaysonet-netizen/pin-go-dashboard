from pathlib import Path

BASE = "f932bdda5c7ebcaf10becf43df9dd3b967a59809"


def patch(path: str, replacements: list[tuple[str, str]]) -> None:
    p = Path(path)
    raw = p.read_bytes()
    crlf = b"\r\n" in raw
    text = raw.decode("utf-8").replace("\r\n", "\n")
    for old, new in replacements:
        count = text.count(old)
        if count != 1:
            raise SystemExit(f"{path}: expected anchor exactly once, found {count}: {old[:80]!r}")
        text = text.replace(old, new, 1)
    out = text.replace("\n", "\r\n") if crlf else text
    p.write_bytes(out.encode("utf-8"))


patch(
    "src/api/properties.ts",
    [
        (
            "  country?: string;\n  timezone?: string;",
            "  country?: string;\n  postalCode?: string;\n  timezone?: string;",
        ),
    ],
)

patch(
    "src/pages/onboarding/CreatePropertyPage.tsx",
    [
        (
            '  const [country, setCountry] = useState("");\n  const [timezone, setTimezone] = useState("America/Puerto_Rico");',
            '  const [country, setCountry] = useState("");\n  const [postalCode, setPostalCode] = useState("");\n  const [timezone, setTimezone] = useState("America/Puerto_Rico");',
        ),
        (
            '            const nextRegion = componentValue("administrative_area_level_1");\n            const nextCountry = componentValue("country");',
            '            const nextRegion = componentValue("administrative_area_level_1");\n            const nextCountry = componentValue("country");\n            const nextPostalCode = componentValue("postal_code");',
        ),
        (
            '            setCity(nextCity);\n\n            if (nextCountry) {',
            '            setCity(nextCity);\n            setPostalCode(nextPostalCode);\n\n            if (nextCountry) {',
        ),
        (
            '        country,\n        timezone,',
            '        country,\n        postalCode,\n        timezone,',
        ),
        (
            '          <div style={twoColGridStyle}>\n            <div>\n              <label style={labelStyle}>Country</label>',
            '          <div>\n            <label style={labelStyle}>ZIP / Postal Code</label>\n            <input\n              value={postalCode}\n              onChange={(e) => setPostalCode(e.target.value)}\n              autoComplete="postal-code"\n              placeholder="00771"\n              style={inputStyle}\n            />\n          </div>\n\n          <div style={twoColGridStyle}>\n            <div>\n              <label style={labelStyle}>Country</label>',
        ),
    ],
)

patch(
    "src/pages/properties/PropertyEditPage.tsx",
    [
        (
            "  country?: string | null;\n  timezone?: string | null;",
            "  country?: string | null;\n  postalCode?: string | null;\n  timezone?: string | null;",
        ),
        (
            '    country: "",\n    timezone: "",',
            '    country: "",\n    postalCode: "",\n    timezone: "",',
        ),
        (
            '          country: p.country ?? "",\n          timezone: p.timezone ?? "",',
            '          country: p.country ?? "",\n          postalCode: p.postalCode ?? "",\n          timezone: p.timezone ?? "",',
        ),
        (
            '          country: form.country,\n          timezone: form.timezone,',
            '          country: form.country,\n          postalCode: form.postalCode,\n          timezone: form.timezone,',
        ),
        (
            '          <div style={responsiveGridStyle}>\n            <div style={{ display: "grid", gap: 6 }}>\n              <div style={labelStyle}>Country</div>',
            '          <div style={{ display: "grid", gap: 6 }}>\n            <div style={labelStyle}>ZIP / Postal Code</div>\n            <input\n              value={form.postalCode}\n              onChange={(e) =>\n                setForm((s) => ({ ...s, postalCode: e.target.value }))\n              }\n              autoComplete="postal-code"\n              placeholder="00771"\n              style={inputStyle}\n            />\n          </div>\n\n          <div style={responsiveGridStyle}>\n            <div style={{ display: "grid", gap: 6 }}>\n              <div style={labelStyle}>Country</div>',
        ),
    ],
)

contract = '''import assert from "node:assert/strict";\nimport fs from "node:fs";\nimport test from "node:test";\n\nconst createSource = fs.readFileSync("src/pages/onboarding/CreatePropertyPage.tsx", "utf8");\nconst editSource = fs.readFileSync("src/pages/properties/PropertyEditPage.tsx", "utf8");\nconst apiSource = fs.readFileSync("src/api/properties.ts", "utf8");\n\ntest("Create Property captures and submits postal code as text", () => {\n  assert.match(apiSource, /postalCode\\?: string;/);\n  assert.match(createSource, /componentValue\\(\"postal_code\"\\)/);\n  assert.match(createSource, /setPostalCode\\(nextPostalCode\\)/);\n  assert.match(createSource, /postalCode,/);\n  assert.match(createSource, /ZIP \\/ Postal Code/);\n  assert.match(createSource, /autoComplete=\"postal-code\"/);\n  assert.doesNotMatch(createSource, /Number\\(postalCode\\)/);\n});\n\ntest("Property Edit loads, edits, and submits postal code without numeric coercion", () => {\n  assert.match(editSource, /postalCode\\?: string \\| null;/);\n  assert.match(editSource, /postalCode: p\\.postalCode \\?\\? \"\"/);\n  assert.match(editSource, /postalCode: form\\.postalCode/);\n  assert.match(editSource, /value=\\{form\\.postalCode\\}/);\n  assert.match(editSource, /ZIP \\/ Postal Code/);\n  assert.doesNotMatch(editSource, /Number\\(form\\.postalCode\\)/);\n});\n'''
Path("src/pages/properties/PropertyPostalCode.contract.test.js").write_text(contract, encoding="utf-8")
print("dashboard postal patch staged")
