import React, { useState } from 'react';
import { ExternalLink, FileText, Link, CheckCircle, AlertCircle, Loader } from 'lucide-react';

const PPPDataSection = ({ submissionId, businessName, initialPppData, onSave }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pppLink, setPppLink] = useState('');
  const [pppData, setPppData] = useState(initialPppData || null);
  const [error, setError] = useState(null);

  // Function to handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!pppLink.trim()) {
      setError('Please enter a valid PPP link');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/scrape-ppp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submissionId,
          businessName,
          pppLink,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to scrape PPP data');
      }

      const data = await response.json();
      setPppData(data.pppData);
      setIsAdding(false);
      
      // Call the parent's onSave callback to update state
      if (onSave) {
        onSave(data.pppData);
      }
    } catch (error) {
      setError(error.message || 'An error occurred while scraping PPP data');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="details-card">
      <h3 className="details-card-title">PPP Loan Data</h3>
      
      {isLoading ? (
        <div className="loading-ppp-container">
          <Loader className="animate-spin" size={24} />
          <p>Scraping and processing PPP data...</p>
          <p className="text-sm text-gray-500">This may take a moment as we extract and format the information.</p>
        </div>
      ) : pppData ? (
        <>
          <div className="ppp-data-container">
            <div className="ppp-header">
              <div className="ppp-summary">
                <CheckCircle className="ppp-success-icon" size={18} />
                <span>PPP data successfully retrieved</span>
              </div>
              <button 
                className="ppp-edit-button"
                onClick={() => setIsAdding(true)}
              >
                Update Link
              </button>
            </div>
            
            <div className="ppp-details">
              <table className="ppp-table">
                <tbody>
                  <tr>
                    <th>Business Name:</th>
                    <td>{pppData.businessName}</td>
                  </tr>
                  <tr>
                    <th>First Draw Amount:</th>
                    <td>{formatCurrency(pppData.firstDraw?.amount)}</td>
                  </tr>
                  <tr>
                    <th>First Draw Date:</th>
                    <td>{formatDate(pppData.firstDraw?.date)}</td>
                  </tr>
                  <tr>
                    <th>First Draw Forgiveness:</th>
                    <td>{formatCurrency(pppData.firstDraw?.forgiveness)}</td>
                  </tr>
                  <tr>
                    <th>Second Draw Amount:</th>
                    <td>{formatCurrency(pppData.secondDraw?.amount)}</td>
                  </tr>
                  <tr>
                    <th>Second Draw Date:</th>
                    <td>{formatDate(pppData.secondDraw?.date)}</td>
                  </tr>
                  <tr>
                    <th>Second Draw Forgiveness:</th>
                    <td>{formatCurrency(pppData.secondDraw?.forgiveness)}</td>
                  </tr>
                  <tr>
                    <th>Lender:</th>
                    <td>{pppData.lender || 'N/A'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div className="ppp-source">
              <a 
                href={pppData.sourceLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="file-card-link"
              >
                View Original Source <ExternalLink className="file-card-link-icon" />
              </a>
              <span className="ppp-timestamp">Last updated: {formatDate(pppData.scrapedAt)}</span>
            </div>
          </div>
        </>
      ) : isAdding ? (
        <form onSubmit={handleSubmit} className="ppp-form">
          <div className="form-description">
            Enter a PPP lookup link (e.g., from ProPublica or SBA database) to automatically extract loan information.
          </div>
          
          <div className="form-group">
            <label htmlFor="pppLink" className="form-label">PPP Data Link:</label>
            <div className="input-with-icon">
              <Link className="input-icon" size={18} />
              <input
                type="url"
                id="pppLink"
                className="form-input"
                placeholder="https://projects.propublica.org/coronavirus/bailouts/..."
                value={pppLink}
                onChange={(e) => setPppLink(e.target.value)}
                required
              />
            </div>
            <small className="form-helper">
              Paste a link to any PPP database entry for this business
            </small>
          </div>
          
          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          
          <div className="form-actions">
            <button 
              type="button" 
              className="cancel-button"
              onClick={() => setIsAdding(false)}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="submit-button"
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Extract PPP Data'}
            </button>
          </div>
        </form>
      ) : (
        <div className="ppp-empty-state">
          <FileText className="empty-icon" size={24} />
          <p>No PPP loan data available for this business.</p>
          <button 
            className="add-ppp-button"
            onClick={() => setIsAdding(true)}
          >
            Add PPP Data Link
          </button>
        </div>
      )}
    </div>
  );
};

// Helper functions
const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export default PPPDataSection;