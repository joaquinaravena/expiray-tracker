"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatExpiryDate, getDaysRemaining } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type Product = {
  name: string;
  expiry_date: string;
};

export function DataTable({ products }: { products: Product[] }) {
  return (
    <div className="w-full overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Fecha vencimiento</TableHead>
            <TableHead className="text-right">Días restantes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                No hay productos.
              </TableCell>
            </TableRow>
          ) : (
            products.map((product) => {
              const days = getDaysRemaining(product.expiry_date);
              return (
                <TableRow key={`${product.name}-${product.expiry_date}`}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{formatExpiryDate(product.expiry_date)}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium",
                      days < 3 && "text-red-600 dark:text-red-400"
                    )}
                  >
                    {days}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
