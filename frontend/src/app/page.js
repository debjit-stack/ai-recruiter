'use client';
import { useState, useEffect } from 'react';
// 👇 Removed Github and Linkedin from this import!
import { UploadCloud, Send, RefreshCw, FileText, Trash2, Filter, Heart } from 'lucide-react';
import { 
  uploadCsv, 
  syncInbox, 
  getCandidates, 
  sendOutreach, 
  deleteCandidates,
  updateCandidateRole 
} from '../lib/apiClient';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// 👇 Added Custom SVG Icons for GitHub and LinkedIn to bypass Lucide's restrictions
const GithubIcon = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
    <path d="M9 18c-4.51 2-5-2-7-2"/>
  </svg>
);

const LinkedinIcon = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
    <rect width="4" height="12" x="2" y="9"/>
    <circle cx="4" cy="4" r="2"/>
  </svg>
);

export default function Dashboard() {
    const [jdTitle, setJdTitle] = useState('');
    const [jdText, setJdText] = useState('');
    const [file, setFile] = useState(null);
    const [statusMsg, setStatusMsg] = useState('');
    const [candidates, setCandidates] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [roleFilter, setRoleFilter] = useState('All');
    
    const [isSavingJd, setIsSavingJd] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isScoring, setIsScoring] = useState(false);
    const [isSendingOutreach, setIsSendingOutreach] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const fetchCandidates = async () => {
    try {
      const res = await getCandidates();
      setCandidates(res.data);
    } catch (error) {
      console.error("Failed to fetch candidates", error);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const handleSaveJd = async () => {
    if (!jdText) return setStatusMsg('❌ Please paste a Job Description.');
    if (!jdTitle) return setStatusMsg('❌ Please enter a Role Title.');

    setIsSavingJd(true);
    setStatusMsg('⏳ Saving and analyzing Job Description...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: jdText,
          roleTitle: jdTitle
        })
      });

      if (response.ok) {
        setStatusMsg('✅ Job Description saved and analyzed successfully!');
      } else {
        setStatusMsg('❌ Failed to save Job Description.');
      }
    } catch (error) {
      setStatusMsg('❌ Server error while saving.');
    } finally {
      setIsSavingJd(false);
    }
  };

  const handleUpload = async () => {
    if (!jdTitle) return setStatusMsg('❌ You must enter a Job Role Title in Phase 1 before uploading candidates.');
    if (!file) return setStatusMsg('❌ Please select a CSV file.');
    
    setIsUploading(true);
    setStatusMsg('⏳ Uploading and filtering candidates... (Lightning fast!)');
    try {
      const res = await uploadCsv(file, jdTitle);
      setStatusMsg(`✅ ${res.data.message}`);
      fetchCandidates();
    } catch (error) {
      const serverError = error.response?.data?.error || error.message || 'Failed to upload CSV.';
      setStatusMsg(`❌ Server Error: ${serverError}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleBatchScore = async () => {
    if (selectedIds.length === 0) return alert("Please select at least one candidate to score!");

    setIsScoring(true);
    setStatusMsg(`⏳ AI is evaluating ${selectedIds.length} selected candidates...`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/candidates/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateIds: selectedIds })
      });
      
      const data = await response.json();
      if (response.ok) {
        setStatusMsg(`✅ ${data.message}`);
        fetchCandidates();
      } else {
        setStatusMsg(`❌ ${data.error}`);
      }
    } catch (error) {
      console.error(error);
      setStatusMsg("❌ Error scoring candidates.");
    } finally {
      setIsScoring(false);
    }
  };

  const handleSendOutreach = async () => {
    if (selectedIds.length === 0) return alert("Select candidates first!");
    
    const validCandidates = candidates.filter(c => 
      selectedIds.includes(c._id) && c.matchScore !== null
    );

    if (validCandidates.length === 0) {
      return alert("None of the selected candidates have Match Scores yet! Please click '🤖 Generate Match Scores' first.");
    }

    if (validCandidates.length < selectedIds.length) {
      const proceed = window.confirm(`⚠️ Only ${validCandidates.length} out of ${selectedIds.length} selected candidates have scores. Proceed sending emails ONLY to the scored candidates?`);
      if (!proceed) return;
    }

    const validCandidateIds = validCandidates.map(c => c._id);

    setIsSendingOutreach(true);
    setStatusMsg(`⏳ Drafting and sending outreach to ${validCandidateIds.length} candidates...`);
    
    try {
      await sendOutreach(validCandidateIds);
      setStatusMsg('✅ Outreach sent successfully!');
      fetchCandidates();
      setSelectedIds([]);
    } catch (error) {
      setStatusMsg('❌ Failed to send outreach.');
    } finally {
      setIsSendingOutreach(false);
    }
  };

  const handleSyncReplies = async () => {
    setIsSyncing(true);
    setStatusMsg('🔄 Checking backend and syncing inbox...');
    try {
      const res = await syncInbox();
      setStatusMsg(`✅ ${res.data.message}`);
      fetchCandidates(); 
    } catch (error) {
      setStatusMsg('❌ Failed to sync inbox.');
    }
    setIsSyncing(false);
  };

  const downloadReport = () => {
    if (filteredCandidates.length === 0) return alert("No candidates to export!");

    const rankedCandidates = [...filteredCandidates].map(candidate => {
      const hasReplied = candidate.status === 'Replied';
      const isApiExhausted = hasReplied && candidate.interestScore === null;
      
      const actionScore = (!isApiExhausted && hasReplied)
        ? Math.round((candidate.matchScore * 0.5) + (candidate.interestScore * 0.5)) 
        : 0;
      
      let recommendation = "Awaiting Reply";
      if (isApiExhausted) {
          recommendation = "API Quota Exhausted - Retry Later";
      } else if (hasReplied) {
        if (actionScore >= 75) recommendation = "🔥 Schedule Interview";
        else if (actionScore >= 50) recommendation = "🤔 Review Manually";
        else recommendation = "🛑 Polite Reject";
      }

      return {
        Name: candidate.name,
        Email: candidate.email,
        Phone: candidate.phone || "N/A",
        Role: candidate.roleTitle || "Uncategorized",
        MatchScore: candidate.matchScore || "Unscored",
        InterestScore: isApiExhausted ? "API Error" : (candidate.interestScore || 0),
        ActionScore: isApiExhausted ? "API Error" : actionScore,
        Recommendation: recommendation,
        PipelineStatus: candidate.status
      };
    }).sort((a, b) => b.ActionScore - a.ActionScore);

    const headers = Object.keys(rankedCandidates[0]).join(",");
    const rows = rankedCandidates.map(c => Object.values(c).map(v => `"${v}"`).join(","));
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Recruiter_Action_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeCandidates = candidates.filter(c => c.status !== 'Skipped - Mismatch');
  const uniqueRoles = ['All', ...new Set(activeCandidates.map(c => c.roleTitle || 'Uncategorized Role'))];
  
  const filteredCandidates = activeCandidates.filter(c => {
    if (roleFilter !== 'All' && c.roleTitle !== roleFilter) return false;
    return true; 
  });

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-900 flex flex-col">
      <div className="flex-grow">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-blue-900">AI-Powered Talent Scouting & Engagement Agent</h1>
            <p className="text-gray-500">Discover, Score, Pool, and Engage Candidates Automatically</p>
          </div>
          <button 
            onClick={handleSyncReplies}
            disabled={isSyncing}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-all disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={isSyncing ? "animate-spin" : ""} size={20} />
            {isSyncing ? "Syncing..." : "Sync Replies & Refresh Table"}
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <FileText className="text-blue-500"/> 1. Define the Role
            </h2>
            <input 
              type="text"
              className="w-full p-3 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
              placeholder="Required: Job Role Title (e.g. Senior Backend Dev)"
              value={jdTitle}
              onChange={(e) => setJdTitle(e.target.value)}
            />
            <textarea 
              className="w-full h-32 p-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Paste the raw Job Description here..."
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
            />
            <button 
              onClick={handleSaveJd} 
              disabled={isSavingJd}
              className={`w-full text-white px-4 py-2 rounded-lg transition-colors font-medium ${isSavingJd ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {isSavingJd ? '⏳ Analyzing JD (Please wait)...' : 'Save Job Description'}
            </button>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <UploadCloud className="text-blue-500"/> 2. Ingest Candidates
            </h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer mb-4">
              <input 
                type="file" 
                accept=".csv"
                onChange={(e) => setFile(e.target.files[0])}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
            </div>
            <button 
              onClick={handleUpload} 
              disabled={isUploading}
              className="flex justify-center items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 w-full transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="animate-spin" size={18} /> Filtering...
                </>
              ) : (
                "Upload CSV & Filter"
              )}
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className={`p-4 rounded-lg mb-8 text-center font-medium shadow-sm border ${statusMsg.includes('❌') ? 'bg-red-50 text-red-800 border-red-100' : 'bg-blue-50 text-blue-800 border-blue-100'}`}>
            {statusMsg}
          </div>
        )}

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Send className="text-blue-500" /> 3. Review, Pool & Engage
            </h2>
            
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg">
                <Filter size={16} className="text-gray-500" />
                <select 
                  className="bg-transparent text-sm font-medium text-gray-700 outline-none cursor-pointer"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  {uniqueRoles.map((role, idx) => (
                    <option key={idx} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={async () => {
                  if (selectedIds.length === 0) return alert("Select candidates to delete first!");
                  if (!window.confirm(`Are you sure you want to permanently delete ${selectedIds.length} candidates?`)) return;
                  setStatusMsg(`⏳ Deleting ${selectedIds.length} candidates...`);
                  try {
                    await deleteCandidates(selectedIds);
                    setStatusMsg('✅ Candidates deleted successfully!');
                    setSelectedIds([]); 
                    fetchCandidates(); 
                  } catch (error) {
                    setStatusMsg('❌ Failed to delete candidates.');
                  }
                }}
                className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 font-medium"
                disabled={selectedIds.length === 0}
              >
                <Trash2 size={18} />
                Delete Selected
              </button>

              <button 
                onClick={handleBatchScore}
                disabled={selectedIds.length === 0 || isScoring}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isScoring ? (
                  <><RefreshCw className="animate-spin" size={18} /> Scoring...</>
                ) : (
                  "🤖 Generate Match Scores"
                )}
              </button>

              <button 
                onClick={handleSendOutreach}
                disabled={selectedIds.length === 0 || isSendingOutreach}
                className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSendingOutreach ? (
                  <><RefreshCw className="animate-spin" size={18} /> Sending...</>
                ) : (
                  "Send Automated Outreach"
                )}
              </button>

              <button 
                onClick={downloadReport}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-sm disabled:opacity-50"
                disabled={filteredCandidates.length === 0}
              >
                📥 Download Ranked Report
              </button>
            </div>
          </div>
                
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500 uppercase tracking-wider">
                  <th className="p-4 font-medium w-16">
                    <input 
                      type="checkbox" 
                      title="Select All Filtered Candidates"
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                      checked={filteredCandidates.length > 0 && selectedIds.length === filteredCandidates.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(filteredCandidates.map(c => c._id));
                        else setSelectedIds([]);
                      }}
                    />
                  </th>
                  <th className="p-4 font-medium">Candidate</th>
                  <th className="p-4 font-medium">Talent Pool</th>
                  <th className="p-4 font-medium">Match Score</th>
                  <th className="p-4 font-medium">Pipeline Status</th>
                  <th className="p-4 font-medium">Interest Score</th>
                  <th className="p-4 font-medium text-purple-700">Action Score</th>
                  <th className="p-4 font-medium">Brief</th> 
                </tr>
              </thead>
              <tbody>
                {filteredCandidates.map((candidate) => {
                  const hasReplied = candidate.status === 'Replied';
                  const isApiExhausted = hasReplied && candidate.interestScore === null;
                  
                  const actionScore = (!isApiExhausted && hasReplied) 
                      ? Math.round((candidate.matchScore * 0.5) + (candidate.interestScore * 0.5)) 
                      : null;
                  
                  let recommendation = "⏳ Awaiting Reply";
                  if (isApiExhausted) {
                    recommendation = "⚠️ Retry Sync";
                  } else if (hasReplied) {
                    if (actionScore >= 85) recommendation = "🔥 Interview";
                    else if (actionScore >= 50) recommendation = "🤔 Review";
                    else recommendation = "🛑 Reject";
                  }

                  return (
                    <tr key={candidate._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                          checked={selectedIds.includes(candidate._id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds([...selectedIds, candidate._id]);
                            else setSelectedIds(selectedIds.filter(id => id !== candidate._id));
                          }}
                        />
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-gray-900">{candidate.name}</p>
                        <div className="flex flex-col mt-1 text-xs text-gray-500">
                          <span>{candidate.email}</span>
                          {candidate.phone && <span className="font-semibold text-blue-600 mt-0.5">{candidate.phone}</span>}
                        </div>
                      </td>
                      <td className="p-4">
                        <select 
                          className="bg-purple-50 text-purple-700 text-xs font-bold px-2.5 py-1.5 rounded-md border border-purple-200 outline-none cursor-pointer hover:bg-purple-100 transition-colors max-w-[180px] truncate"
                          value={candidate.roleTitle || ''}
                          onChange={async (e) => {
                            const newRole = e.target.value;
                            if(window.confirm(`Move ${candidate.name} to ${newRole}? AI will re-evaluate them.`)) {
                              await updateCandidateRole(candidate._id, newRole);
                              fetchCandidates();
                            }
                          }}
                        >
                          <option value={candidate.roleTitle}>{candidate.roleTitle || 'Uncategorized'}</option>
                          {uniqueRoles.filter(r => r !== candidate.roleTitle && r !== 'All').map((role, idx) => (
                            <option key={idx} value={role}>{role}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4">
                        {candidate.matchScore === null ? (
                          <div className="inline-block text-xs font-bold px-3 py-1 rounded-md shadow-sm border bg-gray-100 text-gray-500 border-gray-200" title="Awaiting AI Scoring">
                            Unscored
                          </div>
                        ) : candidate.matchScore === 0 ? (
                          <div className="inline-block text-xs font-bold px-3 py-1 rounded-md shadow-sm border bg-red-50 text-red-600 border-red-200" title="API Error: Please re-upload or retry this candidate.">
                            ⚠️ Failed
                          </div>
                        ) : (
                          <div className={`inline-block text-sm font-bold px-3 py-1 rounded-md shadow-sm border ${candidate.matchScore > 75 ? 'bg-green-100 text-green-800 border-green-200' : candidate.matchScore > 50 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-red-50 text-red-700 border-red-100'}`}>
                            {candidate.matchScore}/100
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="bg-white text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-300 shadow-sm">
                          {candidate.status}
                        </span>
                      </td>
                      <td className="p-4">
                         {isApiExhausted ? (
                           <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded shadow-sm" title="API Limit Reached. Sync again tomorrow.">⚠️ API Exhausted</span>
                         ) : candidate.interestScore ? (
                           <span className="text-sm font-bold text-blue-800 bg-blue-100 border border-blue-200 px-3 py-1 rounded-md shadow-sm">{candidate.interestScore}/100</span>
                         ) : (
                           <span className="text-xs text-gray-400 italic">Awaiting</span>
                         )}
                      </td>
                      <td className="p-4">
                        {isApiExhausted ? (
                           <span className="text-xs font-semibold text-gray-500">{recommendation}</span>
                        ) : hasReplied ? (
                          <div className="flex flex-col items-start">
                            <span className="text-sm font-black text-purple-700 bg-purple-100 border border-purple-200 px-3 py-1 rounded-md shadow-sm mb-1">
                              {actionScore}/100
                            </span>
                            <span className="text-xs font-semibold text-gray-700">{recommendation}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Pending</span>
                        )}
                      </td>
                      <td className="p-4 max-w-[200px]">
                        {isApiExhausted ? (
                          <span className="text-xs text-red-400 italic">Analysis failed.</span>
                        ) : hasReplied && candidate.replySummary ? (
                          <p 
                            className="text-xs text-gray-600 line-clamp-2 cursor-help" 
                            title={candidate.replySummary}
                          >
                            "{candidate.replySummary}"
                          </p>
                        ) : (
                          <span className="text-xs text-gray-400 italic">
                            {candidate.status === 'Outreach Sent' ? 'Awaiting response...' : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredCandidates.length === 0 && (
                  <tr>
                    <td colSpan="8" className="p-12 text-center text-gray-400 font-medium bg-gray-50/50">
                      No candidates found in this talent pool.
                    </td>
                  </tr>                
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <footer className="mt-12 pt-6 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center text-gray-500 text-sm">
        <div className="flex items-center gap-1.5 mb-4 md:mb-0 font-medium">
          Made with <Heart size={16} className="text-red-500 fill-red-500 animate-pulse" /> by Debjit
        </div>
        <div className="flex items-center gap-4">
          <a href="https://github.com/debjit-stack" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-900 transition-colors">
            <GithubIcon size={20} />
          </a>
          <a href="https://www.linkedin.com/in/debjit-ghosh007/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 transition-colors">
            <LinkedinIcon size={20} />
          </a>
        </div>
      </footer>
    </div>
  );
}