const backendUrl =
  process.env.BACKEND_URL ?? "https://adaptive-video-streaming-backend.fly.dev";
const frontendOrigin =
  process.env.FRONTEND_ORIGIN ?? "https://adaptive-video-streaming-frontend.fly.dev";
const email = process.env.LOGIN_EMAIL;
const password = process.env.LOGIN_PASSWORD;

if (!email || !password) {
  console.error(
    "Missing LOGIN_EMAIL or LOGIN_PASSWORD. Example:\n" +
      "LOGIN_EMAIL=user@example.com LOGIN_PASSWORD=Secret123 node scripts/prod-login-check.mjs",
  );
  process.exit(1);
}

const endpoint = `${backendUrl.replace(/\/$/, "")}/api/auth/login`;

const preflight = await fetch(endpoint, {
  method: "OPTIONS",
  headers: {
    Origin: frontendOrigin,
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "content-type,authorization",
  },
});

console.log("OPTIONS status:", preflight.status);
console.log(
  "OPTIONS access-control-allow-origin:",
  preflight.headers.get("access-control-allow-origin"),
);

const login = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: frontendOrigin,
  },
  body: JSON.stringify({ email, password }),
});

const text = await login.text();
console.log("POST status:", login.status);
console.log(
  "POST access-control-allow-origin:",
  login.headers.get("access-control-allow-origin"),
);
console.log("POST body:", text);
