/**
 * @file 应用入口
 * @description 挂载 React 根节点，包裹 NextUIProvider
 * @author TODO <your-github-username>
 * @date 2026-09-08
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { NextUIProvider } from '@nextui-org/react';
import App from './App';
import './entry.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <NextUIProvider>
    <App />
  </NextUIProvider>
);
