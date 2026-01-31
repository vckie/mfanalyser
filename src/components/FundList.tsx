import { useState, useEffect, useMemo } from 'react';
import type { FundBasic } from '../types';

interface FundListProps {
    funds: FundBasic[];
    selectedFund: FundBasic | null;
    onSelectFund: (fund: FundBasic) => void;
    isLoading: boolean;
}

export default function FundList({ funds, selectedFund, onSelectFund, isLoading }: FundListProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [displayCount, setDisplayCount] = useState(50);

    // Filter funds based on search
    const filteredFunds = useMemo(() => {
        if (!searchQuery.trim()) return funds;
        const query = searchQuery.toLowerCase();
        return funds.filter(fund =>
            fund.schemeName.toLowerCase().includes(query) ||
            fund.schemeCode.toString().includes(query)
        );
    }, [funds, searchQuery]);

    // Reset display count when search changes
    useEffect(() => {
        setDisplayCount(50);
    }, [searchQuery]);

    // Load more on scroll
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop <= clientHeight + 100) {
            setDisplayCount(prev => Math.min(prev + 50, filteredFunds.length));
        }
    };

    const displayedFunds = filteredFunds.slice(0, displayCount);

    if (isLoading) {
        return (
            <div className="card fund-list-panel">
                <h2>📋 Mutual Funds</h2>
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Loading funds...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="card fund-list-panel">
            <h2>📋 Mutual Funds</h2>

            <div className="search-box">
                <span className="search-icon">🔍</span>
                <input
                    type="text"
                    placeholder="Search by name or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="fund-count">
                Showing {displayedFunds.length.toLocaleString()} of {filteredFunds.length.toLocaleString()} funds
            </div>

            <div className="fund-list" onScroll={handleScroll}>
                {displayedFunds.map((fund, index) => (
                    <div
                        key={fund.schemeCode}
                        className={`fund-item ${selectedFund?.schemeCode === fund.schemeCode ? 'selected' : ''}`}
                        onClick={() => onSelectFund(fund)}
                        style={{ animationDelay: `${Math.min(index * 20, 500)}ms` }}
                    >
                        <div className="fund-name">{fund.schemeName}</div>
                        <div className="fund-code">Code: {fund.schemeCode}</div>
                    </div>
                ))}

                {displayCount < filteredFunds.length && (
                    <div className="fund-item" style={{ textAlign: 'center', cursor: 'default' }}>
                        <p style={{ color: 'var(--text-muted)' }}>Scroll for more...</p>
                    </div>
                )}

                {filteredFunds.length === 0 && (
                    <div className="empty-state" style={{ height: '200px' }}>
                        <p>No funds found matching "{searchQuery}"</p>
                    </div>
                )}
            </div>
        </div>
    );
}
