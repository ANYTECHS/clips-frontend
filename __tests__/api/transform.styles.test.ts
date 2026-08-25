/**
 * @jest-environment node
 */
import { GET } from "@/app/api/transform/styles/route";
import { TRANSFORM_STYLES } from "@/app/lib/transformStyles";

describe("GET /api/transform/styles (issue #802)", () => {
  it("returns every configured style", async () => {
    const res = await GET();
    const body = await res.json();

    expect(body.error).toBeNull();
    expect(body.data).toHaveLength(TRANSFORM_STYLES.length);
    expect(body.data.map((s: { name: string }) => s.name)).toEqual(
      TRANSFORM_STYLES.map((s) => s.name),
    );
  });

  it("sets a public, 1-hour Cache-Control header", async () => {
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
  });

  it("includes isPremium/isNew flags on each style", async () => {
    const res = await GET();
    const body = await res.json();

    for (const style of body.data) {
      expect(typeof style.isPremium).toBe("boolean");
      expect(typeof style.isNew).toBe("boolean");
    }
  });
});
