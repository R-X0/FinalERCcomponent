import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, FileText, Archive, CheckCircle, XCircle, Filter, RefreshCw } from 'lucide-react';

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

  // Apply filters
  const filteredSubmissions = submissions.filter(submission => {
    if (filters.status && submission.status !== filters.status) return false;
    if (filters.hasZipFiles !== '' && submission.hasZipFiles.toString() !== filters.hasZipFiles) return false;
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
    <div className="flex flex-col w-full max-w-screen-xl mx-auto p-4 bg-white rounded-lg shadow">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Completed Submissions Dashboard</h1>
        <p className="text-gray-600">Manage and view all completed ERC submissions</p>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center">
          <Filter className="w-5 h-5 mr-2 text-gray-500" />
          <span className="font-medium">Filters:</span>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <select
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">All Statuses</option>
            {statusOptions.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          
          <select
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            value={filters.hasZipFiles}
            onChange={(e) => handleFilterChange('hasZipFiles', e.target.value)}
          >
            <option value="">All ZIP Status</option>
            <option value="true">Has ZIP Files</option>
            <option value="false">Missing ZIP Files</option>
          </select>
          
          <select
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            value={filters.isComplete}
            onChange={(e) => handleFilterChange('isComplete', e.target.value)}
          >
            <option value="">All Completion Status</option>
            <option value="true">Complete</option>
            <option value="false">Incomplete</option>
          </select>
          
          <button 
            onClick={() => setFilters({ status: '', hasZipFiles: '', isComplete: '' })}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm flex items-center"
          >
            <RefreshCw className="w-4 h-4 mr-1" /> Reset
          </button>
        </div>
      </div>

      {/* Loading Indicator */}
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-lg text-gray-700">Loading submissions...</span>
        </div>
      ) : (
        <>
          {/* Results Stats */}
          <div className="mb-4 text-gray-600">
            Showing {sortedSubmissions.length} of {submissions.length} submissions
          </div>
          
          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10"></th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('submissionId')}
                  >
                    ID
                    {sortField === 'submissionId' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('businessName')}
                  >
                    Business
                    {sortField === 'businessName' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('status')}
                  >
                    Status
                    {sortField === 'status' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('quarterCount')}
                  >
                    Quarters
                    {sortField === 'quarterCount' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Files
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('receivedAt')}
                  >
                    Date Received
                    {sortField === 'receivedAt' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                      No submissions found matching the current filters
                    </td>
                  </tr>
                ) : (
                  sortedSubmissions.map((submission) => (
                    <React.Fragment key={submission.submissionId}>
                      <tr className={`${expandedRows[submission.submissionId] ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                        <td className="px-4 py-4">
                          <button
                            onClick={() => toggleRowExpand(submission.submissionId)}
                            className="text-gray-600 hover:text-blue-600"
                          >
                            {expandedRows[submission.submissionId] ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {submission.submissionId}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">
                          {submission.businessName || 'Unnamed Business'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium 
                            ${submission.status === 'PDF done' || submission.status === 'Completed' 
                              ? 'bg-green-100 text-green-800' 
                              : submission.status === 'In Progress' 
                                ? 'bg-yellow-100 text-yellow-800' 
                                : 'bg-gray-100 text-gray-800'}`}>
                            {submission.status || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <span className="mr-2">
                              {submission.processedQuarters?.length || 0}/{submission.quarterCount || 0}
                            </span>
                            {submission.isComplete ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center space-x-2">
                            {submission.hasZipFiles && (
                              <span className="flex items-center text-blue-600">
                                <Archive className="w-4 h-4 mr-1" /> 
                                <span>ZIP</span>
                              </span>
                            )}
                            {submission.hasExcelFile && (
                              <span className="flex items-center text-green-600">
                                <FileText className="w-4 h-4 mr-1" /> 
                                <span>Excel</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(submission.receivedAt)}
                        </td>
                      </tr>
                      
                      {/* Expanded Detail View */}
                      {expandedRows[submission.submissionId] && (
                        <tr>
                          <td colSpan="7" className="px-4 py-4 bg-gray-50 border-b">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Basic Information */}
                              <div className="bg-white p-4 rounded-lg shadow-sm">
                                <h3 className="text-lg font-medium mb-4 text-gray-800 border-b pb-2">Basic Information</h3>
                                <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                                  <dt className="text-sm font-medium text-gray-500">Status:</dt>
                                  <dd className="text-sm text-gray-900">{submission.status || 'Unknown'}</dd>
                                  
                                  <dt className="text-sm font-medium text-gray-500">Business Name:</dt>
                                  <dd className="text-sm text-gray-900">{submission.businessName || 'Unnamed'}</dd>
                                  
                                  <dt className="text-sm font-medium text-gray-500">Email:</dt>
                                  <dd className="text-sm text-gray-900">{submission.mongoData?.userEmail || 'Not provided'}</dd>
                                  
                                  <dt className="text-sm font-medium text-gray-500">Received:</dt>
                                  <dd className="text-sm text-gray-900">{formatDate(submission.receivedAt)}</dd>
                                  
                                  <dt className="text-sm font-medium text-gray-500">Completion:</dt>
                                  <dd className="text-sm text-gray-900 flex items-center">
                                    {submission.processedQuarters?.length || 0}/{submission.quarterCount || 0} Quarters
                                    {submission.isComplete ? (
                                      <CheckCircle className="w-4 h-4 text-green-500 ml-2" />
                                    ) : (
                                      <XCircle className="w-4 h-4 text-red-500 ml-2" />
                                    )}
                                  </dd>
                                  
                                  <dt className="text-sm font-medium text-gray-500">MongoDB ID:</dt>
                                  <dd className="text-sm text-gray-900 font-mono text-xs">{submission.mongoData?._id || 'N/A'}</dd>
                                </dl>
                              </div>
                              
                              {/* Quarter Analysis */}
                              <div className="bg-white p-4 rounded-lg shadow-sm">
                                <h3 className="text-lg font-medium mb-4 text-gray-800 border-b pb-2">Quarter Analysis</h3>
                                
                                {submission.mongoData?.report?.qualificationData?.quarterAnalysis?.length > 0 ? (
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                                      <thead>
                                        <tr>
                                          <th className="px-3 py-2 text-left font-medium text-gray-500">Quarter</th>
                                          <th className="px-3 py-2 text-right font-medium text-gray-500">2019 Revenue</th>
                                          <th className="px-3 py-2 text-right font-medium text-gray-500">2021 Revenue</th>
                                          <th className="px-3 py-2 text-right font-medium text-gray-500">Decrease</th>
                                          <th className="px-3 py-2 text-center font-medium text-gray-500">Qualifies</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {submission.mongoData.report.qualificationData.quarterAnalysis.map((quarter, index) => (
                                          <tr key={index} className={quarter.qualifies ? 'bg-green-50' : ''}>
                                            <td className="px-3 py-2">{quarter.quarter}</td>
                                            <td className="px-3 py-2 text-right">{formatCurrency(quarter.revenues?.revenue2019)}</td>
                                            <td className="px-3 py-2 text-right">{formatCurrency(quarter.revenues?.revenue2021)}</td>
                                            <td className="px-3 py-2 text-right">{formatPercentage(quarter.percentDecrease)}</td>
                                            <td className="px-3 py-2 text-center">
                                              {quarter.qualifies ? (
                                                <CheckCircle className="w-5 h-5 text-green-500 inline" />
                                              ) : (
                                                <XCircle className="w-5 h-5 text-red-500 inline" />
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p className="text-gray-500 italic">No quarter analysis data available</p>
                                )}
                              </div>
                              
                              {/* Files & Links */}
                              <div className="bg-white p-4 rounded-lg shadow-sm">
                                <h3 className="text-lg font-medium mb-4 text-gray-800 border-b pb-2">Files & Links</h3>
                                
                                <h4 className="font-medium text-sm text-gray-700 mt-3 mb-2">ZIP Files:</h4>
                                {submission.hasZipFiles ? (
                                  <ul className="space-y-2">
                                    {Object.entries(submission.zipLinks || {}).map(([quarter, link]) => (
                                      <li key={quarter} className="flex items-center">
                                        <Archive className="w-4 h-4 text-blue-500 mr-2" />
                                        <span className="text-sm text-gray-700 mr-2">{quarter}:</span>
                                        <a 
                                          href={link} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                                        >
                                          View File <ExternalLink className="w-3 h-3 ml-1" />
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-gray-500 italic">No ZIP files available</p>
                                )}
                                
                                <h4 className="font-medium text-sm text-gray-700 mt-4 mb-2">Excel Report:</h4>
                                {submission.hasExcelFile ? (
                                  <div className="flex items-center">
                                    <FileText className="w-4 h-4 text-green-500 mr-2" />
                                    <span className="text-sm text-gray-700">{submission.excelPath}</span>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500 italic">No Excel file available</p>
                                )}
                              </div>
                              
                              {/* Qualifying Information */}
                              <div className="bg-white p-4 rounded-lg shadow-sm">
                                <h3 className="text-lg font-medium mb-4 text-gray-800 border-b pb-2">Qualifying Information</h3>
                                
                                <div className="space-y-4">
                                  <div>
                                    <h4 className="font-medium text-sm text-gray-700 mb-2">Qualifying Quarters:</h4>
                                    {submission.mongoData?.report?.qualificationData?.qualifyingQuarters?.length > 0 ? (
                                      <div className="flex flex-wrap gap-2">
                                        {submission.mongoData.report.qualificationData.qualifyingQuarters.map(quarter => (
                                          <span 
                                            key={quarter} 
                                            className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full"
                                          >
                                            {quarter}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-500 italic">No qualifying quarters found</p>
                                    )}
                                  </div>
                                  
                                  <div>
                                    <h4 className="font-medium text-sm text-gray-700 mb-2">Processed Quarters:</h4>
                                    {submission.processedQuarters?.length > 0 ? (
                                      <div className="flex flex-wrap gap-2">
                                        {submission.processedQuarters.map(quarter => (
                                          <span 
                                            key={quarter} 
                                            className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                                          >
                                            {quarter}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-500 italic">No processed quarters found</p>
                                    )}
                                  </div>
                                  
                                  {submission.mongoData?.originalData?.formData?.qualifyingQuestions && (
                                    <div>
                                      <h4 className="font-medium text-sm text-gray-700 mb-2">Qualifying Factors:</h4>
                                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                                        {Object.entries(submission.mongoData.originalData.formData.qualifyingQuestions).map(([key, value]) => (
                                          <React.Fragment key={key}>
                                            <dt className="text-sm font-medium text-gray-500">
                                              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                                            </dt>
                                            <dd className="text-sm text-gray-900">
                                              {Array.isArray(value) 
                                                ? value.join(', ') 
                                                : (value === 'yes' 
                                                  ? 'Yes' 
                                                  : (value === 'no' ? 'No' : value))}
                                            </dd>
                                          </React.Fragment>
                                        ))}
                                      </dl>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default SubmissionsDashboard;