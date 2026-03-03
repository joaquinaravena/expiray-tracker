"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatExpiryDate, getDaysRemaining, cn } from "@/lib/utils";
import type { TrackerData } from "@/lib/utils";

export function TrackerTables({ data }: { data: TrackerData }) {
  const { vencimientos, vencidos, fallados } = data;

  return (
    <Tabs defaultValue="vencimientos" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="vencimientos">Vencimientos</TabsTrigger>
        <TabsTrigger value="vencidos">Vencidos</TabsTrigger>
        <TabsTrigger value="fallados">Fallados (solo vista)</TabsTrigger>
      </TabsList>

      <TabsContent value="vencimientos" className="mt-4">
        <div className="w-full overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Días restantes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vencimientos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No hay productos en vencimientos.
                  </TableCell>
                </TableRow>
              ) : (
                vencimientos.map((row, i) => {
                  const days = getDaysRemaining(row.vencimiento);
                  return (
                    <TableRow key={`v-${i}-${row.producto}-${row.vencimiento}`}>
                      <TableCell className="font-medium">{row.producto}</TableCell>
                      <TableCell>{formatExpiryDate(row.vencimiento)}</TableCell>
                      <TableCell>{row.categoria}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium",
                          days < 3 && "text-red-600 dark:text-red-400",
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
      </TabsContent>

      <TabsContent value="vencidos" className="mt-4">
        <div className="w-full overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artículo</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Fecha vencida</TableHead>
                <TableHead className="text-right">Cant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vencidos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No hay productos vencidos.
                  </TableCell>
                </TableRow>
              ) : (
                vencidos.map((row, i) => (
                  <TableRow key={`vd-${i}-${row.articulo}-${row.fecha_venci}`}>
                    <TableCell className="font-medium">{row.articulo}</TableCell>
                    <TableCell>{row.descripcion}</TableCell>
                    <TableCell>
                      {row.fecha_venci ? formatExpiryDate(row.fecha_venci) : ""}
                    </TableCell>
                    <TableCell className="text-right">{row.cant}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <TabsContent value="fallados" className="mt-4">
        <div className="w-full overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artículo</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Cant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fallados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                    No hay productos fallados.
                  </TableCell>
                </TableRow>
              ) : (
                fallados.map((row, i) => (
                  <TableRow key={`f-${i}-${row.articulo}`}>
                    <TableCell className="font-medium">{row.articulo}</TableCell>
                    <TableCell>{row.descripcion}</TableCell>
                    <TableCell className="text-right">{row.cant}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
    </Tabs>
  );
}
