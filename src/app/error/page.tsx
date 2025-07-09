export default function ErrorPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
            <div className="max-w-md text-center">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold mb-4">
                        Oops! Something went wrong
                    </h1>
                    <p className="text-muted-foreground mb-8">
                        We&apos;re working on it, please try again later.
                    </p>
                </div>
            </div>
        </div>
    )
}