const fs = require("fs");
const path = require("path");
const process = require("process");

const envPath = path.join(__dirname, "..", ".env");

if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const requiredVariables = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
];

const missingVariables = requiredVariables.filter(
  (variable) => !process.env[variable]?.trim()
);

if (missingVariables.length > 0) {
  console.error(
    `Faltan variables de entorno requeridas: ${missingVariables.join(", ")}`
  );

  process.exit(1);
}

const config = {
  SUPABASE_URL: process.env.SUPABASE_URL.trim(),
  SUPABASE_PUBLISHABLE_KEY:
    process.env.SUPABASE_PUBLISHABLE_KEY.trim(),
  BACKEND_API_URL:
    process.env.BACKEND_API_URL?.trim() || "",
};

const output = `export const runtimeConfig = Object.freeze(${JSON.stringify(
  config,
  null,
  2
)});
`;

const destination = path.join(
  __dirname,
  "..",
  "public",
  "js",
  "app",
  "runtime-config.js"
);

fs.mkdirSync(path.dirname(destination), {
  recursive: true,
});

fs.writeFileSync(destination, output, "utf8");

console.log(
  "Configuración pública generada en public/js/app/runtime-config.js"
);