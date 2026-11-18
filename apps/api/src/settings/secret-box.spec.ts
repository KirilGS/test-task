import { openText, sealText } from "./secret-box";

const SECRET = "unit-test-settings-secret";
const PLAIN = "unit-test-key";

describe("закрытие текста", () => {
  it("открывает тот же текст тем же секретом", () => {
    const sealed = sealText(PLAIN, SECRET);
    expect(openText(sealed, SECRET)).toBe(PLAIN);
    expect(JSON.stringify(sealed)).not.toContain(PLAIN);
  });

  it("не открывает текст чужим секретом", () => {
    const sealed = sealText(PLAIN, SECRET);
    expect(openText(sealed, "another-secret")).toBeNull();
  });

  it("не открывает испорченную запись", () => {
    const sealed = sealText(PLAIN, SECRET);
    const broken = { ...sealed, data: `${sealed.data}x` };
    expect(openText(broken, SECRET)).toBeNull();
  });
});
