export interface DashboardCard {
  id: string;
  title: string;
  content: string;
  contentType: "text" | "markdown" | "json";
  source: {
    skillId: string;
    skillName: string;
    agentId?: string;
    cronJobId?: string;
  };
  tags: string[];
  isPinned: boolean;
  pinOrder?: number;
  isSubscribed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardData {
  cards: DashboardCard[];
  version: number;
}

export interface DashboardFilters {
  date?: string; // ISO date string YYYY-MM-DD
  pinned?: boolean;
  tag?: string;
  search?: string;
}
