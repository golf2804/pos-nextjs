import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(input: string) {
    const q = input.trim();
    if (q.length < 2) {
      return { products: [], categories: [], suppliers: [], transactions: [] };
    }

    const [products, categories, suppliers, transactions] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          status: { not: "ARCHIVED" },
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
            { barcode: { contains: q, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          quantity: true,
          unit: true,
        },
        orderBy: { name: "asc" },
        take: 5,
      }),
      this.prisma.category.findMany({
        where: {
          status: { not: "ARCHIVED" },
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, description: true },
        orderBy: { name: "asc" },
        take: 5,
      }),
      this.prisma.supplier.findMany({
        where: {
          status: { not: "ARCHIVED" },
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, email: true, phone: true },
        orderBy: { name: "asc" },
        take: 5,
      }),
      this.prisma.inventoryTransaction.findMany({
        where: {
          OR: [
            { documentNumber: { contains: q, mode: "insensitive" } },
            { referenceNumber: { contains: q, mode: "insensitive" } },
            { receiver: { contains: q, mode: "insensitive" } },
            { department: { contains: q, mode: "insensitive" } },
            { items: { some: { product: {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { sku: { contains: q, mode: "insensitive" } },
              ],
            } } } },
          ],
        },
        select: {
          id: true,
          documentNumber: true,
          type: true,
          transactionDate: true,
          items: {
            select: { product: { select: { name: true, sku: true } } },
            take: 1,
          },
        },
        orderBy: { transactionDate: "desc" },
        take: 5,
      }),
    ]);

    return {
      products: products.map((item) => ({ ...item, quantity: Number(item.quantity) })),
      categories,
      suppliers,
      transactions,
    };
  }
}
