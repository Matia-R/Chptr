/** Values stored in `document_permissions.permission` that may mutate a document. */
const WRITE_PERMISSIONS = new Set(["editor", "owner"]);

export function canWrite(permission: string | null | undefined): boolean {
  return permission != null && WRITE_PERMISSIONS.has(permission);
}
