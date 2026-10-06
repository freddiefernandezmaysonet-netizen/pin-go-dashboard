import json, os, subprocess
from pathlib import Path

def git(*args):
    return subprocess.check_output(["git", *args], text=True)

event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
pr = event["pull_request"]
repo = "freddiefernandezmaysonet-netizen/pin-go-dashboard"
assert os.environ.get("GITHUB_EVENT_NAME") == "pull_request"
assert os.environ.get("GITHUB_REPOSITORY") == repo
assert pr["number"] == 193 and pr["head"]["repo"]["full_name"] == repo
assert pr["head"]["ref"] == "agent/pin-ai-property-activation-v1" and pr["base"]["ref"] == "main"
base = "666dddd895f2fa8d10709126e26cd2f4fd637c21"
assert git("merge-base", "origin/main", "HEAD").strip() == base
expected = {'src/api/auth.ts', 'src/components/properties/PinAIBillingCard.tsx', 'src/api/pinAIActivation.ts', 'src/pages/dashboard/BillingPage.tsx', '.github/workflows/pin-ai-property-activation-dashboard.yml', 'src/components/properties/PinAISettingsCard.tsx', 'src/pages/properties/PropertyEditPage.tsx', 'src/app/layout/AppShell.tsx', '.github/workflows/enterprise-auth-e8b-session-enforcement-ui.yml', 'scripts/verify-pin-ai-activation-scope.py', 'src/pages/admin/AdminPinAIActivationPage.tsx', 'src/components/properties/pinAISettings.interaction.test.mjs', 'src/app/routes/router.tsx', '.github/workflows/enterprise-auth-e6-canary-ui.yml'}
assert set(git("diff", "--name-only", base, "HEAD").splitlines()) == expected
original = git("show", base + ":src/api/auth.ts")
assert git("show", "HEAD:src/api/auth.ts") == original.replace("function brandHostnameHeader() {", "function brandHostnameHeader(): Record<string, string> {")
assert not git("diff", "--name-only", base, "HEAD", "src/auth", "src/api/client.ts", "src/pages/LoginPage.tsx").strip()
