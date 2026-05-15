import React, { useEffect, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, setDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase-setup';
import { LogOut, UploadCloud, AlertCircle, Loader2, HardDrive, Home, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface UploadedFile {
  id: string;
  name: string;
  category?: string;
  fileType: string;
  driveLink: string;
  createdAt: number;
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

  // Form states
  const [fileName, setFileName] = useState('');
  const [category, setCategory] = useState('');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  
  // Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Tabs & files
  const [activeTab, setActiveTab] = useState<'upload' | 'manage'>('upload');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && activeTab === 'manage') {
      setLoadingFiles(true);
      const q = query(
        collection(db, 'uploaded_files'),
        where('isPublic', '==', true)
      );
      const unsub = onSnapshot(q, (snapshot) => {
        const fileData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now()
          };
        }) as UploadedFile[];
        
        fileData.sort((a, b) => b.createdAt - a.createdAt);
        setFiles(fileData);
        setLoadingFiles(false);
      }, (error) => {
        setLoadingFiles(false);
        handleFirestoreError(error, OperationType.LIST, 'uploaded_files');
      });
      return () => unsub();
    }
  }, [user, activeTab]);

  const handleDeleteFile = async (fileId: string) => {
    if (!window.confirm("Are you sure you want to delete this circular from the portal?")) return;
    try {
      await deleteDoc(doc(db, 'uploaded_files', fileId));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `uploaded_files/${fileId}`);
    }
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Scope needed to upload files to user's Google Drive. 
      // drive.file grants access ONLY to files created by the app.
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleAccessToken(credential.accessToken);
      }
    } catch (error: any) {
      console.error('Login error', error);
      alert('Failed to login: ' + error.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setGoogleAccessToken(null);
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileToUpload(e.target.files[0]);
      if (!fileName) {
        setFileName(e.target.files[0].name);
      }
      setUploadError(null);
      setUploadSuccess(false);
    }
  };

  const uploadToGoogleDrive = async (file: File, token: string) => {
    var metadata = {
      name: fileName || file.name,
      mimeType: file.type || 'application/octet-stream',
    };
    
    // 1. Create file metadata
    const metaResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });
    
    if (!metaResponse.ok) {
        throw new Error('Failed to create file metadata on Google Drive: ' + metaResponse.statusText);
    }
    const metaDataResp = await metaResponse.json();
    const fileId = metaDataResp.id;

    // 2. Upload file content (media) to the created file ID
    const updateResponse = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': file.type || 'application/octet-stream'
      },
      body: file
    });

    if (!updateResponse.ok) {
        throw new Error('Failed to upload file content to Google Drive: ' + updateResponse.statusText);
    }
    
    return fileId;
  };

  const getWebViewLink = async (fileId: string, token: string) => {
    // Make the file publicly accessible so anyone with link can view it
    const permResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    });

    if (!permResponse.ok) {
       throw new Error('Failed to update file permissions on Google Drive');
    }

    // Now retrieve the webViewLink
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`, {
        method: 'GET',
        headers: new Headers({ 'Authorization': 'Bearer ' + token }),
    });

    if (!response.ok) {
        throw new Error('Failed to retrieve file sharing link');
    }
    const responseData = await response.json();
    return responseData.webViewLink;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToUpload) {
      setUploadError('Please select a file to upload.');
      return;
    }
    if (!googleAccessToken) {
      setUploadError('Google session token not found. Please log out and back in.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      // 1. Upload to Google Drive directly
      const driveFileId = await uploadToGoogleDrive(fileToUpload, googleAccessToken);
      
      // 2. Set to public and get sharable link
      const driveLink = await getWebViewLink(driveFileId, googleAccessToken);
      
      // 3. Extract text via backend endpoint so AI can ask questions later
      let extractedText = '';
      try {
        const formData = new FormData();
        formData.append('file', fileToUpload);
        const extractRes = await fetch('/api/extract-text', { method: 'POST', body: formData });
        if (extractRes.ok) {
           const json = await extractRes.json();
           extractedText = json.text || '';
        }
      } catch (e) {
        console.warn('Text extraction failed, continuing without it', e);
      }

      // 4. Save reference to Firestore
      const newFileId = crypto.randomUUID();
      const dbRef = doc(db, 'uploaded_files', newFileId);
      
      const fileType = fileToUpload.type || 'Unknown';
      
      // Handle the Firestore creation using correct security rules shape
      try {
        const dataToSave: any = {
          name: fileName || fileToUpload.name,
          category: category || 'GENERAL',
          fileType: fileType,
          driveLink: driveLink,
          uploaderId: user!.uid,
          isPublic: true,
          createdAt: serverTimestamp()
        };
        if (extractedText) {
          dataToSave.textContent = extractedText.substring(0, 500000); // safety crop
        }
        await setDoc(dbRef, dataToSave);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.CREATE, 'uploaded_files');
      }

      setUploadSuccess(true);
      setFileToUpload(null);
      setFileName('');
      setCategory('');
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (err: any) {
      console.error('Submission failed', err);
      setUploadError(err.message || 'An error occurred during submission.');
    } finally {
      setIsUploading(false);
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-[#f7f5ed] flex flex-col font-sans">
      <header className="bg-[#4d161a] border-b border-[#3b1114] text-white">
        <div 
          className="px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{
            backgroundImage: `radial-gradient(#ffffff15 1px, transparent 1px)`,
            backgroundSize: `20px 20px`
          }}
        >
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center p-1 shrink-0 shadow-sm">
              <img 
                src="https://upload.wikimedia.org/wikipedia/en/3/32/India_Post.svg" 
                alt="India Post" 
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white mb-0.5">Department of Posts</h1>
              <p className="text-sm text-white/80 font-medium">Admin Portal - Upload Circulars</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 self-end md:self-center w-full md:w-auto justify-end">
            {user && (
              <button
                onClick={handleLogin}
                className={`flex items-center gap-2 ${googleAccessToken ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} transition-colors px-4 py-2 rounded-lg text-sm font-medium`}
              >
                <HardDrive className="w-4 h-4" />
                <span className="hidden sm:inline">{googleAccessToken ? 'Drive Connected' : 'Connect Drive'}</span>
              </button>
            )}
            <Link 
              to="/" 
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors px-4 py-2 rounded-lg text-sm font-medium"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Public Site</span>
            </Link>
            {user && (
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 bg-white/10 hover:bg-[#cc2128] transition-colors px-4 py-2 rounded-lg text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto p-6 md:p-8 flex flex-col items-center justify-center">
        {!user ? (
          <div className="bg-white p-10 rounded-2xl shadow-xl w-full text-center border">
            <div className="w-20 h-20 bg-[#ffe4e6] text-[#cc2128] rounded-full flex items-center justify-center mx-auto mb-6">
               <UploadCloud className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Editor Login</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              You must sign in with your Google account to upload files into your Google Drive.
            </p>
            <button
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#cc2128] px-6 py-3 text-base font-semibold text-white shadow hover:bg-[#a61a20] focus:outline-none focus:ring-2 focus:ring-[#cc2128] focus:ring-offset-2 transition-all"
            >
              Sign in with Google
            </button>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-2xl shadow border w-full max-w-4xl">
            
            <div className="flex border-b mb-6 overflow-x-auto">
              <button 
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-3 px-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'upload' ? 'border-[#cc2128] text-[#cc2128]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Upload Circular
              </button>
              <button 
                onClick={() => setActiveTab('manage')}
                className={`flex-1 py-3 px-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'manage' ? 'border-[#cc2128] text-[#cc2128]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Manage Circulars
              </button>
            </div>

            {activeTab === 'upload' ? (
              <>
                <div className="mb-6 flex items-center justify-between border-b pb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Upload new file</h2>
                        <p className="text-gray-500 text-sm mt-1">
                            Files are uploaded securely to your linked Google Drive.
                        </p>
                    </div>
                </div>

                {uploadSuccess && (
                  <div className="mb-6 bg-green-50 text-green-800 p-4 rounded-xl border border-green-200 flex items-start">
                    <div className="font-medium text-sm">
                      Success! File uploaded to Google Drive and shared publicly.
                    </div>
                  </div>
                )}

                {uploadError && (
                  <div className="mb-6 bg-red-50 text-red-800 p-4 rounded-xl border border-red-200 flex items-start">
                    <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
                    <div className="font-medium text-sm">{uploadError}</div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">
                      File Upload
                    </label>
                    <div className="mt-1 flex justify-center rounded-xl border border-dashed border-gray-300 px-6 py-10 bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="text-center">
                        <UploadCloud className="mx-auto h-12 w-12 text-[#cc2128]/60" aria-hidden="true" />
                        <div className="mt-4 flex text-sm leading-6 text-gray-600 justify-center">
                          <label htmlFor="file-upload" className="relative cursor-pointer rounded bg-white px-2 py-0.5 font-semibold text-[#cc2128] focus-within:outline-none focus-within:ring-2 focus-within:ring-[#cc2128] focus-within:ring-offset-2 hover:text-[#a61a20] border shadow-sm">
                            <span>Select a file</span>
                            <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileSelection} />
                          </label>
                        </div>
                        {fileToUpload ? (
                            <p className="text-xs leading-5 text-gray-500 mt-2 font-medium">Selected: {fileToUpload.name}</p>
                        ) : (
                            <p className="text-xs leading-5 text-gray-500 mt-2">Any file type up to 5GB (Drive limits apply)</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="fileName" className="block text-sm font-semibold text-gray-900 mb-1">
                      Name of the file
                    </label>
                    <input
                      type="text"
                      id="fileName"
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      placeholder="e.g. Q3 Marketing Report"
                      className="block w-full rounded-lg border-gray-300 py-3 px-4 text-gray-900 shadow-sm border focus:border-[#cc2128] focus:ring-[#cc2128] sm:text-sm outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="category" className="block text-sm font-semibold text-gray-900 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g. SB, SOFTWARE, APT 2.0"
                      className="block w-full rounded-lg border-gray-300 py-3 px-4 text-gray-900 shadow-sm border focus:border-[#cc2128] focus:ring-[#cc2128] sm:text-sm outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">
                      File Type
                    </label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={fileToUpload?.type || 'Select a file first'}
                      className="block w-full rounded-lg border-gray-200 bg-gray-50 py-3 px-4 text-gray-500 border sm:text-sm outline-none"
                    />
                  </div>

                  <div className="pt-4 border-t">
                    <button
                      type="submit"
                      disabled={isUploading || !fileToUpload}
                      className="w-full flex justify-center items-center rounded-lg bg-[#cc2128] px-3 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-[#a61a20] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#cc2128] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          Uploading & Saving...
                        </>
                      ) : (
                        'Upload & Submit'
                      )}
                    </button>
                  </div>

                </form>
              </>
            ) : (
              <div>
                <div className="mb-6 border-b pb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Manage Uploaded Files</h2>
                    <p className="text-gray-500 text-sm mt-1">
                        View or remove circulars from the portal.
                    </p>
                </div>
                {loadingFiles ? (
                   <div className="flex justify-center items-center h-40">
                     <Loader2 className="w-8 h-8 animate-spin text-[#cc2128]" />
                   </div>
                ) : files.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed text-gray-500">
                    No files found.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full min-w-[600px] divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left font-semibold text-gray-900 whitespace-nowrap">Date</th>
                          <th className="px-6 py-3 text-left font-semibold text-gray-900 whitespace-nowrap">Name</th>
                          <th className="px-6 py-3 text-left font-semibold text-gray-900 whitespace-nowrap">Category</th>
                          <th className="px-6 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {files.map(file => (
                          <tr key={file.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                              {new Date(file.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 font-medium text-gray-900">
                              {file.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                              <span className="bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full text-xs font-bold">
                                {file.category || 'GENERAL'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right flex items-center justify-end gap-3">
                              <a 
                                href={file.driveLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 focus:outline-none"
                                title="View in Drive"
                              >
                                <ExternalLink className="w-5 h-5" />
                              </a>
                              <button 
                                onClick={() => handleDeleteFile(file.id)}
                                className="text-red-500 hover:text-red-700"
                                title="Delete from portal"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
