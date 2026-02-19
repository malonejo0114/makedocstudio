const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "GEMINI_API_KEY",
];

const optional = ["GEMINI_TEXT_MODEL", "GEMINI_IMAGE_MODELS"];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error("Missing required env vars:");
  for (const key of missing) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}

console.log("All required env vars are set.");
for (const key of optional) {
  console.log(`- ${key}: ${process.env[key] ? "set" : "not set (optional)"}`);
}
