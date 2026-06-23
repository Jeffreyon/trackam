/**
 * Seed 5 test waybills on the OLI switch via the public endpoint.
 * No auth needed. Prints waybillNumber + claimToken for each.
 *
 * Usage:
 *   node apps/trackam/scripts/seedWaybills.js
 *   node apps/trackam/scripts/seedWaybills.js --base https://trackam.bkydstudios.com
 */

const https = require("https");
const http  = require("http");
const { URL } = require("url");

const BASE = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "https://trackam.bkydstudios.com";

// All pickupLocation / deliveryLocation values use city names from nigerianCities.ts
// so they match exactly what users select in the CityAutocomplete on routes and runs.
const WAYBILLS = [
  {
    senderName:      "Emeka Okafor",
    senderPhone:     "08031234567",
    senderEmail:     "emeka@test.com",
    receiverName:    "Fatima Aliyu",
    receiverPhone:   "08077651234",
    receiverEmail:   "fatima@test.com",
    receiverAddress: "12 Abubakar Rd, Kano",
    goodsDescription: "Phone accessories — 50 units",
    pickupLocation:   "Trade Fair",
    deliveryLocation: "Kano",
    estimatedWeightKg: 8,
    declaredValueNgn:  150000,
  },
  {
    senderName:      "Ngozi Eze",
    senderPhone:     "08055559001",
    senderEmail:     "ngozi@test.com",
    receiverName:    "Seun Adewale",
    receiverPhone:   "08144556677",
    receiverEmail:   "seun@test.com",
    receiverAddress: "45 Market Square, Ibadan",
    goodsDescription: "Fabric rolls — 10 pcs",
    pickupLocation:   "Onitsha",
    deliveryLocation: "Ibadan",
    estimatedWeightKg: 22,
    declaredValueNgn:  95000,
  },
  {
    senderName:      "Aminu Garba",
    senderPhone:     "08022223344",
    senderEmail:     "aminu@test.com",
    receiverName:    "Chioma Obi",
    receiverPhone:   "08134567890",
    receiverEmail:   "chioma@test.com",
    receiverAddress: "7 Apongbon St, Ikeja",
    goodsDescription: "Electronic components — bulk",
    pickupLocation:   "Abuja",
    deliveryLocation: "Ikeja",
    estimatedWeightKg: 15,
    declaredValueNgn:  320000,
  },
  {
    senderName:      "Hauwa Musa",
    senderPhone:     "07067891234",
    senderEmail:     "hauwa@test.com",
    receiverName:    "Tunde Bakare",
    receiverPhone:   "08090001111",
    receiverEmail:   "tunde@test.com",
    receiverAddress: "21 Okigwe Rd, Owerri",
    goodsDescription: "Garments — 30 pieces",
    pickupLocation:   "Kano",
    deliveryLocation: "Owerri",
    estimatedWeightKg: 12,
    declaredValueNgn:  75000,
  },
  {
    senderName:      "Chukwudi Eze",
    senderPhone:     "08033336666",
    senderEmail:     "chukwudi@test.com",
    receiverName:    "Bola Adekunle",
    receiverPhone:   "08011112222",
    receiverEmail:   "bola@test.com",
    receiverAddress: "3 Ring Rd, Benin City",
    goodsDescription: "Spare parts — 25 units",
    pickupLocation:   "Ikeja",
    deliveryLocation: "Benin City",
    estimatedWeightKg: 30,
    declaredValueNgn:  200000,
  },
];

function post(urlStr, body) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(urlStr);
    const mod     = parsed.protocol === "https:" ? https : http;
    const bodyStr = JSON.stringify(body);
    const req = mod.request(
      {
        hostname: parsed.hostname,
        port:     parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path:     parsed.pathname + parsed.search,
        method:   "POST",
        headers: {
          "content-type":   "application/json",
          "content-length": Buffer.byteLength(bodyStr),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => { raw += c; });
        res.on("end", () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
          catch { reject(new Error("Non-JSON: " + raw.slice(0, 200))); }
        });
      }
    );
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

async function run() {
  console.log(`\nSeeding ${WAYBILLS.length} waybills → ${BASE}\n`);
  const results = [];

  for (let i = 0; i < WAYBILLS.length; i++) {
    const w = WAYBILLS[i];
    try {
      const { status, data } = await post(`${BASE}/api/waybill`, w);
      if (status >= 200 && status < 300 && data.waybillNumber) {
        results.push({ waybillNumber: data.waybillNumber, claimToken: data.claimToken, id: data.id });
        console.log(`[${i + 1}] ${data.waybillNumber}  claim: ${data.claimToken}  (${w.goodsDescription})`);
      } else {
        console.error(`[${i + 1}] FAILED ${status}:`, JSON.stringify(data).slice(0, 200));
      }
    } catch (err) {
      console.error(`[${i + 1}] ERROR:`, err.message);
    }
  }

  if (results.length === 0) {
    console.error("\nNo waybills created. Check that the backend is reachable.");
    process.exit(1);
  }

  console.log(`\n── Done: ${results.length} waybill(s) created ─────────────────────────`);
  console.log("Go to your dashboard → Waybills → Claim, and enter each pair:\n");
  for (const r of results) {
    console.log(`  Waybill #: ${r.waybillNumber}   Claim code: ${r.claimToken}`);
  }
  console.log("");
}

run().catch((e) => { console.error(e); process.exit(1); });
