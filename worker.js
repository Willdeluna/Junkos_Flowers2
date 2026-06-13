/**
 * Junko's Custom Flowers — AI Enhance proxy
 * Cloudflare Worker. Keeps the OpenAI key server-side so the app
 * (published on GitHub Pages) never exposes it.
 *
 * The app POSTs JSON:  { image: "data:image/png;base64,...", prompt, size }
 * The Worker returns:  { image: "data:image/png;base64,..." }
 *
 * Secrets / vars (set with: npx wrangler secret put OPENAI_KEY):
 *   OPENAI_KEY   (required)  your OpenAI API key, sk-...
 *   MODEL        (optional)  default "gpt-image-1"  (or gpt-image-1.5 / gpt-image-2)
 *   ALLOW_ORIGIN (optional)  default "*"  — set to https://willdeluna.github.io to lock it down
 */

export default {
  async fetch(request, env) {
    const ORIGIN = env.ALLOW_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "POST only" }, 405, cors);
    }
    if (!env.OPENAI_KEY) {
      return json({ error: "Worker missing OPENAI_KEY secret" }, 500, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid JSON body" }, 400, cors);
    }

    const { image, prompt, size } = body || {};
    if (!image || !prompt) {
      return json({ error: "need { image, prompt }" }, 400, cors);
    }

    // data URL -> Blob for multipart upload
    let blob, mime;
    try {
      const m = /^data:(image\/\w+);base64,(.*)$/s.exec(image);
      if (!m) throw new Error("image must be a data:image/...;base64 URL");
      mime = m[1];
      const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
      blob = new Blob([bytes], { type: mime });
    } catch (e) {
      return json({ error: "bad image: " + e.message }, 400, cors);
    }

    const ext = mime.split("/")[1] || "png";
    const model = env.MODEL || "gpt-image-1";

    const form = new FormData();
    form.append("model", model);
    form.append("image", blob, "view." + ext);
    form.append("prompt", prompt);
    // gpt-image models accept 1024x1024, 1536x1024, 1024x1536 (portrait suits bouquets)
    form.append("size", size || "1024x1536");
    form.append("n", "1");

    let oai;
    try {
      oai = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: "Bearer " + env.OPENAI_KEY },
        body: form,
      });
    } catch (e) {
      return json({ error: "upstream fetch failed: " + e.message }, 502, cors);
    }

    if (!oai.ok) {
      const detail = await oai.text();
      return json({ error: "openai " + oai.status, detail }, oai.status, cors);
    }

    const data = await oai.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      return json({ error: "no image in response", raw: data }, 502, cors);
    }

    return json({ image: "data:image/png;base64," + b64 }, 200, cors);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
