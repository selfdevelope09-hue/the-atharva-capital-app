import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Agar teri CSS file ka naam ye hai
import App from './App'; // YE LINE DEKHO: Ye './App' ko hi point karni chahiye

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
