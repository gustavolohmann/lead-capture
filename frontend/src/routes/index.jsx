import { Navigate, Route, Routes } from 'react-router-dom';
import Login from '../pages/Login/Login.jsx';
import MetaConnection from '../pages/MetaConnection/MetaConnection.jsx';
import Leads from '../pages/Leads/Leads.jsx';
import Campaigns from '../pages/Campaigns/Campaigns.jsx';
import CampaignObjectivePicker from '../pages/Campaigns/CampaignObjectivePicker.jsx';
import CampaignWizard from '../pages/Campaigns/CampaignWizard.jsx';
import CampaignMessagesWizard from '../pages/Campaigns/CampaignMessagesWizard.jsx';
import CampaignTrafficWizard from '../pages/Campaigns/CampaignTrafficWizard.jsx';
import Forms from '../pages/Forms/Forms.jsx';
import FormBuilder from '../pages/Forms/FormBuilder.jsx';
import FormPreview from '../pages/Forms/FormPreview.jsx';
import FormPublic from '../pages/Forms/FormPublic.jsx';
import Conversations from '../pages/Conversations/Conversations.jsx';
import Automations from '../pages/Automations/Automations.jsx';
import CampaignAutomation from '../pages/CampaignAutomation/CampaignAutomation.jsx';
import WhatsappTemplates from '../pages/WhatsappTemplates/WhatsappTemplates.jsx';
import AppLayout from '../layouts/AppLayout.jsx';
import { useAuth } from '../hooks/useAuth.js';

function PrivateRoute({ children }) {
  const { token } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function PublicOnlyRoute({ children }) {
  const { token } = useAuth();
  if (token) {
    return <Navigate to="/meta" replace />;
  }
  return children;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />

      <Route path="/f/:id" element={<FormPublic />} />

      <Route
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route path="/" element={<Navigate to="/meta" replace />} />
        <Route path="/meta" element={<MetaConnection />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/new" element={<CampaignObjectivePicker />} />
        <Route
          path="/campaigns/:campaignId/automation"
          element={<CampaignAutomation />}
        />
        <Route path="/campaigns/new/leads" element={<CampaignWizard />} />
        <Route
          path="/campaigns/new/messages"
          element={<CampaignMessagesWizard />}
        />
        <Route path="/campaigns/new/traffic" element={<CampaignTrafficWizard />} />
        <Route path="/forms" element={<Forms />} />
        <Route path="/forms/new" element={<FormBuilder />} />
        <Route path="/forms/:id" element={<FormBuilder />} />
        <Route path="/forms/:id/preview" element={<FormPreview />} />
        <Route path="/conversations" element={<Conversations />} />
        <Route path="/automations" element={<Automations />} />
        <Route path="/whatsapp/templates" element={<WhatsappTemplates />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
