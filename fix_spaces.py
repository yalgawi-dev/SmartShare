import sys

def modify_spaces():
    path = r'src/app/context/SpacesContext.tsx'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Space member status
    content = content.replace(
        "status?: 'active' | 'pending' | 'disputed';",
        "status?: 'active' | 'pending' | 'disputed' | 'extension_requested' | 'removed' | string;"
    )
    
    # SpaceMember additional fields
    content = content.replace(
        "joinedAt?: string;",
        "joinedAt?: string;\n  messages?: any[];\n  disputeResolved?: boolean;"
    )
    
    # SpaceSettings additional fields
    content = content.replace(
        "mySharePercentage?: number;",
        "mySharePercentage?: number;\n  customCategories?: string[];\n  isCustomShare?: boolean;"
    )
    
    # Invoice isActive
    content = content.replace(
        "invoiceNumber?: string;",
        "invoiceNumber?: string;\n  isActive?: boolean;"
    )
    
    # Space additional fields
    content = content.replace(
        "deletionScheduledFor?: string;",
        "deletionScheduledFor?: string;\n  creatorId?: string;\n  createdAt?: string;\n  pendingInvites?: any[];\n  masterKey?: string;\n  createdBy?: string;"
    )
    
    # AuditRecord actionType
    content = content.replace(
        "actionType: 'MEMBER_LEFT' | 'MEMBER_REMOVED' | 'SHARES_UPDATED' | 'AUTO_BALANCE' | 'EDIT_INVOICE' | 'DELETE_INVOICE' | 'OTHER';",
        "actionType: 'MEMBER_LEFT' | 'MEMBER_REMOVED' | 'SHARES_UPDATED' | 'AUTO_BALANCE' | 'EDIT_INVOICE' | 'DELETE_INVOICE' | 'OTHER' | 'SYSTEM_ALERT' | string;"
    )
    
    # addSpace signatures
    content = content.replace(
        "addSpace: (space: Omit<Space, 'id' | 'updatedAt' | 'settings' | 'invoices' | 'mediaItems' | 'date' | 'coverImage'>) => Promise<string>;",
        "addSpace: (space: Omit<Space, 'id' | 'updatedAt' | 'settings' | 'invoices' | 'mediaItems' | 'date' | 'coverImage' | 'members'>) => Promise<string>;"
    )
    content = content.replace(
        "addSpace = async (spaceData: Omit<Space, 'id' | 'updatedAt' | 'settings' | 'invoices' | 'mediaItems' | 'date' | 'coverImage'>): Promise<string> => {",
        "addSpace = async (spaceData: Omit<Space, 'id' | 'updatedAt' | 'settings' | 'invoices' | 'mediaItems' | 'date' | 'coverImage' | 'members'>): Promise<string> => {"
    )
    
    # SpacesContextType updateInvoice
    content = content.replace(
        "updateInvoice: (spaceId: string, invoiceId: string, updates: Partial<Invoice>, performedBy?: string, actionDetail?: string) => void;",
        "updateInvoice: (spaceId: string, invoiceId: string, updates: Partial<Invoice>, performedBy?: string, actionDetail?: string, chatMessage?: any) => void;"
    )
    
    # Additional SpacesContextType functions
    content = content.replace(
        "devResetSpace: (spaceId: string, currentUserId: string) => void;",
        "sendMessageToMember?: (spaceId: string, memberId: string, text: string, from: 'creator' | 'partner') => void;\n  markMessageRead?: (spaceId: string, memberId: string, messageId: string) => void;\n  approveExtension?: any;\n  setExtensionMessage?: any;\n  devResetSpace: (spaceId: string, currentUserId: string) => void;"
    )
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

modify_spaces()
