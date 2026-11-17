import type { DatasetInput, SupportCase } from "@support-summary/core";

export type DatasetDocument = {
  slug: string | null;
  title: string;
  isDemo: boolean;
  snapshotAt: string;
  cases: SupportCase[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type DatasetView = DatasetInput & {
  id: string;
  slug: string | null;
  isDemo: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type DatasetListItem = Omit<DatasetView, "cases"> & {
  casesCount: number;
};
