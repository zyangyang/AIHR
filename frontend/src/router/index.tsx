import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import Login from '@/pages/Login';
import Apply from '@/pages/Apply';
import MainLayout from '@/components/MainLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import Dashboard from '@/pages/Dashboard';
import Jobs from '@/pages/Jobs';
import Resumes from '@/pages/Resumes';
import ResumeDetail from '@/pages/ResumeDetail';
import ResumeImport from '@/pages/ResumeImport';
import MatchingCenter from '@/pages/MatchingCenter';
import InterviewQuestions from '@/pages/InterviewQuestions';
import Prompts from '@/pages/Prompts';
import LLMConfigs from '@/pages/LLMConfigs';
import AiSearch from '@/pages/AiSearch';

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/apply/:token',
    element: <Apply />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'jobs', element: <Jobs /> },
      { path: 'resumes', element: <Resumes /> },
      { path: 'resumes/:id', element: <ResumeDetail /> },
      { path: 'resumes/import', element: <ResumeImport /> },
      { path: 'ai-search', element: <AiSearch /> },
      { path: 'matching', element: <MatchingCenter /> },
      { path: 'interviews', element: <InterviewQuestions /> },
      { path: 'prompts', element: <Prompts /> },
      { path: 'llm-configs', element: <LLMConfigs /> },
    ],
  },
]);

export default router;
