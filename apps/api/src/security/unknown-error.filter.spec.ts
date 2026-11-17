import { redactForLog } from "./unknown-error.filter";

describe("внутренние ошибки", () => {
  it("убирает адрес базы и ключ из записи в журнал", () => {
    const text = redactForLog(
      new Error("сбой mongodb://user:secret@localhost:27017/db и ключ sk-or-abcdef123456"),
    );
    expect(text).not.toContain("user:secret");
    expect(text).not.toContain("sk-or-abcdef123456");
    expect(text).toContain("mongodb://скрыто");
    expect(text).toContain("ключ-скрыт");
  });
});
