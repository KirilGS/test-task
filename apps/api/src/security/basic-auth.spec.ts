import {
  passwordFromBasicHeader,
  passwordsMatch,
  requestNeedsPassword,
} from "./basic-auth";

describe("пароль на сайт", () => {
  it("пропускает только проверку работоспособности", () => {
    expect(requestNeedsPassword("GET", "/api/health")).toBe(false);
    expect(requestNeedsPassword("GET", "/api/health?x=1")).toBe(false);
    expect(requestNeedsPassword("POST", "/api/health")).toBe(true);
    expect(requestNeedsPassword("GET", "/datasets")).toBe(true);
  });

  it("берёт пароль после первого двоеточия и не смотрит на имя", () => {
    const header = `Basic ${Buffer.from("любое:секрет:ещё", "utf8").toString("base64")}`;
    expect(passwordFromBasicHeader(header)).toBe("секрет:ещё");
    expect(passwordFromBasicHeader("Bearer token")).toBeNull();
  });

  it("сравнивает пароль целиком, не по началу", () => {
    expect(passwordsMatch("секрет", "секрет")).toBe(true);
    expect(passwordsMatch("секрет", "секреты")).toBe(false);
    expect(passwordsMatch("секрет", "секр")).toBe(false);
    expect(passwordsMatch("", "секрет")).toBe(false);
  });
});
