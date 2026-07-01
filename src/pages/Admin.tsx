import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Upload, Save, CheckCircle, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'csv' | 'templates' | 'users'>('csv');
  
  // CSV State
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  // Templates State
  const [acceptanceTemplate, setAcceptanceTemplate] = useState('');
  const [rejectionTemplate, setRejectionTemplate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Users State
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    // Load existing templates
    const loadTemplates = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'admission'));
        if (settingsDoc.exists()) {
          setAcceptanceTemplate(settingsDoc.data().acceptanceTemplate || '');
          setRejectionTemplate(settingsDoc.data().rejectionTemplate || '');
        }
      } catch (err) {
        console.error('Failed to load templates', err);
      }
    };
    loadTemplates();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const usersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(usersData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleUserStatusChange = async (userId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { decisionStatus: newStatus });
      setUsers(users.map(u => u.id === userId ? { ...u, decisionStatus: newStatus } : u));
    } catch (err) {
      console.error("Failed to update status", err);
      alert("Failed to update status");
    }
  };

  const handleCsvUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadStatus('Parsing CSV...');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows: any[] = results.data;
        let successCount = 0;
        let failCount = 0;

        setUploadStatus(`Processing ${rows.length} rows...`);

        for (const row of rows) {
          const { firstName, decision } = row;
          if (!firstName || !decision) {
            failCount++;
            continue;
          }

          try {
            // Find user by exact firstName (can be improved to match last name as well or email)
            const q = query(
              collection(db, 'users'), 
              where('firstName', '==', firstName.trim())
            );
            
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
              // Update the first matching user
              const userDoc = querySnapshot.docs[0];
              const validDecision = ['pending', 'accepted', 'rejected'].includes(decision.toLowerCase()) 
                ? decision.toLowerCase() 
                : 'pending';

              await updateDoc(doc(db, 'users', userDoc.id), {
                decisionStatus: validDecision
              });
              successCount++;
            } else {
              failCount++;
            }
          } catch (err) {
            console.error(err);
            failCount++;
          }
        }

        setUploadStatus(`Completed! Updated: ${successCount}, Failed/Not Found: ${failCount}`);
        setUploading(false);
        setFile(null);
      },
      error: (error) => {
        setUploadStatus(`Error parsing CSV: ${error.message}`);
        setUploading(false);
      }
    });
  };

  const handleSaveTemplates = async () => {
    setSaving(true);
    setSaveMessage('');
    try {
      await setDoc(doc(db, 'settings', 'admission'), {
        acceptanceTemplate,
        rejectionTemplate
      }, { merge: true });
      
      setSaveMessage('Templates saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setSaveMessage('Failed to save templates.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-display uppercase tracking-tight mb-8">Admin Control Panel</h1>

        <div className="flex border-b border-slate-200 mb-8 space-x-8">
          <button
            onClick={() => setActiveTab('csv')}
            className={`pb-4 font-medium text-sm transition-colors relative ${activeTab === 'csv' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Bulk CSV Upload
            {activeTab === 'csv' && (
              <motion.div layoutId="admin-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`pb-4 font-medium text-sm transition-colors relative ${activeTab === 'templates' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Email Templates
            {activeTab === 'templates' && (
              <motion.div layoutId="admin-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-4 font-medium text-sm transition-colors relative ${activeTab === 'users' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Manual Decisions
            {activeTab === 'users' && (
              <motion.div layoutId="admin-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
            )}
          </button>
        </div>

        {activeTab === 'csv' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 p-8 shadow-sm"
          >
            <h2 className="text-xl font-bold mb-4">Upload Decisions CSV</h2>
            <p className="text-slate-500 text-sm mb-6">
              Upload a CSV file with columns: <code>firstName</code>, <code>lastName</code>, <code>decision</code>.<br/>
              Decision must be exactly: <code>accepted</code> or <code>rejected</code>.
            </p>

            <div className="flex items-center space-x-4 mb-4">
              <input 
                type="file" 
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:border-0 file:text-sm file:font-bold file:bg-slate-100 file:text-slate-900 hover:file:bg-slate-200 transition-colors"
              />
              <button 
                onClick={handleCsvUpload}
                disabled={!file || uploading}
                className="flex items-center px-6 py-2 bg-slate-900 text-white font-bold text-sm uppercase tracking-wider hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Processing...' : 'Upload'}
              </button>
            </div>

            {uploadStatus && (
              <div className={`mt-4 p-4 border flex items-center space-x-3 text-sm font-medium ${uploadStatus.includes('Error') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                {uploadStatus.includes('Error') ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                <span>{uploadStatus}</span>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'templates' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white border border-slate-200 p-8 shadow-sm">
              <h2 className="text-xl font-bold mb-4 flex justify-between items-center">
                <span>Acceptance Template (HTML)</span>
              </h2>
              <p className="text-slate-500 text-xs mb-4">Variables allowed: <code>{`{{firstName}}`}</code>, <code>{`{{lastName}}`}</code></p>
              <textarea 
                className="w-full h-64 p-4 border border-slate-300 font-mono text-sm focus:outline-none focus:border-slate-900 transition-colors"
                value={acceptanceTemplate}
                onChange={(e) => setAcceptanceTemplate(e.target.value)}
                placeholder="<h1>Congratulations {{firstName}}!</h1>..."
              />
            </div>

            <div className="bg-white border border-slate-200 p-8 shadow-sm">
              <h2 className="text-xl font-bold mb-4">Rejection Template (HTML)</h2>
              <p className="text-slate-500 text-xs mb-4">Variables allowed: <code>{`{{firstName}}`}</code>, <code>{`{{lastName}}`}</code></p>
              <textarea 
                className="w-full h-64 p-4 border border-slate-300 font-mono text-sm focus:outline-none focus:border-slate-900 transition-colors"
                value={rejectionTemplate}
                onChange={(e) => setRejectionTemplate(e.target.value)}
                placeholder="<p>Dear {{firstName}}, we regret to inform you...</p>"
              />
            </div>

            <div className="flex items-center space-x-4">
              <button 
                onClick={handleSaveTemplates}
                disabled={saving}
                className="flex items-center px-8 py-3 bg-slate-900 text-white font-bold text-sm uppercase tracking-wider hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Templates'}
              </button>
              {saveMessage && (
                <span className={`text-sm font-bold ${saveMessage.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
                  {saveMessage}
                </span>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'users' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 p-8 shadow-sm overflow-x-auto"
          >
            <h2 className="text-xl font-bold mb-6">Manual User Decisions</h2>
            {loadingUsers ? (
              <p className="text-slate-500">Loading users...</p>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-sm uppercase tracking-wider text-slate-500">
                    <th className="py-4 font-semibold">Name</th>
                    <th className="py-4 font-semibold">Email</th>
                    <th className="py-4 font-semibold">Current Status</th>
                    <th className="py-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-4 font-medium">{user.firstName} {user.lastName}</td>
                      <td className="py-4 text-slate-600">{user.email}</td>
                      <td className="py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-bold uppercase ${
                          user.decisionStatus === 'accepted' ? 'bg-green-100 text-green-800' :
                          user.decisionStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {user.decisionStatus || 'pending'}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <select 
                          className="border border-slate-300 text-sm font-medium py-1 px-2 focus:outline-none"
                          value={user.decisionStatus || 'pending'}
                          onChange={(e) => handleUserStatusChange(user.id, e.target.value)}
                        >
                          <option value="pending">Pending</option>
                          <option value="accepted">Accepted</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Admin;
