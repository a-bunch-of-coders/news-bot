// src/commands/feedspot/types.ts
export type FeedspotSearchItem = {
  name: string;
  link: string;
};

export type FeedspotSearchResponse = {
  status: number;
  msg: string;
  data: FeedspotSearchItem[];
};

export type ParsedFeedRow = {
  title: string;
  rss: string;
  website?: string;
  description?: string;
  image?: string;
};

export type ViewKind = "search" | "rss";

export type SearchViewState = {
  kind: "search";
  userId: string;
  query: string;
  results: FeedspotSearchItem[];
  page: number;
};

export type RssViewState = {
  kind: "rss";
  userId: string;
  query: string;
  pickedName: string;
  pickedLink: string;
  feeds: ParsedFeedRow[];
  page: number;
};

export type ViewState = SearchViewState | RssViewState;

export type CachedView = {
  createdAt: number;
  state: ViewState;
};
