import { describe, expect, it } from "vitest";

import { autorizarCron } from "@/server/cron";

describe("autorizarCron", () => {
  it("acepta solo el secreto exacto con el formato Bearer", () => {
    expect(autorizarCron("Bearer secreto-largo", "secreto-largo")).toBe(true);
    expect(autorizarCron("Bearer otro", "secreto-largo")).toBe(false);
    expect(autorizarCron("secreto-largo", "secreto-largo")).toBe(false);
    expect(autorizarCron(null, "secreto-largo")).toBe(false);
  });

  it("sin secreto configurado no autoriza a nadie", () => {
    expect(autorizarCron("Bearer ", "")).toBe(false);
    expect(autorizarCron("Bearer undefined", undefined)).toBe(false);
  });
});
