function securityHeaders(request) {
  const ownOrigin = new URL(request.url).origin;
  const origin = request.headers.get("Origin");
  return {
    ...(origin === ownOrigin ? { "Access-Control-Allow-Origin": ownOrigin } : {}),
    "Access-Control-Allow-Headers": "content-type,x-app-password",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };
}

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["canvas", "objects"],
  properties: {
    canvas: {
      type: "object",
      additionalProperties: false,
      required: ["width", "height", "summary"],
      properties: {
        width: { type: "integer" },
        height: { type: "integer" },
        summary: { type: "string" },
      },
    },
    objects: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "category", "z_index", "confidence", "bbox", "polygon", "text", "editable_as_text"],
        properties: {
          name: { type: "string" },
          category: { type: "string", enum: ["person", "text", "number", "label", "icon", "decoration", "photo", "background", "other"] },
          z_index: { type: "integer" },
          confidence: { type: "number" },
          bbox: {
            type: "object", additionalProperties: false,
            required: ["x", "y", "width", "height"],
            properties: { x: {type:"number"}, y:{type:"number"}, width:{type:"number"}, height:{type:"number"} },
          },
          polygon: {
            type: "array",
            items: {
              type: "object", additionalProperties: false,
              required: ["x", "y"], properties: { x:{type:"number"}, y:{type:"number"} },
            },
          },
          text: { type: "string" },
          editable_as_text: { type: "boolean" },
        },
      },
    },
  },
};

function extractText(json) {
  for (const item of json.output || []) {
    for (const part of item.content || []) if (part.type === "output_text") return part.text;
  }
  throw new Error("Model response did not contain output_text");
}

export default {
  async fetch(request, env) {
    const headers = securityHeaders(request);
    if (request.method === "OPTIONS") return new Response(null, { headers });
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ ok: true }, { headers });
    if (url.pathname !== "/api/analyze-layout") return env.ASSETS.fetch(request);
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers });
    if (!env.APP_PASSWORD || request.headers.get("X-App-Password") !== env.APP_PASSWORD) {
      return Response.json({ error: "访问密码错误" }, { status: 401, headers });
    }
    if (!env.OPENAI_API_KEY) return Response.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503, headers });
    try {
      const { image, width, height } = await request.json();
      if (!image?.startsWith("data:image/")) throw new Error("A data URL image is required");
      const prompt = `Analyze this flattened poster as a professional Photoshop/Adobe-style layer reconstruction system.
Return every visually meaningful object: people, photos, large titles, numbers, labels, icons, decorations and background regions.
Coordinates must be normalized from 0 to 1 relative to the full canvas (${width}x${height}).
For each object return a tight bbox and an 8-24 point polygon following the visible silhouette. Respect occlusion and infer z-order: larger z_index is visually higher.
Text must be transcribed exactly. Separate distinct typographic blocks. Do not combine a person with nearby text or labels.
Do not invent invisible content. Prefer more specific objects over one giant region. Background may be one object.`;
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: env.OPENAI_MODEL || "gpt-5.6-sol",
          reasoning: { effort: "high" },
          input: [{ role: "user", content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: image, detail: "high" },
          ]}],
          text: { format: { type: "json_schema", name: "layout_analysis", strict: true, schema } },
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || "OpenAI request failed");
      const result = JSON.parse(extractText(json));
      return Response.json(result, { headers: { ...headers, "Cache-Control": "no-store" } });
    } catch (error) {
      return Response.json({ error: error.message }, { status: 400, headers });
    }
  },
};
