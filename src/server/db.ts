import { createClient } from '~/utils/supabase/server'
import { randomUUID } from 'crypto'
import { type Document } from '~/server/api/routers/document'

type DocumentSchema = {
    id: string;
    creator_id: string;
    name: string;
    content?: Document['content'];
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
            content: []
        })
        .select()

    if (error) throw new Error(`Failed to create document: ${error.message}`)
    return { success: true, createdDocument: data }
}

export async function saveDocument(doc: Omit<Document, 'name'>) {
    const supabase = await createClient()

    console.log("Doc save time: ", doc.lastUpdated)

    const { error } = await supabase
        .from('documents')
        .upsert({
            id: doc.id,
            content: doc.content,
            last_updated: doc.lastUpdated
        })

    if (error) throw new Error(`Failed to save document: ${error.message}`)
    return { success: true }
}

export async function getDocumentById(documentId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('documents')
        .select('*')
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

    const supabase = await createClient()

    const { error } = await supabase
        .from('documents')
        .update({
            name,
            last_updated: new Date()
        })
        .eq('id', documentId)

    if (error) throw new Error(`Failed to update document name: ${error.message}`)
    return { success: true }
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

// Store snapshot as-is (base64)
export async function persistDocumentSnapshot(documentId: string, snapshotBase64: string) {
    const supabase = await createClient();
  
    await supabase.from("document_updates").delete().eq("document_id", documentId);
  
    const { error } = await supabase
      .from("document_updates")
      .insert({ document_id: documentId, update_data: snapshotBase64 });
  
    if (error) throw new Error(`Failed to persist snapshot: ${error.message}`);
    return { success: true };
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

  // Fetch latest snapshot
  export async function getLatestDocumentSnapshot(documentId: string) {
    const supabase = await createClient();
  
    const { data, error } = await supabase
      .from("document_updates")
      .select("update_data")
      .eq("document_id", documentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
  
    if (error?.code === "PGRST116") {
      return { success: true, snapshot: null };
    }
    if (error) {
      throw new Error(`Failed to fetch latest snapshot: ${error.message}`);
    }
  
    // Ensure we return null if data is missing or update_data is null/undefined
    if (!data?.update_data) {
      return { success: true, snapshot: null };
    }
  
    // Ensure update_data is a string
    if (typeof data.update_data !== 'string') {
      // If it's not a string, something is wrong - return null to avoid errors
      return { success: true, snapshot: null };
    }
  
    // Normalize to base64 (handles both hex and base64 formats)
    try {
      const normalizedBase64 = normalizeToBase64(data.update_data);
      return { success: true, snapshot: normalizedBase64 };
    } catch (err) {
      // If normalization fails, log and return null (document will start fresh)
      console.error('[getLatestDocumentSnapshot] Failed to normalize snapshot:', err);
      return { success: true, snapshot: null };
    }
  }
    
