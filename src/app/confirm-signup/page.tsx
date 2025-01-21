export default function ConfirmSignupPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
            <div className="max-w-md text-center">
                <h1 className="text-2xl font-bold mb-4">Check your email</h1>
                <p className="text-muted-foreground">
                    We&apos;ve sent you a confirmation link to your email address.
                    Please check your inbox and click the link to complete your registration.
                </p>
            </div>
        </div>
    );
}