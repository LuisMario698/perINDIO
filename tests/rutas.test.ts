import { describe, expect, it } from "vitest";

import { destinoSeguro } from "@/lib/rutas";

describe("destinoSeguro", () => {
  it("acepta rutas internas", () => {
    expect(destinoSeguro("/rifas/abc?estado=apartado")).toBe("/rifas/abc?estado=apartado");
  });

  it.each([undefined, ["/a", "/b"], "", "https://otro.com", "//otro.com", "/\\otro.com", "rifas"])(
    "descarta %j",
    (desde) => {
      expect(destinoSeguro(desde)).toBe("/");
    },
  );
});
