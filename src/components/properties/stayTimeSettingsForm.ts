import type { StayTimeRule, StayTimeSettings } from "../../api/stayTimeSettings";

export type StayTimeRuleForm = {
  enabled: boolean; limitLocalTime: string; mode: StayTimeRule["fee"]["mode"]; amount: string;
};
export type StayTimeSettingsForm = { earlyCheckin: StayTimeRuleForm; lateCheckout: StayTimeRuleForm };
export function settingsToForm(settings: StayTimeSettings): StayTimeSettingsForm {
  const rule = (value: StayTimeRule): StayTimeRuleForm => ({ enabled: value.enabled,
    limitLocalTime: value.limitLocalTime, mode: value.fee.mode, amount: (value.fee.amountMinor / 100).toFixed(2) });
  return { earlyCheckin: rule(settings.earlyCheckin), lateCheckout: rule(settings.lateCheckout) };
}
export function formToSettings(form: StayTimeSettingsForm): StayTimeSettings {
  const rule = (value: StayTimeRuleForm): StayTimeRule => {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.limitLocalTime)) throw new Error("INVALID_TIME");
    const normalized = value.amount.trim().replace(",", ".");
    let amountMinor = 0;
    if (value.mode !== "FREE") {
      if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(normalized)) throw new Error("INVALID_AMOUNT");
      const [whole, fraction = ""] = normalized.split(".");
      amountMinor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
      if (amountMinor <= 0 || amountMinor > 99_999_999) throw new Error("INVALID_AMOUNT");
    }
    return { enabled: value.enabled, limitLocalTime: value.limitLocalTime,
      fee: { mode: value.mode, amountMinor, currency: "USD" } };
  };
  return { earlyCheckin: rule(form.earlyCheckin), lateCheckout: rule(form.lateCheckout) };
}
