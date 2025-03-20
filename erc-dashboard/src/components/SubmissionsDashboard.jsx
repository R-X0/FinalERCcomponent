import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, FileText, Archive, CheckCircle, XCircle, Filter, RefreshCw, Search } from 'lucide-react';
import './SubmissionsDashboard.css';

const SubmissionsDashboard = () => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState({});
  const [sortField, setSortField] = useState('receivedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filters, setFilters] = useState({
    status: '',
    hasZipFiles: '',
    isComplete: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusOptions, setStatusOptions] = useState([]);

  useEffect(() => {
    // Fetch submissions data from API
    const fetchData = async () => {
      try {
        const response = await fetch('/api/submissions');
        const data = await response.json();
        
        if (data && data.submissions) {
          setSubmissions(data.submissions);
          
          // Extract unique status values for filter dropdown
          const uniqueStatuses = [...new Set(data.submissions.map(sub => sub.status).filter(Boolean))];
          setStatusOptions(uniqueStatuses);
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error loading submissions:", error);
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Toggle expansion of a row
  const toggleRowExpand = (submissionId) => {
    setExpandedRows(prev => ({
      ...prev,
      [submissionId]: !prev[submissionId]
    }));
  };

  // Handle sort change
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle filter change
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Apply search and filters
  const filteredSubmissions = submissions.filter(submission => {
    // Search term filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (submission.submissionId && submission.submissionId.toLowerCase().includes(searchLower)) ||
        (submission.businessName && submission.businessName.toLowerCase().includes(searchLower)) ||
        (submission.status && submission.status.toLowerCase().includes(searchLower));
      
      if (!matchesSearch) return false;
    }
    
    // Status filter
    if (filters.status && submission.status !== filters.status) return false;
    
    // ZIP files filter
    if (filters.hasZipFiles !== '' && submission.hasZipFiles.toString() !== filters.hasZipFiles) return false;
    
    // Completion filter
    if (filters.isComplete !== '' && submission.isComplete.toString() !== filters.isComplete) return false;
    
    return true;
  });

  // Apply sorting
  const sortedSubmissions = [...filteredSubmissions].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortField) {
      case 'receivedAt':
        aValue = new Date(a.receivedAt).getTime();
        bValue = new Date(b.receivedAt).getTime();
        break;
      case 'businessName':
        aValue = a.businessName || '';
        bValue = b.businessName || '';
        break;
      case 'status':
        aValue = a.status || '';
        bValue = b.status || '';
        break;
      case 'quarterCount':
        aValue = (a.processedQuarters?.length || 0) / (a.quarterCount || 1);
        bValue = (b.processedQuarters?.length || 0) / (b.quarterCount || 1);
        break;
      default:
        aValue = a[sortField];
        bValue = b[sortField];
    }
    
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Format percentage
  const formatPercentage = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <h1 className="dashboard-title">ERC Submissions Dashboard</h1>
        <p className="dashboard-description">Track and manage your Employee Retention Credit submissions</p>
      </div>

      {/* Search and Filter Controls */}
      <div className="filter-section">
        <div className="filter-header">
          <h2 className="filter-title">
            <Filter className="filter-icon" size={18} />
            Search & Filters
          </h2>
          
          {/* Search input */}
          <div className="search-container">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              className="search-input"
              placeholder="Search submissions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="filters-grid">
          <div className="filter-group">
            <label className="filter-label">Status</label>
            <select
              className="filter-select"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All Statuses</option>
              {statusOptions.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label className="filter-label">ZIP Files</label>
            <select
              className="filter-select"
              value={filters.hasZipFiles}
              onChange={(e) => handleFilterChange('hasZipFiles', e.target.value)}
            >
              <option value="">All ZIP Status</option>
              <option value="true">Has ZIP Files</option>
              <option value="false">Missing ZIP Files</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label className="filter-label">Completion</label>
            <select
              className="filter-select"
              value={filters.isComplete}
              onChange={(e) => handleFilterChange('isComplete', e.target.value)}
            >
              <option value="">All Completion Status</option>
              <option value="true">Complete</option>
              <option value="false">Incomplete</option>
            </select>
          </div>
          
          <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
            <button 
              className="reset-button"
              onClick={() => {
                setFilters({ status: '', hasZipFiles: '', isComplete: '' });
                setSearchTerm('');
              }}
            >
              <RefreshCw className="reset-button-icon" size={14} /> Reset All Filters
            </button>
          </div>
        </div>
      </div>

      {/* Loading Indicator */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <div className="loading-text">Loading submissions...</div>
          <div className="loading-subtext">Please wait while we fetch your data</div>
        </div>
      ) : (
        <>
          {/* Results Summary */}
          <div className="results-summary">
            <div className="results-count">
              Showing <span className="results-count-highlight">{sortedSubmissions.length}</span> of <span className="results-count-highlight">{submissions.length}</span> submissions
            </div>
            
            <div className="last-updated">
              Last updated: {new Date().toLocaleDateString()}
            </div>
          </div>
          
          {/* Empty State */}
          {sortedSubmissions.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon-container">
                <Filter className="empty-icon" />
              </div>
              <h3 className="empty-title">No submissions found</h3>
              <p className="empty-description">
                No submissions match your current filters. Try changing your search terms or clearing filters.
              </p>
              <button 
                className="clear-filters-button"
                onClick={() => {
                  setFilters({ status: '', hasZipFiles: '', isComplete: '' });
                  setSearchTerm('');
                }}
              >
                <RefreshCw size={14} style={{ marginRight: '8px' }} /> Clear All Filters
              </button>
            </div>
          )}
          
          {/* Table */}
          {sortedSubmissions.length > 0 && (
            <div className="table-container">
              <table className="submissions-table">
                <thead className="table-header">
                  <tr>
                    <th style={{ width: '50px' }}></th>
                    <th 
                      className="sortable-header"
                      onClick={() => handleSort('submissionId')}
                    >
                      ID
                      {sortField === 'submissionId' && (
                        <span className="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th 
                      className="sortable-header"
                      onClick={() => handleSort('businessName')}
                    >
                      Business
                      {sortField === 'businessName' && (
                        <span className="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th 
                      className="sortable-header"
                      onClick={() => handleSort('status')}
                    >
                      Status
                      {sortField === 'status' && (
                        <span className="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th 
                      className="sortable-header"
                      onClick={() => handleSort('quarterCount')}
                    >
                      Quarters
                      {sortField === 'quarterCount' && (
                        <span className="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th>Files</th>
                    <th 
                      className="sortable-header"
                      onClick={() => handleSort('receivedAt')}
                    >
                      Date Received
                      {sortField === 'receivedAt' && (
                        <span className="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSubmissions.map((submission) => (
                    <React.Fragment key={submission.submissionId}>
                      <tr className={`table-row ${expandedRows[submission.submissionId] ? 'expanded' : ''}`}>
                        <td className="table-cell" style={{ textAlign: 'center' }}>
                          <button
                            className={`expand-button ${expandedRows[submission.submissionId] ? 'expanded' : ''}`}
                            onClick={() => toggleRowExpand(submission.submissionId)}
                            aria-label={expandedRows[submission.submissionId] ? "Collapse details" : "Expand details"}
                          >
                            {expandedRows[submission.submissionId] ? (
                              <ChevronUp size={18} />
                            ) : (
                              <ChevronDown size={18} />
                            )}
                          </button>
                        </td>
                        <td className="table-cell id-cell">
                          {submission.submissionId}
                        </td>
                        <td className="table-cell business-cell">
                          {submission.businessName || 'Unnamed Business'}
                        </td>
                        <td className="table-cell">
                          <span className={`status-badge ${
                            submission.status === 'PDF done' || submission.status === 'Completed' 
                              ? 'completed' 
                              : submission.status === 'In Progress' 
                                ? 'in-progress' 
                                : 'default'
                          }`}>
                            {submission.status || 'Unknown'}
                          </span>
                        </td>
                        <td className="table-cell">
                          <div className="progress-container">
                            <div className="progress-bar-container">
                              <div 
                                className={`progress-bar ${submission.isComplete ? 'complete' : 'incomplete'}`}
                                style={{ 
                                  width: `${((submission.processedQuarters?.length || 0) / (submission.quarterCount || 1)) * 100}%` 
                                }}
                              ></div>
                            </div>
                            <span className="progress-text">
                              {submission.processedQuarters?.length || 0}/{submission.quarterCount || 0}
                            </span>
                            {submission.isComplete ? (
                              <CheckCircle className="check-icon" size={16} />
                            ) : (
                              <XCircle className="x-icon" size={16} />
                            )}
                          </div>
                        </td>
                        <td className="table-cell">
                          <div>
                            {submission.hasZipFiles && (
                              <span className="file-badge zip">
                                <Archive className="file-icon" size={14} /> 
                                ZIP
                              </span>
                            )}
                            {submission.hasExcelFile && (
                              <span className="file-badge excel">
                                <FileText className="file-icon" size={14} /> 
                                Excel
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="table-cell date-cell">
                          {formatDate(submission.receivedAt)}
                        </td>
                      </tr>
                      
                      {/* Expanded Detail View */}
                      {expandedRows[submission.submissionId] && (
                        <tr>
                          <td colSpan="7" className="expanded-content">
                            <div className="details-grid">
                              {/* Basic Information */}
                              <div className="details-card">
                                <h3 className="details-card-title">Basic Information</h3>
                                <dl>
                                  <dt>Status:</dt>
                                  <dd>
                                    <span className={`status-badge ${
                                      submission.status === 'PDF done' || submission.status === 'Completed' 
                                        ? 'completed' 
                                        : submission.status === 'In Progress' 
                                          ? 'in-progress' 
                                          : 'default'
                                    }`}>
                                      {submission.status || 'Unknown'}
                                    </span>
                                  </dd>
                                  
                                  <dt>Business Name:</dt>
                                  <dd>{submission.businessName || 'Unnamed'}</dd>
                                  
                                  <dt>Email:</dt>
                                  <dd>
                                    {submission.mongoData?.userEmail ? (
                                      <a href={`mailto:${submission.mongoData.userEmail}`} className="file-card-link">
                                        {submission.mongoData.userEmail}
                                      </a>
                                    ) : (
                                      'Not provided'
                                    )}
                                  </dd>
                                  
                                  <dt>Received:</dt>
                                  <dd>{formatDate(submission.receivedAt)}</dd>
                                  
                                  <dt>Completion:</dt>
                                  <dd className="progress-container">
                                    <div className="progress-bar-container">
                                      <div 
                                        className={`progress-bar ${submission.isComplete ? 'complete' : 'incomplete'}`}
                                        style={{ 
                                          width: `${((submission.processedQuarters?.length || 0) / (submission.quarterCount || 1)) * 100}%` 
                                        }}
                                      ></div>
                                    </div>
                                    <span className="progress-text">
                                      {submission.processedQuarters?.length || 0}/{submission.quarterCount || 0}
                                    </span>
                                    {submission.isComplete ? (
                                      <CheckCircle className="check-icon" size={16} />
                                    ) : (
                                      <XCircle className="x-icon" size={16} />
                                    )}
                                  </dd>
                                  
                                  <dt>MongoDB ID:</dt>
                                  <dd className="id-cell" style={{ fontSize: '12px' }}>
                                    {submission.mongoData?._id || 'N/A'}
                                  </dd>
                                </dl>
                              </div>
                              
                              {/* Quarter Analysis */}
                              <div className="details-card">
                                <h3 className="details-card-title">Quarter Analysis</h3>
                                
                                {submission.mongoData?.report?.qualificationData?.quarterAnalysis?.length > 0 ? (
                                  <div style={{ overflowX: 'auto' }}>
                                    <table className="quarter-analysis-table">
                                      <thead>
                                        <tr>
                                          <th>Quarter</th>
                                          <th className="right-align">2019 Revenue</th>
                                          <th className="right-align">2021 Revenue</th>
                                          <th className="right-align">Decrease</th>
                                          <th className="center-align">Qualifies</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {submission.mongoData.report.qualificationData.quarterAnalysis.map((quarter, index) => (
                                          <tr key={index} className={quarter.qualifies ? 'qualified' : ''}>
                                            <td className="quarter-name">{quarter.quarter}</td>
                                            <td className="right-align">{formatCurrency(quarter.revenues?.revenue2019)}</td>
                                            <td className="right-align">{formatCurrency(quarter.revenues?.revenue2021)}</td>
                                            <td className="right-align">
                                              <span className={`decrease-value ${quarter.percentDecrease > 50 ? 'high' : ''}`}>
                                                {formatPercentage(quarter.percentDecrease)}
                                              </span>
                                            </td>
                                            <td className="center-align">
                                              {quarter.qualifies ? (
                                                <span className="qualification-indicator qualified">
                                                  <CheckCircle className="qualification-icon" />
                                                </span>
                                              ) : (
                                                <span className="qualification-indicator not-qualified">
                                                  <XCircle className="qualification-icon" />
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="no-data-message">
                                    <FileText className="no-data-icon" size={24} />
                                    <p className="no-data-text">No quarter analysis data available</p>
                                  </div>
                                )}
                              </div>
                              
                              {/* Files & Links */}
                              <div className="details-card files-section">
                                <h3 className="details-card-title">Files & Links</h3>
                                
                                <h4>ZIP Files:</h4>
                                {submission.hasZipFiles ? (
                                  <div className="files-grid">
                                    {Object.entries(submission.zipLinks || {}).map(([quarter, link]) => (
                                      <div key={quarter} className="file-card">
                                        <div className="file-card-icon-container">
                                          <Archive className="file-card-icon" size={18} />
                                        </div>
                                        <div className="file-card-content">
                                          <div className="file-card-title">{quarter}</div>
                                          <a 
                                            href={link} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="file-card-link"
                                          >
                                            View File <ExternalLink className="file-card-link-icon" />
                                          </a>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="no-files-message">
                                    No ZIP files available
                                  </div>
                                )}
                                
                                <h4>Excel Report:</h4>
                                {submission.hasExcelFile ? (
                                  <div className="file-card excel">
                                    <div className="file-card-icon-container">
                                      <FileText className="file-card-icon" size={18} />
                                    </div>
                                    <div className="file-card-content">
                                      <div className="file-card-title">Excel Report</div>
                                      <div className="file-card-path">{submission.excelPath}</div>
                                      <a 
                                        href={`/api/reports/${submission.submissionId}`}
                                        className="file-card-link download-button"
                                        download={`report_${submission.submissionId}.xlsx`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        Download Report <ExternalLink className="file-card-link-icon" />
                                      </a>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="no-files-message">
                                    No Excel file available
                                  </div>
                                )}
                              </div>
                              
                              {/* Qualifying Information */}
                              <div className="details-card quarters-section">
                                <h3 className="details-card-title">Qualifying Information</h3>
                                
                                <div style={{ marginBottom: '24px' }}>
                                  <h4>Qualifying Quarters:</h4>
                                  {submission.mongoData?.report?.qualificationData?.qualifyingQuarters?.length > 0 ? (
                                    <div className="quarters-badges">
                                      {submission.mongoData.report.qualificationData.qualifyingQuarters.map(quarter => (
                                        <span 
                                          key={quarter} 
                                          className="quarter-badge qualifying"
                                        >
                                          {quarter}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="no-files-message">
                                      No qualifying quarters found
                                    </div>
                                  )}
                                </div>
                                
                                <div style={{ marginBottom: '24px' }}>
                                  <h4>Processed Quarters:</h4>
                                  {submission.processedQuarters?.length > 0 ? (
                                    <div className="quarters-badges">
                                      {submission.processedQuarters.map(quarter => (
                                        <span 
                                          key={quarter} 
                                          className="quarter-badge processed"
                                        >
                                          {quarter}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="no-files-message">
                                      No processed quarters found
                                    </div>
                                  )}
                                </div>
                                
                                {submission.mongoData?.originalData?.formData?.qualifyingQuestions && (
                                  <div>
                                    <h4>Qualifying Factors:</h4>
                                    <div className="qualifying-factors">
                                      <dl>
                                        {Object.entries(submission.mongoData.originalData.formData.qualifyingQuestions).map(([key, value]) => (
                                          <React.Fragment key={key}>
                                            <dt>
                                              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                                            </dt>
                                            <dd>
                                              {Array.isArray(value) 
                                                ? value.map(v => (
                                                  <span key={v} className="factor-tag">
                                                    {v}
                                                  </span>
                                                ))
                                                : (value === 'yes' 
                                                  ? <span className="boolean-value yes">Yes</span> 
                                                  : (value === 'no' ? <span className="boolean-value no">No</span> : value))}
                                            </dd>
                                          </React.Fragment>
                                        ))}
                                      </dl>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SubmissionsDashboard;