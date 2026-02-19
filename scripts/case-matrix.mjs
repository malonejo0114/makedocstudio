function resolveScenarioKey({ hasReference, hasProduct, isCustomText }) {
  if (hasReference && hasProduct && isCustomText) return "CASE_1_REF_PROD_CUSTOM";
  if (hasReference && hasProduct && !isCustomText) return "CASE_2_REF_PROD_AUTO";
  if (hasReference && !hasProduct && isCustomText) return "CASE_3_REF_NOPROD_CUSTOM";
  if (hasReference && !hasProduct && !isCustomText) return "CASE_4_REF_NOPROD_AUTO";
  if (!hasReference && hasProduct && isCustomText) return "CASE_5_NOREF_PROD_CUSTOM";
  if (!hasReference && hasProduct && !isCustomText) return "CASE_6_NOREF_PROD_AUTO";
  if (!hasReference && !hasProduct && isCustomText) return "CASE_7_NOREF_NOPROD_CUSTOM";
  return "CASE_8_NOREF_NOPROD_AUTO";
}

const rows = [
  { hasReference: true, hasProduct: true, isCustomText: true },
  { hasReference: true, hasProduct: true, isCustomText: false },
  { hasReference: true, hasProduct: false, isCustomText: true },
  { hasReference: true, hasProduct: false, isCustomText: false },
  { hasReference: false, hasProduct: true, isCustomText: true },
  { hasReference: false, hasProduct: true, isCustomText: false },
  { hasReference: false, hasProduct: false, isCustomText: true },
  { hasReference: false, hasProduct: false, isCustomText: false },
];

console.log("8-case matrix:");
for (const row of rows) {
  const key = resolveScenarioKey(row);
  console.log(
    `- ref:${row.hasReference ? "Y" : "N"} / prod:${row.hasProduct ? "Y" : "N"} / text:${row.isCustomText ? "CUSTOM" : "AUTO"} => ${key}`,
  );
}
