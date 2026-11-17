import type { CaseAssessment, ChatClaim } from "@support-summary/core";
import type { ObjectId } from "mongodb";

export type SummaryFeedback = {
  caseId: string | null;
  verdict: "correct" | "wrong" | "missed";
  comment: string;
  createdAt: Date;
};

export type SummaryDocument = {
  datasetId: ObjectId;
  datasetTitle: string;
  snapshotAt: string;
  mode: "ai" | "no-ai";
  createdAt: Date;
  assessments: CaseAssessment[];
  claimsByCase: Record<string, ChatClaim[]>;
  rejectedByCase: Record<string, number>;
  warnings: string[];
  markdown: string;
  feedback: SummaryFeedback[];
};

export type SummaryFeedbackView = {
  caseId: string | null;
  verdict: "correct" | "wrong" | "missed";
  comment: string;
  createdAt: string;
};

export type SummaryView = {
  id: string;
  datasetId: string;
  datasetTitle: string;
  snapshotAt: string;
  mode: "ai" | "no-ai";
  createdAt: string;
  assessments: CaseAssessment[];
  claimsByCase: Record<string, ChatClaim[]>;
  rejectedByCase: Record<string, number>;
  warnings: string[];
  markdown: string;
  feedback: SummaryFeedbackView[];
};

export type SummaryListItem = {
  id: string;
  datasetId: string;
  datasetTitle: string;
  snapshotAt: string;
  mode: "ai" | "no-ai";
  createdAt: string;
  rejectedByCase: Record<string, number>;
  warnings: string[];
  feedback: { correct: number; wrong: number; missed: number };
};
