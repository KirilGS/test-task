import type { CaseAssessment } from "./assess.js";
import type { Priority } from "./catalog.js";

const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  none: 3,
};

export function sortAssessments(items: CaseAssessment[]): CaseAssessment[] {
  return [...items].sort((left, right) => {
    const byPriority =
      PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
    if (byPriority !== 0) {
      return byPriority;
    }

    if (left.deadline === null && right.deadline !== null) {
      return 1;
    }
    if (left.deadline !== null && right.deadline === null) {
      return -1;
    }
    if (
      left.deadline !== null &&
      right.deadline !== null &&
      left.deadline !== right.deadline
    ) {
      return Date.parse(left.deadline) - Date.parse(right.deadline);
    }

    return left.caseId.localeCompare(right.caseId, "ru");
  });
}
