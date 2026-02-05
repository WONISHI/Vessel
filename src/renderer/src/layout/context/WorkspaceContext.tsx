import { createContext, useContext } from 'react';

interface WorkspaceContextType {
    workspace: any;
    activeFilePath: string;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const useWorkspace = () => {
    const context = useContext(WorkspaceContext);
    if (!context) throw new Error('useWorkspace must be used within LayoutSide');
    return context;
};

export { WorkspaceContext };