import { useState } from 'react';
import type { FundDetails } from '../types';
import NavChart from './NavChart';
import SipCalculator from './SipCalculator';
import { formatCurrency, parseNavDate } from '../services/mfApi';

interface FundDetailsProps {
    details: FundDetails | null;
    isLoading: boolean;
    error: string | null;
}

export default function FundDetailsPanel({ details, isLoading, error }: FundDetailsProps) {
    if (isLoading) {
        return (
            <div className="details-panel">
                <div className="card loading-container">
                    <div className="spinner"></div>
                    <p>Loading fund details...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="details-panel">
                <div className="card error-message">
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    if (!details) {
        return (
            <div className="details-panel">
                <div className="card empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                    <h3>Select a Fund</h3>
                    <p>Choose a mutual fund from the list to view its NAV history and calculate SIP returns</p>
                </div>
            </div>
        );
    }

    const { meta, data } = details;
    const latestNav = data[0];
    const latestNavValue = parseFloat(latestNav?.nav || '0');
    const latestNavDate = latestNav ? parseNavDate(latestNav.date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }) : '';

    return (
        <div className="details-panel fade-in">
            {/* Fund Header */}
            <div className="card">
                <div className="fund-details-header">
                    <div className="fund-info">
                        <h2>{meta.scheme_name}</h2>
                        <div className="fund-meta">
                            <span>{meta.fund_house}</span>
                            <span>{meta.scheme_category}</span>
                            <span>{meta.scheme_type}</span>
                        </div>
                    </div>
                    <div className="current-nav">
                        <div className="nav-value">₹{latestNavValue.toFixed(4)}</div>
                        <div className="nav-date">NAV as of {latestNavDate}</div>
                    </div>
                </div>
            </div>

            {/* NAV Chart */}
            <div className="card">
                <NavChart data={data} />
            </div>

            {/* SIP Calculator */}
            <SipCalculator navData={data} />
        </div>
    );
}
