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

export async function createDocument() {
    const supabase = await createClient()
    const currentUserId = (await supabase.auth.getUser()).data.user?.id

    const newDocumentId = randomUUID()

    const newDocumentContent = [{
        id: "1",
        type: "heading",
        props: {
            textColor: "default",
            backgroundColor: "default",
            textAlignment: "left",
            level: 1
        },
        content: [
            {
                type: "text",
                text: "Untitled",
                styles: {}
            }
        ],
        children: []
    }]

    const { data, error } = await supabase
        .from('documents')
        .insert({
            id: newDocumentId,
            creator_id: currentUserId,
            name: 'Untitled',
            content: newDocumentContent
        })
        .select()

    if (error) throw new Error(`Failed to create document: ${error.message}`)
    return { success: true, createdDocument: data }
}

export async function saveDocument(doc: Document) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('documents')
        .upsert({
            id: doc.id,
            name: doc.name,
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

export const getDocumentsForUser = async () => {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
        .from('document_permissions')
        .select(`
            document_id,
            documents:document_id (
                name
            )
        `)
        .eq('user_id', user?.id) as { data: (DocumentPermissionSchema & { documents: Pick<DocumentSchema, 'name'> })[] | null, error: Error | null }

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
        .update({ name })
        .eq('id', documentId)

    if (error) throw new Error(`Failed to update document name: ${error.message}`)
    return { success: true }
}
