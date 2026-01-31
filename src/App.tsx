import { useState, useEffect } from 'react';
import './App.css';
import type { FundBasic, FundDetails } from './types';
import { getAllFunds, getFundDetails } from './services/mfApi';
import FundList from './components/FundList';
import FundDetailsPanel from './components/FundDetails';

function App() {
  const [funds, setFunds] = useState<FundBasic[]>([]);
  const [selectedFund, setSelectedFund] = useState<FundBasic | null>(null);
  const [fundDetails, setFundDetails] = useState<FundDetails | null>(null);
  const [isLoadingFunds, setIsLoadingFunds] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all funds on mount
  useEffect(() => {
    async function loadFunds() {
      try {
        setIsLoadingFunds(true);
        const data = await getAllFunds();
        setFunds(data);
      } catch (err) {
        setError('Failed to load mutual funds. Please refresh the page.');
        console.error(err);
      } finally {
        setIsLoadingFunds(false);
      }
    }
    loadFunds();
  }, []);

  // Fetch fund details when selection changes
  useEffect(() => {
    async function loadDetails() {
      if (!selectedFund) {
        setFundDetails(null);
        return;
      }

      try {
        setIsLoadingDetails(true);
        setError(null);
        const details = await getFundDetails(selectedFund.schemeCode);
        setFundDetails(details);
      } catch (err) {
        setError('Failed to load fund details. Please try again.');
        console.error(err);
      } finally {
        setIsLoadingDetails(false);
      }
    }
    loadDetails();
  }, [selectedFund]);

  return (
    <div className="app">
      <header className="header">
        <h1>📊 Mutual Fund Analyser</h1>
        <p>Analyze NAV history and calculate SIP returns for Indian mutual funds</p>
      </header>

      <main className="main-content">
        <FundList
          funds={funds}
          selectedFund={selectedFund}
          onSelectFund={setSelectedFund}
          isLoading={isLoadingFunds}
        />

        <FundDetailsPanel
          details={fundDetails}
          isLoading={isLoadingDetails}
          error={error}
        />
      </main>
    </div>
  );
}

export default App;
