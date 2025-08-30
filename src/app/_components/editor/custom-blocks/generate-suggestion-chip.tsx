import { LucideTable } from "lucide-react";

interface TableButtonProps {
  label: string;
  onClick?: () => void;
  variant?: "default" | "accent";
}

export const TableButton = ({ label, onClick, variant = "default" }: TableButtonProps) => {
  const baseClasses = "flex items-center gap-x-1 border shadow-sm rounded-sm p-1 text-xs w-fit cursor-pointer transition-colors";
  
  const variantClasses = variant === "accent" 
    ? "border-accent-foreground text-accent-foreground hover:bg-accent-foreground/10" 
    : "border-muted-foreground/20 text-muted-foreground hover:bg-muted-foreground/10";

  return (
    <div 
      className={`${baseClasses} ${variantClasses}`}
      onClick={onClick}
    >
      <LucideTable className="h-3 w-3" />
      <span>{label}</span>
    </div>
  );
};
