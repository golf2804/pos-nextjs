"use client";

import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { Barcode, LoaderCircle, Save, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadProductImage, type Product, type ProductFormInput } from "@/lib/products";

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor;
  }
}

const productSchema = z.object({
  sku: z.string().trim()
    .min(2, "SKU must contain at least 2 characters.")
    .max(64, "SKU must not exceed 64 characters.")
    .regex(/^[a-zA-Z0-9._-]+$/, "SKU can only contain letters, numbers, dots, underscores, and hyphens."),
  barcode: z.string().trim().max(64, "Barcode must not exceed 64 characters."),
  name: z.string().trim().min(2, "Product name must contain at least 2 characters.").max(160, "Product name must not exceed 160 characters."),
  description: z.string().trim().max(1000, "Description must not exceed 1,000 characters."),
  imageUrl: z.union([z.literal(""), z.url("Enter a valid image URL.")]),
  categoryId: z.string().min(1, "Select a category."),
  supplierId: z.string(),
  costPrice: z.number({ error: "Enter a valid cost price." }).min(0, "Cost price cannot be negative."),
  sellingPrice: z.number({ error: "Enter a valid selling price." }).min(0, "Selling price cannot be negative."),
  quantity: z.number({ error: "Enter a valid quantity." }).min(0, "Quantity cannot be negative."),
  minimumStock: z.number({ error: "Enter a valid minimum stock." }).min(0, "Minimum stock cannot be negative."),
  unit: z.string().trim().min(1, "Unit is required.").max(24, "Unit must not exceed 24 characters."),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

type ProductFormValues = z.infer<typeof productSchema>;
type Option = { id: string; name: string };

const emptyValues: ProductFormValues = {
  sku: "",
  barcode: "",
  name: "",
  description: "",
  imageUrl: "",
  categoryId: "",
  supplierId: "",
  costPrice: 0,
  sellingPrice: 0,
  quantity: 0,
  minimumStock: 0,
  unit: "pcs",
  status: "ACTIVE",
};

export function ProductForm({
  editing,
  categories,
  suppliers,
  pending,
  serverError,
  onSubmit,
  onCancel,
}: {
  editing: Product | null;
  categories: Option[];
  suppliers: Option[];
  pending: boolean;
  serverError: string;
  onSubmit: (input: ProductFormInput) => void;
  onCancel: () => void;
}) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: editing ? valuesFromProduct(editing) : emptyValues,
    mode: "onBlur",
  });
  const imageUrl = useWatch({ control: form.control, name: "imageUrl" });

  useEffect(() => () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
  }, []);

  async function uploadImage(file: File) {
    setMediaError("");
    if (file.size > 5 * 1024 * 1024) {
      setMediaError("Image must not exceed 5 MB.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setMediaError("Use a JPEG, PNG, WebP, or GIF image.");
      return;
    }
    try {
      const uploaded = await uploadProductImage(file);
      form.setValue("imageUrl", uploaded.url, { shouldDirty: true, shouldValidate: true });
    } catch {
      setMediaError("Image upload failed. Check your access and try again.");
      return;
    }
  }

  async function scanBarcode() {
    setMediaError("");
    if (!window.BarcodeDetector) {
      setMediaError("Barcode scanning is not supported in this browser. Enter it manually.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setScannerOpen(true);
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
      const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "code_128", "qr_code"] });
      const started = Date.now();
      const tick = async () => {
        if (!videoRef.current || Date.now() - started > 20_000) {
          stopScanner(stream);
          return;
        }
        const codes = await detector.detect(videoRef.current);
        if (codes[0]?.rawValue) {
          form.setValue("barcode", codes[0].rawValue, { shouldDirty: true, shouldValidate: true });
          stopScanner(stream);
          return;
        }
        window.requestAnimationFrame(() => void tick());
      };
      window.requestAnimationFrame(() => void tick());
    } catch {
      setMediaError("Camera access was denied or no camera is available.");
      setScannerOpen(false);
    }
  }

  function stopScanner(stream?: MediaStream) {
    const active = stream ?? (videoRef.current?.srcObject as MediaStream | null);
    active?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setScannerOpen(false);
  }

  const submit = form.handleSubmit((values) => {
    onSubmit({
      ...values,
      sku: values.sku.trim(),
      name: values.name.trim(),
      barcode: values.barcode.trim() || undefined,
      description: values.description.trim() || undefined,
      imageUrl: values.imageUrl || undefined,
      supplierId: values.supplierId || undefined,
      unit: values.unit.trim(),
    });
  });

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{editing ? "Update Product" : "Create Product"}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">SKU, pricing, stock, category, supplier, and image</p>
        </div>
        {editing && <Button type="button" variant="outline" size="icon" onClick={onCancel} title="Cancel edit"><X /></Button>}
      </div>
      <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
        <Field label="SKU" error={form.formState.errors.sku?.message}><Input placeholder="SKU-001" {...form.register("sku")} aria-invalid={Boolean(form.formState.errors.sku)} /></Field>
        <Field label="Barcode" error={form.formState.errors.barcode?.message}>
          <div className="flex gap-2"><Input placeholder="885..." {...form.register("barcode")} aria-invalid={Boolean(form.formState.errors.barcode)} /><Button type="button" variant="outline" size="icon" onClick={scanBarcode} title="Scan barcode"><Barcode /></Button></div>
        </Field>
        <Field label="Product Name" error={form.formState.errors.name?.message}><Input {...form.register("name")} aria-invalid={Boolean(form.formState.errors.name)} /></Field>
        <Field label="Description" error={form.formState.errors.description?.message}><textarea {...form.register("description")} aria-invalid={Boolean(form.formState.errors.description)} className="input min-h-20 py-2" /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category" error={form.formState.errors.categoryId?.message}><select {...form.register("categoryId")} aria-invalid={Boolean(form.formState.errors.categoryId)} className="input"><option value="">Select</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Supplier"><select {...form.register("supplierId")} className="input"><option value="">None</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cost Price" error={form.formState.errors.costPrice?.message}><Input type="number" min="0" step="0.01" {...form.register("costPrice", { valueAsNumber: true })} aria-invalid={Boolean(form.formState.errors.costPrice)} /></Field>
          <Field label="Selling Price" error={form.formState.errors.sellingPrice?.message}><Input type="number" min="0" step="0.01" {...form.register("sellingPrice", { valueAsNumber: true })} aria-invalid={Boolean(form.formState.errors.sellingPrice)} /></Field>
          <Field label="Quantity" error={form.formState.errors.quantity?.message}><Input type="number" min="0" step="0.0001" disabled={Boolean(editing)} {...form.register("quantity", { valueAsNumber: true })} aria-invalid={Boolean(form.formState.errors.quantity)} /></Field>
          <Field label="Minimum Stock" error={form.formState.errors.minimumStock?.message}><Input type="number" min="0" step="0.0001" {...form.register("minimumStock", { valueAsNumber: true })} aria-invalid={Boolean(form.formState.errors.minimumStock)} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Unit" error={form.formState.errors.unit?.message}><Input {...form.register("unit")} aria-invalid={Boolean(form.formState.errors.unit)} /></Field>
          <Field label="Status"><select {...form.register("status")} className="input"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></Field>
        </div>
        <Field label="Product Image" error={form.formState.errors.imageUrl?.message}>
          <div className="flex gap-2"><Input placeholder="https://..." {...form.register("imageUrl")} aria-invalid={Boolean(form.formState.errors.imageUrl)} /><label className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700" title="Upload image"><Upload className="size-4" /><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => event.target.files?.[0] && void uploadImage(event.target.files[0])} /></label></div>
        </Field>
        {imageUrl && <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-2 dark:bg-slate-800"><Image src={imageUrl} alt="Product preview" width={56} height={56} className="size-14 rounded-md object-cover" /><span className="text-xs text-slate-500 dark:text-slate-400">Image ready</span></div>}
        {scannerOpen && <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 dark:border-cyan-900 dark:bg-cyan-950/30"><video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full rounded-lg bg-slate-950" /><Button type="button" variant="outline" size="sm" onClick={() => stopScanner()} className="mt-2">Stop scan</Button></div>}
        {(mediaError || serverError) && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{mediaError || serverError}</p>}
        <Button disabled={pending} className="h-11 w-full">{pending ? <LoaderCircle className="animate-spin" /> : <Save />}{editing ? "Save Changes" : "Create Product"}</Button>
      </form>
    </article>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700 dark:text-slate-200"><span>{label}</span><div className="mt-2">{children}</div>{error && <span role="alert" className="mt-1.5 block text-xs text-rose-600 dark:text-rose-300">{error}</span>}</label>;
}

function valuesFromProduct(product: Product): ProductFormValues {
  return {
    sku: product.sku,
    barcode: product.barcode ?? "",
    name: product.name,
    description: product.description ?? "",
    imageUrl: product.imageUrl ?? "",
    categoryId: product.category.id,
    supplierId: product.supplier?.id ?? "",
    costPrice: product.costPrice,
    sellingPrice: product.sellingPrice,
    quantity: product.quantity,
    minimumStock: product.minimumStock,
    unit: product.unit,
    status: product.status === "ARCHIVED" ? "INACTIVE" : product.status,
  };
}
