import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

export default function WorkspaceSettings() {
  const { orgId } = useParams();
  // Redirect to the new permissions page since this old settings page was superseded
  return <Navigate to={`/workspace/${orgId}/settings/permissions`} replace />;
}
