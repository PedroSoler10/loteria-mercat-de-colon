import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }
type OriginPatch = {
  idOrigen?: string
  nombre?: string
  tipoOrigen?: string
  fechaCarga?: string
  pdfPath?: string | null
  pdfChecksum?: string | null
}

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params
  const body = (await request.json()) as OriginPatch
  const idOrigen = body.idOrigen?.trim() || id
  const nombre = body.nombre?.trim()
  const tipoOrigen = body.tipoOrigen?.trim()
  const fechaCarga = body.fechaCarga ? new Date(body.fechaCarga) : undefined
  if (!nombre) return Response.json({ error: 'El nombre de la carga no puede estar vacío' }, { status: 400 })
  if (!tipoOrigen) return Response.json({ error: 'El tipo de origen no puede estar vacío' }, { status: 400 })
  if (!/^[-A-Za-z0-9_]+$/.test(idOrigen)) return Response.json({ error: 'El ID de origen solo puede contener letras, números, guiones y guiones bajos' }, { status: 400 })
  if (fechaCarga && Number.isNaN(fechaCarga.getTime())) return Response.json({ error: 'La fecha de carga no es válida' }, { status: 400 })

  try {
    const origin = await prisma.origen.update({
      where: { idOrigen: id },
      data: {
        idOrigen,
        nombreAlbaran: nombre,
        tipoOrigen,
        fechaHoraCarga: fechaCarga,
        pdfPath: body.pdfPath?.trim() || null,
        pdfChecksum: body.pdfChecksum?.trim() || null,
      },
    })
    return Response.json({
      idOrigen: origin.idOrigen,
      nombre: origin.nombreAlbaran,
      tipoOrigen: origin.tipoOrigen,
      fechaCarga: origin.fechaHoraCarga.toISOString(),
      pdfPath: origin.pdfPath,
      pdfChecksum: origin.pdfChecksum,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo modificar la carga'
    return Response.json({ error: message }, { status: message.includes('Record to update not found') ? 404 : 409 })
  }
}

export async function DELETE(request: Request, context: Context) {
  const { id } = await context.params
  const deleteSales = new URL(request.url).searchParams.get('deleteSales') === 'true'

  try {
    await prisma.$transaction(async (tx) => {
      const origin = await tx.origen.findUnique({ where: { idOrigen: id }, select: { idOrigen: true } })
      if (!origin) throw new Error('La carga no existe')

      const salesCount = await tx.venta.count({ where: { boleto: { is: { idOrigen: id } } } })
      if (salesCount > 0 && !deleteSales) {
        const error = new Error('La carga tiene ventas asociadas') as Error & { salesCount?: number }
        error.salesCount = salesCount
        throw error
      }
      if (deleteSales) await tx.venta.deleteMany({ where: { boleto: { is: { idOrigen: id } } } })

      await tx.origen.update({ where: { idOrigen: id }, data: { deletedAt: new Date() } })
    })
    return Response.json({ idOrigen: id, deleted: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo eliminar la carga'
    const salesCount = error && typeof error === 'object' && 'salesCount' in error ? (error as { salesCount?: number }).salesCount : undefined
    return Response.json({ error: message, salesCount }, { status: message === 'La carga no existe' ? 404 : 409 })
  }
}
