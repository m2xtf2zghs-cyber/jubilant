export type Borrower = {
  id: string;
  org_id: string;
  name: string;
  industry?: string;
  constitution?: string;
  gstin?: string;
  pan?: string;
  created_at: string;
};

export type LoanCase = {
  id: string;
  borrower_id: string;
  org_id: string;
  analyst_user_id: string;
  status: string;
  months_analyzed: number;
  accounts_analyzed: number;
  decision_badge: string;
  created_at: string;
};
