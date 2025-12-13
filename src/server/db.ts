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
      console.log('[getLatestDocumentSnapshot] No snapshot found (PGRST116)');
      return { success: true, snapshot: null };
    }
    if (error) {
      console.error('[getLatestDocumentSnapshot] Error fetching snapshot:', error);
      throw new Error(`Failed to fetch latest snapshot: ${error.message}`);
    }
  
    // Ensure we return null if data is missing or update_data is null/undefined
    if (!data?.update_data) {
      console.log('[getLatestDocumentSnapshot] No update_data in response');
      return { success: true, snapshot: null };
    }
  
    // Log what we received
    const updateData: unknown = data.update_data;
    const updateDataType = typeof updateData;
    const isString = updateDataType === 'string';
    const constructorName = updateData && typeof updateData === 'object' && updateData !== null && 'constructor' in updateData
      ? (updateData as { constructor?: { name?: string } }).constructor?.name
      : undefined;
    
    console.log('[getLatestDocumentSnapshot] Received data:', {
      type: updateDataType,
      isString,
      isNull: updateData === null,
      isUndefined: updateData === undefined,
      constructor: constructorName,
      length: isString ? (updateData as string).length : 'N/A',
      preview: isString 
        ? (updateData as string).substring(0, 100) 
        : String(updateData).substring(0, 100),
    });
  
    // Ensure update_data is a string - if it's not, something went wrong
    if (!isString) {
      console.error('[getLatestDocumentSnapshot] update_data is not a string!', {
        type: updateDataType,
        value: String(updateData).substring(0, 100),
        constructor: constructorName,
      });
      // Don't try to convert - return null instead to avoid issues
      return { success: true, snapshot: null };
    }
  
    const snapshot = updateData as string;
    console.log('[getLatestDocumentSnapshot] Returning snapshot, length:', snapshot.length);
    return { success: true, snapshot };
  }
    
