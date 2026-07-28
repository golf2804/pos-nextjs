import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn("input aria-invalid:border-rose-500 aria-invalid:ring-4 aria-invalid:ring-rose-100 dark:aria-invalid:ring-rose-950/40", className)}
      {...props}
    />
  );
}

export { Input };
