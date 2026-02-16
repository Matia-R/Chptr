import { createClient } from '~/utils/supabase/server'
import { randomUUID } from 'crypto'
import { TRPCError } from '@trpc/server'

type DocumentSchema = {
    id: string;
    creator_id: string;
    name: string;
    last_updated?: Date;
}

type DocumentPermissionSchema = {
    id: string;
    user_id: string;
    document_id: string;
    permission: string;
}

type UserProfile = {
    updated_at: string,
    avatar_url: string,
    first_name: string,
    last_name: string,
    default_avatar_background_color: string,
};

export async function createDocument() {
    const supabase = await createClient()
    const currentUserId = (await supabase.auth.getUser()).data.user?.id

    const newDocumentId = randomUUID()

    const { data, error } = await supabase
        .from('documents')
        .insert({
            id: newDocumentId,
            creator_id: currentUserId,
            name: 'Untitled',
        })
        .select()

    if (error) throw new Error(`Failed to create document: ${error.message}`)
    return { success: true, createdDocument: data }
}

export async function getDocumentById(documentId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('documents')
        .select('id, creator_id, name, last_updated')
        .eq('id', documentId)
        .single() as { data: DocumentSchema | null, error: Error | null }

    if (error) throw new Error(`Failed to fetch document: ${error.message}`)
    return { success: true, document: data }
}

export async function getLastUpdatedTimestamp(documentId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('documents')
        .select('last_updated')
        .eq('id', documentId)
        .single() as { data: Pick<DocumentSchema, 'last_updated'> | null, error: Error | null }

    if (error) throw new Error(`Failed to fetch last updated timestamp: ${error.message}`)
    return { success: true, lastUpdated: data?.last_updated }
}

export const getDocumentIdsForUser = async () => {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
        .from('document_permissions')
        .select(`
            document_id,
            documents:document_id (
                name,
                last_updated
            )
        `)
        .eq('user_id', user?.id)
        .order('documents(last_updated)', { ascending: false }) as { data: (DocumentPermissionSchema & { documents: Pick<DocumentSchema, 'name' | 'last_updated'> })[] | null, error: Error | null }

    const documents = data?.map((permission) => ({
        id: permission.document_id,
        name: permission.documents.name
    }))

    if (error) throw new Error(`Failed to fetch documents for user: ${error.message}`)
    return { success: true, documents }
}

export async function updateDocumentName(documentId: string, name: string) {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
        });
    }

    // Check if document exists
    const { data: existingDoc, error: docError } = await supabase
        .from('documents')
        .select('id')
        .eq('id', documentId)
        .single();

    if (docError && docError.code !== 'PGRST116') {
        throw new Error(`Failed to check document: ${docError.message}`);
    }

    if (!existingDoc) {
        // Document doesn't exist - create it with the given name
        const { error: createError } = await supabase
            .from('documents')
            .insert({
                id: documentId,
                creator_id: user.id,
                name,
                last_updated: new Date()
            });

        if (createError && createError.code !== '23505') {
            throw new Error(`Failed to create document: ${createError.message}`);
        }

        // Create permission for the creator
        const { error: permError } = await supabase
            .from('document_permissions')
            .insert({
                user_id: user.id,
                document_id: documentId,
                permission: 'owner'
            });

        if (permError && permError.code !== '23505') {
            throw new Error(`Failed to create document permission: ${permError.message}`);
        }

        return { success: true, created: true };
    }

    // Document exists - check permission
    const { data: permission, error: permCheckError } = await supabase
        .from('document_permissions')
        .select('id')
        .eq('document_id', documentId)
        .eq('user_id', user.id)
        .single();

    if (permCheckError && permCheckError.code !== 'PGRST116') {
        throw new Error(`Failed to check permission: ${permCheckError.message}`);
    }

    if (!permission) {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have permission to edit this document',
        });
    }

    // Update the document name
    const { error: updateError } = await supabase
        .from('documents')
        .update({
            name,
            last_updated: new Date()
        })
        .eq('id', documentId);

    if (updateError) {
        throw new Error(`Failed to update document name: ${updateError.message}`);
    }

    return { success: true, created: false };
}

export async function getCurrentUser(): Promise<string | undefined> {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Not authenticated');
    return user.email;
}

export async function getCurrentUserProfile(): Promise<UserProfile | undefined> {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Not authenticated');
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single<UserProfile>();
    if (error) throw new Error('Failed to fetch user profile');
    return data;
}

/**
   * Converts hex-encoded string to ASCII string.
   * Used when hex is encoding a text string (like a base64 string).
   */
  function hexToAscii(hex: string): string {
    let cleanHex = hex;
    
    // Remove \x or 0x prefix if present
    if (hex.startsWith('\\x')) {
      cleanHex = hex.slice(2);
    } else if (hex.startsWith('0x') || hex.startsWith('0X')) {
      cleanHex = hex.slice(2);
    }
    
    // Remove whitespace
    cleanHex = cleanHex.replace(/\s/g, '');
    
    // Validate hex string
    if (cleanHex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(cleanHex)) {
      throw new Error('Invalid hex string');
    }
    
    // Convert hex to ASCII string
    let ascii = '';
    for (let i = 0; i < cleanHex.length; i += 2) {
      const byte = parseInt(cleanHex.substring(i, i + 2), 16);
      ascii += String.fromCharCode(byte);
    }
    
    return ascii;
  }

  /**
   * Normalizes snapshot data to base64 format.
   * If the data is hex-encoded, it's likely encoding a base64 string.
   * We decode hex to ASCII, and if that's base64, we use it directly.
   * If it's already base64, returns as-is.
   */
  function normalizeToBase64(data: string): string {
    const trimmed = data.trim();
    
    // Check if it's hex-encoded (starts with \x, 0x, or is pure hex)
    const hasHexPrefix = trimmed.startsWith('\\x') || 
                         trimmed.startsWith('0x') || 
                         trimmed.startsWith('0X');
    const isPureHex = /^[0-9a-fA-F]+$/.test(trimmed);
    const isHex = hasHexPrefix || isPureHex;
    
    // Check if it's base64
    const isBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(trimmed);
    
    if (isHex && !isBase64) {
      // It's hex, decode it to see what we get
      try {
        const decoded = hexToAscii(trimmed);
        
        // Check if the decoded string is base64
        const decodedIsBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(decoded);
        
        if (decodedIsBase64) {
          // Hex was encoding a base64 string, return it directly
          return decoded;
        } else {
          // Hex was encoding raw binary, convert to base64
          // This is unlikely but handle it for completeness
          const bytes = new Uint8Array(decoded.length);
          for (let i = 0; i < decoded.length; i++) {
            bytes[i] = decoded.charCodeAt(i);
          }
          
          let binary = '';
          for (const byte of bytes) {
            binary += String.fromCharCode(byte);
          }
          
          return btoa(binary);
        }
      } catch (err) {
        throw new Error(`Failed to convert hex to base64: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else if (isBase64) {
      // Already base64, return as-is
      return trimmed;
    } else {
      // Unknown format
      throw new Error(`Snapshot data is neither valid base64 nor valid hex. Preview: ${trimmed.substring(0, 50)}`);
    }
  }

// =============================================================================
// CRDT-based document changes (new approach)
// =============================================================================

/**
 * Save a single Yjs update to the document_changes table.
 * Uses unique constraint (document_id, client_id, clock) to prevent duplicates.
 * This allows every client to write every update they see (local or remote).
 */
export async function saveDocumentChange(
  documentId: string,
  clientId: string,
  clock: number,
  updateData: string
) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Not authenticated',
    });
  }

  // Check permission or create document if new
  const { data: permission } = await supabase
    .from('document_permissions')
    .select('id')
    .eq('document_id', documentId)
    .eq('user_id', user.id)
    .single();

  if (!permission) {
    // Check if document exists
    const { data: existingDoc } = await supabase
      .from('documents')
      .select('id')
      .eq('id', documentId)
      .single();

    if (existingDoc) {
      // Document exists but user has no permission
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this document',
      });
    }

    // Create new document (this is a new document)
    const { error: createError } = await supabase
      .from('documents')
      .insert({
        id: documentId,
        creator_id: user.id,
        name: 'Untitled',
      });

    if (createError && createError.code !== '23505') {
      throw new Error(`Failed to create document: ${createError.message}`);
    }

    // Create permission for the creator (required by RLS)
    const { error: permError } = await supabase
      .from('document_permissions')
      .insert({
        user_id: user.id,
        document_id: documentId,
        permission: 'owner'
      });

    if (permError && permError.code !== '23505') {
      throw new Error(`Failed to create document permission: ${permError.message}`);
    }
  }

  // Insert the change (unique constraint handles duplicates)
  const { error } = await supabase
    .from('document_changes')
    .insert({
      document_id: documentId,
      client_id: clientId,
      clock,
      update_data: updateData,
    });

  // Ignore duplicate key errors (23505) - this is expected with CRDT
  if (error && error.code !== '23505') {
    throw new Error(`Failed to save document change: ${error.message}`);
  }

  return { success: true };
}

/**
 * Batch save multiple Yjs updates at once.
 * More efficient than saving one at a time.
 */
export async function saveDocumentChanges(
  documentId: string,
  changes: Array<{ clientId: string; clock: number; updateData: string }>
) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Not authenticated',
    });
  }

  // Check permission or create document if new
  const { data: permission } = await supabase
    .from('document_permissions')
    .select('id')
    .eq('document_id', documentId)
    .eq('user_id', user.id)
    .single();

  if (!permission) {
    // Check if document exists
    const { data: existingDoc } = await supabase
      .from('documents')
      .select('id')
      .eq('id', documentId)
      .single();

    if (existingDoc) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this document',
      });
    }

    // Create new document
    const { error: createError } = await supabase
      .from('documents')
      .insert({
        id: documentId,
        creator_id: user.id,
        name: 'Untitled',
      });

    if (createError && createError.code !== '23505') {
      throw new Error(`Failed to create document: ${createError.message}`);
    }

    // Create permission for the creator (required by RLS)
    const { error: permError } = await supabase
      .from('document_permissions')
      .insert({
        user_id: user.id,
        document_id: documentId,
        permission: 'owner'
      });

    if (permError && permError.code !== '23505') {
      throw new Error(`Failed to create document permission: ${permError.message}`);
    }
  }

  // Batch insert (upsert to handle duplicates gracefully)
  const rows = changes.map(c => ({
    document_id: documentId,
    client_id: c.clientId,
    clock: c.clock,
    update_data: c.updateData,
  }));

  const { error } = await supabase
    .from('document_changes')
    .upsert(rows, { 
      onConflict: 'document_id,client_id,clock',
      ignoreDuplicates: true 
    });

  if (error) {
    throw new Error(`Failed to save document changes: ${error.message}`);
  }

  return { success: true, count: changes.length };
}

/**
 * Get all changes for a document to rebuild the CRDT state.
 * Returns changes ordered by creation time so they can be applied in order.
 */
export async function getDocumentChanges(documentId: string) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Not authenticated',
    });
  }

  // Check if document exists
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .single();

  if (docError?.code === 'PGRST116' || !doc) {
    // Document doesn't exist - return empty (new document)
    return { success: true, changes: [] };
  }

  // Check permission
  const { data: permission } = await supabase
    .from('document_permissions')
    .select('id')
    .eq('document_id', documentId)
    .eq('user_id', user.id)
    .single();

  if (!permission) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this document',
    });
  }

  // Fetch all changes ordered by creation time
  const { data, error } = await supabase
    .from('document_changes')
    .select('client_id, clock, update_data, created_at')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch document changes: ${error.message}`);
  }

  // Normalize the update data (handle hex encoding if present)
  const changes = (data ?? []).map((row: { 
    client_id: string; 
    clock: number; 
    update_data: string; 
    created_at: string;
  }) => ({
    clientId: row.client_id,
    clock: row.clock,
    updateData: normalizeToBase64(row.update_data),
    createdAt: row.created_at,
  }));

  return { success: true, changes };
}

