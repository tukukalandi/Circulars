/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PublicPage from './pages/PublicPage';
import AdminPage from './pages/AdminPage';
import CategoriesPage from './pages/CategoriesPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}
