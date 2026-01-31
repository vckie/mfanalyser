// Type definitions for Mutual Fund API

export interface FundBasic {
  schemeCode: number;
  schemeName: string;
  isinGrowth: string | null;
  isinDivReinvestment: string | null;
}

export interface NavData {
  date: string;
  nav: string;
}

export interface FundMeta {
  fund_house: string;
  scheme_type: string;
  scheme_category: string;
  scheme_code: number;
  scheme_name: string;
  isin_growth: string | null;
  isin_div_reinvestment: string | null;
}

export interface FundDetails {
  meta: FundMeta;
  data: NavData[];
  status: string;
}

export interface SipResult {
  totalInvested: number;
  currentValue: number;
  totalUnits: number;
  returns: number;
  returnsPercentage: number;
  isProfit: boolean;
}
