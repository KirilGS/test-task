import type {
  Author,
  CaseAssessment,
  CaseType,
  ChatClaim,
  DatasetInput,
  Priority,
  RuleCode,
} from '@support-summary/core'

export type ApiFailure = {
  message: string
  fieldErrors: Record<string, string>
  status: number
}

export type RuleInfo = {
  code: RuleCode
  title: string
  description: string
}

export type MetaResponse = {
  aiAvailable: boolean
  aiModel: string | null
  rules: RuleInfo[]
  prompt: string
  labels: {
    priority: Record<Priority, string>
    caseType: Record<CaseType, string>
    author: Record<Author, string>
  }
  limits: {
    maxCases: number
    maxMessages: number
    maxMessageLength: number
    aiRequestsPerHour: number
  }
}

export type DatasetView = DatasetInput & {
  id: string
  slug: string | null
  isDemo: boolean
  version: number
  createdAt: string
  updatedAt: string
}

export type DatasetListItem = {
  id: string
  slug: string | null
  title: string
  isDemo: boolean
  snapshotAt: string
  version: number
  createdAt: string
  updatedAt: string
  casesCount: number
}

export type DatasetUpdate = DatasetInput & {
  version: number
}

export type SummaryFeedbackView = {
  caseId: string | null
  verdict: 'correct' | 'wrong' | 'missed'
  comment: string
  createdAt: string
}

export type SummaryView = {
  id: string
  datasetId: string
  datasetTitle: string
  snapshotAt: string
  mode: 'ai' | 'no-ai'
  createdAt: string
  assessments: CaseAssessment[]
  claimsByCase: Record<string, ChatClaim[]>
  rejectedByCase: Record<string, number>
  warnings: string[]
  markdown: string
  feedback: SummaryFeedbackView[]
}

export type SummaryRemark = {
  caseId: string | null
  verdict: 'wrong' | 'missed'
  comment: string
}

export type SummaryListItem = {
  id: string
  datasetId: string
  datasetTitle: string
  snapshotAt: string
  mode: 'ai' | 'no-ai'
  createdAt: string
  rejectedByCase: Record<string, number>
  warnings: string[]
  feedback: {
    correct: number
    wrong: number
    missed: number
  }
  remarks: SummaryRemark[]
}

export type SummaryCreateInput = {
  datasetId: string
  snapshotAt?: string
}

export type FeedbackInput = {
  caseId: string | null
  verdict: 'correct' | 'wrong' | 'missed'
  comment?: string
}
