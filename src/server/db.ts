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

export async function persistDocumentSnapshot(documentId: string, snapshotData: Uint8Array) {
    const supabase = await createClient();
    
    // Convert Uint8Array to Buffer for BYTEA storage
    const buffer = Buffer.from(snapshotData);
    
    // Delete old snapshots for this document (keep only the latest)
    // This ensures we don't accumulate too many snapshots
    await supabase
        .from('document_updates')
        .delete()
        .eq('document_id', documentId);
    
    // Insert the new snapshot
    const { error } = await supabase
        .from('document_updates')
        .insert({
            document_id: documentId,
            update_data: buffer
        });

    if (error) {
        console.error('Failed to persist document snapshot:', error);
        throw new Error(`Failed to persist document snapshot: ${error.message}`);
    }
    
    return { success: true };
}

export async function getLatestDocumentSnapshot(documentId: string) {
    const supabase = await createClient();
    
    const { data, error } = await supabase
        .from('document_updates')
        .select('update_data, created_at')
        .eq('document_id', documentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        // If no snapshot exists, that's okay - return null
        if (error.code === 'PGRST116') {
            return { success: true, snapshot: null };
        }
        console.error('Failed to fetch document snapshot:', error);
        throw new Error(`Failed to fetch document snapshot: ${error.message}`);
    }
    
    // Convert Buffer to base64 string for tRPC transmission
    const buf: Buffer = data.update_data as Buffer;
    const snapshotBase64 = buf.toString("base64");
    
    return { success: true, snapshot: snapshotBase64 };
}
