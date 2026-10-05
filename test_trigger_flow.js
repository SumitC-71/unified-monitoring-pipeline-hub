// test-consent-email.js

const FLOW_URL = ""; // paste your Power Automate URL here

const body = {
  adminName:  "Test Admin",
  adminEmail: "chauhansk1712@gmail.com", // use your own email to verify delivery
  tenantName: "Test Client Corp",
  consentUrl: "https://login.microsoftonline.com/test-tenant-id/adminconsent?client_id=test-app-id",
};

const res = await fetch(FLOW_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

console.log("Status :", res.status, res.statusText);

// Power Automate returns 202 Accepted (not 200) on success
if (res.status === 202) {
  console.log("✅ Flow triggered successfully — check your inbox");
} else {
  const text = await res.text();
  console.error("❌ Flow failed:", text);
}