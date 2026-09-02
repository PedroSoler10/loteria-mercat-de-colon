type Props = {
  title: string
  description: string
}

export function PlaceholderTab({ title, description }: Props) {
  return (
    <section className="flex min-h-96 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card text-center shadow-sm">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="max-w-md text-pretty text-muted-foreground">{description}</p>
    </section>
  )
}
