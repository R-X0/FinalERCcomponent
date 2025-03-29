import React, { useState } from 'react';
import { ExternalLink, FileText, CheckCircle, AlertCircle, Loader } from 'lucide-react';

const PPPDataSection = ({ submissionId, businessName, initialPppData, onSave }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pppData, setPppData] = useState(initialPppData || null);
  const [error, setError] = useState(null);
  
  // Form state for manual data entry
  const [formData, setFormData] = useState({
    businessName: businessName || '',
    sourceLink: '',
    firstDrawAmount: '',
    firstDrawDate: '',
    firstDrawForgiveness: '',
    secondDrawAmount: '',
    secondDrawDate: '',
    secondDrawForgiveness: '',
    lender: '',
    notes: ''
  });

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  // Function to handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setIsLoading(true);
    setError(null);

    try {
      // Format the data in the structure expected by the database
      const submissionData = {
        businessName: formData.businessName,
        sourceLink: formData.sourceLink,
        scrapedAt: new Date().toISOString(),
        firstDraw: {
          amount: formData.firstDrawAmount ? parseFloat(formData.firstDrawAmount) : null,
          date: formData.firstDrawDate || null,
          forgiveness: formData.firstDrawForgiveness ? parseFloat(formData.firstDrawForgiveness) : null
        },
        secondDraw: {
          amount: formData.secondDrawAmount ? parseFloat(formData.secondDrawAmount) : null,
          date: formData.secondDrawDate || null,
          forgiveness: formData.secondDrawForgiveness ? parseFloat(formData.secondDrawForgiveness) : null
        },
        lender: formData.lender,
        notes: formData.notes
      };

      const response = await fetch(`/api/ppp-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submissionId,
          pppData: submissionData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save PPP data');
      }

      const data = await response.json();
      setPppData(data.pppData);
      setIsAdding(false);
      
      // Call the parent's onSave callback to update state
      if (onSave) {
        onSave(data.pppData);
      }
    } catch (error) {
      setError(error.message || 'An error occurred while saving PPP data');
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
          <p>Saving PPP data...</p>
        </div>
      ) : pppData ? (
        <>
          <div className="ppp-data-container">
            <div className="ppp-header">
              <div className="ppp-summary">
                <CheckCircle className="ppp-success-icon" size={18} />
                <span>PPP data available</span>
              </div>
              <div>
                <button 
                  className="ppp-edit-button"
                  onClick={() => setIsAdding(true)}
                  style={{ marginRight: '8px' }}
                >
                  Edit Data
                </button>
                <button 
                  className="ppp-reset-button"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to reset the PPP data? This action cannot be undone.')) {
                      setPppData(null);
                      if (onSave) {
                        onSave(null);
                      }
                    }
                  }}
                >
                  Reset Data
                </button>
              </div>
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
                  {pppData.notes && (
                    <tr>
                      <th>Notes:</th>
                      <td>{pppData.notes}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {pppData.sourceLink && (
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
            )}
          </div>
        </>
      ) : isAdding ? (
        <form onSubmit={handleSubmit} className="ppp-form">
          <div className="form-description">
            Enter PPP loan information manually.
          </div>
          
          <div className="form-group">
            <label htmlFor="businessName" className="form-label">Business Name:</label>
            <input
              type="text"
              id="businessName"
              name="businessName"
              className="form-input"
              value={formData.businessName}
              onChange={handleInputChange}
              style={{ paddingLeft: '12px' }}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="sourceLink" className="form-label">Source Link (Optional):</label>
            <input
              type="url"
              id="sourceLink"
              name="sourceLink"
              className="form-input"
              placeholder="https://projects.propublica.org/coronavirus/bailouts/..."
              value={formData.sourceLink}
              onChange={handleInputChange}
              style={{ paddingLeft: '12px' }}
            />
            <small className="form-helper">
              Link to the source of PPP data (if available)
            </small>
          </div>
          
          <div className="form-group">
            <label htmlFor="firstDrawAmount" className="form-label">First Draw Amount:</label>
            <input
              type="number"
              id="firstDrawAmount"
              name="firstDrawAmount"
              className="form-input"
              placeholder="100000"
              value={formData.firstDrawAmount}
              onChange={handleInputChange}
              style={{ paddingLeft: '12px' }}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="firstDrawDate" className="form-label">First Draw Date:</label>
            <input
              type="date"
              id="firstDrawDate"
              name="firstDrawDate"
              className="form-input"
              value={formData.firstDrawDate}
              onChange={handleInputChange}
              style={{ paddingLeft: '12px' }}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="firstDrawForgiveness" className="form-label">First Draw Forgiveness Amount:</label>
            <input
              type="number"
              id="firstDrawForgiveness"
              name="firstDrawForgiveness"
              className="form-input"
              placeholder="100000"
              value={formData.firstDrawForgiveness}
              onChange={handleInputChange}
              style={{ paddingLeft: '12px' }}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="secondDrawAmount" className="form-label">Second Draw Amount (if applicable):</label>
            <input
              type="number"
              id="secondDrawAmount"
              name="secondDrawAmount"
              className="form-input"
              placeholder="100000"
              value={formData.secondDrawAmount}
              onChange={handleInputChange}
              style={{ paddingLeft: '12px' }}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="secondDrawDate" className="form-label">Second Draw Date:</label>
            <input
              type="date"
              id="secondDrawDate"
              name="secondDrawDate"
              className="form-input"
              value={formData.secondDrawDate}
              onChange={handleInputChange}
              style={{ paddingLeft: '12px' }}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="secondDrawForgiveness" className="form-label">Second Draw Forgiveness Amount:</label>
            <input
              type="number"
              id="secondDrawForgiveness"
              name="secondDrawForgiveness"
              className="form-input"
              placeholder="100000"
              value={formData.secondDrawForgiveness}
              onChange={handleInputChange}
              style={{ paddingLeft: '12px' }}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="lender" className="form-label">Lender:</label>
            <input
              type="text"
              id="lender"
              name="lender"
              className="form-input"
              placeholder="Bank Name"
              value={formData.lender}
              onChange={handleInputChange}
              style={{ paddingLeft: '12px' }}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="notes" className="form-label">Notes:</label>
            <textarea
              id="notes"
              name="notes"
              className="form-input"
              placeholder="Additional information"
              value={formData.notes}
              onChange={handleInputChange}
              style={{ paddingLeft: '12px', height: '80px' }}
            />
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
              {isLoading ? 'Saving...' : 'Save PPP Data'}
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
            Add PPP Data
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