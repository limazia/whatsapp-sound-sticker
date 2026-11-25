export const apiErrorSchema = {
  type: "object",
  required: ["ok", "error"],
  properties: { ok: { const: false }, error: { type: "string" } },
};

export const ffmpegStatusSchema = {
  type: "object",
  required: ["available"],
  properties: { available: { type: "boolean" } },
};
