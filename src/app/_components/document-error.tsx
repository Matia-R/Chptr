"use client"

interface DocumentErrorProps {
    title: string;
    message: string;
}

export function DocumentError({ title, message }: DocumentErrorProps) {
    return (
        <div className="rounded-lg bg-red-50 p-4">
            <h3 className="text-lg font-medium text-red-800">{title}</h3>
            <p className="mt-2 text-red-700">{message}</p>
        </div>
    )
} 