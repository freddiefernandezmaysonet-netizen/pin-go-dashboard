from pathlib import Path
p=Path("src/pages/properties/PropertyCalendarPage.tsx")
s=p.read_text()
old='import {\n  getLiveMissionControlMetric,\n  getMissionControlDisplayStatus,\n} from "../../lib/apmsMissionControlPresentation.js";'
new='import {\n  getLiveMissionControlMetric,\n  getMissionControlDisplayStatus,\n} from "../../lib/apmsMissionControlPresentation.js";\nimport {\n  MISSION_CONTROL_POLL_INTERVAL_MS,\n  createMissionControlRefreshState,\n} from "../../lib/apmsMissionControlFreshness.js";'
assert s.count(old)==1, "import anchor drift"
s=s.replace(old,new)
old2='  const [missionControlSnapshot, setMissionControlSnapshot] =\n    useState<any | null>(null);\n  const [loading, setLoading] = useState(false);'
new2='  const [missionControlSnapshot, setMissionControlSnapshot] =\n    useState<any | null>(null);\n  const [loading, setLoading] = useState(false);'
assert s.count(old2)==1, "state anchor drift"
s=s.replace(old2,new2)
old3='        const missionControlRes = await fetch(\n          `${API_BASE}/api/dashboard/properties/${id}/mission-control?from=${from}&to=${to}`,\n          { credentials: "include" }\n        );\n        const missionControlData = await missionControlRes.json();\n\n        if (!active) return;\n\n        setProperty(propertyRes.ok ? propertyData.item : null);\n        setMissionControlSnapshot(\n          missionControlRes.ok ? missionControlData.item : null\n        );'
new3='        if (!active) return;\n\n        setProperty(propertyRes.ok ? propertyData.item : null);'
assert s.count(old3)==1, "heavy loader anchor drift"
s=s.replace(old3,new3)
s=s.replace('          setBlockedDates([]);\n          setMissionControlSnapshot(null);','          setBlockedDates([]);',1)
anchor='  }, [id, from, to]);\n\n  const rateByDate = useMemo(() => {'
insert='  }, [id, from, to]);\n\n  useEffect(() => {\n    if (!id) return;\n\n    let active = true;\n    let requestSequence = 0;\n\n    async function refreshMissionControl() {\n      const sequence = ++requestSequence;\n\n      try {\n        const response = await fetch(\n          `${API_BASE}/api/dashboard/properties/${id}/mission-control?from=${from}&to=${to}`,\n          { credentials: "include" }\n        );\n        const data = await response.json().catch(() => ({}));\n\n        if (!active || sequence !== requestSequence) return;\n\n        const next = createMissionControlRefreshState({\n          ok: response.ok,\n          item: data?.item,\n          refreshedAt: new Date(),\n        });\n        setMissionControlSnapshot(next.snapshot);\n      } catch (error) {\n        console.error("Failed to refresh Mission Control", error);\n        if (!active || sequence !== requestSequence) return;\n        const next = createMissionControlRefreshState({ ok: false });\n        setMissionControlSnapshot(next.snapshot);\n      }\n    }\n\n    setMissionControlSnapshot(null);\n    void refreshMissionControl();\n    const intervalId = window.setInterval(\n      () => void refreshMissionControl(),\n      MISSION_CONTROL_POLL_INTERVAL_MS\n    );\n\n    return () => {\n      active = false;\n      requestSequence += 1;\n      window.clearInterval(intervalId);\n    };\n  }, [id, from, to]);\n\n  const rateByDate = useMemo(() => {'
assert s.count(anchor)==1, "effect anchor drift"
s=s.replace(anchor,insert)
p.write_text(s)
