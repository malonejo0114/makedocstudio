export type ScenarioKey =
  | "CASE_1_REF_PROD_CUSTOM"
  | "CASE_2_REF_PROD_AUTO"
  | "CASE_3_REF_NOPROD_CUSTOM"
  | "CASE_4_REF_NOPROD_AUTO"
  | "CASE_5_NOREF_PROD_CUSTOM"
  | "CASE_6_NOREF_PROD_AUTO"
  | "CASE_7_NOREF_NOPROD_CUSTOM"
  | "CASE_8_NOREF_NOPROD_AUTO";

export function resolveScenarioKey(params: {
  hasReference: boolean;
  hasProduct: boolean;
  isCustomText: boolean;
}): ScenarioKey {
  const { hasReference, hasProduct, isCustomText } = params;

  if (hasReference && hasProduct && isCustomText) return "CASE_1_REF_PROD_CUSTOM";
  if (hasReference && hasProduct && !isCustomText) return "CASE_2_REF_PROD_AUTO";
  if (hasReference && !hasProduct && isCustomText) return "CASE_3_REF_NOPROD_CUSTOM";
  if (hasReference && !hasProduct && !isCustomText) return "CASE_4_REF_NOPROD_AUTO";
  if (!hasReference && hasProduct && isCustomText) return "CASE_5_NOREF_PROD_CUSTOM";
  if (!hasReference && hasProduct && !isCustomText) return "CASE_6_NOREF_PROD_AUTO";
  if (!hasReference && !hasProduct && isCustomText) return "CASE_7_NOREF_NOPROD_CUSTOM";
  return "CASE_8_NOREF_NOPROD_AUTO";
}

export function scenarioSummary(key: ScenarioKey): string {
  switch (key) {
    case "CASE_1_REF_PROD_CUSTOM":
      return "Reference+Product with custom copy";
    case "CASE_2_REF_PROD_AUTO":
      return "Reference+Product with auto copy";
    case "CASE_3_REF_NOPROD_CUSTOM":
      return "Reference only with custom copy";
    case "CASE_4_REF_NOPROD_AUTO":
      return "Reference only with auto copy";
    case "CASE_5_NOREF_PROD_CUSTOM":
      return "Product only with custom copy";
    case "CASE_6_NOREF_PROD_AUTO":
      return "Product only with auto copy";
    case "CASE_7_NOREF_NOPROD_CUSTOM":
      return "No image inputs with custom copy";
    case "CASE_8_NOREF_NOPROD_AUTO":
      return "No image inputs with auto copy";
  }
}
