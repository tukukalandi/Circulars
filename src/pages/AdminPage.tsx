import React, { useEffect, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, setDoc, deleteDoc, updateDoc, collection, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase-setup';
import { 
  LogOut, 
  UploadCloud, 
  AlertCircle, 
  Loader2, 
  HardDrive, 
  Home, 
  Trash2, 
  ExternalLink, 
  Search, 
  FolderTree, 
  Edit2, 
  X, 
  Check, 
  CheckCircle2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { CIRCULAR_CATEGORIES } from '../constants/categories';

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
  const [category, setCategory] = useState<string>(CIRCULAR_CATEGORIES[0]);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  
  // Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Tabs & files
  const [activeTab, setActiveTab] = useState<'upload' | 'manage'>('upload');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [manageCategoryFilter, setManageCategoryFilter] = useState('All');

  // Edit modal states
  const [editingFile, setEditingFile] = useState<UploadedFile | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<string>(CIRCULAR_CATEGORIES[0]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccessMsg, setEditSuccessMsg] = useState<string | null>(null);

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

  const handleOpenEdit = (file: UploadedFile) => {
    setEditingFile(file);
    setEditName(file.name);
    const matchedCategory = CIRCULAR_CATEGORIES.find(
      c => c.toLowerCase() === (file.category || '').toLowerCase()
    );
    setEditCategory(matchedCategory || CIRCULAR_CATEGORIES[0]);
    setEditError(null);
    setEditSuccessMsg(null);
  };

  const handleCloseEdit = () => {
    setEditingFile(null);
    setEditName('');
    setEditError(null);
    setEditSuccessMsg(null);
  };

  const handleUpdateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFile) return;
    if (!editName.trim()) {
      setEditError('Circular name cannot be empty.');
      return;
    }

    setIsUpdating(true);
    setEditError(null);
    setEditSuccessMsg(null);

    try {
      const fileRef = doc(db, 'uploaded_files', editingFile.id);
      await updateDoc(fileRef, {
        name: editName.trim(),
        category: editCategory
      });

      setEditSuccessMsg('File details updated successfully!');
      setTimeout(() => {
        handleCloseEdit();
      }, 1000);
    } catch (err: any) {
      console.error('Update error', err);
      setEditError(err.message || 'Failed to update circular details.');
      handleFirestoreError(err, OperationType.UPDATE, `uploaded_files/${editingFile.id}`);
    } finally {
      setIsUpdating(false);
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
      if (error.code === 'auth/popup-closed-by-user') {
        console.log('Login popup was closed by the user.');
      } else {
        console.error('Login error', error);
        alert('Failed to login: ' + error.message);
      }
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

  const getOrCreateCategoryFolder = async (folderName: string, parentId: string, token: string) => {
    // 1. Search for existing folder
    const q = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentId}' in parents and trashed=false`;
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`, {
      headers: {
        'Authorization': 'Bearer ' + token,
      }
    });
    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id; // Return existing folder ID
      }
    }
    
    // 2. Create if not exists
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      })
    });
    if (!createRes.ok) {
      throw new Error('Failed to create category folder on Google Drive');
    }
    const createData = await createRes.json();
    return createData.id;
  };

  const uploadToGoogleDrive = async (file: File, token: string, uploadCategory: string) => {
    const rootFolderId = '1UcVx1b631VGL17MXqUV23sizpUDvcNrI';
    const folderId = await getOrCreateCategoryFolder(uploadCategory, rootFolderId, token);

    const metadata = {
      name: fileName || file.name,
      mimeType: file.type || 'application/octet-stream',
      parents: [folderId]
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
      const selectedCategory = category || CIRCULAR_CATEGORIES[0];

      // 1. Upload to Google Drive directly into the subfolder
      const driveFileId = await uploadToGoogleDrive(fileToUpload, googleAccessToken, selectedCategory);
      
      // 2. Set to public and get sharable link
      const driveLink = await getWebViewLink(driveFileId, googleAccessToken);
      
      // 3. Extract text via backend endpoint so AI can search text later
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
      
      // Handle the Firestore creation
      try {
        const dataToSave: any = {
          name: fileName || fileToUpload.name,
          category: selectedCategory,
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
      setCategory(CIRCULAR_CATEGORIES[0]);
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (err: any) {
      console.error('Submission failed', err);
      setUploadError(err.message || 'An error occurred during submission.');
    } finally {
      setIsUploading(false);
    }
  };

  const filteredManageFiles = files.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (f.category && f.category.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = manageCategoryFilter === 'All' || 
                            (f.category && f.category.toLowerCase() === manageCategoryFilter.toLowerCase());
    return matchesSearch && matchesCategory;
  });

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
              <p className="text-sm text-white/80 font-medium">Admin Portal - Upload & Manage Circulars</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 self-end md:self-center w-full md:w-auto justify-end flex-wrap">
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
            <Link 
              to="/categories" 
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors px-4 py-2 rounded-lg text-sm font-medium"
            >
              <FolderTree className="w-4 h-4 text-amber-300" />
              <span className="hidden sm:inline">Categories</span>
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

      <main className={`flex-1 w-full mx-auto p-4 md:p-8 flex flex-col ${activeTab === 'manage' ? 'max-w-7xl items-stretch' : 'max-w-2xl items-center justify-center'}`}>
        {!user ? (
          <div className="bg-white p-10 rounded-2xl shadow-xl w-full text-center border">
            <div className="w-20 h-20 bg-[#ffe4e6] text-[#cc2128] rounded-full flex items-center justify-center mx-auto mb-6">
               <UploadCloud className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Editor Login</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              You must sign in with your Google account to upload and manage files in your Google Drive and portal.
            </p>
            <button
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#cc2128] px-6 py-3 text-base font-semibold text-white shadow hover:bg-[#a61a20] focus:outline-none focus:ring-2 focus:ring-[#cc2128] focus:ring-offset-2 transition-all"
            >
              Sign in with Google
            </button>
          </div>
        ) : (
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow border w-full">
            
            <div className="flex border-b mb-6 overflow-x-auto">
              <button 
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-3 px-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'upload' ? 'border-[#cc2128] text-[#cc2128]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Upload Circular
              </button>
              <button 
                onClick={() => setActiveTab('manage')}
                className={`flex-1 py-3 px-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'manage' ? 'border-[#cc2128] text-[#cc2128]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <span>Manage Circulars</span>
                {files.length > 0 && (
                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-bold">
                    {files.length}
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'upload' ? (
              <>
                <div className="mb-6 flex items-center justify-between border-b pb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Upload New Circular</h2>
                        <p className="text-gray-500 text-sm mt-1">
                            Files will be stored into category subfolders in your Google Drive and published immediately.
                        </p>
                    </div>
                </div>

                {uploadSuccess && (
                  <div className="mb-6 bg-green-50 text-green-800 p-4 rounded-xl border border-green-200 flex items-start">
                    <div className="font-medium text-sm">
                      Success! File uploaded to Google Drive and shared publicly on the portal.
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
                            <p className="text-xs leading-5 text-gray-500 mt-2">PDF, DOC, Images, or any circular format (up to 5GB)</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="fileName" className="block text-sm font-semibold text-gray-900 mb-1">
                      Circular / File Name
                    </label>
                    <input
                      type="text"
                      id="fileName"
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      placeholder="e.g. SB Order No. 04/2024 regarding Sukanya Samriddhi Scheme"
                      className="block w-full rounded-lg border-gray-300 py-3 px-4 text-gray-900 shadow-sm border focus:border-[#cc2128] focus:ring-[#cc2128] sm:text-sm outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="category" className="block text-sm font-semibold text-gray-900 mb-1 flex items-center justify-between">
                      <span>Category</span>
                      <span className="text-xs font-normal text-gray-500">Choose from 15 postal categories</span>
                    </label>
                    <select
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="block w-full rounded-lg border-gray-300 py-3 px-4 text-gray-900 shadow-sm border focus:border-[#cc2128] focus:ring-[#cc2128] sm:text-sm outline-none bg-white font-medium cursor-pointer"
                      required
                    >
                      {CIRCULAR_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1.5">
                      Subfolder <span className="font-semibold text-gray-700">"{category}"</span> will be created or used in your Google Drive.
                    </p>
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
                          Uploading & Saving to Drive...
                        </>
                      ) : (
                        'Upload & Publish Circular'
                      )}
                    </button>
                  </div>

                </form>
              </>
            ) : (
              <div>
                <div className="mb-6 border-b pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Manage Circulars</h2>
                      <p className="text-gray-500 text-sm mt-1">
                          Edit titles, reassign categories, view Drive links, or delete circulars.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                      {/* Filter by Category */}
                      <div className="relative w-full sm:w-48">
                        <select
                          value={manageCategoryFilter}
                          onChange={(e) => setManageCategoryFilter(e.target.value)}
                          className="w-full py-2 pl-3 pr-8 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#cc2128]"
                        >
                          <option value="All">All Categories</option>
                          {CIRCULAR_CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      {/* Search box */}
                      <div className="relative w-full sm:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          placeholder="Search circulars..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#cc2128] sm:text-sm"
                        />
                      </div>
                    </div>
                </div>

                {loadingFiles ? (
                   <div className="flex justify-center items-center h-48">
                     <Loader2 className="w-8 h-8 animate-spin text-[#cc2128]" />
                   </div>
                ) : files.length === 0 ? (
                  <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed text-gray-500">
                    <p className="font-medium text-gray-700">No circulars uploaded yet.</p>
                    <p className="text-xs text-gray-500 mt-1">Click "Upload Circular" tab above to publish your first notice.</p>
                  </div>
                ) : filteredManageFiles.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed text-gray-500">
                    <p className="font-medium text-gray-700">No circulars match your current filter.</p>
                    <button 
                      onClick={() => { setSearchQuery(''); setManageCategoryFilter('All'); }}
                      className="mt-3 text-xs bg-white border border-gray-300 px-3 py-1.5 rounded-lg text-gray-700 hover:bg-gray-100 font-medium"
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm">
                    <table className="w-full min-w-[700px] divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50 text-gray-700">
                        <tr>
                          <th className="px-6 py-3.5 text-left font-bold whitespace-nowrap w-32">Date</th>
                          <th className="px-6 py-3.5 text-left font-bold">Circular Name</th>
                          <th className="px-6 py-3.5 text-left font-bold whitespace-nowrap w-36">Category</th>
                          <th className="px-6 py-3.5 text-right font-bold whitespace-nowrap w-44">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {filteredManageFiles.map(file => (
                          <tr key={file.id} className="hover:bg-gray-50/80 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-xs font-medium">
                              {new Date(file.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </td>
                            <td className="px-6 py-4 font-semibold text-gray-900 leading-snug">
                              {file.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="bg-[#ffe4e6] text-[#cc2128] px-2.5 py-1 rounded-full text-xs font-bold inline-block">
                                {file.category || 'Others'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleOpenEdit(file)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-colors shadow-sm"
                                  title="Edit name and category"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-amber-700" />
                                  <span>Edit</span>
                                </button>
                                <a 
                                  href={file.driveLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-colors shadow-sm"
                                  title="Open in Google Drive"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Drive</span>
                                </a>
                                <button 
                                  onClick={() => handleDeleteFile(file.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition-colors shadow-sm"
                                  title="Delete from portal"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              </div>
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

      {/* Edit Circular Modal */}
      {editingFile && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#4d161a] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Edit2 className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-lg">Edit Circular</h3>
              </div>
              <button 
                onClick={handleCloseEdit}
                disabled={isUpdating}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleUpdateFile} className="p-6 space-y-5">
              {editSuccessMsg && (
                <div className="bg-green-50 border border-green-200 text-green-800 p-3.5 rounded-xl flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  <span>{editSuccessMsg}</span>
                </div>
              )}

              {editError && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-xl flex items-center gap-2 text-sm font-medium">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div>
                <label htmlFor="editFileName" className="block text-sm font-bold text-gray-800 mb-1.5">
                  Circular / File Name
                </label>
                <input
                  type="text"
                  id="editFileName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter circular title"
                  className="w-full rounded-xl border border-gray-300 py-3 px-4 text-gray-900 shadow-sm focus:border-[#cc2128] focus:ring-2 focus:ring-[#cc2128]/20 outline-none text-sm font-medium"
                  required
                  disabled={isUpdating}
                />
              </div>

              <div>
                <label htmlFor="editCategory" className="block text-sm font-bold text-gray-800 mb-1.5 flex items-center justify-between">
                  <span>Category</span>
                  <span className="text-xs font-normal text-gray-500">15 postal categories</span>
                </label>
                <select
                  id="editCategory"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 py-3 px-4 text-gray-900 shadow-sm focus:border-[#cc2128] focus:ring-2 focus:ring-[#cc2128]/20 outline-none text-sm font-medium bg-white cursor-pointer"
                  disabled={isUpdating}
                >
                  {CIRCULAR_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1.5">
                  Changing the category updates where this circular appears across the portal.
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 text-xs text-gray-600 space-y-1.5">
                <p className="font-semibold text-gray-700">File Type: <span className="font-normal text-gray-600">{editingFile.fileType}</span></p>
                <p className="font-semibold text-gray-700 flex items-center gap-1.5">
                  <span>Google Drive:</span>
                  <a 
                    href={editingFile.driveLink} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-600 hover:underline flex items-center gap-1 font-normal"
                  >
                    Open Document Link <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  disabled={isUpdating}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating || !editName.trim()}
                  className="px-5 py-2.5 rounded-xl bg-[#cc2128] hover:bg-[#a61a20] text-sm font-semibold text-white shadow flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-[#4d161a] text-white/80 py-6 text-center text-sm mt-auto w-full border-t border-[#3b1114]">
        <p>Prepared by Kalandi Charan Sahoo, PA, Dhenkanal RS SO.</p>
      </footer>
    </div>
  );
}
