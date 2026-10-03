import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { store } from './services/store';
import './styles/index.css';

// טוענים את הנתונים לפני התצוגה הראשונה, כדי שהמסך לא יהבהב עם נתונים חלקיים
void store.init().finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
