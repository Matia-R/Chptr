import { createCaller } from "~/server/api/root";

import { headers } from "next/headers";
import { createTRPCContext } from "~/server/api/trpc";

export const getTrpcCaller = async () => {
    const headersList = await headers();
    const heads = new Headers();
    for (const [key, value] of headersList.entries()) {
        heads.set(key, value);
    }
    heads.set("x-trpc-source", "rsc");
    const context = await createTRPCContext({ headers: heads });
    return createCaller(context);
}