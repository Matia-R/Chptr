import { TRPCClientError } from "@trpc/client";

export type DocumentErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "INTERNAL_SERVER_ERROR";

export type DocumentConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected";

/** Close codes that mean this user cannot use this doc. Do not retry. */
export function isFatalDocumentCloseCode(code: number): boolean {
  return code === 4000 || code === 4003 || code === 4004;
}

export class DocumentAccessError extends Error {
  readonly code: DocumentErrorCode;

  constructor(code: DocumentErrorCode, message: string) {
    super(message);
    this.name = "DocumentAccessError";
    this.code = code;
  }
}

export function getDocumentErrorCode(error: unknown): DocumentErrorCode | undefined {
  if (error instanceof DocumentAccessError) {
    return error.code;
  }
  if (error instanceof TRPCClientError) {
    return (error.data as { code?: DocumentErrorCode } | undefined)?.code;
  }
  if (error instanceof Error && error.cause instanceof TRPCClientError) {
    return (error.cause.data as { code?: DocumentErrorCode } | undefined)?.code;
  }
  return undefined;
}
