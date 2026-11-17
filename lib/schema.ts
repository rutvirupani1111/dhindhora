// zod schemas shared by client and server. Unknown keys are stripped; a doc that fails is never stored.
import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const style = z.enum(["truck", "cinema", "kirana", "akhbaar", "neon"]);
const block = z.object({
  lines: z.array(z.string().max(200)).max(12), px: z.number(), family: z.string().max(40), weight: z.number(),
  box: z.tuple([z.number(), z.number(), z.number(), z.number()]), align: z.enum(["left", "center"]),
});
export const BriefSchema = z.object({
  lang: z.enum(["en", "hi", "hinglish"]),
  name: z.string().max(40),
  oneLiner: z.string().max(90),
  points: z.array(z.object({ id: z.string().max(12), text: z.string().max(60) })).max(6),
  numbers: z.array(z.object({
    id: z.string().max(12), value: z.number().finite().min(-1e9).max(1e9),
    prefix: z.enum(["", "₹", "Rs", "#"]), suffix: z.enum(["", "+", "%", "k", "L", "x", " saal", " seats"]),
    label: z.string().max(24), sample: z.boolean(),
  })).max(4),
  colors: z.array(hex).max(3),
  logo: z.object({ hash: z.string().regex(/^[0-9a-f]{64}$/), w: z.number().int().min(1).max(512), h: z.number().int().min(1).max(512), tint: z.boolean() }).optional(),
  cta: z.object({
    text: z.string().max(40),
    phone: z.string().regex(/^\+?[0-9 ]{8,15}$/).optional().or(z.literal("")),
    address: z.string().max(120).optional(),
    url: z.string().max(120).regex(/^https?:\/\//).optional().or(z.literal("")),
  }),
  offer: z.object({
    oldPrice: z.number().min(0).max(1e8).optional(), newPrice: z.number().min(0).max(1e8).optional(),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  }).optional(),
});
export const SceneSchema = z.object({
  id: z.string().min(1).max(12),
  type: z.enum(["shutter", "meter", "kite", "magazine", "phone", "ladoo", "seal", "price", "countdown", "end"]),
  variant: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  durMs: z.number().min(500).max(12000),
  inMs: z.number().min(0).max(12000),
  speed: z.number().min(0.5).max(2),
  source: z.array(z.string().max(24)).max(12),
  text: z.record(z.string().max(24), z.string().max(120)),
  style: style.optional(),
  edited: z.array(z.string().max(24)).max(40),
  userAdded: z.boolean().optional(),
  lock: z.object({
    rv: z.string().max(12), aspect: z.enum(["9:16", "1:1", "16:9"]), style, blocks: z.record(z.string().max(24), block),
    days: z.number().int().min(0).max(9999).optional(), qr: z.object({ n: z.number().int().max(177), bits: z.string().max(31329).regex(/^[01]*$/) }).optional(),
    sig: z.string().max(24),
  }).optional(),
});
export const DocSchema = z.object({
  schema: z.literal(1),
  renderer: z.string().max(12),
  brief: BriefSchema,
  seed: z.number().int().min(1).max(1e6),
  style,
  aspect: z.enum(["9:16", "1:1", "16:9"]),
  lengthSec: z.union([z.literal(10), z.literal(15), z.literal(30), z.literal(45), z.literal(60)]),
  scenes: z.array(SceneSchema).max(20),
}).superRefine((d, ctx) => {
  const total = d.scenes.reduce((a, s) => a + s.durMs, 0);
  if (total > 60500) ctx.addIssue({ code: "custom", message: "total_too_long" });
  if (JSON.stringify(d).length > 65536) ctx.addIssue({ code: "custom", message: "doc_too_big" });
});
export type DocIn = z.infer<typeof DocSchema>;

export const projectIdRe = /^[A-Za-z0-9_-]{10}$/;
export const CreateSchema = z.object({ id: z.string().regex(projectIdRe), doc: DocSchema });
export const PutSchema = z.object({ baseVersion: z.number().int().min(1), doc: DocSchema });
export const PublishSchema = z.object({ visibility: z.enum(["unlisted", "public"]), ownsOrPermitted: z.boolean().optional() });
export const ReportSchema = z.object({ reason: z.enum(["impersonation", "misleading", "offensive", "spam", "other"]), note: z.string().max(500).optional() });
export const AuthSchema = z.object({ email: z.string().email().max(120), password: z.string().min(8).max(200), name: z.string().max(60).optional(), mode: z.enum(["signin", "signup"]) });
