// Serverless function: logs into the SQL Explorer, downloads the batch data,
// enriches it with FIDE ratings, and returns clean JSON to the browser.
// Credentials are read from environment variables and never sent to the client.

const EXPLORER_BASE = "https://explorer.circlechess.com";
const QUERY_ID = "224";

const COACH_FIDE_OVERRIDES = {
  "Vinay Bhatt": 2025,
};

function extractCsrfToken(html) {
  const match = html.match(/csrfmiddlewaretoken"\s+value="([^"]+)"/);
  return match ? match[1] : null;
}

function extractCookies(headers) {
  const raw = headers.getSetCookie ? headers.getSetCookie() : (headers.get("set-cookie") ? [headers.get("set-cookie")] : []);
  return raw.map(c => c.split(";")[0]).join("; ");
}

async function loginAndGetSession() {
  const loginUrl = `${EXPLORER_BASE}/${QUERY_ID}/`;
  const loginPageRes = await fetch(loginUrl);
  const loginHtml = await loginPageRes.text();
  const csrfToken = extractCsrfToken(loginHtml);
  let cookies = extractCookies(loginPageRes.headers);

  const form = new URLSearchParams();
  form.set("csrfmiddlewaretoken", csrfToken);
  form.set("username", process.env.EXPLORER_USERNAME);
  form.set("password", process.env.EXPLORER_PASSWORD);
  form.set("next", `/${QUERY_ID}/`);

  const signInRes = await fetch(loginUrl, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies,
      Referer: loginUrl,
    },
    body: form.toString(),
  });
  const moreCookies = extractCookies(signInRes.headers);
  if (moreCookies) cookies = moreCookies;
  return cookies;
}

async function downloadBatches(cookies) {
  const url = `${EXPLORER_BASE}/explorer/${QUERY_ID}/download?format=json`;
  const res = await fetch(url, { headers: { Cookie: cookies } });
  if (!res.ok) throw new Error(`Explorer download failed: ${res.status}`);
  return res.json();
}

async function fetchFideRating(fideId) {
  try {
    const res = await fetch(`https://api.chesstools.org/fide/player_history/?fide_id=${fideId}`);
    if (!res.ok) return null;
    const history = await res.json();
    if (!Array.isArray(history) || !history.length) return null;
    const latest = history[0];
    const values = [latest.classical_rating, latest.rapid_rating, latest.blitz_rating].filter(v => typeof v === "number" && v > 0);
    return values.length ? Math.max(...values) : null;
  } catch {
    return null;
  }
}

function parseBatch(row, ratingsById) {
  let code = row.batch_name || "";
  let display = row.batch_display_name || "";
  const looksLikeCode = s => /^[A-Za-z]{2,4}(-[A-Za-z0-9]+){1,3}$/.test((s || "").trim());
  if (!looksLikeCode(code) && looksLikeCode(display)) {
    [code, display] = [display, code];
  }
  const parts = code.split("-").filter(Boolean);
  const country = (parts[0] || "?").toUpperCase();
  let level = parts.length >= 2 ? parts[parts.length - 2].toUpperCase() : "?";
  if (level === "F") level = "F1";
  const coachName = (row.coach_name || "").trim();

  let fideRating = null;
  if (coachName && COACH_FIDE_OVERRIDES[coachName] != null) {
    fideRating = COACH_FIDE_OVERRIDES[coachName];
  } else if (coachName && row.fide_id) {
    fideRating = ratingsById[row.fide_id] ?? null;
  }

  return {
    tournament_id: row.tournament_id,
    batch_name: code,
    batch_display_name: display,
    country,
    level,
    coach_name: coachName || null,
    fide_id: row.fide_id || null,
    fide_rating: fideRating,
    start_date: row.start_date,
    end_date: row.end_date,
    registration_active: row.registration_active,
    entrycount: row.entrycount,
  };
}

module.exports = async function handler(req, res) {
  try {
    const cookies = await loginAndGetSession();
    const rawBatches = await downloadBatches(cookies);

    const uniqueFideIds = [...new Set(rawBatches.map(r => r.fide_id).filter(id => id && id !== 0))];
    const ratingsById = {};
    await Promise.all(
      uniqueFideIds.map(async id => {
        ratingsById[id] = await fetchFideRating(id);
      })
    );

    const enriched = rawBatches.map(row => parseBatch(row, ratingsById));

    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=300");
    res.status(200).json({ generatedAt: new Date().toISOString(), batches: enriched });
  } catch (err) {
    res.status(502).json({ error: "Failed to fetch live data", detail: String(err && err.message || err) });
  }
};
