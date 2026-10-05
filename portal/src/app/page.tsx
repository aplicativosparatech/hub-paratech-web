import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-24 bg-slate-50">
      <div className="max-w-3xl text-center flex flex-col items-center space-y-6">
        <img src="/logo.png" alt="Paratech Logo" className="h-32 object-contain" />
        <h1 className="text-5xl font-bold tracking-tight text-slate-900">
          Hub Paratech
        </h1>
        <p className="text-xl text-slate-600">
          Portal de Gerenciamento de Clientes, Contabilidades e Sincronização de XML.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/login" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition">
            Acessar Sistema
          </Link>
        </div>
      </div>
    </main>
  )
}
